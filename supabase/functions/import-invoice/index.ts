import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ExtractedLineItem {
  productName: string;
  variety: string;
  quantity: number;
  unit: string;
  stemsPerUnit: number;
  linePrice: number;
}

const EXTRACTION_PROMPT = `You are an expert at reading floral wholesaler invoices. Extract every product line item from this invoice.

For each line item, extract:
- productName: The flower or product name (e.g., "Roses", "Carnations", "Glass Vase")
- variety: Any variety, color, or length info (e.g., "Freedom Red 50cm") — empty string if none
- quantity: Number of units (e.g., 5 bunches, 10 stems)
- unit: The unit type — one of "stem", "bunch", or "box"
- stemsPerUnit: How many stems per unit (e.g., 25 stems per bunch) — use 1 if the unit is "stem" or if not specified
- linePrice: Total price for that line in dollars (not cents)

Rules:
- Only extract product line items, not headers, totals, shipping, tax, or footer text
- If a line is ambiguous or you cannot confidently identify it as a product, skip it
- Convert all prices to dollars (e.g., $15.00 = 15.00, not 1500)
- If stemsPerUnit is not explicitly listed, use 1 for stems, and for bunches try to infer from context (e.g., "25 ct bunch" = 25). If truly unknown, use 1
- Return ONLY a JSON object with this exact shape: { "lineItems": [...] }
- If the document is not an invoice or is unreadable, return { "lineItems": [], "error": "Could not read invoice" }
- Do not include any text outside the JSON object`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured. Please contact support." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller identity
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await anonClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an owner
    const { data: callerProfile, error: profileError } = await anonClient
      .from("profiles")
      .select("account_role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.account_role !== "owner") {
      return new Response(JSON.stringify({ error: "Only shop owners can import invoices" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
    const fileName = file.name.toLowerCase();
    const isAllowedType = allowedTypes.includes(file.type) ||
      fileName.endsWith(".pdf") || fileName.endsWith(".png") || fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") || fileName.endsWith(".webp") || fileName.endsWith(".heic");

    if (!isAllowedType) {
      return new Response(JSON.stringify({ error: "Unsupported file type. Please upload a PDF or image (PNG, JPG, WebP)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 20MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Upload to private storage (owner-scoped path)
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const storagePath = `${callerUser.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await serviceClient.storage
      .from("invoice-imports")
      .upload(storagePath, fileBytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to store invoice file." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare file for Gemini API
    const base64Data = btoa(String.fromCharCode(...fileBytes));
    const mimeType = file.type || (fileName.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    // Call Gemini 2.0 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI extraction service returned an error. Please try again." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      return new Response(JSON.stringify({ error: "AI could not extract any data from this invoice. Please try a clearer photo or PDF." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { lineItems?: ExtractedLineItem[]; error?: string };
    try {
      parsed = JSON.parse(textContent);
    } catch {
      console.error("Gemini returned non-JSON:", textContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "AI returned unparseable data. Please try again with a clearer file." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsed.error) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineItems = parsed.lineItems || [];

    if (lineItems.length === 0) {
      return new Response(JSON.stringify({ error: "No product line items found in this invoice. Make sure the file is a valid invoice with product lines." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and sanitize each line item
    const sanitized: ExtractedLineItem[] = lineItems
      .filter((item: any) => item && item.productName && typeof item.productName === "string")
      .map((item: any) => ({
        productName: String(item.productName).trim(),
        variety: String(item.variety || "").trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit: ["stem", "bunch", "box"].includes(item.unit) ? item.unit : "stem",
        stemsPerUnit: Math.max(1, Number(item.stemsPerUnit) || 1),
        linePrice: Math.max(0, Number(item.linePrice) || 0),
      }));

    if (sanitized.length === 0) {
      return new Response(JSON.stringify({ error: "No valid product lines could be extracted from this invoice." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ lineItems: sanitized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("import-invoice error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred while processing the invoice." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

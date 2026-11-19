import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
const GEMINI_FALLBACK_MODEL = Deno.env.get("GEMINI_FALLBACK_MODEL") || "";
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

function encodeBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function geminiErrorMessage(status: number, errText: string): string {
  try {
    const parsed = JSON.parse(errText);
    const msg = parsed?.error?.message || "";
    if (status === 400 && /api key|api_key|API_KEY/i.test(msg)) {
      return "Invalid Gemini API key. Check the GEMINI_API_KEY secret in Supabase.";
    }
    if (status === 404 || /not found|not supported/i.test(msg)) {
      return `Model "${GEMINI_MODEL}" was not found. Check the GEMINI_MODEL secret — it may have been retired. Current stable: gemini-3.8-flash`;
    }
    if (status === 400 && /mime type|unsupported/i.test(msg)) {
      return "Unsupported file type for the AI model. Try a standard JPG or PDF.";
    }
    if (msg) return `AI service error: ${msg}`;
  } catch { /* not JSON */ }
  if (status === 400) return "Bad request to AI service. The file may be corrupted or in an unsupported format.";
  if (status === 403) return "Gemini API key does not have permission for this model. Check your Google AI Studio key settings.";
  if (status === 429) return "Gemini API rate limit reached. Wait a moment and try again.";
  if (status >= 500) return "Gemini service is temporarily unavailable. Please try again.";
  return `AI service returned error ${status}.`;
}

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

    // Prepare file for Gemini API — encode in chunks to avoid call-stack limits on large files
    const base64Data = encodeBase64(fileBytes);
    const mimeType = file.type || (fileName.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

    // Call Gemini API with configurable model
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

    const RETRY_DELAYS = [2000, 5000, 10000];
    const TRANSIENT_RE = /overloaded|high demand|temporarily|try again later/i;

    function isTransientError(status: number, errText: string): boolean {
      return status === 429 || status >= 500 || TRANSIENT_RE.test(errText);
    }

    async function callGemini(model: string): Promise<{ response: Response; transient: boolean; errText: string; status: number }> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });
      if (response.ok) return { response, transient: false, errText: "", status: response.status };
      const errText = await response.text();
      return { response, transient: isTransientError(response.status, errText), errText, status: response.status };
    }

    let geminiResponse: Response | null = null;
    let lastErrText = "";
    let lastStatus = 0;

    // Try primary model with up to 3 retries (delays: 2s, 5s, 10s)
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      const result = await callGemini(GEMINI_MODEL);
      if (!result.transient) {
        if (result.response.ok) {
          geminiResponse = result.response;
          break;
        }
        // Non-transient error — return specific message immediately
        console.error("Gemini API error:", result.status, result.errText);
        const userMsg = geminiErrorMessage(result.status, result.errText);
        return new Response(JSON.stringify({ error: userMsg }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      lastErrText = result.errText;
      lastStatus = result.status;

      if (attempt < RETRY_DELAYS.length) {
        console.warn(`Gemini transient error (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}), retrying in ${RETRY_DELAYS[attempt]}ms:`, result.status);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }

    // If primary model exhausted retries, try fallback model once
    if (!geminiResponse && GEMINI_FALLBACK_MODEL) {
      console.warn(`Primary model "${GEMINI_MODEL}" exhausted retries (last status ${lastStatus}). Trying fallback "${GEMINI_FALLBACK_MODEL}"...`);
      const fallbackResult = await callGemini(GEMINI_FALLBACK_MODEL);
      if (fallbackResult.response.ok) {
        geminiResponse = fallbackResult.response;
      } else {
        console.error("Fallback model also failed:", fallbackResult.status, fallbackResult.errText);
      }
    }

    if (!geminiResponse) {
      return new Response(JSON.stringify({
        error: "The invoice reader is busy right now. Please try again in a few minutes. Nothing was saved.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse!.json();
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
    const detail = err instanceof Error ? err.message : String(err);
    let userMsg = "An unexpected error occurred while processing the invoice.";
    if (/Maximum call stack|too many arguments/i.test(detail)) {
      userMsg = "The file is too large to process. Try a smaller image (under 10MB) or a PDF.";
    } else if (/fetch|network|connect|dns|timeout/i.test(detail)) {
      userMsg = "Could not reach the AI service. Check your network connection and try again.";
    } else if (detail) {
      userMsg = `Processing error: ${detail}`;
    }
    return new Response(JSON.stringify({ error: userMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

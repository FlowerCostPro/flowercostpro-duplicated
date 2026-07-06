import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function stripeRequest(path: string, method: string, body?: Record<string, unknown>) {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const encodedBody = body
    ? Object.entries(flattenForStripe(body))
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&")
    : undefined;

  const res = await fetch(url, { method, headers, body: encodedBody });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Stripe error");
  return data;
}

function flattenForStripe(obj: Record<string, unknown>, prefix = ""): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && value !== undefined) {
      if (typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, flattenForStripe(value as Record<string, unknown>, fullKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (typeof item === "object") {
            Object.assign(result, flattenForStripe(item as Record<string, unknown>, `${fullKey}[${i}]`));
          } else {
            result[`${fullKey}[${i}]`] = item as string | number;
          }
        });
      } else {
        result[fullKey] = value as string | number;
      }
    }
  }
  return result;
}

async function getOrCreatePrice(): Promise<string> {
  // List products and find FlowerCostPro
  const products = await stripeRequest("/products?limit=100&active=true", "GET");

  let productId: string;
  const existing_product = products.data?.find(
    (p: { name: string }) => p.name === "FlowerCostPro"
  );
  if (existing_product) {
    productId = existing_product.id;
  } else {
    const product = await stripeRequest("/products", "POST", {
      name: "FlowerCostPro",
      description:
        "Floral business management software - unlimited designers, real time budget building, inventory tracking, low stock alerts, photo records, profit analytics, and one click POS copy",
    });
    productId = product.id;
  }

  // Find active $25/month price for this product
  const prices = await stripeRequest(
    `/prices?product=${productId}&active=true&type=recurring&limit=10`,
    "GET"
  );
  const existingPrice = prices.data?.find(
    (p: { unit_amount: number; currency: string; recurring?: { interval: string } }) =>
      p.unit_amount === 2500 && p.currency === "usd" && p.recurring?.interval === "month"
  );
  if (existingPrice) return existingPrice.id;

  const price = await stripeRequest("/prices", "POST", {
    product: productId,
    unit_amount: "2500",
    currency: "usd",
    "recurring[interval]": "month",
  });
  return price.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId, email, setupOnly } = await req.json();
    if (!userId || !email) {
      return new Response(JSON.stringify({ error: "userId and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get or create Stripe customer, validating against current Stripe environment
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    let customerId: string;
    if (profile?.stripe_customer_id) {
      const existing = await fetch(
        `https://api.stripe.com/v1/customers/${profile.stripe_customer_id}`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
      );
      if (existing.ok) {
        customerId = profile.stripe_customer_id;
      } else {
        const customer = await stripeRequest("/customers", "POST", {
          email,
          metadata: { supabase_user_id: userId },
        });
        customerId = customer.id;
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);
      }
    } else {
      const customer = await stripeRequest("/customers", "POST", {
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const origin = req.headers.get("origin") ?? "https://flowercostpro.com";

    // Setup-only mode: collect a payment method without creating a subscription.
    // The saved card will be charged automatically when the trial ends.
    if (setupOnly) {
      const session = await stripeRequest("/checkout/sessions", "POST", {
        customer: customerId,
        mode: "setup",
        currency: "usd",
        success_url: `${origin}?payment_method=saved`,
        cancel_url: `${origin}`,
      });
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine trial length: 30 days for feedback submitters, 14 for everyone else
    const { data: feedbackRow } = await supabase
      .from("beta_feedback")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    const trialDays = feedbackRow ? 30 : 14;

    const priceId = await getOrCreatePrice();

    const session = await stripeRequest("/checkout/sessions", "POST", {
      customer: customerId,
      mode: "subscription",
      currency: "usd",
      payment_method_collection: "if_required",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { supabase_user_id: userId, trial_days: trialDays },
      },
      success_url: `${origin}?checkout=success`,
      cancel_url: `${origin}?checkout=cancelled`,
    });

    // Record trial start in profiles
    await supabase
      .from("profiles")
      .update({
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", userId);

    return new Response(JSON.stringify({ url: session.url, trialDays }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

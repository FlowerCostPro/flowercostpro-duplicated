import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_VERSION = "2024-06-20";

async function stripeRequest(path: string, method: string, body?: Record<string, string>) {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": STRIPE_VERSION,
  };

  const encodedBody = body
    ? Object.entries(body)
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join("&")
    : undefined;

  const res = await fetch(url, { method, headers, body: encodedBody });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`Stripe API ${method} ${path} failed: ${data.error?.message ?? "unknown error"}`) as any;
    err.stripeError = data.error;
    throw err;
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Check if coupon already exists
    const coupons = await stripeRequest("/coupons?limit=100", "GET");
    let coupon = coupons.data?.find(
      (c: any) => c.name === "Founding Florist" && c.amount_off === 1000 && c.currency === "usd"
    );

    let couponCreated = false;
    if (!coupon) {
      coupon = await stripeRequest("/coupons", "POST", {
        amount_off: "1000",
        currency: "usd",
        duration: "repeating",
        duration_in_months: "12",
        name: "Founding Florist",
        "metadata[purpose]": "founding_tester_discount",
      });
      couponCreated = true;
    }

    // 2. Check if promotion code already exists for this coupon
    const promoCodes = await stripeRequest(`/promotion_codes?coupon=${coupon.id}&limit=10`, "GET");
    let promoCode = promoCodes.data?.find(
      (p: any) => p.code === "FOUNDINGFLORIST"
    );

    let promoCreated = false;
    if (!promoCode) {
      promoCode = await stripeRequest("/promotion_codes", "POST", {
        coupon: String(coupon.id),
        code: "FOUNDINGFLORIST",
        max_redemptions: "20",
        active: "true",
        "metadata[purpose]": "founding_tester_discount",
      });
      promoCreated = true;
    }

    return new Response(JSON.stringify({
      success: true,
      couponCreated,
      promoCreated,
      coupon: {
        id: coupon.id,
        name: coupon.name,
        amount_off: coupon.amount_off,
        currency: coupon.currency,
        duration: coupon.duration,
        duration_in_months: coupon.duration_in_months,
        times_redeemed: coupon.times_redeemed,
        max_redemptions: coupon.max_redemptions,
      },
      promotionCode: {
        id: promoCode.id,
        code: promoCode.code,
        active: promoCode.active,
        max_redemptions: promoCode.max_redemptions,
        times_redeemed: promoCode.times_redeemed,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("setup-coupon-v2 error:", err.message, err.stripeError ? JSON.stringify(err.stripeError) : "");
    return new Response(JSON.stringify({ error: err.message, stripeError: err.stripeError }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
  if (!timestamp || !v1) return false;

  // Reject events older than 5 minutes to prevent replay attacks
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    console.error(`Webhook timestamp too old: ${age}s`);
    return false;
  }

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === v1;
}

async function stripeRequest(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${body}`);
  }
  return res.json();
}

// Update a profile by Stripe customer ID, falling back to supabase_user_id from metadata.
// This handles the case where stripe_customer_id hasn't been saved to the profile yet
// (e.g., the checkout.session.completed event arrives before the create-checkout-session
// function finishes saving the customer ID).
async function updateProfile(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
  update: Record<string, string | null>,
  supabaseUserId?: string
) {
  // First try matching by stripe_customer_id
  let { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", customerId)
    .select("id");

  if (error) {
    console.error("DB update error (by customer_id):", error);
  }

  // If no rows matched and we have a supabase_user_id, try matching by user ID
  if ((!data || data.length === 0) && supabaseUserId) {
    const { error: err2 } = await supabase
      .from("profiles")
      .update({ ...update, stripe_customer_id: customerId })
      .eq("id", supabaseUserId);
    if (err2) console.error("DB update error (by user_id):", err2);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let body: string;
  try {
    body = await req.text();
  } catch (err) {
    console.error("Failed to read request body:", err);
    return new Response(JSON.stringify({ error: "Could not read body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify webhook signature when secret is configured
  if (STRIPE_WEBHOOK_SECRET) {
    const sig = req.headers.get("stripe-signature") ?? "";
    let valid: boolean;
    try {
      valid = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Signature verification error:", err);
      valid = false;
    }
    if (!valid) {
      console.error("Invalid Stripe webhook signature. Verify STRIPE_WEBHOOK_SECRET matches the signing secret shown in Stripe Dashboard > Developers > Webhooks for this endpoint.");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch (err) {
    console.error("Failed to parse webhook body as JSON:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  console.log(`Processing Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (!subscriptionId) break;

        const sub = await stripeRequest(`/subscriptions/${subscriptionId}`);
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
        const supabaseUserId = sub.metadata?.supabase_user_id ?? session.metadata?.supabase_user_id;

        await updateProfile(supabase, customerId, {
          stripe_subscription_id: subscriptionId,
          subscription_status: sub.status,
          trial_ends_at: trialEnd,
        }, supabaseUserId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
        const subscribedAt = sub.status === "active" ? new Date().toISOString() : null;
        const supabaseUserId = sub.metadata?.supabase_user_id;

        const update: Record<string, string | null> = {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          trial_ends_at: trialEnd,
        };
        if (subscribedAt) update.subscribed_at = subscribedAt;

        await updateProfile(supabase, sub.customer, update, supabaseUserId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const supabaseUserId = sub.metadata?.supabase_user_id;
        await updateProfile(supabase, sub.customer, {
          subscription_status: "canceled",
        }, supabaseUserId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason === "subscription_cycle") {
          await updateProfile(supabase, invoice.customer, {
            subscription_status: "active",
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        await updateProfile(supabase, invoice.customer, {
          subscription_status: "past_due",
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    // Still return 200 for events we received but couldn't fully process,
    // to prevent Stripe from retrying indefinitely on transient DB errors.
    // The error is logged above for investigation.
    return new Response(JSON.stringify({ received: true, warning: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

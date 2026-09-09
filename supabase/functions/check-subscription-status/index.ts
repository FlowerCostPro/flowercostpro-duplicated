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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileError } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subscriptionId, customerId } = await req.json();

    if (!subscriptionId && !customerId) {
      return new Response(JSON.stringify({ error: "subscriptionId or customerId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: HeadersInit = { Authorization: `Bearer ${STRIPE_SECRET_KEY}` };

    let sub: any = null;

    if (subscriptionId) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${subscriptionId}?expand[]=latest_invoice`,
        { headers }
      );
      if (subRes.ok) {
        sub = await subRes.json();
      } else {
        const err = await subRes.text();
        return new Response(JSON.stringify({ error: `Failed to fetch subscription: ${err}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (customerId) {
      const subListRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customerId}&limit=5&expand[]=data.latest_invoice`,
        { headers }
      );
      if (subListRes.ok) {
        const subList = await subListRes.json();
        sub = subList.data?.[0] ?? null;
      } else {
        const err = await subListRes.text();
        return new Response(JSON.stringify({ error: `Failed to list subscriptions: ${err}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!sub) {
      return new Response(JSON.stringify({ error: "No subscription found for this customer" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let latestInvoice: any = null;
    if (sub.latest_invoice) {
      const invoiceId = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice.id;
      const invRes = await fetch(
        `https://api.stripe.com/v1/invoices/${invoiceId}?expand[]=payment_intent`,
        { headers }
      );
      if (invRes.ok) {
        latestInvoice = await invRes.json();
      }
    }

    const result = {
      subscription: {
        id: sub.id,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        trial_end: sub.trial_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: sub.canceled_at,
        collection_method: sub.collection_method,
      },
      latest_invoice: latestInvoice
        ? {
            id: latestInvoice.id,
            number: latestInvoice.number,
            status: latestInvoice.status,
            paid: latestInvoice.paid,
            amount_due: latestInvoice.amount_due,
            currency: latestInvoice.currency,
            created: latestInvoice.created,
            billing_reason: latestInvoice.billing_reason,
            attempt_count: latestInvoice.attempt_count,
            next_payment_attempt: latestInvoice.next_payment_attempt,
            charge_id: latestInvoice.charge,
            payment_intent: latestInvoice.payment_intent
              ? {
                  id: latestInvoice.payment_intent.id,
                  status: latestInvoice.payment_intent.status,
                  amount: latestInvoice.payment_intent.amount,
                  last_payment_error: latestInvoice.payment_intent.last_payment_error,
                }
              : null,
          }
        : null,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-subscription-status error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the caller's JWT
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm caller is an admin — bypasses RLS via service role
    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all auth users (carries last_sign_in_at which is not in profiles)
    const { data: authData, error: authListError } = await serviceClient.auth.admin.listUsers({
      perPage: 1000,
    });
    if (authListError) throw authListError;
    const authUserMap = new Map(authData.users.map((u) => [u.id, u]));

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, email, created_at, subscription_status, trial_ends_at, subscribed_at, is_admin");
    if (profilesError) throw profilesError;

    // Count orders per user in one query
    const { data: orderRows, error: ordersError } = await serviceClient
      .from("orders")
      .select("user_id");
    if (ordersError) throw ordersError;
    const orderCountMap: Record<string, number> = {};
    for (const row of orderRows ?? []) {
      orderCountMap[row.user_id] = (orderCountMap[row.user_id] ?? 0) + 1;
    }

    // Collect feedback submitter emails for O(1) lookup
    const { data: feedbackRows } = await serviceClient
      .from("beta_feedback")
      .select("email");
    const feedbackEmails = new Set(
      (feedbackRows ?? []).map((f: { email: string }) => f.email.toLowerCase().trim())
    );

    // Merge everything
    const users = (profiles ?? []).map((p) => {
      const authUser = authUserMap.get(p.id);
      return {
        id: p.id,
        email: p.email,
        createdAt: p.created_at,
        subscriptionStatus: p.subscription_status ?? "trialing",
        trialEndsAt: p.trial_ends_at ?? null,
        subscribedAt: p.subscribed_at ?? null,
        lastSignIn: authUser?.last_sign_in_at ?? null,
        orderCount: orderCountMap[p.id] ?? 0,
        hasFeedback: feedbackEmails.has((p.email ?? "").toLowerCase().trim()),
        isAdmin: p.is_admin ?? false,
      };
    });

    // Newest signup first
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-admin-data error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

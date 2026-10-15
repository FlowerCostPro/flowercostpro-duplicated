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

    // Handle POST actions (restart trial, delete account)
    if (req.method === "POST") {
      const body = await req.json();
      const action = body.action;

      if (action === "restart_trial") {
        const targetUserId: string = body.userId;
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "Missing userId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch the target profile to check subscription status
        const { data: targetProfile, error: targetError } = await serviceClient
          .from("profiles")
          .select("subscription_status, account_role")
          .eq("id", targetUserId)
          .single();

        if (targetError || !targetProfile) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Never restart trial for paying subscribers
        if (targetProfile.subscription_status === "active" || targetProfile.subscription_status === "past_due") {
          return new Response(JSON.stringify({ error: "Cannot restart trial for a paying subscriber" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Set trial_ends_at to 14 days from now, reset status to trialing
        const newTrialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const { error: updateError } = await serviceClient
          .from("profiles")
          .update({
            trial_ends_at: newTrialEnd,
            subscription_status: "trialing",
          })
          .eq("id", targetUserId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, newTrialEnd }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "delete_account") {
        const targetUserId: string = body.userId;
        const confirmEmail: string = (body.confirmEmail ?? "").toLowerCase().trim();
        if (!targetUserId || !confirmEmail) {
          return new Response(JSON.stringify({ error: "Missing userId or confirmEmail" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Fetch the target profile to verify email and check subscription status
        const { data: targetProfile, error: targetError } = await serviceClient
          .from("profiles")
          .select("email, subscription_status")
          .eq("id", targetUserId)
          .single();

        if (targetError || !targetProfile) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Never delete paying subscribers
        if (targetProfile.subscription_status === "active" || targetProfile.subscription_status === "past_due") {
          return new Response(JSON.stringify({ error: "Cannot delete a paying subscriber" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify the confirmation email matches
        const targetEmail = (targetProfile.email ?? "").toLowerCase().trim();
        if (targetEmail !== confirmEmail) {
          return new Response(JSON.stringify({ error: "Email does not match" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete the auth user (cascades to profiles and user-scoped data via FK)
        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUserId);
        if (deleteError) throw deleteError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET — fetch all admin data
    // Fetch all auth users (carries last_sign_in_at which is not in profiles)
    const { data: authData, error: authListError } = await serviceClient.auth.admin.listUsers({
      perPage: 1000,
    });
    if (authListError) throw authListError;
    const authUserMap = new Map(authData.users.map((u) => [u.id, u]));

    // Fetch all profiles (include account_role and owner_id so staff can inherit owner status)
    const { data: profiles, error: profilesError } = await serviceClient
      .from("profiles")
      .select("id, email, created_at, subscription_status, trial_ends_at, subscribed_at, is_admin, account_role, owner_id");
    if (profilesError) throw profilesError;

    // Build a lookup map for resolving staff -> owner subscription status
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

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

    // Merge everything. Staff inherit their owner's subscription status.
    const users = (profiles ?? []).map((p) => {
      const authUser = authUserMap.get(p.id);
      let subStatus = p.subscription_status ?? "trialing";
      let trialEnds = p.trial_ends_at ?? null;
      let subscribedAt = p.subscribed_at ?? null;

      if (p.account_role === "staff" && p.owner_id) {
        const owner = profileMap.get(p.owner_id);
        if (owner) {
          subStatus = owner.subscription_status ?? "trialing";
          trialEnds = owner.trial_ends_at ?? null;
          subscribedAt = owner.subscribed_at ?? null;
        }
      }

      return {
        id: p.id,
        email: p.email,
        createdAt: p.created_at,
        subscriptionStatus: subStatus,
        trialEndsAt: trialEnds,
        subscribedAt: subscribedAt,
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

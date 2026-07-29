import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || url.pathname.split("/").pop();

    if (action === "lookup") {
      const { token } = await req.json();
      if (!token) {
        return new Response(JSON.stringify({ error: "Token is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await adminClient.rpc("get_staff_invite_by_token", {
        p_token: token,
      });

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired invite" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { token, password, fullName } = await req.json();
      if (!token || !password || !fullName) {
        return new Response(
          JSON.stringify({ error: "token, password, and fullName are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate the invite first — no account is created if the token is invalid.
      const { data: invite, error: inviteError } = await adminClient.rpc(
        "get_staff_invite_by_token",
        { p_token: token }
      );

      if (inviteError || !invite || !invite.id) {
        return new Response(
          JSON.stringify({ error: "This invitation link is invalid, has already been used, or has expired." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if a user with this email already exists (e.g. previously removed staff).
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === invite.email.toLowerCase()
      );

      let staffUserId: string;

      if (existing) {
        // Re-link existing user: update password and metadata with staff role.
        const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
          existing.id,
          {
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
              account_role: "staff",
              owner_id: invite.owner_id,
            },
          }
        );

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        staffUserId = updated.user.id;
      } else {
        // Create the auth user with staff role in metadata so handle_new_user
        // trigger writes account_role='staff' and does NOT create sample products.
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: invite.email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            account_role: "staff",
            owner_id: invite.owner_id,
          },
        });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        staffUserId = newUser.user.id;
      }

      // Ensure the profile row has the correct role and owner_id.
      // The trigger should have set this, but upsert as a safety net.
      const { error: linkError } = await adminClient
        .from("profiles")
        .upsert({
          id: staffUserId,
          account_role: "staff",
          owner_id: invite.owner_id,
          full_name: fullName,
          email: invite.email,
        })
        .eq("id", staffUserId);

      if (linkError) {
        if (!existing) {
          await adminClient.auth.admin.deleteUser(staffUserId);
        }
        return new Response(
          JSON.stringify({ error: "Failed to link staff account to shop" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark the invite as accepted — only after the account is fully created and linked.
      const { error: acceptError } = await adminClient.rpc("accept_staff_invite", {
        p_token: token,
        p_user_id: staffUserId,
      });

      if (acceptError) {
        // The account was created and linked, but the invite wasn't marked accepted.
        // This is not a failure for the user — they can still sign in.
        console.error("Failed to mark invite accepted:", acceptError.message);
      }

      return new Response(
        JSON.stringify({
          id: staffUserId,
          email: invite.email,
          fullName,
          ownerId: invite.owner_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "accept") {
      // Legacy action — kept for backward compatibility but should not be used
      // for new account creation. Use "create" instead.
      const { token, userId } = await req.json();
      if (!token || !userId) {
        return new Response(
          JSON.stringify({ error: "Token and userId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await adminClient.rpc("accept_staff_invite", {
        p_token: token,
        p_user_id: userId,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ownerId: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use ?action=lookup, ?action=create, or ?action=accept" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

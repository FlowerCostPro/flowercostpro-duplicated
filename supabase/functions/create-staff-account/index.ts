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
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use anon client to verify the calling user's identity
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: callerError } = await anonClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an owner (account_role = 'owner')
    const { data: callerProfile, error: profileError } = await anonClient
      .from("profiles")
      .select("account_role")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.account_role !== "owner") {
      return new Response(JSON.stringify({ error: "Only shop owners can create staff accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(JSON.stringify({ error: "email, password, and fullName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to create the staff auth user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if a user with this email already exists (e.g. previously removed staff)
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    let staffUserId: string;

    if (existing) {
      // Re-link existing user: update password and metadata, then relink profile
      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
        existing.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            account_role: "staff",
            owner_id: callerUser.id,
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
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          account_role: "staff",
          owner_id: callerUser.id,
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

    // The handle_new_user trigger will have created the profile.
    // Now explicitly ensure owner_id and account_role are set correctly.
    // Use upsert in case the profile row was deleted when staff was removed.
    const { error: linkError } = await adminClient
      .from("profiles")
      .upsert({
        id: staffUserId,
        account_role: "staff",
        owner_id: callerUser.id,
        full_name: fullName,
        email: email.trim().toLowerCase(),
      })
      .eq("id", staffUserId);

    if (linkError) {
      // Only roll back if we created a new user (not re-linking)
      if (!existing) {
        await adminClient.auth.admin.deleteUser(staffUserId);
      }
      return new Response(JSON.stringify({ error: "Failed to link staff to shop" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: staffUserId,
        email: email.trim().toLowerCase(),
        fullName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

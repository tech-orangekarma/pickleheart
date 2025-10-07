// Email-only login/upsert function
// Creates or updates a user with the default password and auto-confirms the email
// WARNING: This is intentionally insecure per product request. Do not use in production.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const admin = createClient(supabaseUrl!, serviceRoleKey!);

const DEFAULT_PASSWORD = "pickle";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { email } = await req.json().catch(() => ({ email: undefined }));

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to create user first; if already exists, update password
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    // Created successfully
    if (!createError && created?.user?.id) {
      return new Response(
        JSON.stringify({ ok: true, exists: false, user_id: created.user.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If creation failed (likely because the user already exists), try to find by email and update password
    if (createError) {
      console.log("[email-login] createUser failed, attempting update path:", createError.message);
    }

    // Fallback: list users in pages and find by email (avoids direct HTTP calls)
    let foundUserId: string | null = null;
    for (let page = 1; page <= 5 && !foundUserId; page++) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) {
        console.error("[email-login] Failed to list users:", listError);
        break;
      }
      const users = list?.users ?? [] as any[];
      const match = users.find((u: any) => u?.email?.toLowerCase() === email.toLowerCase());
      if (match) {
        foundUserId = match.id ?? null;
        break;
      }
      if (!users.length) {
        // No more users
        break;
      }
    }

    if (!foundUserId) {
      console.error("[email-login] Unable to locate user by email after createUser failure");
      return new Response(
        JSON.stringify({ error: "User lookup failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update existing user's password and confirm email
    const { error: updateError } = await admin.auth.admin.updateUserById(foundUserId, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (updateError) {
      console.error("[email-login] Failed to update user password:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, exists: true, user_id: foundUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
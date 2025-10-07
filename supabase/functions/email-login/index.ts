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

const DEFAULT_PASSWORD = "pickleheart2024";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { email } = await req.json().catch(() => ({ email: undefined }));

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1) Try to create the user (auto-confirmed)
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (!createError) {
      return new Response(
        JSON.stringify({ ok: true, created: true, user_id: created.user?.id }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2) If already exists, find user by email via GoTrue Admin API and update password
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        headers: {
          apikey: serviceRoleKey!,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to look up user by email" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload = await res.json();
    const user = payload?.users?.[0] ?? null;

    if (!user?.id) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, created: false, user_id: user.id }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
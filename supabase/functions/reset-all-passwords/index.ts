// One-time admin function to reset all user passwords to the default
// WARNING: This is a security risk in production. Only for development/testing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const admin = createClient(supabaseUrl!, serviceRoleKey!);

const DEFAULT_PASSWORD = "pickleheart2024";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    console.log("Starting password reset for all users...");

    // Get all users
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${users?.length || 0} users`);

    const results = [];
    for (const user of users || []) {
      console.log(`Updating password for user: ${user.email} (${user.id})`);
      
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });

      if (updateError) {
        console.error(`Failed to update user ${user.email}:`, updateError);
        results.push({ user_id: user.id, email: user.email, success: false, error: updateError.message });
      } else {
        console.log(`Successfully updated user ${user.email}`);
        results.push({ user_id: user.id, email: user.email, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Password reset complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: users?.length || 0,
        updated: successCount,
        failed: failCount,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Unexpected error", details: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
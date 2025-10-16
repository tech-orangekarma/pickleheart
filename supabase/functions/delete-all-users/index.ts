// Admin function to delete all users
// WARNING: This is destructive and should only be used in development/testing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const admin = createClient(supabaseUrl!, serviceRoleKey!);

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
    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Starting deletion of all users...");

    // Get all users
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${users?.length || 0} users to delete`);

    const results = [];
    for (const user of users || []) {
      console.log(`Deleting user: ${user.email} (${user.id})`);
      
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error(`Failed to delete user ${user.email}:`, deleteError);
        results.push({ user_id: user.id, email: user.email, success: false, error: deleteError.message });
      } else {
        console.log(`Successfully deleted user ${user.email}`);
        results.push({ user_id: user.id, email: user.email, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Deletion complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: users?.length || 0,
        deleted: successCount,
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

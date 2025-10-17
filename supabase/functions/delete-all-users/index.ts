// Admin function to delete all users (except current admin)
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

    const currentUserId = user.id;
    console.log("Starting deletion of all users (except current admin)...");

    // Get all users
    const { data: { users }, error: listError } = await admin.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${users?.length || 0} users to process`);

    const results = {
      deleted: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    for (const authUser of users || []) {
      // Skip current admin user
      if (authUser.id === currentUserId) {
        results.skipped++;
        results.details.push({
          userId: authUser.id,
          email: authUser.email,
          status: 'skipped',
          reason: 'current admin user'
        });
        console.log(`Skipped current admin user: ${authUser.email}`);
        continue;
      }

      console.log(`Deleting user: ${authUser.email} (${authUser.id})`);
      
      const { error: deleteError } = await admin.auth.admin.deleteUser(authUser.id);

      if (deleteError) {
        console.error(`Failed to delete user ${authUser.email}:`, deleteError);
        results.failed++;
        results.errors.push(deleteError.message);
        results.details.push({ 
          userId: authUser.id, 
          email: authUser.email, 
          status: 'failed',
          error: deleteError.message 
        });
      } else {
        console.log(`Successfully deleted user ${authUser.email}`);
        results.deleted++;
        results.details.push({ 
          userId: authUser.id, 
          email: authUser.email, 
          status: 'deleted' 
        });
      }
    }

    console.log(`Deletion complete. Deleted: ${results.deleted}, Skipped: ${results.skipped}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify(results),
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

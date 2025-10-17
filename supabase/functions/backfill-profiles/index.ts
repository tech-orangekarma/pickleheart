import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting profile backfill for auth users missing profiles...');

    const results = {
      created: 0,
      already_existing: 0,
      errors: [] as string[],
    };

    // Paginate through all auth users
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: authUsers, error: listError } = await admin.auth.admin.listUsers({
        page: page,
        perPage: pageSize,
      });

      if (listError) {
        console.error('Error listing auth users:', listError);
        results.errors.push(`Failed to list users page ${page}: ${listError.message}`);
        break;
      }

      if (!authUsers || authUsers.users.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing page ${page} with ${authUsers.users.length} users`);

      for (const authUser of authUsers.users) {
        try {
          // Check if profile exists
          const { data: existingProfile } = await admin
            .from('profiles')
            .select('id')
            .eq('id', authUser.id)
            .maybeSingle();

          if (existingProfile) {
            results.already_existing++;
            continue;
          }

          // Extract display name from metadata or email
          const metadata = authUser.user_metadata || {};
          let displayName = metadata.display_name || metadata.full_name;
          
          if (!displayName && authUser.email) {
            // Use email local part as fallback
            displayName = authUser.email.split('@')[0];
          }

          // Create profile
          const { error: insertError } = await admin
            .from('profiles')
            .insert({
              id: authUser.id,
              display_name: displayName || 'User',
            });

          if (insertError) {
            console.error(`Failed to create profile for ${authUser.id}:`, insertError);
            results.errors.push(`User ${authUser.id}: ${insertError.message}`);
          } else {
            results.created++;
            if (results.created <= 10) {
              console.log(`Created profile for user ${authUser.id} (${displayName})`);
            }
          }
        } catch (err: any) {
          console.error(`Error processing user ${authUser.id}:`, err);
          results.errors.push(`User ${authUser.id}: ${err.message}`);
        }
      }

      page++;
      if (authUsers.users.length < pageSize) {
        hasMore = false;
      }
    }

    console.log('Backfill complete:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

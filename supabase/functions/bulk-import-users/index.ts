import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    const { users } = await req.json();

    console.log(`Starting bulk import of ${users.length} users`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      skipped_users: [] as string[],
    };

    for (const userData of users) {
      try {
        const email = `${userData.display_name.toLowerCase().replace(/\s+/g, '.')}@pickleheart.app`;
        
        // Check if user with this email already exists
        const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
        const userExists = existingUsers?.users?.some(u => u.email === email);
        
        if (userExists) {
          console.log(`User ${userData.display_name} already exists, skipping`);
          results.skipped++;
          results.skipped_users.push(userData.display_name);
          continue;
        }

        const password = `temp${Math.random().toString(36).slice(2)}`;

        // Create auth user
        const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: userData.display_name,
            first_name: userData.first_name,
            last_name: userData.last_name,
          },
        });

        if (authError) {
          console.error(`Failed to create auth user for ${userData.display_name}:`, authError);
          results.failed++;
          results.errors.push(`${userData.display_name}: ${authError.message}`);
          continue;
        }

        // Create profile
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .insert({
            id: authUser.user.id,
            display_name: userData.display_name,
            first_name: userData.first_name,
            last_name: userData.last_name,
            gender: userData.gender,
            birthday: userData.birthday,
            dupr_rating: parseFloat(userData.dupr_rating),
          });

        if (profileError) {
          console.error(`Failed to create profile for ${userData.display_name}:`, profileError);
          results.failed++;
          results.errors.push(`${userData.display_name}: Profile creation failed`);
          continue;
        }

        // Create user_parks
        if (userData.favorite_park_id) {
          const { error: parksError } = await supabaseClient
            .from('user_parks')
            .insert({
              user_id: authUser.user.id,
              favorite_park_id: userData.favorite_park_id || null,
              park2_id: userData.park2_id || null,
              park3_id: userData.park3_id || null,
            });

          if (parksError) {
            console.error(`Failed to create user_parks for ${userData.display_name}:`, parksError);
          }
        }

        // Map mode from CSV to friend_finder_mode enum
        let mode = 'receive_all';
        if (userData.mode === 'Auto-Friend (all)') {
          mode = 'everyone';
        }

        // Create friend_finder_settings
        const { error: settingsError } = await supabaseClient
          .from('friend_finder_settings')
          .insert({
            user_id: authUser.user.id,
            mode,
            min_age: parseInt(userData.min_age) || 18,
            max_age: parseInt(userData.max_age) || 100,
            gender_filter: userData.gender_filter || 'all',
            min_rating: parseFloat(userData.min_rating) || 2.0,
            max_rating: parseFloat(userData.max_rating) || 5.0,
          });

        if (settingsError) {
          console.error(`Failed to create friend_finder_settings for ${userData.display_name}:`, settingsError);
        }

        results.success++;
        console.log(`Successfully created user: ${userData.display_name}`);
      } catch (error) {
        console.error(`Error processing user ${userData.display_name}:`, error);
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${userData.display_name}: ${errorMessage}`);
      }
    }

    console.log(`Bulk import complete: ${results.success} success, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in bulk-import-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

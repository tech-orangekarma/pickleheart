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

    // Build a complete map of existing auth users by email and collect all users
    const emailToUserId = new Map<string, string>();
    const allAuthUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data: authUsers } = await supabaseClient.auth.admin.listUsers({ page, perPage });
      if (!authUsers?.users || authUsers.users.length === 0) break;
      
      for (const authUser of authUsers.users) {
        allAuthUsers.push(authUser);
        if (authUser.email) {
          emailToUserId.set(authUser.email.toLowerCase(), authUser.id);
        }
      }
      
      if (authUsers.users.length < perPage) break;
      page++;
    }

    console.log(`Found ${emailToUserId.size} existing auth users`);

    // Build displayName lookup map
    const displayNameToUserId = new Map<string, string>();
    for (const authUser of allAuthUsers) {
      const metadata = authUser.user_metadata || {};
      const displayName = metadata.display_name || metadata.full_name;
      if (displayName) {
        const normalized = displayName.trim().toLowerCase();
        displayNameToUserId.set(normalized, authUser.id);
      }
    }
    console.log(`Found ${displayNameToUserId.size} users with display names`);

    // Normalize gender values to satisfy DB check constraint gender_check
    const normalizeGender = (g: string | null | undefined): 'male' | 'female' | 'prefer_not_to_say' | null => {
      const val = String(g ?? '').trim().toLowerCase();
      if (!val) return null;
      if (["male", "m", "man", "boy"].includes(val)) return "male";
      if (["female", "f", "woman", "girl"].includes(val)) return "female";
      if (["non-binary", "nonbinary", "non binary", "nb", "genderqueer", "gender nonconforming"].includes(val)) return "prefer_not_to_say";
      if (["prefer not to say", "prefer_not_to_say", "unspecified", "unknown", "n/a", "na"].includes(val)) return "prefer_not_to_say";
      return null; // fallback to null to pass CHECK constraint
    };

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
      unmatched: [] as string[],
    };

    for (const userData of users) {
      try {
        const derivedEmail = `${userData.display_name.toLowerCase().replace(/\s+/g, '')}@pickleheart.com`;
        let existingUserId = emailToUserId.get(derivedEmail);
        
        // If not found by email, try display name
        if (!existingUserId) {
          const normalizedName = userData.display_name.trim().toLowerCase();
          existingUserId = displayNameToUserId.get(normalizedName);
        }

        // Map mode from CSV to friend_finder_mode enum
        let mode = 'receive_all';
        if (userData.mode === 'Auto-Friend (all)') {
          mode = 'everyone';
        }

        if (existingUserId) {
          // User exists - upsert profile and settings
          console.log(`Updating existing user: ${userData.display_name}`);

          // Upsert profile
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
              id: existingUserId,
              display_name: userData.display_name,
              first_name: userData.first_name,
              last_name: userData.last_name,
              gender: normalizeGender(userData.gender),
              birthday: userData.birthday || null,
              dupr_rating: userData.dupr_rating ? parseFloat(userData.dupr_rating) : null,
            }, { onConflict: 'id' });

          if (profileError) {
            console.error(`Failed to upsert profile for ${userData.display_name}:`, profileError);
            results.failed++;
            results.errors.push(`${userData.display_name}: Profile upsert failed - ${profileError.message}`);
            continue;
          }

          // Upsert user_parks
          if (userData.favorite_park_id) {
            const { error: parksError } = await supabaseClient
              .from('user_parks')
              .upsert({
                user_id: existingUserId,
                favorite_park_id: userData.favorite_park_id || null,
                park2_id: userData.park2_id || null,
                park3_id: userData.park3_id || null,
              }, { onConflict: 'user_id' });

            if (parksError) {
              console.error(`Failed to upsert user_parks for ${userData.display_name}:`, parksError);
            }
          }

          // Upsert friend_finder_settings
          const { error: settingsError } = await supabaseClient
            .from('friend_finder_settings')
            .upsert({
              user_id: existingUserId,
              mode,
              min_age: userData.min_age ? parseInt(userData.min_age) : 18,
              max_age: userData.max_age ? parseInt(userData.max_age) : 100,
              gender_filter: userData.gender_filter || 'all',
              min_rating: userData.min_rating ? parseFloat(userData.min_rating) : 2.0,
              max_rating: userData.max_rating ? parseFloat(userData.max_rating) : 5.0,
            }, { onConflict: 'user_id' });

          if (settingsError) {
            console.error(`Failed to upsert friend_finder_settings for ${userData.display_name}:`, settingsError);
          }

          results.updated++;
          console.log(`Successfully updated user: ${userData.display_name}`);
        } else {
          // Not found by email or display name - create new user
          console.log(`Creating new user: ${userData.display_name}`);
          const password = `temp${Math.random().toString(36).slice(2)}`;

          const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email: derivedEmail,
            password,
            email_confirm: true,
            user_metadata: {
              display_name: userData.display_name,
              first_name: userData.first_name,
              last_name: userData.last_name,
            },
          });

          if (createError) {
            // Check if user already exists but wasn't in our map
            if (createError.message?.includes('already registered') || createError.message?.includes('duplicate')) {
              console.log(`User ${userData.display_name} already exists, attempting to find and update...`);
              // Refresh email map by checking if user was just created
              existingUserId = emailToUserId.get(derivedEmail);
              if (!existingUserId) {
                // Try a single page lookup
                const { data: freshUsers } = await supabaseClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
                const foundUser = freshUsers?.users?.find(u => u.email?.toLowerCase() === derivedEmail);
                if (foundUser) {
                  existingUserId = foundUser.id;
                } else {
                  results.failed++;
                  results.errors.push(`${userData.display_name}: ${createError.message}`);
                  results.unmatched.push(userData.display_name);
                  continue;
                }
              }
              // Fall through to update logic below with existingUserId
            } else {
              console.error(`Error creating user ${userData.display_name}:`, createError);
              results.failed++;
              results.errors.push(`${userData.display_name}: ${createError.message}`);
              continue;
            }
          }

          const userId = existingUserId || newUser?.user?.id;
          if (!userId) {
            results.failed++;
            results.errors.push(`${userData.display_name}: No user ID available`);
            continue;
          }

          const isUpdate = !!existingUserId;

          // Insert/upsert profile
          const { error: profileError } = await supabaseClient
            .from('profiles')
            .upsert({
              id: userId,
              display_name: userData.display_name,
              first_name: userData.first_name,
              last_name: userData.last_name,
              gender: normalizeGender(userData.gender),
              birthday: userData.birthday || null,
              dupr_rating: userData.dupr_rating ? parseFloat(userData.dupr_rating) : null,
            }, { onConflict: 'id' });

          if (profileError) {
            console.error(`Failed to create profile for ${userData.display_name}:`, profileError);
            results.failed++;
            results.errors.push(`${userData.display_name}: Profile creation failed`);
            continue;
          }

          // Insert/upsert user_parks
          if (userData.favorite_park_id) {
            const { error: parksError } = await supabaseClient
              .from('user_parks')
              .upsert({
                user_id: userId,
                favorite_park_id: userData.favorite_park_id || null,
                park2_id: userData.park2_id || null,
                park3_id: userData.park3_id || null,
              }, { onConflict: 'user_id' });

            if (parksError) {
              console.error(`Failed to create user_parks for ${userData.display_name}:`, parksError);
            }
          }

          // Insert/upsert friend_finder_settings
          const { error: settingsError } = await supabaseClient
            .from('friend_finder_settings')
            .upsert({
              user_id: userId,
              mode,
              min_age: userData.min_age ? parseInt(userData.min_age) : 18,
              max_age: userData.max_age ? parseInt(userData.max_age) : 100,
              gender_filter: userData.gender_filter || 'all',
              min_rating: userData.min_rating ? parseFloat(userData.min_rating) : 2.0,
              max_rating: userData.max_rating ? parseFloat(userData.max_rating) : 5.0,
            }, { onConflict: 'user_id' });

          if (settingsError) {
            console.error(`Failed to create friend_finder_settings for ${userData.display_name}:`, settingsError);
          }

          if (isUpdate) {
            results.updated++;
            console.log(`Updated user: ${userData.display_name}`);
          } else {
            results.created++;
            console.log(`Created user: ${userData.display_name}`);
          }
        }
      } catch (error) {
        console.error(`Error processing user ${userData.display_name}:`, error);
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${userData.display_name}: ${errorMessage}`);
      }
    }

    console.log(`Bulk import complete: ${results.created} created, ${results.updated} updated, ${results.failed} failed`);

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

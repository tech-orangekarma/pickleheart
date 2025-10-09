import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FriendFinderSettings {
  user_id: string;
  mode: 'everyone' | 'auto_friends' | 'auto_requests' | 'receive_all' | 'manual';
  min_age: number | null;
  max_age: number | null;
  gender_filter: string | null;
  min_rating: number | null;
  max_rating: number | null;
}

interface Profile {
  id: string;
  dupr_rating: number | null;
  gender: string | null;
  birthday: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get current user's settings and profile
    const { data: mySettings } = await supabase
      .from('friend_finder_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!mySettings) {
      return new Response(
        JSON.stringify({ message: 'No settings found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, dupr_rating, gender, birthday')
      .eq('id', user.id)
      .single();

    // Get all other users' settings and profiles
    const { data: allSettings } = await supabase
      .from('friend_finder_settings')
      .select('*')
      .neq('user_id', user.id);

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, dupr_rating, gender, birthday')
      .neq('id', user.id);

    if (!allSettings || !allProfiles) {
      return new Response(
        JSON.stringify({ message: 'No other users found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calculateAge = (birthday: string | null): number | null => {
      if (!birthday) return null;
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    const matchesCriteria = (
      settings: FriendFinderSettings,
      profile: Profile
    ): boolean => {
      if (settings.mode === 'everyone') return true;
      if (settings.mode === 'manual') return false;

      // Check age
      if (settings.min_age !== null || settings.max_age !== null) {
        const age = calculateAge(profile.birthday);
        if (age === null) return false;
        if (settings.min_age !== null && age < settings.min_age) return false;
        if (settings.max_age !== null && age > settings.max_age) return false;
      }

      // Check gender
      if (settings.gender_filter && settings.gender_filter !== 'all') {
        if (profile.gender !== settings.gender_filter) return false;
      }

      // Check rating
      if (settings.min_rating !== null || settings.max_rating !== null) {
        if (profile.dupr_rating === null) return false;
        if (settings.min_rating !== null && profile.dupr_rating < settings.min_rating) return false;
        if (settings.max_rating !== null && profile.dupr_rating > settings.max_rating) return false;
      }

      return true;
    };

    const friendshipsToCreate = [];
    const requestsToCreate = [];

    for (const otherSettings of allSettings) {
      const otherProfile = allProfiles.find(p => p.id === otherSettings.user_id);
      if (!otherProfile) continue;

      // Check if already friends or has pending request
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherSettings.user_id}),and(requester_id.eq.${otherSettings.user_id},addressee_id.eq.${user.id})`)
        .maybeSingle();

      if (existingFriendship) continue;

      const iMatchThem = matchesCriteria(otherSettings, myProfile!);
      const theyMatchMe = matchesCriteria(mySettings, otherProfile);

      if (!iMatchThem || !theyMatchMe) continue;

      const myMode = mySettings.mode;
      const theirMode = otherSettings.mode;

      // Determine action based on mode combination
      if (myMode === 'everyone' || theirMode === 'everyone') {
        if (myMode === 'everyone' && theirMode === 'everyone') {
          friendshipsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'accepted' });
        } else if ((myMode === 'everyone' && theirMode === 'auto_friends') || (myMode === 'auto_friends' && theirMode === 'everyone')) {
          friendshipsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'accepted' });
        } else {
          requestsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'pending' });
        }
      } else if (myMode === 'auto_friends' && theirMode === 'auto_friends') {
        friendshipsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'accepted' });
      } else if ((myMode === 'auto_friends' && theirMode === 'auto_requests') || (myMode === 'auto_requests' && theirMode === 'auto_friends')) {
        requestsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'pending' });
      } else if (myMode === 'auto_requests' && theirMode === 'auto_requests') {
        requestsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'pending' });
      } else if (myMode === 'receive_all' && theirMode !== 'manual') {
        // User receives requests from everyone (except manual users)
        requestsToCreate.push({ requester_id: otherSettings.user_id, addressee_id: user.id, status: 'pending' });
      } else if (theirMode === 'receive_all' && myMode !== 'manual') {
        // Other user receives requests from everyone (except manual users)
        requestsToCreate.push({ requester_id: user.id, addressee_id: otherSettings.user_id, status: 'pending' });
      }
    }

    // Create friendships
    if (friendshipsToCreate.length > 0) {
      await supabase.from('friendships').insert(friendshipsToCreate);
    }

    // Create requests
    if (requestsToCreate.length > 0) {
      await supabase.from('friendships').insert(requestsToCreate);
    }

    return new Response(
      JSON.stringify({
        message: 'Friend finder processed',
        friendships_created: friendshipsToCreate.length,
        requests_created: requestsToCreate.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing friend finder:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

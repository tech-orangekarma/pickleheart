-- Enable PostGIS extension for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum types
CREATE TYPE privacy_mode AS ENUM ('basic', 'standard', 'custom');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE dupr_source AS ENUM ('linked', 'manual', 'self_assessment');

-- User profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  display_name TEXT,
  dupr_rating DECIMAL(3,2) CHECK (dupr_rating >= 2.0 AND dupr_rating <= 8.0),
  dupr_source dupr_source,
  dupr_linked_at TIMESTAMPTZ,
  home_park_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Privacy settings table
CREATE TABLE public.privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  mode privacy_mode NOT NULL DEFAULT 'standard',
  share_skill_level BOOLEAN NOT NULL DEFAULT true,
  share_arrival_time BOOLEAN NOT NULL DEFAULT true,
  share_name BOOLEAN NOT NULL DEFAULT false,
  do_not_share_at_all BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parks table with PostGIS POINT
CREATE TABLE public.parks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT,
  court_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create spatial index on parks
CREATE INDEX idx_parks_location ON public.parks USING GIST(location);

-- Friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- Presence table (who is at which park right now)
CREATE TABLE public.presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  park_id UUID NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ,
  auto_checked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, park_id, checked_out_at)
);

CREATE INDEX idx_presence_user ON public.presence(user_id);
CREATE INDEX idx_presence_park ON public.presence(park_id);
CREATE INDEX idx_presence_active ON public.presence(park_id, checked_out_at) WHERE checked_out_at IS NULL;

-- Stack reports table (user-submitted stack counts)
CREATE TABLE public.stack_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  park_id UUID NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  stack_count INTEGER NOT NULL CHECK (stack_count >= 0 AND stack_count <= 15),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stack_reports_park ON public.stack_reports(park_id, reported_at DESC);

-- Visits table (track park visits for analytics)
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  park_id UUID NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visits_user ON public.visits(user_id);
CREATE INDEX idx_visits_park ON public.visits(park_id, visited_at DESC);

-- Invites table (shareable links for friends)
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  park_id UUID NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_code ON public.invites(invite_code);
CREATE INDEX idx_invites_inviter ON public.invites(inviter_id);

-- DUPR link table (for future DUPR API integration)
CREATE TABLE public.dupr_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  dupr_id TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Welcome sequence progress table
CREATE TABLE public.welcome_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  completed_privacy BOOLEAN NOT NULL DEFAULT false,
  completed_delight BOOLEAN NOT NULL DEFAULT false,
  completed_promise BOOLEAN NOT NULL DEFAULT false,
  completed_profile BOOLEAN NOT NULL DEFAULT false,
  completed_level BOOLEAN NOT NULL DEFAULT false,
  completed_location BOOLEAN NOT NULL DEFAULT false,
  completed_ready BOOLEAN NOT NULL DEFAULT false,
  current_step TEXT NOT NULL DEFAULT 'privacy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Materialized view for park live stats
CREATE MATERIALIZED VIEW public.park_live_stats AS
SELECT 
  p.id AS park_id,
  p.name AS park_name,
  COUNT(DISTINCT pr.user_id) FILTER (WHERE pr.checked_out_at IS NULL) AS player_count,
  COUNT(DISTINCT CASE 
    WHEN pr.checked_out_at IS NULL 
    AND prof.dupr_rating IS NOT NULL 
    THEN prof.id 
  END) AS players_with_skill,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
    CASE 
      WHEN AGE(now(), sr.reported_at) < INTERVAL '15 minutes' THEN sr.stack_count 
      ELSE NULL 
    END
  ) AS median_stack_count,
  COUNT(sr.id) FILTER (WHERE sr.reported_at > now() - INTERVAL '15 minutes') AS recent_stack_reports,
  MAX(pr.arrived_at) FILTER (WHERE pr.checked_out_at IS NULL) AS last_arrival,
  now() AS refreshed_at
FROM public.parks p
LEFT JOIN public.presence pr ON p.id = pr.park_id
LEFT JOIN public.profiles prof ON pr.user_id = prof.id
LEFT JOIN public.stack_reports sr ON p.id = sr.park_id
GROUP BY p.id, p.name;

CREATE UNIQUE INDEX idx_park_live_stats_park ON public.park_live_stats(park_id);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_park_live_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.park_live_stats;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_settings_updated_at BEFORE UPDATE ON public.privacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parks_updated_at BEFORE UPDATE ON public.parks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presence_updated_at BEFORE UPDATE ON public.presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_welcome_progress_updated_at BEFORE UPDATE ON public.welcome_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stack_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dupr_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for privacy_settings
CREATE POLICY "Users can view their own privacy settings" ON public.privacy_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings" ON public.privacy_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings" ON public.privacy_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for parks (public read)
CREATE POLICY "Anyone can view parks" ON public.parks
  FOR SELECT USING (true);

-- RLS Policies for friendships
CREATE POLICY "Users can view their friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update friendships they're part of" ON public.friendships
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can delete their friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- RLS Policies for presence
CREATE POLICY "Users can view presence at parks" ON public.presence
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own presence" ON public.presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence" ON public.presence
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presence" ON public.presence
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for stack_reports
CREATE POLICY "Users can view stack reports" ON public.stack_reports
  FOR SELECT USING (true);

CREATE POLICY "Users can create stack reports" ON public.stack_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for visits
CREATE POLICY "Users can view their own visits" ON public.visits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own visits" ON public.visits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for invites
CREATE POLICY "Users can view invites they created" ON public.invites
  FOR SELECT USING (auth.uid() = inviter_id);

CREATE POLICY "Anyone can view invites by code" ON public.invites
  FOR SELECT USING (true);

CREATE POLICY "Users can create invites" ON public.invites
  FOR INSERT WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can delete their own invites" ON public.invites
  FOR DELETE USING (auth.uid() = inviter_id);

-- RLS Policies for dupr_links
CREATE POLICY "Users can view their own DUPR link" ON public.dupr_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own DUPR link" ON public.dupr_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DUPR link" ON public.dupr_links
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for welcome_progress
CREATE POLICY "Users can view their own welcome progress" ON public.welcome_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own welcome progress" ON public.welcome_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own welcome progress" ON public.welcome_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed three NYC parks
INSERT INTO public.parks (name, location, address, court_count) VALUES
  ('Riverside Park', ST_SetSRID(ST_MakePoint(-73.9926, 40.8019), 4326)::geography, 'Riverside Dr & W 96th St, New York, NY 10025', 8),
  ('Central Park', ST_SetSRID(ST_MakePoint(-73.9654, 40.7829), 4326)::geography, 'Mid-Park at 86th St, New York, NY 10024', 6),
  ('Carl Schurz Park', ST_SetSRID(ST_MakePoint(-73.9433, 40.7764), 4326)::geography, 'East End Ave & E 84th St, New York, NY 10028', 4);
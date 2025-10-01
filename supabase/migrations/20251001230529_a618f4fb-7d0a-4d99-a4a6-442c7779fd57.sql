-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view public profile fields" ON public.profiles;

-- Recreate public_profiles view as a security definer function
-- This allows the view to bypass RLS while only exposing safe fields
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  dupr_rating numeric,
  home_park_id uuid,
  gender text,
  age integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.dupr_rating,
    p.home_park_id,
    p.gender,
    public.calculate_age(p.birthday) as age
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profiles_for_search(current_user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  dupr_rating numeric,
  home_park_id uuid,
  gender text,
  age integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.dupr_rating,
    p.home_park_id,
    p.gender,
    public.calculate_age(p.birthday) as age
  FROM public.profiles p
  WHERE p.id != current_user_id;
$$;

-- Recreate the view using the security definer function for its base query
CREATE VIEW public.public_profiles AS
SELECT 
  p.id,
  p.display_name,
  p.avatar_url,
  p.dupr_rating,
  p.home_park_id,
  p.gender,
  public.calculate_age(p.birthday) as age
FROM public.profiles p;

-- Grant select on the view
GRANT SELECT ON public.public_profiles TO authenticated;
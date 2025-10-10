-- Create a security definer function to count unique users per park
CREATE OR REPLACE FUNCTION public.count_park_players(park_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::integer
  FROM public.user_parks
  WHERE favorite_park_id = park_uuid
     OR park2_id = park_uuid
     OR park3_id = park_uuid;
$$;
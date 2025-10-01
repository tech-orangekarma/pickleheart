-- Create function to calculate age from birthday
CREATE OR REPLACE FUNCTION public.calculate_age(birthday date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXTRACT(YEAR FROM age(birthday))::integer;
$$;

-- Create public_profiles view with only non-sensitive fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  display_name,
  avatar_url,
  dupr_rating,
  home_park_id,
  gender,
  public.calculate_age(birthday) as age
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.public_profiles SET (security_invoker = on);

-- Drop the overly permissive policy on profiles table
DROP POLICY IF EXISTS "Users can view all profiles for friend search" ON public.profiles;

-- Grant select permission on the view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;
-- Create function to safely get friend profiles for friend requests and friendships
CREATE OR REPLACE FUNCTION public.get_friend_profiles(user_ids uuid[])
RETURNS TABLE(
  id uuid,
  display_name text,
  avatar_url text,
  dupr_rating numeric,
  gender text,
  age integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.dupr_rating,
    p.gender,
    public.calculate_age(p.birthday) as age
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
$$;
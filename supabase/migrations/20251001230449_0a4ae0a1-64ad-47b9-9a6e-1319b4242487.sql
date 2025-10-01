-- Add policy to profiles table to allow authenticated users to view public profile data
-- The public_profiles view will filter out sensitive fields (phone, exact birthday)
CREATE POLICY "Authenticated users can view public profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
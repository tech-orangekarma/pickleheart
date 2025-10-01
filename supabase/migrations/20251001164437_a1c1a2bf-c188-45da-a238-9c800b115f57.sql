-- Allow users to view other users' profiles for friend search
CREATE POLICY "Users can view all profiles for friend search"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
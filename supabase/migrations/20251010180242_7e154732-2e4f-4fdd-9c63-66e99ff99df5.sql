-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own parks" ON user_parks;

-- Create new policy that allows viewing own and friends' parks
CREATE POLICY "Users can view friends parks"
ON user_parks
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  are_users_friends(auth.uid(), user_id)
);
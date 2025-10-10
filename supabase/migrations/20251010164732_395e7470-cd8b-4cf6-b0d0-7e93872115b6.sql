-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view their own planned visits" ON planned_visits;

-- Create new policy that allows viewing own visits and friends' visits
CREATE POLICY "Users can view own and friends planned visits"
ON planned_visits
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  public.are_users_friends(auth.uid(), user_id)
);
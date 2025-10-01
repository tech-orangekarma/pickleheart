-- Create a security definer function to check if two users are friends
-- This avoids RLS recursion issues
CREATE OR REPLACE FUNCTION public.are_users_friends(user_id_1 uuid, user_id_2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = user_id_1 AND addressee_id = user_id_2)
      OR
      (requester_id = user_id_2 AND addressee_id = user_id_1)
    )
  );
$$;

-- Remove the overly permissive presence policy
DROP POLICY IF EXISTS "Users can view presence at parks" ON public.presence;

-- Create a secure policy that only allows viewing presence if:
-- 1. It's the user's own presence, OR
-- 2. The users are friends, OR  
-- 3. Both users are currently present at the same park (for real-time park activity)
CREATE POLICY "Users can view friend or same-park presence"
  ON public.presence
  FOR SELECT
  USING (
    -- User can see their own presence
    auth.uid() = user_id
    OR
    -- User can see presence of their friends
    public.are_users_friends(auth.uid(), user_id)
    OR
    -- User can see presence of others currently at the same park they're at
    EXISTS (
      SELECT 1
      FROM public.presence AS my_presence
      WHERE my_presence.user_id = auth.uid()
      AND my_presence.park_id = presence.park_id
      AND my_presence.checked_out_at IS NULL
      AND presence.checked_out_at IS NULL
    )
  );
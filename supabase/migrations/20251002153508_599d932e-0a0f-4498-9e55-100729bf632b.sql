-- Priority 1: Create security definer function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_user_at_park(_user_id uuid, _park_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.presence
    WHERE user_id = _user_id
      AND park_id = _park_id
      AND checked_out_at IS NULL
  )
$$;

-- Drop and recreate the problematic RLS policy without recursion
DROP POLICY IF EXISTS "Users can view friend or same-park presence" ON public.presence;

CREATE POLICY "Users can view friend or same-park presence" 
ON public.presence
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.are_users_friends(auth.uid(), user_id)
  OR public.is_user_at_park(auth.uid(), park_id)
);

-- Priority 2: Add location permission column to privacy_settings
ALTER TABLE public.privacy_settings 
ADD COLUMN IF NOT EXISTS location_permission_granted boolean DEFAULT NULL;
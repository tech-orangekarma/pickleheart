-- Make park_id nullable in invites table since invites are now for friends, not parks
ALTER TABLE public.invites 
ALTER COLUMN park_id DROP NOT NULL;

-- Add comment to clarify the change
COMMENT ON COLUMN public.invites.park_id IS 'Optional park reference - null for friend invites';
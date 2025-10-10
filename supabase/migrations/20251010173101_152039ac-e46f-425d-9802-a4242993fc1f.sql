-- Drop the old user_parks table and create new structure
DROP TABLE IF EXISTS public.user_parks CASCADE;

-- Create new user_parks table with three park columns
CREATE TABLE public.user_parks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_park_id uuid REFERENCES public.parks(id) ON DELETE SET NULL,
  park2_id uuid REFERENCES public.parks(id) ON DELETE SET NULL,
  park3_id uuid REFERENCES public.parks(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

-- Enable RLS
ALTER TABLE public.user_parks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can insert their own parks"
ON public.user_parks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own parks"
ON public.user_parks
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own parks"
ON public.user_parks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own parks"
ON public.user_parks
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Migrate existing home_park_id data from profiles to favorite_park_id
INSERT INTO public.user_parks (user_id, favorite_park_id)
SELECT id, home_park_id
FROM public.profiles
WHERE home_park_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET favorite_park_id = EXCLUDED.favorite_park_id;
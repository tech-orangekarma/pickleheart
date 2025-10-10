-- Create a table to track which parks users play at
CREATE TABLE IF NOT EXISTS public.user_parks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  park_id UUID NOT NULL REFERENCES public.parks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, park_id)
);

-- Enable RLS
ALTER TABLE public.user_parks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own parks"
  ON public.user_parks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own parks"
  ON public.user_parks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own parks"
  ON public.user_parks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_parks_user_id ON public.user_parks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_parks_park_id ON public.user_parks(park_id);
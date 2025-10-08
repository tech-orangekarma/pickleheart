-- Create enum for friend finder modes
CREATE TYPE public.friend_finder_mode AS ENUM (
  'everyone',
  'auto_friends',
  'auto_requests',
  'manual'
);

-- Create friend finder settings table
CREATE TABLE public.friend_finder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  mode public.friend_finder_mode NOT NULL DEFAULT 'manual',
  min_age INTEGER,
  max_age INTEGER,
  gender_filter TEXT,
  min_rating NUMERIC,
  max_rating NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friend_finder_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own friend finder settings"
  ON public.friend_finder_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own friend finder settings"
  ON public.friend_finder_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend finder settings"
  ON public.friend_finder_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_friend_finder_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_friend_finder_settings_updated_at
  BEFORE UPDATE ON public.friend_finder_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_friend_finder_settings_updated_at();
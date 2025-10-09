-- Create function to automatically create friend finder settings for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_profile_friend_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default friend_finder_settings for new profile
  INSERT INTO public.friend_finder_settings (
    user_id,
    mode,
    min_age,
    max_age,
    gender_filter,
    min_rating,
    max_rating
  )
  VALUES (
    NEW.id,
    'receive_all',
    18,
    100,
    'all',
    2.0,
    5.0
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create friend finder settings when a profile is created
CREATE TRIGGER on_profile_created_friend_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_friend_settings();

-- Backfill friend finder settings for existing profiles that don't have them
INSERT INTO public.friend_finder_settings (
  user_id,
  mode,
  min_age,
  max_age,
  gender_filter,
  min_rating,
  max_rating
)
SELECT 
  p.id,
  'receive_all',
  18,
  100,
  'all',
  2.0,
  5.0
FROM public.profiles p
LEFT JOIN public.friend_finder_settings ffs ON p.id = ffs.user_id
WHERE ffs.user_id IS NULL;
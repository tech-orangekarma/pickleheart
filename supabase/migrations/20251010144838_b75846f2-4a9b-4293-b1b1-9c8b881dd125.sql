-- Create trigger to set default friend finder settings for new profiles
CREATE TRIGGER on_profile_created_set_friend_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_profile_friend_settings();
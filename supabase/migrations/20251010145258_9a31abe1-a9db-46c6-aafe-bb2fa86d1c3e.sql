-- Create function to process friend finder for new users
CREATE OR REPLACE FUNCTION public.process_friend_finder_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_settings RECORD;
  other_settings RECORD;
  new_user_profile RECORD;
  other_profile RECORD;
  new_user_age INTEGER;
  other_user_age INTEGER;
  b_in_a_range BOOLEAN;
  a_in_b_range BOOLEAN;
BEGIN
  -- Get the new user's settings (already created by previous trigger)
  SELECT * INTO new_user_settings 
  FROM friend_finder_settings 
  WHERE user_id = NEW.id;
  
  -- Get the new user's profile
  SELECT * INTO new_user_profile 
  FROM profiles 
  WHERE id = NEW.id;
  
  -- Calculate new user's age
  IF new_user_profile.birthday IS NOT NULL THEN
    new_user_age := EXTRACT(YEAR FROM age(new_user_profile.birthday));
  END IF;
  
  -- Loop through all other users with their settings
  FOR other_settings IN 
    SELECT * FROM friend_finder_settings WHERE user_id != NEW.id
  LOOP
    -- Get the other user's profile
    SELECT * INTO other_profile 
    FROM profiles 
    WHERE id = other_settings.user_id;
    
    -- Calculate other user's age
    IF other_profile.birthday IS NOT NULL THEN
      other_user_age := EXTRACT(YEAR FROM age(other_profile.birthday));
    END IF;
    
    -- Check if friendship already exists
    IF EXISTS (
      SELECT 1 FROM friendships 
      WHERE (requester_id = NEW.id AND addressee_id = other_settings.user_id)
         OR (requester_id = other_settings.user_id AND addressee_id = NEW.id)
    ) THEN
      CONTINUE;
    END IF;
    
    -- Skip if either is in manual mode
    IF new_user_settings.mode = 'manual' OR other_settings.mode = 'manual' THEN
      CONTINUE;
    END IF;
    
    -- Check if new user is in other user's criteria range (B in A range)
    b_in_a_range := TRUE;
    IF other_settings.mode != 'everyone' AND other_settings.mode != 'receive_all' THEN
      -- Check age
      IF other_settings.min_age IS NOT NULL AND (new_user_age IS NULL OR new_user_age < other_settings.min_age) THEN
        b_in_a_range := FALSE;
      END IF;
      IF other_settings.max_age IS NOT NULL AND (new_user_age IS NULL OR new_user_age > other_settings.max_age) THEN
        b_in_a_range := FALSE;
      END IF;
      -- Check gender
      IF other_settings.gender_filter IS NOT NULL AND other_settings.gender_filter != 'all' THEN
        IF new_user_profile.gender IS NULL OR new_user_profile.gender != ALL(string_to_array(other_settings.gender_filter, ',')) THEN
          b_in_a_range := FALSE;
        END IF;
      END IF;
      -- Check rating
      IF other_settings.min_rating IS NOT NULL AND (new_user_profile.dupr_rating IS NULL OR new_user_profile.dupr_rating < other_settings.min_rating) THEN
        b_in_a_range := FALSE;
      END IF;
      IF other_settings.max_rating IS NOT NULL AND (new_user_profile.dupr_rating IS NULL OR new_user_profile.dupr_rating > other_settings.max_rating) THEN
        b_in_a_range := FALSE;
      END IF;
    END IF;
    
    -- Check if other user is in new user's criteria range (A in B range)
    a_in_b_range := TRUE;
    IF new_user_settings.mode != 'everyone' AND new_user_settings.mode != 'receive_all' THEN
      -- Check age
      IF new_user_settings.min_age IS NOT NULL AND (other_user_age IS NULL OR other_user_age < new_user_settings.min_age) THEN
        a_in_b_range := FALSE;
      END IF;
      IF new_user_settings.max_age IS NOT NULL AND (other_user_age IS NULL OR other_user_age > new_user_settings.max_age) THEN
        a_in_b_range := FALSE;
      END IF;
      -- Check gender
      IF new_user_settings.gender_filter IS NOT NULL AND new_user_settings.gender_filter != 'all' THEN
        IF other_profile.gender IS NULL OR other_profile.gender != ALL(string_to_array(new_user_settings.gender_filter, ',')) THEN
          a_in_b_range := FALSE;
        END IF;
      END IF;
      -- Check rating
      IF new_user_settings.min_rating IS NOT NULL AND (other_profile.dupr_rating IS NULL OR other_profile.dupr_rating < new_user_settings.min_rating) THEN
        a_in_b_range := FALSE;
      END IF;
      IF new_user_settings.max_rating IS NOT NULL AND (other_profile.dupr_rating IS NULL OR other_profile.dupr_rating > new_user_settings.max_rating) THEN
        a_in_b_range := FALSE;
      END IF;
    END IF;
    
    -- Process based on modes (existing users sending to new user)
    IF other_settings.mode = 'everyone' THEN
      IF new_user_settings.mode = 'everyone' AND b_in_a_range AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'accepted');
      ELSIF new_user_settings.mode = 'auto_friends' AND b_in_a_range AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'accepted');
      ELSIF new_user_settings.mode = 'auto_requests' AND b_in_a_range AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'pending');
      ELSIF new_user_settings.mode = 'receive_all' AND b_in_a_range AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'pending');
      END IF;
    ELSIF other_settings.mode = 'auto_friends' AND b_in_a_range THEN
      IF new_user_settings.mode = 'everyone' AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'accepted');
      ELSIF new_user_settings.mode = 'auto_requests' AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'pending');
      ELSIF new_user_settings.mode = 'receive_all' AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'pending');
      END IF;
    ELSIF other_settings.mode = 'auto_requests' AND b_in_a_range THEN
      IF new_user_settings.mode = 'everyone' AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'accepted');
      ELSIF new_user_settings.mode = 'auto_friends' AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'accepted');
      ELSIF new_user_settings.mode = 'receive_all' AND a_in_b_range THEN
        INSERT INTO friendships (requester_id, addressee_id, status) 
        VALUES (other_settings.user_id, NEW.id, 'pending');
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically process friend finder for new users
CREATE TRIGGER on_profile_created_process_friend_finder
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.process_friend_finder_for_new_user();
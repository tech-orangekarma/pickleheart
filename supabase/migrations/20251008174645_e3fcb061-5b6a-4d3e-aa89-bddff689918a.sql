-- Add new enum type for privacy levels
CREATE TYPE privacy_level AS ENUM ('everyone', 'friends', 'no_one');

-- Add new columns for granular privacy settings
ALTER TABLE public.privacy_settings 
ADD COLUMN share_name_with privacy_level DEFAULT 'everyone',
ADD COLUMN share_photo_with privacy_level DEFAULT 'everyone';

-- Migrate existing data
UPDATE public.privacy_settings
SET share_name_with = CASE 
  WHEN share_name = true THEN 'everyone'::privacy_level
  ELSE 'no_one'::privacy_level
END;

-- Set default for share_photo_with based on current behavior
UPDATE public.privacy_settings
SET share_photo_with = 'everyone'::privacy_level;
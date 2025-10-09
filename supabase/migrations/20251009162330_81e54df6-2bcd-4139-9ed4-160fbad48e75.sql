-- Update the default mode for friend_finder_settings to auto_requests (receive all friend requests)
ALTER TABLE friend_finder_settings 
ALTER COLUMN mode SET DEFAULT 'auto_requests'::friend_finder_mode;
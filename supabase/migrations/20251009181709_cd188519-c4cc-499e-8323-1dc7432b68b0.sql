-- Update default mode for friend_finder_settings to receive_all
ALTER TABLE friend_finder_settings 
ALTER COLUMN mode SET DEFAULT 'receive_all'::friend_finder_mode;
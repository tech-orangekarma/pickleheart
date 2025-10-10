-- Migrate existing home parks to user_parks table
INSERT INTO user_parks (user_id, park_id)
SELECT id, home_park_id
FROM profiles
WHERE home_park_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM user_parks 
  WHERE user_parks.user_id = profiles.id 
  AND user_parks.park_id = profiles.home_park_id
);
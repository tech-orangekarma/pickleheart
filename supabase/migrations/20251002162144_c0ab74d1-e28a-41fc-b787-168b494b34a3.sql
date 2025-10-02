
-- Update Carl Schurz Park location to 159 W 126th St with coordinates (40.80922, -73.94718)
UPDATE parks 
SET 
  address = '159 W 126th St, New York, NY',
  location = ST_SetSRID(ST_MakePoint(-73.94718, 40.80922), 4326)::geography,
  updated_at = now()
WHERE name = 'Carl Schurz Park';

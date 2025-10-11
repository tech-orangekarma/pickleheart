-- Update Carl Schurz Park coordinates
UPDATE public.parks
SET location = ST_SetSRID(ST_MakePoint(-73.9453, 40.8049), 4326)
WHERE name = 'Carl Schurz Park';
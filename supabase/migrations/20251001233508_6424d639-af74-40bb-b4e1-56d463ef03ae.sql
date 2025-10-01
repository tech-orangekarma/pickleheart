-- Update court counts for specific parks
UPDATE public.parks
SET court_count = 5, updated_at = now()
WHERE id = '90558d06-ad45-492d-8fb5-d18131697329'; -- Riverside Park

UPDATE public.parks
SET court_count = 3, updated_at = now()
WHERE id = 'f811f95a-2139-4d35-b82b-28b1754e704a'; -- Central Park

UPDATE public.parks
SET court_count = 3, updated_at = now()
WHERE id = 'e5761b73-7831-4da0-9e96-f754259ce2a2'; -- Carl Schurz Park
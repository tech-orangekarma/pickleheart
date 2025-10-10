-- Add unique constraint to ensure only one planned visit per user per park
ALTER TABLE public.planned_visits
ADD CONSTRAINT unique_user_park_visit UNIQUE (user_id, park_id);
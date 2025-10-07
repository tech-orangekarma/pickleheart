-- Add selected_purpose column to welcome_progress table
ALTER TABLE public.welcome_progress
ADD COLUMN selected_purpose text;
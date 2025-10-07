-- Add completed_purpose column to welcome_progress table
ALTER TABLE public.welcome_progress 
ADD COLUMN completed_purpose boolean NOT NULL DEFAULT false;
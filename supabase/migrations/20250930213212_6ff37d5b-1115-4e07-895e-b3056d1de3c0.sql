-- Add gender and birthday fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN gender TEXT,
ADD COLUMN birthday DATE;

-- Add a check constraint for gender values
ALTER TABLE public.profiles
ADD CONSTRAINT gender_check CHECK (gender IN ('male', 'female', 'prefer_not_to_say'));
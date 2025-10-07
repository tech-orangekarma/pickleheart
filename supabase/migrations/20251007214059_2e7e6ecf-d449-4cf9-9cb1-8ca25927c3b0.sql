-- Create park suggestions table
CREATE TABLE public.park_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  park_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.park_suggestions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own park suggestions"
ON public.park_suggestions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own park suggestions"
ON public.park_suggestions
FOR SELECT
USING (auth.uid() = user_id);
-- Create court_conditions table
CREATE TABLE public.court_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  park_id UUID NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('dry', 'wet', 'damp', 'snowy', 'icy')),
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.court_conditions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view court conditions"
ON public.court_conditions
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own court condition reports"
ON public.court_conditions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_court_conditions_park_reported ON public.court_conditions(park_id, reported_at DESC);
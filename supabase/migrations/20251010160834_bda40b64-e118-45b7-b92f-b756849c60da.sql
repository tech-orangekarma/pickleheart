-- Create table for planned visits
CREATE TABLE public.planned_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  park_id UUID NOT NULL,
  planned_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.planned_visits ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own planned visits" 
ON public.planned_visits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own planned visits" 
ON public.planned_visits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planned visits" 
ON public.planned_visits 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planned visits" 
ON public.planned_visits 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_planned_visits_updated_at
BEFORE UPDATE ON public.planned_visits
FOR EACH ROW
EXECUTE FUNCTION public.update_friend_finder_settings_updated_at();
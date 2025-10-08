-- Create storage bucket for park photos/videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('park-media', 'park-media', true);

-- Create table for park photos/videos
CREATE TABLE public.park_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  park_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.park_media ENABLE ROW LEVEL SECURITY;

-- Create policies for park_media
CREATE POLICY "Anyone can view park media"
ON public.park_media
FOR SELECT
USING (true);

CREATE POLICY "Users can upload their own media"
ON public.park_media
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media"
ON public.park_media
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage policies for park-media bucket
CREATE POLICY "Park media is publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'park-media');

CREATE POLICY "Users can upload park media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'park-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own park media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'park-media' AND auth.uid()::text = (storage.foldername(name))[1]);
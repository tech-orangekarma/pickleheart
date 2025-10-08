-- Add storage buckets for the three parks
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('central-park-media', 'central-park-media', true),
  ('riverside-park-media', 'riverside-park-media', true),
  ('carl-schurz-park-media', 'carl-schurz-park-media', true);

-- Create storage policies for central-park-media bucket
CREATE POLICY "Central Park media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'central-park-media');

CREATE POLICY "Users can upload to Central Park" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'central-park-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their Central Park media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'central-park-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for riverside-park-media bucket
CREATE POLICY "Riverside Park media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'riverside-park-media');

CREATE POLICY "Users can upload to Riverside Park" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'riverside-park-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their Riverside Park media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'riverside-park-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for carl-schurz-park-media bucket
CREATE POLICY "Carl Schurz Park media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'carl-schurz-park-media');

CREATE POLICY "Users can upload to Carl Schurz Park" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'carl-schurz-park-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their Carl Schurz Park media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'carl-schurz-park-media' AND auth.uid()::text = (storage.foldername(name))[1]);
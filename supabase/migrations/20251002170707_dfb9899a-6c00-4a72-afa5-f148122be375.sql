-- Create function to get parks with extracted coordinates
CREATE OR REPLACE FUNCTION public.get_parks_with_coordinates()
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  court_count integer,
  longitude double precision,
  latitude double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    name,
    address,
    court_count,
    ST_X(location::geometry) as longitude,
    ST_Y(location::geometry) as latitude
  FROM public.parks;
$$;
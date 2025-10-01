-- Fix invites table: Remove overly permissive "Anyone can view invites by code" policy
DROP POLICY IF EXISTS "Anyone can view invites by code" ON public.invites;

-- Fix stack_reports table: Remove public read "Users can view stack reports" policy  
DROP POLICY IF EXISTS "Users can view stack reports" ON public.stack_reports;

-- Create restrictive policy for stack_reports if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'stack_reports' 
    AND policyname = 'Users can view their own stack reports'
  ) THEN
    CREATE POLICY "Users can view their own stack reports"
      ON public.stack_reports
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
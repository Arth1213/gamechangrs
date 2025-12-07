-- Drop the overly permissive policy that allows all authenticated users to read
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

-- Create a proper PERMISSIVE policy that only allows users to view their own profile
CREATE POLICY "Users can only read their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);
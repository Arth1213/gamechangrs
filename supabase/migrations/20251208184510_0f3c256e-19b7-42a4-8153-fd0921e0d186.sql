-- Remove duplicate SELECT policy on profiles table
DROP POLICY IF EXISTS "Users can only read their own profile" ON public.profiles;
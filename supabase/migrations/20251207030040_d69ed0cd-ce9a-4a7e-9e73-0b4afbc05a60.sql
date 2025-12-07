-- Deny anonymous users from accessing profiles table
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Deny anonymous users from accessing user_roles table  
CREATE POLICY "Deny anonymous access to user_roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);
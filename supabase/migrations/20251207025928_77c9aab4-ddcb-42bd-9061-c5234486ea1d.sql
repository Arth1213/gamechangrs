-- Prevent all profile deletions (profiles should persist with user accounts)
CREATE POLICY "Profiles cannot be deleted" 
ON public.profiles 
FOR DELETE 
USING (false);
-- Add policy allowing users to view their own listings (active or inactive)
CREATE POLICY "Users can view their own listings" 
ON public.marketplace_listings 
FOR SELECT 
USING (auth.uid() = user_id);
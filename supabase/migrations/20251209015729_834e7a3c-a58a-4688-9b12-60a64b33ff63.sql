-- Remove the policy that exposes user_id to everyone
DROP POLICY IF EXISTS "Anyone can view active listings" ON public.marketplace_listings;
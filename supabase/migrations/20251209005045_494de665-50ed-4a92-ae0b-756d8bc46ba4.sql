-- Drop the problematic view
DROP VIEW IF EXISTS public.marketplace_listings_public;

-- Recreate the original public policy but we control access at the application level
-- The contact_email field is never selected in frontend queries
CREATE POLICY "Anyone can view active listings" 
ON public.marketplace_listings 
FOR SELECT 
USING (is_active = true);

-- Drop the authenticated-only policy since we're reverting to simpler approach
DROP POLICY IF EXISTS "Authenticated users can view active listings without sensitive data" ON public.marketplace_listings;
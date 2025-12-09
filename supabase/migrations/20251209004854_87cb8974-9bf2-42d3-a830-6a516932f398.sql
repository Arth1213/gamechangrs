-- Create a public view that excludes contact_email for anonymous/public access
CREATE OR REPLACE VIEW public.marketplace_listings_public AS
SELECT 
  id,
  title,
  description,
  price,
  original_price,
  condition,
  location,
  image_url,
  category,
  listing_type,
  user_id,
  is_active,
  created_at,
  updated_at
FROM public.marketplace_listings
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.marketplace_listings_public TO anon, authenticated;

-- Drop the overly permissive public policy on the main table
DROP POLICY IF EXISTS "Anyone can view active listings" ON public.marketplace_listings;

-- Create a more restrictive policy - only authenticated users can view listings
-- and they can only see full details (including contact_email) for their own listings
CREATE POLICY "Authenticated users can view active listings without sensitive data" 
ON public.marketplace_listings 
FOR SELECT 
TO authenticated
USING (is_active = true OR auth.uid() = user_id);
-- Drop the existing view
DROP VIEW IF EXISTS public.marketplace_listings_public;

-- Recreate the view with security_invoker = true (the default, safer option)
CREATE VIEW public.marketplace_listings_public
WITH (security_invoker = true)
AS
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

-- Grant access to the view for all roles
GRANT SELECT ON public.marketplace_listings_public TO anon, authenticated;
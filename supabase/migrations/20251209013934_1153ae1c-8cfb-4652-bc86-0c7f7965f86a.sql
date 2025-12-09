-- Create a secure view that hides user_id but shows ownership status
CREATE OR REPLACE VIEW public.public_marketplace_listings AS
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
  is_active,
  created_at,
  updated_at,
  -- Only expose ownership status, not the actual user_id
  (CASE WHEN auth.uid() IS NOT NULL AND user_id = auth.uid() THEN true ELSE false END) as is_owner
FROM public.marketplace_listings
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.public_marketplace_listings TO anon, authenticated;
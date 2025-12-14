-- Drop and recreate the view with security definer to bypass RLS
DROP VIEW IF EXISTS public_marketplace_listings;

-- Add a policy to allow anyone (including anonymous) to view active listings
CREATE POLICY "Anyone can view active listings" 
ON public.marketplace_listings 
FOR SELECT 
USING (is_active = true);

-- Recreate the view
CREATE VIEW public_marketplace_listings AS
SELECT 
    id,
    title,
    description,
    price,
    original_price,
    listing_type,
    category,
    condition,
    location,
    image_url,
    is_active,
    created_at,
    updated_at,
    (user_id = auth.uid()) AS is_owner
FROM marketplace_listings
WHERE is_active = true OR user_id = auth.uid();
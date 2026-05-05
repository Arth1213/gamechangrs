-- Restore the public marketplace view as SECURITY INVOKER so it respects
-- the querying role's policies instead of running with elevated privileges.
DROP VIEW IF EXISTS public.public_marketplace_listings;

CREATE VIEW public.public_marketplace_listings
WITH (security_invoker = true)
AS
SELECT
  ml.id,
  ml.title,
  ml.description,
  ml.price,
  ml.original_price,
  ml.listing_type,
  ml.category,
  ml.condition,
  ml.location,
  ml.image_url,
  ml.is_active,
  ml.created_at,
  ml.updated_at,
  (ml.user_id = auth.uid()) AS is_owner
FROM public.marketplace_listings AS ml
WHERE ml.is_active = true OR ml.user_id = auth.uid();

GRANT SELECT ON public.public_marketplace_listings TO anon, authenticated;

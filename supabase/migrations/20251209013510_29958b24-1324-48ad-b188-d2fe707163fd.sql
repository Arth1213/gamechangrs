-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own contact info" ON public.seller_contacts;

-- Create a new PERMISSIVE SELECT policy that explicitly requires authentication
-- and restricts access to only the listing owner
CREATE POLICY "Authenticated listing owners can view contact info"
ON public.seller_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM marketplace_listings
    WHERE marketplace_listings.id = seller_contacts.listing_id
      AND marketplace_listings.user_id = auth.uid()
  )
);

-- Add explicit policy to deny anonymous access
CREATE POLICY "Deny anonymous access to seller_contacts"
ON public.seller_contacts
FOR SELECT
TO anon
USING (false);
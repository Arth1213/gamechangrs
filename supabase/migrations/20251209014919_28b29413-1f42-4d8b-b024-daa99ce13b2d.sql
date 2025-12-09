-- Remove all existing SELECT policies that expose seller emails to clients
-- The edge function uses the service role key, so it bypasses RLS
DROP POLICY IF EXISTS "Authenticated listing owners can view contact info" ON public.seller_contacts;
DROP POLICY IF EXISTS "Deny anonymous access to seller_contacts" ON public.seller_contacts;

-- Create a single deny-all SELECT policy for client access
-- The edge function uses service role key which bypasses RLS entirely
CREATE POLICY "No direct client access to seller emails"
ON public.seller_contacts
FOR SELECT
USING (false);

-- Note: INSERT, UPDATE, DELETE policies remain unchanged
-- Listing owners can still manage their own contact info
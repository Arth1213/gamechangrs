-- Create a separate table for seller contact information (not publicly accessible)
CREATE TABLE public.seller_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(listing_id)
);

-- Enable RLS on the new table
ALTER TABLE public.seller_contacts ENABLE ROW LEVEL SECURITY;

-- Only the listing owner can view/manage their contact info
CREATE POLICY "Users can view their own contact info"
ON public.seller_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_listings 
    WHERE id = seller_contacts.listing_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own contact info"
ON public.seller_contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.marketplace_listings 
    WHERE id = seller_contacts.listing_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own contact info"
ON public.seller_contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_listings 
    WHERE id = seller_contacts.listing_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own contact info"
ON public.seller_contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.marketplace_listings 
    WHERE id = seller_contacts.listing_id 
    AND user_id = auth.uid()
  )
);

-- Migrate existing contact emails to the new table
INSERT INTO public.seller_contacts (listing_id, contact_email)
SELECT id, contact_email FROM public.marketplace_listings
WHERE contact_email IS NOT NULL AND contact_email != '';

-- Now remove the contact_email column from the main table
ALTER TABLE public.marketplace_listings DROP COLUMN contact_email;
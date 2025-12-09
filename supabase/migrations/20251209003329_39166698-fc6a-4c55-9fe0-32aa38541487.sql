-- Add contact_email column to marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN contact_email text NOT NULL DEFAULT '';

-- Add a check constraint to ensure contact_email is provided
ALTER TABLE public.marketplace_listings 
ADD CONSTRAINT marketplace_listings_contact_email_check 
CHECK (contact_email <> '');
-- Add status column to connections for request flow
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS requester_type text,
ADD COLUMN IF NOT EXISTS requester_email text,
ADD COLUMN IF NOT EXISTS recipient_email text;

-- Update existing connections to be 'verified' status
UPDATE public.connections SET status = 'verified' WHERE verified = true;
UPDATE public.connections SET status = 'pending' WHERE verified = false;
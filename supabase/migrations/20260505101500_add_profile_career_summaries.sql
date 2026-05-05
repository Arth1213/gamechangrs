ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS career_summary text;

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS career_summary text;

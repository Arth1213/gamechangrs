-- Add specific_date column to coach_availability for date-based slots
ALTER TABLE public.coach_availability 
ADD COLUMN specific_date date NULL;

-- Create index for efficient date-based queries
CREATE INDEX idx_coach_availability_specific_date ON public.coach_availability(coach_id, specific_date);

-- Add comment for clarity
COMMENT ON COLUMN public.coach_availability.specific_date IS 'When set, this slot is for a specific date. When NULL, uses day_of_week for recurring weekly slots.';
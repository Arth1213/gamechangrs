-- Allow coaches to view active players for browsing/matching purposes
CREATE POLICY "Coaches can view active players for matching" 
ON public.players 
FOR SELECT 
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM coaches c 
    WHERE c.user_id = auth.uid() AND c.is_active = true
  )
);
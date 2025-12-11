-- Add policy to allow coaches to create connection requests
CREATE POLICY "Coaches can create connections"
ON public.connections
FOR INSERT
WITH CHECK (coach_id = get_user_coach_id(auth.uid()));

-- Also allow players to update connections (to accept requests from coaches)
CREATE POLICY "Players can verify connections"
ON public.connections
FOR UPDATE
USING (student_id = get_user_player_id(auth.uid()));
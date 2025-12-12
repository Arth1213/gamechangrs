-- Allow coaches to view analysis results of their connected players
CREATE POLICY "Coaches can view connected players analysis results"
ON public.analysis_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM connections c
    JOIN players p ON p.id = c.student_id
    WHERE c.coach_id = get_user_coach_id(auth.uid())
      AND c.verified = true
      AND p.user_id = analysis_results.user_id
  )
);
-- Fix recursion in players SELECT policies by moving connection checks into a
-- security definer helper that bypasses RLS on dependent tables.

CREATE OR REPLACE FUNCTION public.user_can_view_player(_user_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.connections c
      JOIN public.coaches co ON co.id = c.coach_id
      WHERE c.student_id = _player_id
        AND co.user_id = _user_id
        AND co.is_active = true
        AND c.verified = true
    )
$$;

DROP POLICY IF EXISTS "Coaches can view connected players" ON public.players;

CREATE POLICY "Coaches can view connected players"
ON public.players
FOR SELECT
USING (public.user_can_view_player(auth.uid(), id));

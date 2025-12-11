-- Create security definer functions to avoid RLS recursion

-- Function to check if user owns a player profile
CREATE OR REPLACE FUNCTION public.user_owns_player(_user_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE id = _player_id AND user_id = _user_id
  )
$$;

-- Function to check if user owns a coach profile
CREATE OR REPLACE FUNCTION public.user_owns_coach(_user_id uuid, _coach_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches
    WHERE id = _coach_id AND user_id = _user_id
  )
$$;

-- Function to get user's player id
CREATE OR REPLACE FUNCTION public.get_user_player_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.players WHERE user_id = _user_id LIMIT 1
$$;

-- Function to get user's coach id
CREATE OR REPLACE FUNCTION public.get_user_coach_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.coaches WHERE user_id = _user_id LIMIT 1
$$;

-- Drop and recreate connections policies to use security definer functions
DROP POLICY IF EXISTS "Users can view their connections" ON public.connections;
CREATE POLICY "Users can view their connections" 
ON public.connections 
FOR SELECT 
USING (
  student_id = public.get_user_player_id(auth.uid())
  OR coach_id = public.get_user_coach_id(auth.uid())
);

DROP POLICY IF EXISTS "Players can create connections" ON public.connections;
CREATE POLICY "Players can create connections" 
ON public.connections 
FOR INSERT 
WITH CHECK (
  student_id = public.get_user_player_id(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their connections" ON public.connections;
CREATE POLICY "Users can delete their connections" 
ON public.connections 
FOR DELETE 
USING (
  student_id = public.get_user_player_id(auth.uid())
  OR coach_id = public.get_user_coach_id(auth.uid())
);

-- Drop and recreate players policies to avoid recursion
DROP POLICY IF EXISTS "Coaches can view connected players" ON public.players;
CREATE POLICY "Coaches can view connected players" 
ON public.players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.student_id = players.id 
    AND c.coach_id = public.get_user_coach_id(auth.uid())
    AND c.verified = true
  )
);
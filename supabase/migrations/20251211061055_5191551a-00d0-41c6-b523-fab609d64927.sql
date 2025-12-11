-- Create coaching categories table
CREATE TABLE public.coaching_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create coaches table
CREATE TABLE public.coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  timezone text DEFAULT 'UTC',
  specialties text[] DEFAULT '{}',
  coaching_level text DEFAULT 'intermediate' CHECK (coaching_level IN ('beginner', 'intermediate', 'advanced')),
  years_experience integer DEFAULT 0,
  teams_coached text[] DEFAULT '{}',
  notable_players_coached text[] DEFAULT '{}',
  external_links text[] DEFAULT '{}',
  bio text,
  number_of_ratings integer DEFAULT 0,
  average_rating numeric DEFAULT 0,
  adjusted_rating numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create players table
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  timezone text DEFAULT 'UTC',
  age_group text,
  playing_role text,
  training_categories_needed text[] DEFAULT '{}',
  experience_level text DEFAULT 'beginner' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  matches_played integer DEFAULT 0,
  batting_strike_rate numeric,
  batting_average numeric,
  bowling_economy numeric,
  best_figures text,
  external_links text[] DEFAULT '{}',
  preferred_mode text DEFAULT 'either' CHECK (preferred_mode IN ('online', 'in-person', 'either')),
  preferred_days text[] DEFAULT '{}',
  preferred_time_range text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create connections table
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(student_id, coach_id)
);

-- Create coach availability table
CREATE TABLE public.coach_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time_utc time NOT NULL,
  end_time_utc time NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create sessions table
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_date_time_utc timestamp with time zone NOT NULL,
  duration_minutes integer DEFAULT 60,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled')),
  cancellation_reason text,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create ratings table
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE UNIQUE,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create blocked dates table
CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(coach_id, blocked_date)
);

-- Enable RLS on all tables
ALTER TABLE public.coaching_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

-- Coaching categories: public read, admin write
CREATE POLICY "Anyone can view coaching categories" ON public.coaching_categories FOR SELECT USING (true);

-- Coaches: public read for active coaches, users manage their own
CREATE POLICY "Anyone can view active coaches" ON public.coaches FOR SELECT USING (is_active = true);
CREATE POLICY "Users can insert their own coach profile" ON public.coaches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own coach profile" ON public.coaches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own coach profile" ON public.coaches FOR DELETE USING (auth.uid() = user_id);

-- Players: users manage their own, coaches can view connected students
CREATE POLICY "Users can view their own player profile" ON public.players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches can view connected players" ON public.players FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.connections c
    JOIN public.coaches co ON co.id = c.coach_id
    WHERE c.student_id = players.id AND co.user_id = auth.uid() AND c.verified = true
  )
);
CREATE POLICY "Users can insert their own player profile" ON public.players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own player profile" ON public.players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own player profile" ON public.players FOR DELETE USING (auth.uid() = user_id);

-- Connections: involved parties can manage
CREATE POLICY "Users can view their connections" ON public.connections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Players can create connections" ON public.connections FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid())
);
CREATE POLICY "Coaches can verify connections" ON public.connections FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users can delete their connections" ON public.connections FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);

-- Coach availability: coaches manage their own, public read
CREATE POLICY "Anyone can view coach availability" ON public.coach_availability FOR SELECT USING (true);
CREATE POLICY "Coaches can manage their availability" ON public.coach_availability FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Coaches can update their availability" ON public.coach_availability FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Coaches can delete their availability" ON public.coach_availability FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);

-- Sessions: involved parties can view/manage
CREATE POLICY "Users can view their sessions" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Players can create sessions" ON public.sessions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid())
);
CREATE POLICY "Involved parties can update sessions" ON public.sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);

-- Ratings: students can create, public read
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Students can rate completed sessions" ON public.ratings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.players p WHERE p.id = student_id AND p.user_id = auth.uid())
);

-- Blocked dates: coaches manage their own
CREATE POLICY "Anyone can view blocked dates" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "Coaches can manage blocked dates" ON public.blocked_dates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Coaches can update blocked dates" ON public.blocked_dates FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);
CREATE POLICY "Coaches can delete blocked dates" ON public.blocked_dates FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = coach_id AND c.user_id = auth.uid())
);

-- Seed initial coaching categories
INSERT INTO public.coaching_categories (name, description) VALUES
('Batting', 'Batting technique and shot selection'),
('Bowling', 'Bowling technique including pace and spin'),
('Fielding', 'Catching, throwing, and ground fielding'),
('Wicket Keeping', 'Wicket keeping skills and techniques'),
('Fitness', 'Cricket-specific fitness and conditioning'),
('Mental Game', 'Mental strength and match temperament'),
('Match Strategy', 'Game awareness and tactical decision making'),
('Video Analysis', 'Performance analysis using video footage');

-- Create trigger for updated_at
CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
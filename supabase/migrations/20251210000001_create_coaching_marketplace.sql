-- Create Categories table (pre-filled with coaching specialties)
CREATE TABLE IF NOT EXISTS public.coaching_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert coaching categories
INSERT INTO public.coaching_categories (name, description) VALUES
  ('Top Order Batting', 'Specialized coaching for opening and top-order batsmen'),
  ('Wicketkeeping', 'Wicketkeeping techniques and skills'),
  ('Pace Bowling', 'Fast and medium pace bowling coaching'),
  ('Wrist Spin', 'Leg spin and googly bowling techniques'),
  ('Finger Spin', 'Off spin and left-arm orthodox coaching'),
  ('Power Hitting', 'T20 and power hitting techniques'),
  ('Fielding', 'Fielding skills and techniques')
ON CONFLICT (name) DO NOTHING;

-- Create Coaches table
CREATE TABLE IF NOT EXISTS public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Coaching Details
  specialties UUID[] NOT NULL DEFAULT '{}', -- Array of category IDs
  coaching_level TEXT NOT NULL CHECK (coaching_level IN ('beginner', 'intermediate', 'advanced')),
  years_experience INTEGER NOT NULL DEFAULT 0,
  teams_coached TEXT[] DEFAULT '{}',
  notable_players_coached TEXT[] DEFAULT '{}',
  external_links TEXT[] DEFAULT '{}',
  bio TEXT,
  
  -- Ratings
  number_of_ratings INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (average_rating >= 0 AND average_rating <= 5),
  adjusted_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  
  -- Profile status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Players table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Player Details
  age_group TEXT,
  playing_role TEXT,
  training_categories_needed UUID[] NOT NULL DEFAULT '{}', -- Array of category IDs
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  
  -- Structured Stats
  matches_played INTEGER DEFAULT 0,
  batting_strike_rate NUMERIC(5,2),
  batting_average NUMERIC(5,2),
  bowling_economy NUMERIC(4,2),
  best_figures TEXT,
  external_links TEXT[] DEFAULT '{}',
  
  -- Preferences
  preferred_mode TEXT NOT NULL DEFAULT 'either' CHECK (preferred_mode IN ('online', 'in-person', 'either')),
  preferred_days TEXT[] DEFAULT '{}',
  preferred_time_range TEXT,
  
  -- Profile status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Connections table
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, coach_id)
);

-- Create Availability table (recurring weekly availability)
CREATE TABLE IF NOT EXISTS public.coach_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time_utc TIME NOT NULL,
  end_time_utc TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coach_id, day_of_week, start_time_utc, end_time_utc)
);

-- Create Blocked Dates table
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coach_id, blocked_date)
);

-- Create Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_date_time_utc TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled')),
  cancellation_reason TEXT,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

-- Create Admin Users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Reported Profiles table
CREATE TABLE IF NOT EXISTS public.reported_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('coach', 'player')),
  profile_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.coaching_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reported_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coaching_categories (public read)
CREATE POLICY "Anyone can view categories"
ON public.coaching_categories FOR SELECT
USING (true);

-- RLS Policies for coaches
CREATE POLICY "Anyone can view active coaches"
ON public.coaches FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can view their own coach profile"
ON public.coaches FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coach profile"
ON public.coaches FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coach profile"
ON public.coaches FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for players
CREATE POLICY "Anyone can view active players"
ON public.players FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can view their own player profile"
ON public.players FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own player profile"
ON public.players FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own player profile"
ON public.players FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for connections
CREATE POLICY "Users can view their own connections"
ON public.connections FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = connections.coach_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.players WHERE id = connections.student_id AND user_id = auth.uid())
);

CREATE POLICY "Users can create connections"
ON public.connections FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = connections.coach_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.players WHERE id = connections.student_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update their own connections"
ON public.connections FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = connections.coach_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.players WHERE id = connections.student_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete their own connections"
ON public.connections FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = connections.coach_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.players WHERE id = connections.student_id AND user_id = auth.uid())
);

-- RLS Policies for coach_availability
CREATE POLICY "Anyone can view coach availability"
ON public.coach_availability FOR SELECT
USING (true);

CREATE POLICY "Coaches can manage their own availability"
ON public.coach_availability FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = coach_availability.coach_id AND user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = coach_availability.coach_id AND user_id = auth.uid())
);

-- RLS Policies for blocked_dates
CREATE POLICY "Coaches can manage their own blocked dates"
ON public.blocked_dates FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = blocked_dates.coach_id AND user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = blocked_dates.coach_id AND user_id = auth.uid())
);

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions"
ON public.sessions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = sessions.coach_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.players WHERE id = sessions.student_id AND user_id = auth.uid())
);

CREATE POLICY "Connected users can create sessions"
ON public.sessions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.connections
    WHERE (coach_id = sessions.coach_id AND student_id = sessions.student_id)
    AND verified = true
  )
);

CREATE POLICY "Users can update their own sessions"
ON public.sessions FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.coaches WHERE id = sessions.coach_id AND user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM public.players WHERE id = sessions.student_id AND user_id = auth.uid())
);

-- RLS Policies for ratings
CREATE POLICY "Anyone can view ratings"
ON public.ratings FOR SELECT
USING (true);

CREATE POLICY "Students can create ratings for their sessions"
ON public.ratings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.players WHERE id = ratings.student_id AND user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = ratings.session_id
    AND student_id = ratings.student_id
    AND status = 'completed'
  )
);

-- RLS Policies for admin_users
CREATE POLICY "Admins can view admin users"
ON public.admin_users FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- RLS Policies for reported_profiles
CREATE POLICY "Users can report profiles"
ON public.reported_profiles FOR INSERT
WITH CHECK (auth.uid() = reported_by_user_id);

CREATE POLICY "Admins can view and manage reports"
ON public.reported_profiles FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

-- Create indexes for performance
CREATE INDEX idx_coaches_user_id ON public.coaches(user_id);
CREATE INDEX idx_coaches_specialties ON public.coaches USING GIN(specialties);
CREATE INDEX idx_coaches_location ON public.coaches(location);
CREATE INDEX idx_coaches_is_active ON public.coaches(is_active);

CREATE INDEX idx_players_user_id ON public.players(user_id);
CREATE INDEX idx_players_training_categories ON public.players USING GIN(training_categories_needed);
CREATE INDEX idx_players_location ON public.players(location);

CREATE INDEX idx_connections_student_coach ON public.connections(student_id, coach_id);
CREATE INDEX idx_connections_verified ON public.connections(verified);
CREATE INDEX idx_connections_code ON public.connections(code);

CREATE INDEX idx_availability_coach_day ON public.coach_availability(coach_id, day_of_week);
CREATE INDEX idx_blocked_dates_coach_date ON public.blocked_dates(coach_id, blocked_date);

CREATE INDEX idx_sessions_coach_date ON public.sessions(coach_id, session_date_time_utc);
CREATE INDEX idx_sessions_student_date ON public.sessions(student_id, session_date_time_utc);
CREATE INDEX idx_sessions_status ON public.sessions(status);

CREATE INDEX idx_ratings_coach ON public.ratings(coach_id);
CREATE INDEX idx_ratings_session ON public.ratings(session_id);

-- Function to calculate adjusted rating
CREATE OR REPLACE FUNCTION public.calculate_adjusted_rating(
  avg_rating NUMERIC,
  num_ratings INTEGER
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN num_ratings = 0 THEN 0.00
    ELSE ROUND((avg_rating * num_ratings::NUMERIC) / (num_ratings + 5), 2)
  END;
$$;

-- Function to update coach adjusted rating
CREATE OR REPLACE FUNCTION public.update_coach_adjusted_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.adjusted_rating := public.calculate_adjusted_rating(NEW.average_rating, NEW.number_of_ratings);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update adjusted rating
CREATE TRIGGER update_coach_adjusted_rating_trigger
BEFORE INSERT OR UPDATE OF average_rating, number_of_ratings ON public.coaches
FOR EACH ROW
EXECUTE FUNCTION public.update_coach_adjusted_rating();

-- Function to update coach rating when new rating is added
CREATE OR REPLACE FUNCTION public.update_coach_rating_on_new_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_avg NUMERIC;
  new_count INTEGER;
BEGIN
  SELECT 
    COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0.00),
    COUNT(*)
  INTO new_avg, new_count
  FROM public.ratings
  WHERE coach_id = NEW.coach_id;
  
  UPDATE public.coaches
  SET 
    average_rating = new_avg,
    number_of_ratings = new_count
  WHERE id = NEW.coach_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update coach rating when rating is added
CREATE TRIGGER update_coach_rating_on_rating_insert
AFTER INSERT ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_coach_rating_on_new_rating();

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_coaches_updated_at
BEFORE UPDATE ON public.coaches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


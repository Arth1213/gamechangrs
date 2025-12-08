-- Create table for storing analysis results
CREATE TABLE public.analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mode TEXT NOT NULL CHECK (mode IN ('batting', 'bowling')),
  video_duration TEXT,
  angles JSONB NOT NULL,
  scores JSONB NOT NULL,
  feedback JSONB,
  drills JSONB,
  overall_score INTEGER NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Users can only view their own analysis results
CREATE POLICY "Users can view their own analysis results"
ON public.analysis_results
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own analysis results
CREATE POLICY "Users can insert their own analysis results"
ON public.analysis_results
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own analysis results
CREATE POLICY "Users can delete their own analysis results"
ON public.analysis_results
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_analysis_results_user_id ON public.analysis_results(user_id);
CREATE INDEX idx_analysis_results_created_at ON public.analysis_results(created_at DESC);
-- Add video_url column to analysis_results
ALTER TABLE public.analysis_results
ADD COLUMN video_url text;

-- Create storage bucket for analysis videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('analysis-videos', 'analysis-videos', true);

-- Storage policies for analysis videos
CREATE POLICY "Users can upload their own analysis videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'analysis-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own analysis videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'analysis-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Coaches can view connected players analysis videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'analysis-videos' 
  AND EXISTS (
    SELECT 1
    FROM connections c
    JOIN players p ON p.id = c.student_id
    WHERE c.coach_id = get_user_coach_id(auth.uid())
      AND c.verified = true
      AND p.user_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete their own analysis videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'analysis-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
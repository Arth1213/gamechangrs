-- Drop the incorrect policy
DROP POLICY IF EXISTS "Coaches can view connected players analysis videos" ON storage.objects;

-- Create the correct policy for coaches to view connected players' videos
CREATE POLICY "Coaches can view connected players analysis videos"
ON storage.objects
FOR SELECT
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
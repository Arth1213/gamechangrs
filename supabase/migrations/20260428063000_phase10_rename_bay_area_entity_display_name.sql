BEGIN;

UPDATE public.entity
SET
  display_name = 'Grizzlies Cricket',
  updated_at = NOW()
WHERE slug = 'bay-area-youth-cricket-hub';

COMMIT;

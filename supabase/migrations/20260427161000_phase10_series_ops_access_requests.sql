BEGIN;

ALTER TABLE public.entity_subscription
  ALTER COLUMN max_series SET DEFAULT 5;

UPDATE public.entity_subscription
SET
  max_series = GREATEST(COALESCE(max_series, 0), 5),
  updated_at = NOW()
WHERE max_series IS NULL
   OR max_series < 5;

CREATE TABLE IF NOT EXISTS public.series_access_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entity(id) ON DELETE CASCADE,
  series_source_config_id BIGINT NOT NULL,
  requested_email TEXT NOT NULL,
  requested_user_id UUID,
  requested_access_role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (requested_access_role IN ('viewer', 'analyst')),
  request_type TEXT NOT NULL DEFAULT 'self_request'
    CHECK (request_type IN ('self_request', 'admin_invite')),
  request_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'approved', 'declined', 'canceled')),
  request_note TEXT,
  admin_response_note TEXT,
  requested_by_user_id UUID,
  reviewed_by_user_id UUID,
  requested_expires_at TIMESTAMPTZ,
  resolved_grant_id UUID REFERENCES public.series_access_grant(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT series_access_request_series_entity_fk
    FOREIGN KEY (series_source_config_id, entity_id)
    REFERENCES public.series_source_config(id, entity_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_access_request_series_status
  ON public.series_access_request (series_source_config_id, request_status, request_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_series_access_request_email
  ON public.series_access_request (lower(requested_email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_access_request_pending_admin_invite
  ON public.series_access_request (series_source_config_id, lower(requested_email), requested_access_role)
  WHERE request_status = 'pending'
    AND request_type = 'admin_invite';

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_access_request_pending_self_request
  ON public.series_access_request (series_source_config_id, requested_user_id, requested_access_role)
  WHERE request_status = 'pending'
    AND request_type = 'self_request'
    AND requested_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_series_access_request_updated_at ON public.series_access_request;

CREATE TRIGGER update_series_access_request_updated_at
  BEFORE UPDATE ON public.series_access_request
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

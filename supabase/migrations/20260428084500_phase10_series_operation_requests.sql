BEGIN;

CREATE TABLE IF NOT EXISTS public.series_operation_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entity(id) ON DELETE CASCADE,
  series_source_config_id BIGINT NOT NULL,
  operation_key TEXT NOT NULL
    CHECK (operation_key IN ('discover_new_matches', 'recompute_series')),
  request_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  request_note TEXT,
  requested_by_user_id UUID,
  requested_by_label TEXT,
  runner_mode TEXT NOT NULL DEFAULT 'deferred'
    CHECK (runner_mode IN ('deferred', 'manual', 'worker')),
  worker_ref TEXT,
  last_worker_note TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CONSTRAINT series_operation_request_series_entity_fk
    FOREIGN KEY (series_source_config_id, entity_id)
    REFERENCES public.series_source_config(id, entity_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_operation_request_series_status
  ON public.series_operation_request (series_source_config_id, request_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_series_operation_request_entity_status
  ON public.series_operation_request (entity_id, request_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_operation_request_pending_key
  ON public.series_operation_request (series_source_config_id, operation_key)
  WHERE request_status IN ('pending', 'processing');

DROP TRIGGER IF EXISTS update_series_operation_request_updated_at ON public.series_operation_request;

CREATE TRIGGER update_series_operation_request_updated_at
  BEFORE UPDATE ON public.series_operation_request
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

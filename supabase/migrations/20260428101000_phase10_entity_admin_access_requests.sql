BEGIN;

CREATE TABLE IF NOT EXISTS public.entity_admin_access_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entity(id) ON DELETE CASCADE,
  requested_email TEXT NOT NULL,
  requested_user_id UUID,
  requested_role TEXT NOT NULL DEFAULT 'admin'
    CHECK (requested_role IN ('admin')),
  request_type TEXT NOT NULL DEFAULT 'self_request'
    CHECK (request_type IN ('self_request', 'admin_invite')),
  request_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'approved', 'declined', 'canceled')),
  request_note TEXT,
  admin_response_note TEXT,
  requested_by_user_id UUID,
  reviewed_by_user_id UUID,
  resolved_membership_id UUID REFERENCES public.entity_membership(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_entity_admin_access_request_entity_status
  ON public.entity_admin_access_request (entity_id, request_status, request_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_admin_access_request_email
  ON public.entity_admin_access_request (lower(requested_email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_admin_access_request_pending_admin_invite
  ON public.entity_admin_access_request (entity_id, lower(requested_email), requested_role)
  WHERE request_status = 'pending'
    AND request_type = 'admin_invite';

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_admin_access_request_pending_self_request
  ON public.entity_admin_access_request (entity_id, requested_user_id, requested_role)
  WHERE request_status = 'pending'
    AND request_type = 'self_request'
    AND requested_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_entity_admin_access_request_updated_at ON public.entity_admin_access_request;

CREATE TRIGGER update_entity_admin_access_request_updated_at
  BEFORE UPDATE ON public.entity_admin_access_request
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.entity_admin_access_request ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entity admin access requests visible to self, entity admins, and platform admins" ON public.entity_admin_access_request;
CREATE POLICY "Entity admin access requests visible to self, entity admins, and platform admins"
ON public.entity_admin_access_request FOR SELECT
USING (
  requested_user_id = auth.uid()
  OR requested_by_user_id = auth.uid()
  OR public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Entity admin access requests managed by entity admins and platform admins" ON public.entity_admin_access_request;
CREATE POLICY "Entity admin access requests managed by entity admins and platform admins"
ON public.entity_admin_access_request FOR ALL
USING (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
)
WITH CHECK (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

COMMIT;

-- Phase 10 Step 1
-- Multi-tenant entity and series ownership foundation for Game-Changrs cricket analytics.
-- This slice introduces entity ownership, admin memberships, viewer grants, and
-- subscription scaffolding without changing the current public Render analytics behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.platform_admin_user (
  user_id UUID PRIMARY KEY,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  entity_type TEXT NOT NULL DEFAULT 'sports_program'
    CHECK (entity_type IN ('sports_program', 'academy', 'club', 'league', 'school', 'region', 'other')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  default_timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  owner_user_id UUID,
  notes TEXT,
  created_by_user_id UUID,
  updated_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entity_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entity(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'disabled')),
  invited_by_user_id UUID,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.entity_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL UNIQUE REFERENCES public.entity(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'past_due', 'canceled')),
  max_series INTEGER,
  max_admin_users INTEGER,
  max_viewer_users INTEGER,
  allow_manual_refresh BOOLEAN NOT NULL DEFAULT TRUE,
  allow_scheduled_refresh BOOLEAN NOT NULL DEFAULT TRUE,
  allow_weight_tuning BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.series_source_config
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entity(id) ON DELETE RESTRICT;

ALTER TABLE public.series_source_config
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

ALTER TABLE public.series_source_config
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID;

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entity(id) ON DELETE SET NULL;

INSERT INTO public.entity (
  slug,
  display_name,
  legal_name,
  entity_type,
  status,
  default_timezone,
  notes
)
VALUES (
  'bay-area-youth-cricket-hub',
  'Bay Area Youth Cricket Hub',
  'Bay Area Youth Cricket Hub',
  'sports_program',
  'active',
  'America/Los_Angeles',
  'Backfilled by Phase 10 Step 1 from the existing Bay Area USAC Hub analytics workspace.'
)
ON CONFLICT (slug) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  legal_name = EXCLUDED.legal_name,
  entity_type = EXCLUDED.entity_type,
  status = EXCLUDED.status,
  default_timezone = EXCLUDED.default_timezone,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO public.platform_admin_user (
  user_id,
  notes
)
SELECT
  u.id,
  'Auto-bootstrapped by Phase 10 Step 1 because exactly one auth user existed at migration time.'
FROM auth.users u
WHERE (SELECT count(*) FROM auth.users) = 1
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.entity
SET
  owner_user_id = COALESCE(
    owner_user_id,
    (
      SELECT pau.user_id
      FROM public.platform_admin_user pau
      ORDER BY pau.created_at, pau.user_id
      LIMIT 1
    )
  ),
  updated_by_user_id = COALESCE(
    updated_by_user_id,
    (
      SELECT pau.user_id
      FROM public.platform_admin_user pau
      ORDER BY pau.created_at, pau.user_id
      LIMIT 1
    )
  ),
  updated_at = NOW()
WHERE slug = 'bay-area-youth-cricket-hub'
  AND owner_user_id IS NULL
  AND (SELECT count(*) FROM public.platform_admin_user) = 1;

UPDATE public.series_source_config
SET entity_id = (
  SELECT id
  FROM public.entity
  WHERE slug = 'bay-area-youth-cricket-hub'
)
WHERE entity_id IS NULL;

UPDATE public.series s
SET entity_id = c.entity_id
FROM public.series_source_config c
WHERE c.series_id = s.id
  AND c.entity_id IS NOT NULL
  AND (s.entity_id IS NULL OR s.entity_id <> c.entity_id);

ALTER TABLE public.series_source_config
  ALTER COLUMN entity_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_series_source_config_id_entity
  ON public.series_source_config (id, entity_id);

CREATE INDEX IF NOT EXISTS idx_series_source_config_entity_id
  ON public.series_source_config (entity_id);

CREATE INDEX IF NOT EXISTS idx_series_entity_id
  ON public.series (entity_id);

INSERT INTO public.entity_subscription (
  entity_id,
  plan_key,
  status,
  max_series,
  max_admin_users,
  max_viewer_users,
  allow_manual_refresh,
  allow_scheduled_refresh,
  allow_weight_tuning,
  notes
)
SELECT
  e.id,
  'internal',
  'active',
  1,
  5,
  50,
  TRUE,
  TRUE,
  TRUE,
  'Initial internal allocation for the Bay Area U15 analytics workspace.'
FROM public.entity e
WHERE e.slug = 'bay-area-youth-cricket-hub'
ON CONFLICT (entity_id) DO UPDATE
SET
  plan_key = EXCLUDED.plan_key,
  status = EXCLUDED.status,
  max_series = EXCLUDED.max_series,
  max_admin_users = EXCLUDED.max_admin_users,
  max_viewer_users = EXCLUDED.max_viewer_users,
  allow_manual_refresh = EXCLUDED.allow_manual_refresh,
  allow_scheduled_refresh = EXCLUDED.allow_scheduled_refresh,
  allow_weight_tuning = EXCLUDED.allow_weight_tuning,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO public.entity_membership (
  entity_id,
  user_id,
  role,
  status,
  invited_by_user_id
)
SELECT
  e.id,
  e.owner_user_id,
  'owner',
  'active',
  e.owner_user_id
FROM public.entity e
WHERE e.slug = 'bay-area-youth-cricket-hub'
  AND e.owner_user_id IS NOT NULL
ON CONFLICT (entity_id, user_id) DO UPDATE
SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  invited_by_user_id = EXCLUDED.invited_by_user_id,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.series_access_grant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entity(id) ON DELETE CASCADE,
  series_source_config_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  access_role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (access_role IN ('viewer', 'analyst')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  granted_by_user_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_id, series_source_config_id, user_id),
  CONSTRAINT series_access_grant_series_entity_fk
    FOREIGN KEY (series_source_config_id, entity_id)
    REFERENCES public.series_source_config(id, entity_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_series_access_grant_user
  ON public.series_access_grant (user_id, status);

CREATE INDEX IF NOT EXISTS idx_series_access_grant_entity_series
  ON public.series_access_grant (entity_id, series_source_config_id, status);

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admin_user pau
    WHERE pau.user_id = COALESCE(_user_id, auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_entity(_entity_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_admin(COALESCE(_user_id, auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.entity_membership em
      WHERE em.entity_id = _entity_id
        AND em.user_id = COALESCE(_user_id, auth.uid())
        AND em.status = 'active'
        AND em.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_series_source_config(_series_source_config_id BIGINT, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_admin(COALESCE(_user_id, auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.series_source_config c
      WHERE c.id = _series_source_config_id
        AND public.can_manage_entity(c.entity_id, COALESCE(_user_id, auth.uid()))
    )
    OR EXISTS (
      SELECT 1
      FROM public.series_access_grant sag
      WHERE sag.series_source_config_id = _series_source_config_id
        AND sag.user_id = COALESCE(_user_id, auth.uid())
        AND sag.status = 'active'
        AND (sag.expires_at IS NULL OR sag.expires_at > NOW())
    );
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_entity_owner(
  _entity_slug TEXT,
  _user_id UUID,
  _grant_platform_admin BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_id UUID;
BEGIN
  SELECT e.id
  INTO _entity_id
  FROM public.entity e
  WHERE e.slug = _entity_slug
  LIMIT 1;

  IF _entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity not found for slug: %', _entity_slug;
  END IF;

  IF _grant_platform_admin THEN
    INSERT INTO public.platform_admin_user (
      user_id,
      notes
    )
    VALUES (
      _user_id,
      'Bootstrapped by Phase 10 foundation helper.'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  UPDATE public.entity
  SET
    owner_user_id = _user_id,
    updated_by_user_id = _user_id,
    updated_at = NOW()
  WHERE id = _entity_id;

  INSERT INTO public.entity_membership (
    entity_id,
    user_id,
    role,
    status,
    invited_by_user_id
  )
  VALUES (
    _entity_id,
    _user_id,
    'owner',
    'active',
    _user_id
  )
  ON CONFLICT (entity_id, user_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    invited_by_user_id = EXCLUDED.invited_by_user_id,
    updated_at = NOW();
END;
$$;

ALTER TABLE public.platform_admin_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_access_grant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin rows visible to self and platform admins" ON public.platform_admin_user;
CREATE POLICY "Platform admin rows visible to self and platform admins"
ON public.platform_admin_user FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Platform admin rows managed by platform admins" ON public.platform_admin_user;
CREATE POLICY "Platform admin rows managed by platform admins"
ON public.platform_admin_user FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Entity rows visible to platform admins, entity admins, and granted series viewers" ON public.entity;
CREATE POLICY "Entity rows visible to platform admins, entity admins, and granted series viewers"
ON public.entity FOR SELECT
USING (
  public.is_platform_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.entity_membership em
    WHERE em.entity_id = id
      AND em.user_id = auth.uid()
      AND em.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM public.series_access_grant sag
    WHERE sag.entity_id = id
      AND sag.user_id = auth.uid()
      AND sag.status = 'active'
      AND (sag.expires_at IS NULL OR sag.expires_at > NOW())
  )
);

DROP POLICY IF EXISTS "Entity rows managed by platform admins" ON public.entity;
CREATE POLICY "Entity rows managed by platform admins"
ON public.entity FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Entity memberships visible to self, entity admins, and platform admins" ON public.entity_membership;
CREATE POLICY "Entity memberships visible to self, entity admins, and platform admins"
ON public.entity_membership FOR SELECT
USING (
  user_id = auth.uid()
  OR public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Entity memberships managed by entity admins and platform admins" ON public.entity_membership;
CREATE POLICY "Entity memberships managed by entity admins and platform admins"
ON public.entity_membership FOR ALL
USING (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
)
WITH CHECK (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Entity subscriptions visible to entity admins and platform admins" ON public.entity_subscription;
CREATE POLICY "Entity subscriptions visible to entity admins and platform admins"
ON public.entity_subscription FOR SELECT
USING (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Entity subscriptions managed by platform admins" ON public.entity_subscription;
CREATE POLICY "Entity subscriptions managed by platform admins"
ON public.entity_subscription FOR ALL
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Series access grants visible to self, entity admins, and platform admins" ON public.series_access_grant;
CREATE POLICY "Series access grants visible to self, entity admins, and platform admins"
ON public.series_access_grant FOR SELECT
USING (
  user_id = auth.uid()
  OR public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Series access grants managed by entity admins and platform admins" ON public.series_access_grant;
CREATE POLICY "Series access grants managed by entity admins and platform admins"
ON public.series_access_grant FOR ALL
USING (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
)
WITH CHECK (
  public.can_manage_entity(entity_id, auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP TRIGGER IF EXISTS update_entity_updated_at ON public.entity;
CREATE TRIGGER update_entity_updated_at
  BEFORE UPDATE ON public.entity
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_membership_updated_at ON public.entity_membership;
CREATE TRIGGER update_entity_membership_updated_at
  BEFORE UPDATE ON public.entity_membership
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_entity_subscription_updated_at ON public.entity_subscription;
CREATE TRIGGER update_entity_subscription_updated_at
  BEFORE UPDATE ON public.entity_subscription
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_series_access_grant_updated_at ON public.series_access_grant;
CREATE TRIGGER update_series_access_grant_updated_at
  BEFORE UPDATE ON public.series_access_grant
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

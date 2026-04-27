-- Phase 10 live correction
-- The cricket analytics database is hosted in a separate Supabase project from the root app auth project.
-- Tenant-management user identifiers must therefore be stored as external auth UUIDs, not foreign keys to the
-- analytics project's local auth.users table.

BEGIN;

ALTER TABLE public.platform_admin_user
  DROP CONSTRAINT IF EXISTS platform_admin_user_user_id_fkey;

ALTER TABLE public.entity
  DROP CONSTRAINT IF EXISTS entity_owner_user_id_fkey,
  DROP CONSTRAINT IF EXISTS entity_created_by_user_id_fkey,
  DROP CONSTRAINT IF EXISTS entity_updated_by_user_id_fkey;

ALTER TABLE public.entity_membership
  DROP CONSTRAINT IF EXISTS entity_membership_user_id_fkey,
  DROP CONSTRAINT IF EXISTS entity_membership_invited_by_user_id_fkey;

ALTER TABLE public.series_access_grant
  DROP CONSTRAINT IF EXISTS series_access_grant_user_id_fkey,
  DROP CONSTRAINT IF EXISTS series_access_grant_granted_by_user_id_fkey;

ALTER TABLE public.series_source_config
  DROP CONSTRAINT IF EXISTS series_source_config_created_by_user_id_fkey,
  DROP CONSTRAINT IF EXISTS series_source_config_updated_by_user_id_fkey;

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

COMMIT;

BEGIN;

ALTER TABLE public.entity_subscription
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'internal'
    CHECK (billing_provider IN ('internal', 'manual', 'stripe', 'none'));

ALTER TABLE public.entity_subscription
  ADD COLUMN IF NOT EXISTS plan_display_name TEXT;

ALTER TABLE public.entity_subscription
  ADD COLUMN IF NOT EXISTS billing_customer_ref TEXT;

ALTER TABLE public.entity_subscription
  ADD COLUMN IF NOT EXISTS billing_subscription_ref TEXT;

ALTER TABLE public.entity_subscription
  ADD COLUMN IF NOT EXISTS contract_owner_email TEXT;

ALTER TABLE public.entity_subscription
  ADD COLUMN IF NOT EXISTS enforcement_mode TEXT NOT NULL DEFAULT 'hard'
    CHECK (enforcement_mode IN ('advisory', 'hard'));

UPDATE public.entity_subscription
SET
  billing_provider = COALESCE(NULLIF(billing_provider, ''), 'internal'),
  plan_display_name = COALESCE(
    NULLIF(plan_display_name, ''),
    CASE
      WHEN plan_key = 'internal' THEN 'Internal Admin'
      ELSE initcap(replace(plan_key, '-', ' '))
    END
  ),
  enforcement_mode = COALESCE(NULLIF(enforcement_mode, ''), 'hard'),
  updated_at = NOW();

COMMIT;

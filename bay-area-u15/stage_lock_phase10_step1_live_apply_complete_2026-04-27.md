# Stage Lock: Phase 10 Step 1 Live Apply Complete

Date: 2026-04-27  
Slice: live Supabase application of the tenant/entity foundation after aligning the migration with the real analytics schema

## 1. Goal Of The Slice

Apply the Phase 10 Step 1 tenant/entity foundation to the live cricket analytics Supabase database so later admin and viewer access work can target the real production schema instead of only the repo.

This live-apply slice specifically delivered:

- application of the entity ownership foundation to the live analytics database
- a self-contained `platform_admin_user` foundation instead of the missing legacy `user_roles` dependency
- split-project auth alignment so analytics tenant tables store external root-app auth UUIDs instead of foreign keys to the analytics project’s own empty `auth.users` table
- bootstrap helper function `public.bootstrap_entity_owner(...)` for assigning the first real owner after an auth user exists in the root app auth project
- no change to scraping, analytics computation, or public report routes

## 2. Exact Files Changed

- `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- `bay-area-u15/apps/api/src/services/accessService.js`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step1_live_apply_complete_2026-04-27.md`

## 3. Exact Migration Applied

Applied to the live cricket analytics database:

- `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- `supabase/migrations/20260427125500_phase10_external_auth_alignment.sql`

Important adjustment made before apply:

- removed dependency on missing live-schema objects `public.user_roles`, `public.app_role`, and `public.has_role(...)`
- added `public.platform_admin_user`
- added `public.bootstrap_entity_owner(_entity_slug, _user_id, _grant_platform_admin)`
- added a self-contained `public.update_updated_at_column()` definition
- removed tenant-management foreign keys to the analytics project's local `auth.users` because root-app auth is verified against a different Supabase project

## 4. Exact Local Run Commands

Schema dependency inspection:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
node <db-inspection-script>
```

Dry run against the live database:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
node <migration-dry-run-script>
```

Live apply against the live database:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
node <migration-apply-script>
```

Post-apply verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
node <post-apply-verification-script>
node --check apps/api/src/services/accessService.js
```

## 5. Exact URLs Verified

This slice was database-apply work, not an HTTP deployment slice.

No public URLs were changed or newly verified here.

The following production database facts were verified directly after apply:

- `public.platform_admin_user` exists
- `public.entity` exists
- `public.entity_membership` exists
- `public.entity_subscription` exists
- `public.series_access_grant` exists
- `public.is_platform_admin(...)` exists
- `public.bootstrap_entity_owner(...)` exists
- `public.series_source_config.entity_id` exists and is populated
- `public.series.entity_id` exists and is populated
- there are no remaining `REFERENCES auth.users(...)` constraints on the tenant-management tables in the analytics database

## 6. Exact Deploy Status

- Supabase schema: applied live
- Render API code: not deployed in this slice
- Lovable/root frontend: not deployed in this slice
- GitHub: not pushed in this slice
- Public analytics/report behavior: unchanged

## 7. Blockers Or Known Gaps

- the analytics Supabase project still has `auth.users = 0`, which is now expected and no longer used for tenant ownership
- the root app auth project still needs at least one real signed-in user before ownership can be bootstrapped into the analytics database
- because there is no root-app auth user bootstrap yet, the live database still has no:
  - `platform_admin_user` row
  - `entity_membership` owner/admin row
  - `entity.owner_user_id`
- that means the schema prerequisite is now live, but a real admin success path is still blocked until the first real auth user exists and is bootstrapped into the entity
- the Render API auth boundary code was updated locally to align with the new live-safe platform-admin model, but that code is still not deployed

## 8. Exact Next Step

Before or alongside Phase 10 Step 6 viewer access work:

1. create the first real auth user in the root app Supabase auth project through the Game-Changrs auth flow
2. run `public.bootstrap_entity_owner('bay-area-youth-cricket-hub', <root_auth_user_id>, true)` in the analytics database for that user
3. deploy the aligned Render API auth-boundary code
4. then proceed with Step 6 viewer access and sharing on top of a real owner/admin account

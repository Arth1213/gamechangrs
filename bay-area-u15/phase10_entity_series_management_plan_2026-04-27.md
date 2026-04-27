# Phase 10 Plan: Entity + Series Management

Date: 2026-04-27  
Scope owner: Game-Changrs / Arth Arun  
Runtime boundary: keep `bay-area-u15/apps/api` as the cricket analytics service and integrate admin/user flows into the main Game-Changrs app without rewriting the working report runtime.

## 1. Goal

Turn the current Bay Area U15 analytics integration into a multi-tenant Game-Changrs product where:

- an entity owns one or more series
- entity admins can manage only the series owned by that entity
- entity admins can grant users access to reports for the right series
- series management eventually becomes a paid subscription capability at the entity level
- scraping, updates, weighting, and tuning remain server-side responsibilities, not browser responsibilities

## 2. Fixed Architecture Boundary

Keep these boundaries intact throughout Phase 10:

- root frontend app: `src`
- Supabase auth, RLS, and schema: `supabase/migrations`
- cricket analytics/report API: `bay-area-u15/apps/api/src`
- scrape/load/recompute worker: `bay-area-u15/apps/worker/src`
- Render remains the hosted Node/Express analytics runtime
- Lovable remains the frontend edit/publish surface backed by GitHub `main`
- current live architecture uses root-app Supabase auth separately from the analytics database, so analytics tenant tables must store external auth UUIDs rather than foreign keys to the analytics project's local `auth.users`

## 3. Phase 10 Step Tracker

### Step 1. Tenant foundation
Status: implemented in repo and applied to the live cricket Supabase database, with live-safe self-contained bootstrap helpers because the production project does not contain the legacy `user_roles` foundation originally assumed

Deliver:

- `entity`
- `entity_membership`
- `entity_subscription`
- `series_access_grant`
- `platform_admin_user`
- series ownership columns on analytics config tables
- helper functions for platform-admin, entity-admin, and series-view checks
- bootstrap helper for assigning the first real entity owner once an auth user exists

Exact landing zone:

- `supabase/migrations`
- `bay-area-u15/*.md`

### Step 2. Render API auth boundary
Status: implemented locally, not deployed, and still waiting on the Step 1 migration to be applied before authenticated admin success can be verified end to end

Deliver:

- verify Supabase bearer token in the Render cricket API
- resolve current user and platform/entity permissions
- protect admin routes first
- keep public search/report routes unchanged until access policy is intentionally switched

Exact landing zone:

- `bay-area-u15/apps/api/src/lib`
- `bay-area-u15/apps/api/src/services`
- `bay-area-u15/apps/api/src/server.js`

### Step 3. Root-app admin shell
Status: implemented locally, not deployed, and still dependent on the Step 1 migration being applied before live entity-scoped admin success can be verified end to end

Deliver:

- add Game-Changrs admin entry flow under `/analytics/admin`
- show only owned entities/series for the logged-in admin
- do not replace the working player report/search flow

Exact landing zone:

- `src/App.tsx`
- `src/pages`
- `src/contexts`
- `src/lib`

### Step 4. Series configuration management
Status: implemented locally for the setup-editing slice, not deployed, and still dependent on the Step 1 migration plus a real admin bearer token before end-to-end authenticated writes can be verified against the shared dataset

Deliver:

- source website and source URL management
- expected series name / league name controls
- division and phase configuration
- ball-by-ball/profile include flags
- report profile selection
- weighting model selection and per-series tuning controls

Exact landing zone:

- `bay-area-u15/apps/api/src/services/adminService.js`
- `bay-area-u15/apps/api/src/render/pages.js`
- `src/pages`
- `supabase/migrations`

### Step 5. Job control plane
Status: implemented locally for the first safe control-plane slice, not deployed, and still dependent on a real authenticated admin success path before live write flows can be verified end to end

Deliver:

- manual refresh request trigger in the root admin shell
- per-match selection override controls in the root admin shell
- recent manual request visibility
- live match status, warning, and pending-op visibility
- full-series extract/scheduler/run-history controls intentionally deferred to later slices

Exact landing zone:

- `bay-area-u15/apps/worker/src`
- `bay-area-u15/apps/api/src/services`
- `src/pages`
- `supabase/migrations`

### Step 6. Viewer access and sharing
Status: implemented locally after the live Step 1 owner bootstrap; root-app viewer access is now enforced at the Game-Changrs route layer and series admins can manage per-series viewer grants through the protected admin shell

Deliver:

- add users to a series by root-auth user UUID
- grant and revoke per-series viewer or analyst access
- enforce viewer access on root analytics routes and root report routes
- keep the standalone Express report runtime unchanged for this slice

Exact landing zone:

- `bay-area-u15/apps/api/src`
- `src/App.tsx`
- `src/lib`
- `src/pages`

### Step 7. Subscription enforcement
Status: implemented locally with live billing-field migration applied to the analytics database; entity plan summary, feature gates, viewer-cap enforcement, manual-refresh enforcement, weight-tuning enforcement, and active-series-cap checks now exist in the protected cricket admin layer

Deliver:

- entity plan checks
- feature entitlement checks
- viewer and active-series limit enforcement
- manual and scheduled update entitlement surfacing, plus manual-refresh enforcement
- billing-ready contract fields on `entity_subscription`

Exact landing zone:

- `supabase/migrations`
- `bay-area-u15/apps/api/src`
- `src/pages`

## 4. Rules For Every Slice

- do not rewrite the current Express/CommonJS report runtime
- do not move cricket analytics into Supabase edge functions
- do not move scraping or compute into the browser
- do not redesign the current report unless the slice explicitly targets report UX
- keep each slice small, reversible, and checkpointed

## 5. Checkpoint Files To Create

After every implementation slice, create a repo-side checkpoint document in `bay-area-u15`.

Naming pattern:

- `stage_lock_phase10_step1_tenant_foundation_repo_ready_2026-04-27.md`
- `stage_lock_phase10_step2_api_auth_boundary_complete_2026-04-27.md`
- `stage_lock_phase10_step3_root_admin_shell_complete_2026-04-27.md`
- `stage_lock_phase10_step4_series_config_complete_2026-04-27.md`
- `stage_lock_phase10_step5_job_control_plane_complete_2026-04-27.md`
- `stage_lock_phase10_step6_viewer_access_complete_2026-04-27.md`
- `stage_lock_phase10_step7_subscription_enforcement_complete_2026-04-27.md`

Each checkpoint should record:

- goal of the slice
- exact files changed
- exact run commands
- exact URLs verified
- whether database migration was only committed or also applied
- known gaps
- next step

## 6. How We Push This Into The Actual Game-Changrs App

Use the same push path for every Phase 10 slice:

1. implement the slice in `gamechangrs-repo`
2. run targeted local verification
3. if the slice includes Supabase schema work, review the migration before applying it
4. push the feature branch to GitHub
5. merge to `main` only after local verification is clean
6. apply or confirm the Supabase migration in the target project
7. let Render deploy backend changes from the `bay-area-u15` path
8. let Lovable sync from GitHub `main` for frontend changes
9. publish from Lovable when the frontend slice is ready
10. verify live Render URLs and live frontend URLs before locking the slice

## 7. Local Run Commands

Root frontend:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
npm run dev
```

Root build:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
npm run build
```

Render API locally:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
npm run api:start
```

Current worker commands:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
npm run bay-u15:discover
npm run bay-u15:inventory
npm run bay-u15:run
```

## 8. Verification Order For Step 1 Through Step 3

### Step 1 verification

- migration file exists and is internally coherent
- root app build still succeeds
- no working analytics route behavior is changed yet

### Step 2 verification

- admin API routes reject unauthorized access
- platform admin or entity admin can still reach the right routes
- public player report routes remain intentionally unchanged unless switched by policy

### Step 3 verification

- signed-in entity admin can see only owned entities/series in the root app
- non-admin user cannot access the admin shell
- existing `/analytics` and report flows still work

## 9. Current Recommendation

Proceed in this order:

1. Step 1 tenant foundation
2. Step 2 Render API auth boundary
3. Step 3 root-app admin shell

Do not start Step 4 UI forms until Step 1 and Step 2 are verified.

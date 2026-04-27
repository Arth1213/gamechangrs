# Stage Lock: Phase 10 Step 3 Root Admin Shell

Date: 2026-04-27  
Slice: protected root-app admin shell for entity/series-scoped cricket management

## 1. Goal Of The Slice

Add the first Game-Changrs root-app admin entry route under `/analytics/admin` without changing the working public cricket analytics and report behavior.

This slice specifically delivers:

- a protected root route for cricket admin access
- a minimal authenticated series-discovery endpoint in the Render cricket API
- a read-only admin shell that lists manageable series and reads the existing protected setup JSON for the selected series
- a small bridge from the analytics landing/workspace into the admin route

## 2. Exact Files Changed

- `bay-area-u15/apps/api/src/lib/auth.js`
- `bay-area-u15/apps/api/src/services/accessService.js`
- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step3_root_admin_shell_complete_2026-04-27.md`
- `src/App.tsx`
- `src/lib/cricketApi.ts`
- `src/pages/Analytics.tsx`
- `src/pages/AnalyticsAdmin.tsx`

## 3. Exact Migration Applied

- No new migration was added in this step.
- This slice still depends on the existing Step 1 migration:
  - `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- Applied to Supabase in this step: **no**

## 4. Exact Local Run Commands

Syntax checks:

```bash
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src/lib/auth.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src/services/accessService.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src/server.js
```

Root build:

```bash
npm -C /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo run build
```

Local cricket API:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
PORT=4013 node apps/api/src/server.js
```

Local root app with cricket API proxy:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
CRICKET_API_PROXY_TARGET=http://127.0.0.1:4013 npm run dev -- --host 127.0.0.1 --port 8081
```

Verification commands:

```bash
curl -sS http://127.0.0.1:4013/health
curl -sS "http://127.0.0.1:4013/api/dashboard/summary"
curl -i -sS "http://127.0.0.1:4013/api/admin/series"
curl -i -sS -H "Authorization: Bearer invalid-token" "http://127.0.0.1:4013/api/admin/series"
curl -i -sS "http://127.0.0.1:4013/api/series/bay-area-usac-hub-2026/admin/setup"
curl -I -sS "http://127.0.0.1:4013/players/176?divisionId=3"
curl -I -sS http://127.0.0.1:8081/analytics
curl -I -sS http://127.0.0.1:8081/analytics/admin
curl -I -sS "http://127.0.0.1:8081/analytics/reports/176?divisionId=3"
curl -i -sS http://127.0.0.1:8081/cricket-api/api/admin/series
curl -i -sS http://127.0.0.1:8081/cricket-api/api/dashboard/summary
```

## 5. Exact URLs Verified

Direct API:

- `http://127.0.0.1:4013/health`
- `http://127.0.0.1:4013/api/dashboard/summary`
- `http://127.0.0.1:4013/api/admin/series`
- `http://127.0.0.1:4013/api/series/bay-area-usac-hub-2026/admin/setup`
- `http://127.0.0.1:4013/players/176?divisionId=3`

Root app and proxy:

- `http://127.0.0.1:8081/analytics`
- `http://127.0.0.1:8081/analytics/admin`
- `http://127.0.0.1:8081/analytics/reports/176?divisionId=3`
- `http://127.0.0.1:8081/cricket-api/api/admin/series`
- `http://127.0.0.1:8081/cricket-api/api/dashboard/summary`

## 6. Exact Deploy Status

- GitHub: not pushed in this step
- Supabase migration: not applied in this step
- Render: not deployed in this step
- Lovable: not published in this step
- Local verification: complete

## 7. Blockers Or Known Gaps

- the Step 1 entity foundation migration is still not applied to the shared Supabase project, so authenticated entity-scoped admin success cannot be verified end to end yet
- this slice verified protected failure paths (`401`) and preserved public routes, but it did **not** verify a successful `/api/admin/series` response with a real signed-in admin bearer token
- the root admin shell is intentionally read-only in this slice; it does not yet edit setup, tuning, or job controls
- the root build still shows the pre-existing CSS `@import` ordering warning and large chunk-size warning

## 8. Exact Next Step

Phase 10 Step 4 should add the first editable series configuration surface:

- wire the root admin shell into setup editing for the selected series
- keep using `bay-area-u15/apps/api` as the source of truth
- continue preserving public analytics/report behavior

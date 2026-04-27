# Stage Lock: Phase 10 Step 4 Series Configuration

Date: 2026-04-27  
Slice: first editable series-configuration slice inside the root Game-Changrs admin shell

## 1. Goal Of The Slice

Turn `/analytics/admin` from a read-only setup snapshot into the first editable series configuration surface while continuing to use the existing protected cricket setup API as the source of truth.

This slice specifically delivers:

- editable source setup fields for the selected series
- editable include flags and report profile selection
- editable division mapping fields for the selected series
- explicit `Dry run`, `Reset changes`, and `Save setup` actions
- no change to public analytics landing, player search, or player report behavior

## 2. Exact Files Changed

- `src/lib/cricketApi.ts`
- `src/pages/AnalyticsAdmin.tsx`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step4_series_config_complete_2026-04-27.md`

## 3. Exact Migration Applied

- No new migration was added in this step.
- This slice still depends on the existing Step 1 migration:
  - `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- Applied to Supabase in this step: **no**

## 4. Exact Local Run Commands

Root build:

```bash
npm -C /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo run build
```

Local cricket API:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
PORT=4014 node apps/api/src/server.js
```

Local root app with cricket API proxy:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
CRICKET_API_PROXY_TARGET=http://127.0.0.1:4014 npm run dev -- --host 127.0.0.1 --port 8082
```

Verification commands:

```bash
curl -sS http://127.0.0.1:4014/health
curl -i -sS -X PUT "http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/setup?dryRun=true" -H "Content-Type: application/json" --data '{"sourceSetup":{"name":"Test"}}'
curl -i -sS -X PUT "http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/setup?dryRun=true" -H "Content-Type: application/json" -H "Authorization: Bearer invalid-token" --data '{"sourceSetup":{"name":"Test"}}'
curl -I -sS http://127.0.0.1:8082/analytics/admin
curl -i -sS -X PUT "http://127.0.0.1:8082/cricket-api/api/series/bay-area-usac-hub-2026/admin/setup?dryRun=true" -H "Content-Type: application/json" --data '{"sourceSetup":{"name":"Test"}}'
curl -I -sS "http://127.0.0.1:8082/analytics/reports/176?divisionId=3"
curl -i -sS http://127.0.0.1:8082/cricket-api/api/dashboard/summary
```

## 5. Exact URLs Verified

Direct API:

- `http://127.0.0.1:4014/health`
- `http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/setup?dryRun=true`

Root app and proxy:

- `http://127.0.0.1:8082/analytics/admin`
- `http://127.0.0.1:8082/cricket-api/api/series/bay-area-usac-hub-2026/admin/setup?dryRun=true`
- `http://127.0.0.1:8082/analytics/reports/176?divisionId=3`
- `http://127.0.0.1:8082/cricket-api/api/dashboard/summary`

## 6. Exact Deploy Status

- GitHub: not pushed in this step
- Supabase migration: not applied in this step
- Render: not deployed in this step
- Lovable: not published in this step
- Local verification: complete

## 7. Blockers Or Known Gaps

- the Step 1 tenant/entity migration is still not applied to the shared Supabase project, so end-to-end authenticated setup reads/writes still cannot be verified with a real admin success path
- a real signed-in admin bearer token was not available in this slice, so the protected `PUT` setup route was verified only through failure-path auth enforcement (`401`) rather than a successful write
- this slice edits only the setup/configuration surface; tuning weights and job controls are intentionally left for later steps
- the root build still shows the same pre-existing CSS `@import` warning and large chunk-size warning

## 8. Exact Next Step

Phase 10 Step 5 should add the job control plane:

- initial extract/load trigger
- manual incremental refresh trigger
- recompute trigger
- run history and status visibility inside the root admin surface

# Stage Lock: Phase 10 Step 5 Job Control Plane

Date: 2026-04-27  
Slice: first safe job-control-plane bridge inside the root Game-Changrs admin shell

## 1. Goal Of The Slice

Extend `/analytics/admin` beyond setup editing so the signed-in admin flow can also drive the existing protected cricket match-ops endpoints from the root app.

This slice specifically delivers:

- live match-ops summary for the selected series
- manual refresh request creation by CricClubs match URL
- recent manual refresh request visibility
- per-match selector override controls (`auto`, `force_include`, `force_exclude`)
- no change to public analytics landing, player search, or player report behavior

## 2. Exact Files Changed

- `src/lib/cricketApi.ts`
- `src/pages/AnalyticsAdmin.tsx`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step5_job_control_plane_complete_2026-04-27.md`

## 3. Exact Migration Applied

- No new migration was added in this step.
- This slice still depends on the existing Step 1 migration:
  - `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- Applied to Supabase in this step: **no**

## 4. Exact Local Run Commands

Root build:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
npm run build
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
curl -i -sS http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/matches
curl -i -sS -H "Authorization: Bearer invalid-token" "http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/matches?limit=10"
curl -I -sS http://127.0.0.1:8082/analytics/admin
curl -i -sS "http://127.0.0.1:8082/cricket-api/api/series/bay-area-usac-hub-2026/admin/matches?limit=10"
curl -i -sS http://127.0.0.1:8082/cricket-api/api/dashboard/summary
curl -I -sS http://127.0.0.1:8082/analytics
curl -I -sS "http://127.0.0.1:8082/analytics/reports/176?divisionId=3"
```

## 5. Exact URLs Verified

Direct API:

- `http://127.0.0.1:4014/health`
- `http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/matches`
- `http://127.0.0.1:4014/api/series/bay-area-usac-hub-2026/admin/matches?limit=10`

Root app and proxy:

- `http://127.0.0.1:8082/analytics/admin`
- `http://127.0.0.1:8082/cricket-api/api/series/bay-area-usac-hub-2026/admin/matches?limit=10`
- `http://127.0.0.1:8082/cricket-api/api/dashboard/summary`
- `http://127.0.0.1:8082/analytics`
- `http://127.0.0.1:8082/analytics/reports/176?divisionId=3`

Browser note:

- direct browser navigation to `http://127.0.0.1:8082/analytics/admin` redirected to `/auth` without a signed-in session, which is expected for the protected root admin flow

## 6. Exact Deploy Status

- GitHub: not pushed in this step
- Supabase migration: not applied in this step
- Render: not deployed in this step
- Lovable: not published in this step
- Local verification: complete

## 7. Blockers Or Known Gaps

- the Step 1 tenant/entity migration is still not applied to the shared Supabase project, so real entity-scoped admin success-path verification is still blocked
- a real signed-in admin bearer token was not available in this slice, so the protected match-ops endpoints were verified only through failure-path auth enforcement (`401`) rather than successful writes
- this slice intentionally stops at existing match-ops capabilities; full-series extract triggers, scheduled weekly jobs, and durable worker run history are still deferred
- the root build still shows the same pre-existing CSS `@import` warning and large chunk-size warning
- browser verification also surfaced the same pre-existing React Router future-flag warnings

## 8. Exact Next Step

Phase 10 Step 6 should add viewer access and sharing:

- entity-scoped viewer grants
- invite or add users to a series
- grant and revoke report access
- begin enforcing viewer access on root analytics and report routes

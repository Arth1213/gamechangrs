# Stage Lock: Phase 10 Step 2 API Auth Boundary

Date: 2026-04-27  
Slice: Render cricket API auth boundary for admin routes

## 1. Goal Of The Slice

Add an authenticated authorization boundary to the Render cricket API so admin routes are no longer publicly open, while keeping the working public cricket analytics flow unchanged.

This slice specifically targets:

- admin setup routes
- admin tuning routes
- admin match-ops routes

Public routes such as `/`, `/health`, search, dashboard summary, and player report routes remain intentionally unchanged in this step.

## 2. Exact Files Changed

- `bay-area-u15/apps/api/src/lib/auth.js`
- `bay-area-u15/apps/api/src/services/accessService.js`
- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/.env.example`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step2_api_auth_boundary_complete_2026-04-27.md`

## 3. Exact Migration Applied

- No new migration was added in this step.
- The auth boundary code depends on the Phase 10 Step 1 migration:
  - `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- Applied to Supabase in this step: **no**

## 4. Exact Local Run Commands

Syntax checks:

```bash
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src/lib/auth.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src/services/accessService.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15/apps/api/src/server.js
```

Local API run:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
PORT=4012 node apps/api/src/server.js
```

Verification commands:

```bash
curl -sS http://127.0.0.1:4012/health
curl -sS "http://127.0.0.1:4012/api/players/search?q=Shreyak"
curl -i -sS "http://127.0.0.1:4012/api/dashboard/summary"
curl -i -sS "http://127.0.0.1:4012/players/176?divisionId=3"
curl -i -sS "http://127.0.0.1:4012/api/series/bay-area-usac-hub-2026/admin/setup"
curl -i -sS -H "Authorization: Bearer invalid-token" "http://127.0.0.1:4012/api/series/bay-area-usac-hub-2026/admin/setup"
curl -i -sS "http://127.0.0.1:4012/admin/series/bay-area-usac-hub-2026/setup"
```

## 5. Exact URLs Verified

Public routes verified:

- `http://127.0.0.1:4012/health`
- `http://127.0.0.1:4012/api/players/search?q=Shreyak`
- `http://127.0.0.1:4012/api/dashboard/summary`
- `http://127.0.0.1:4012/players/176?divisionId=3`

Admin-route protection verified:

- `http://127.0.0.1:4012/api/series/bay-area-usac-hub-2026/admin/setup`
- `http://127.0.0.1:4012/admin/series/bay-area-usac-hub-2026/setup`

## 6. Exact Deploy Status

- GitHub: not pushed in this step
- Supabase migration: not applied in this step
- Render: not deployed in this step
- Lovable: not published in this step
- Local API verification: complete

## 7. Verified Behavior Change

- admin JSON routes now require a Supabase bearer token
- invalid bearer tokens are rejected
- public dashboard, search, and player report routes still work unchanged
- local API auth can use values from either `bay-area-u15/.env` or repo-root `.env` for local development fallback

## 8. Blockers Or Known Gaps

- authenticated admin success was **not** verified end to end because no valid local admin bearer token was supplied during this slice
- the Step 1 entity foundation migration has still not been applied to the target Supabase project, so even with a valid token, full entity-admin authorization will not succeed until that migration is applied
- HTML admin pages are protected by the same auth boundary, but direct browser navigation without an auth header will fail by design
- no root-app admin shell exists yet, so there is not yet a frontend surface sending authenticated admin requests to these routes

## 9. Exact Next Step

Phase 10 Step 3 should add the root Game-Changrs admin shell:

- signed-in admin-only route in the root app
- entity/series list scoped to the signed-in admin
- authenticated calls from the root app to the protected Render admin JSON endpoints

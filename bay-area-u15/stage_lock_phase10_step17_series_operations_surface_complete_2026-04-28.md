# Stage Lock: Phase 10 Step 17 Series Operations Surface Complete

Date: 2026-04-28

## Goal of the slice

Upgrade the series admin console so the existing live match-ops capability reads like a proper series operations surface:

- promote the current match-ops area into a clearer `Series operations` console
- add a true series-level pending-ops summary from the backend
- keep the live controls real and narrow:
  - manual refresh requests
  - recent refresh activity
  - loaded review-queue visibility
  - per-match selector overrides
- explicitly keep full-series pull, scheduler actions, and durable worker-run history deferred until the worker control plane is production-ready

## Exact files changed

- `bay-area-u15/apps/api/src/services/adminService.js`
- `src/lib/cricketApi.ts`
- `src/pages/AnalyticsAdmin.tsx`
- `bay-area-u15/stage_lock_phase10_step17_series_operations_surface_complete_2026-04-28.md`

Local-only files intentionally not committed:

- `bay-area-u15/.env`
- `supabase/.temp/`

## Exact migration applied

- none

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run build

node --check bay-area-u15/apps/api/src/services/adminService.js

npx eslint src/pages/AnalyticsAdmin.tsx src/lib/cricketApi.ts

cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
CRICKET_API_PROXY_TARGET=http://127.0.0.1:4017 npm run dev -- --host 127.0.0.1 --port 4174

cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4017 node apps/api/src/server.js
```

Direct payload verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
cd bay-area-u15 && node - <<'NODE'
const path = require('path');
const { loadEnvFile } = require('./apps/api/src/lib/env');
loadEnvFile(path.resolve(process.cwd(), '.env'));
const { getMatchOpsPayload } = require('./apps/api/src/services/adminService');

(async () => {
  const payload = await getMatchOpsPayload({ seriesConfigKey: 'bay-area-usac-hub-2026', limit: 10 });
  console.log(JSON.stringify({
    summary: payload.summary,
    recentRequests: payload.recentRequests.length,
    firstMatch: payload.matches[0]
      ? {
          matchId: payload.matches[0].matchId,
          sourceMatchId: payload.matches[0].sourceMatchId,
        }
      : null,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Route verification:

```bash
curl -sS http://127.0.0.1:4017/health
curl -I http://127.0.0.1:4174/analytics
curl -I http://127.0.0.1:4174/analytics/admin/series
curl -I http://127.0.0.1:4174/analytics/workspace
```

## Exact URLs verified

- `http://127.0.0.1:4017/health`
- `http://127.0.0.1:4174/analytics`
- `http://127.0.0.1:4174/analytics/admin/series`
- `http://127.0.0.1:4174/analytics/workspace`

Verified payload detail:

- `getMatchOpsPayload({ seriesConfigKey: "bay-area-usac-hub-2026", limit: 10 })` returned:
  - `summary.totalMatches = 42`
  - `summary.computedMatches = 42`
  - `summary.warningMatches = 7`
  - `summary.overriddenMatches = 0`
  - `summary.pendingOps = 0`

## Exact deploy status

- GitHub: pushed after this slice to `phase10-entity-series-deploy` and `main`
- Render: required after push because the cricket API contract changed
- Lovable / published frontend: publish still required after the frontend syncs from GitHub

## What changed

- the series admin console now labels this surface as `Series operations`
- the live summary now includes a true backend `pendingOps` count
- the top of the section now reads as an operations console instead of an optional utility block
- current live capabilities are clearer:
  - manual refresh status
  - scheduled-refresh entitlement visibility
  - latest refresh activity
  - review-queue preview
  - per-match override controls
- recent refresh rows now support reusing the source URL back into the refresh form
- the page now makes the current boundary explicit: no fake series-wide runner button until the worker control plane is ready

## Blockers or known gaps

- full-series pull, scheduled-run triggers, and durable worker-run history are still intentionally deferred
- the worker bundle under `bay-area-u15/apps/worker` is still scaffold-level, so exposing a live server-side “pull all new matches” action would be misleading right now
- targeted ESLint still reports non-blocking React hook dependency warnings on `src/pages/AnalyticsAdmin.tsx`
- this slice verified payloads, builds, and route serving locally, but not a signed-in hosted browser walkthrough of the updated admin surface

## Next step

Build the first real protected series-operations control-plane slice:

1. define the safe runtime boundary for series-wide admin actions
2. add a durable operation-request record or equivalent control-plane primitive
3. expose a real `pull all new matches` action only once it is backed by a production-safe runner path
4. then add run visibility, status history, and operator feedback in the series admin console

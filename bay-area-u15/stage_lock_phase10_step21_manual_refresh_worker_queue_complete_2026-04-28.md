# Phase 10 Step 21 Lock

## Goal of the slice
- Move manual refresh from request-only logging to a real worker-backed queue path and surface truthful live status in the admin console.

## Exact files changed
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/api/src/server.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/api/src/services/adminService.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/index.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/ops/seriesOperationRunner.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/package.json`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/src/lib/cricketApi.ts`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/src/pages/AnalyticsAdmin.tsx`

## Exact migration applied
- None.

## Exact local run commands
```bash
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/api/src/services/adminService.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/api/src/server.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/index.js
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/ops/seriesOperationRunner.js
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15 && node <<'NODE'
const { createManualRefreshRequest } = require('./apps/api/src/services/adminService');
const { closePool } = require('./apps/api/src/lib/connection');
(async () => {
  try {
    const payload = await createManualRefreshRequest({
      seriesConfigKey: 'bay-area-usac-hub-2026',
      actorUserId: 'phase10-step21-check',
      actorEmail: 'phase10-step21-check@example.com',
      body: {
        matchUrl: 'https://cricclubs.com/USACricketJunior/viewScorecard.do?matchId=7574&clubId=40319',
        reason: 'Phase 10 Step 21 worker-backed manual refresh verification.',
      },
      dryRun: false,
    });
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await closePool();
  }
})();
NODE
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15 && node apps/worker/src/index.js process-manual-refresh-queue --limit 1
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15 && node <<'NODE'
const { getMatchOpsPayload } = require('./apps/api/src/services/adminService');
const { closePool } = require('./apps/api/src/lib/connection');
(async () => {
  try {
    const payload = await getMatchOpsPayload({
      seriesConfigKey: 'bay-area-usac-hub-2026',
      limit: 5,
    });
    console.log(JSON.stringify({
      refreshSummary: payload.refreshSummary,
      latestRefreshRequest: payload.recentRequests?.[0] || null,
    }, null, 2));
  } finally {
    await closePool();
  }
})();
NODE
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy && npm run build
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15 && PORT=4019 node apps/api/src/server.js
curl -s http://127.0.0.1:4019/health
```

## Exact URLs verified
- `http://127.0.0.1:4019/health`

## Exact deploy status
- Local only.
- Not pushed in this step.
- Not deployed in this step.

## Blockers or known gaps
- Manual refresh now runs a real worker-backed discovery/inventory refresh and relinks the requested match, but it still does not execute full scorecard/commentary extraction or recompute.
- `recompute_series` remains intentionally deferred.
- Browser-auth UI was not manually exercised in this step; verification was service-level plus production build.

## Good to go
- Yes.

## What the next step will do
- Step 22 should surface worker visibility more directly in the admin experience, including clearer worker history, request provenance, and then move toward scheduled/manual operational controls for series refreshes.

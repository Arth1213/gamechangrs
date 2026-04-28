# Phase 10 Step 20 Lock

## Goal of the slice
- Make the series operations area in the admin console truthful about what is actually live versus still deferred.

## Exact files changed
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/api/src/services/adminService.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/src/lib/cricketApi.ts`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/src/pages/AnalyticsAdmin.tsx`

## Exact migration applied
- None.

## Exact local run commands
```bash
node --check /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/api/src/services/adminService.js
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
      availableOperations: payload.availableOperations,
      firstRequest: payload.operationRequests?.[0] || null,
      summary: payload.operationsSummary,
    }, null, 2));
  } finally {
    await closePool();
  }
})();
NODE
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15 && node <<'NODE'
const { createSeriesOperationRequest } = require('./apps/api/src/services/adminService');
const { closePool } = require('./apps/api/src/lib/connection');
(async () => {
  try {
    await createSeriesOperationRequest({
      seriesConfigKey: 'bay-area-usac-hub-2026',
      actorUserId: 'phase10-step20-check',
      actorEmail: 'phase10-step20-check@example.com',
      body: {
        operationKey: 'recompute_series',
        requestNote: 'step20 verification',
      },
      dryRun: false,
    });
  } catch (error) {
    console.log(JSON.stringify({
      statusCode: error.statusCode || null,
      message: error.message,
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
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15 && PORT=4018 node apps/api/src/server.js
```

```bash
curl -s http://127.0.0.1:4018/health
curl -s http://127.0.0.1:4018/api/dashboard/summary
```

## Exact URLs verified
- `http://127.0.0.1:4018/health`
- `http://127.0.0.1:4018/api/dashboard/summary`

## Exact deploy status
- Local only.
- Not pushed in this step.
- Not deployed in this step.

## Blockers or known gaps
- `recompute_series` is intentionally deferred and now blocked truthfully until full scorecard/commentary persistence exists.
- The local dataset currently reports `computedMatches: 0` and `pendingOps: 42` on `/api/dashboard/summary`, so the admin console will surface that current state rather than a fully-computed state.
- No browser-auth flow was re-verified in this step; verification was backend plus production build only.

## Good to go
- Yes.

## What the next step will do
- Step 21 should make the next operational control real, preferably by moving manual refresh from request logging toward worker-backed execution and surfacing that run status cleanly in the admin console.

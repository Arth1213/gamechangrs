# Stage Lock: Phase 10 Step 18 Series Operation Request Queue Complete

Date: 2026-04-28

## Goal of the slice

Add the first durable protected control-plane primitive for series-wide operations without pretending the scaffold worker is already a production runner:

- create a durable `series_operation_request` queue in the analytics database
- expose a protected admin API to queue series-wide requests
- keep the root series admin console as the main operator surface
- add real buttons for:
  - `Pull new matches`
  - `Recompute series`
- keep actual worker execution, scheduler automation, and durable run history deferred until the runner path is hardened

## Exact files changed

- `supabase/migrations/20260428084500_phase10_series_operation_requests.sql`
- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/apps/api/src/services/adminService.js`
- `bay-area-u15/apps/api/src/services/subscriptionService.js`
- `src/lib/cricketApi.ts`
- `src/pages/AnalyticsAdmin.tsx`
- `bay-area-u15/stage_lock_phase10_step18_series_operation_request_queue_complete_2026-04-28.md`

Local-only files intentionally not committed:

- `bay-area-u15/.env`
- `supabase/.temp/`

## Exact migration applied

Applied directly to the live analytics database:

- `supabase/migrations/20260428084500_phase10_series_operation_requests.sql`

Applied via the local Node/Postgres runtime against `bay-area-u15/.env` `DATABASE_URL`, not via repo-wide `supabase db push`.

## Exact local run commands

Build and syntax checks:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run build

node --check bay-area-u15/apps/api/src/server.js
node --check bay-area-u15/apps/api/src/services/adminService.js
node --check bay-area-u15/apps/api/src/services/subscriptionService.js

npx eslint src/pages/AnalyticsAdmin.tsx src/lib/cricketApi.ts
```

Targeted migration apply:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { loadEnvFile } = require('./apps/api/src/lib/env');

const workdir = process.cwd();
const migrationVersion = '20260428084500';
const migrationName = 'phase10_series_operation_requests';
const migrationPath = path.resolve(workdir, '../supabase/migrations/20260428084500_phase10_series_operation_requests.sql');

loadEnvFile(path.resolve(workdir, '.env'));
const sslMode = String(process.env.DATABASE_SSL_MODE || 'disable').toLowerCase();
const ssl = sslMode === 'require'
  ? { rejectUnauthorized: false }
  : sslMode === 'verify-full'
    ? { rejectUnauthorized: true }
    : undefined;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });

(async () => {
  try {
    const before = await pool.query(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'series_operation_request'
      ) as exists
    `);

    if (!before.rows[0]?.exists) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
    }

    await pool.query(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ($1, $2)
       on conflict (version) do nothing`,
      [migrationVersion, migrationName]
    );
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Dry-run queue verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node - <<'NODE'
const path = require('path');
const { loadEnvFile } = require('./apps/api/src/lib/env');
loadEnvFile(path.resolve(process.cwd(), '.env'));
const { createSeriesOperationRequest, getMatchOpsPayload } = require('./apps/api/src/services/adminService');

(async () => {
  const result = await createSeriesOperationRequest({
    seriesConfigKey: 'bay-area-usac-hub-2026',
    actorUserId: '5ffa7fd5-37b9-4505-b819-8357be68de8f',
    actorEmail: 'phase10-dry-run@game-changrs.local',
    body: {
      operationKey: 'discover_new_matches',
      requestNote: 'Dry-run verification for Step 18 series operations queue.',
    },
    dryRun: true,
  });

  const payload = await getMatchOpsPayload({ seriesConfigKey: 'bay-area-usac-hub-2026', limit: 5 });
  console.log(JSON.stringify({
    dryRun: result.dryRun === true,
    message: result.message,
    request: result.request,
    operationsSummary: payload.operationsSummary,
    operationRequestsCount: (payload.operationRequests || []).length,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Local API and root app:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4018 node apps/api/src/server.js
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
CRICKET_API_PROXY_TARGET=http://127.0.0.1:4018 npm run dev -- --host 127.0.0.1 --port 4175
```

Verification commands:

```bash
curl -sS http://127.0.0.1:4018/health
curl -i -sS -X POST http://127.0.0.1:4018/api/series/bay-area-usac-hub-2026/admin/operations/requests \
  -H 'Content-Type: application/json' \
  --data '{"operationKey":"discover_new_matches"}'
curl -I http://127.0.0.1:4175/analytics
curl -I http://127.0.0.1:4175/analytics/admin/series
```

## Exact URLs verified

- `http://127.0.0.1:4018/health`
- `http://127.0.0.1:4018/api/series/bay-area-usac-hub-2026/admin/operations/requests`
- `http://127.0.0.1:4175/analytics`
- `http://127.0.0.1:4175/analytics/admin/series`

Verified behavior:

- `/health` returned `200`
- unauthenticated `POST /api/series/bay-area-usac-hub-2026/admin/operations/requests` returned `401`
- the dry-run service call returned:
  - `message = "Pull new matches dry-run validated."`
  - `request.requestStatus = "pending"`
  - `request.runnerMode = "deferred"`
- the follow-up payload check confirmed the dry-run left the live queue empty:
  - `operationsSummary.totalRequests = 0`
  - `operationRequestsCount = 0`

## Exact deploy status

- GitHub: pushed after this slice to `phase10-entity-series-deploy` and `main`
- Render: required after push because the cricket API changed
- Lovable / published frontend: publish still required after the frontend syncs from GitHub

## What changed

- added a durable `series_operation_request` table for protected series-wide admin operations
- added a protected admin API route to queue series-wide operation requests
- enforced scheduled-refresh entitlement for the new series-wide operation queue
- extended the admin match-ops payload with:
  - `operationsSummary`
  - `operationRequests`
- added root admin buttons for:
  - `Pull new matches`
  - `Recompute series`
- added queue visibility in the root admin console, including:
  - queue status
  - latest series-wide request
  - recent request rows
  - operator notes
- kept worker execution explicitly deferred by marking the current queue mode as `deferred`

## Blockers or known gaps

- queueing is real, but automatic execution is not wired yet; requests are durable control-plane records, not completed worker runs
- the worker bundle under `bay-area-u15/apps/worker` is still scaffold-level, so Render should not execute these queued requests automatically yet
- targeted ESLint still reports non-blocking React hook dependency warnings on `src/pages/AnalyticsAdmin.tsx`
- this slice verified build, migration, dry-run queue behavior, auth failure path, and local route serving; it did not include a signed-in hosted browser walkthrough of the new buttons yet

## Next step

Build the first actual runner bridge for queued series operations:

1. define how queued requests transition from `pending` to `processing`
2. add a safe worker invocation boundary outside the browser
3. record worker notes and final results back onto `series_operation_request`
4. surface real run progress and completion/failure states in the series admin console

# Stage Lock: Phase 10 Step 34 - Local Ops Console Complete

Date: 2026-04-29

## Goal of the slice

Add a localhost operator console so the cricket local-ops flow can be run from a browser on this machine instead of only through terminal commands.

This slice keeps the hosted boundary intact by making the console:

- local-only
- loopback-only
- env-gated

## Exact files changed

- `bay-area-u15/apps/api/src/services/localOpsService.js`
- `bay-area-u15/apps/api/src/render/localOpsPage.js`
- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/package.json`
- `bay-area-u15/README.md`
- `bay-area-u15/stage_lock_phase10_step34_local_ops_console_complete_2026-04-29.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node --check apps/api/src/services/localOpsService.js
node --check apps/api/src/render/localOpsPage.js
node --check apps/api/src/server.js
PORT=4012 npm run ops:ui:start
curl -sS http://127.0.0.1:4012/local-ops
curl -sS http://127.0.0.1:4012/api/local-ops/overview
curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/validate-series -H 'Content-Type: application/json' -d '{"series":"bay-area-usac-hub-2026"}'
curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/publish-series -H 'Content-Type: application/json' -d '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27","dryRun":true}'
PORT=4013 npm run api:start
curl -i -sS http://127.0.0.1:4013/local-ops
```

## Exact URLs verified

- `http://127.0.0.1:4012/local-ops`
- `http://127.0.0.1:4012/api/local-ops/overview`
- `http://127.0.0.1:4012/api/local-ops/actions/validate-series`
- `http://127.0.0.1:4012/api/local-ops/actions/publish-series`
- `http://127.0.0.1:4013/local-ops`

## Verification result

- `ops:ui:start` now correctly exposes the local console on loopback when started with the env-gated script.
- `/local-ops` renders the local console HTML and shows the expected local start command.
- `/api/local-ops/overview` returns both configured series plus their stored artifact summaries.
- `validate-series` succeeds for `bay-area-usac-hub-2026` with `publishReady=true`.
- `publish-series` dry-run stays blocked for `bay-area-youth-cricket-hub-2025-milc-2025-27` because parsed coverage is only `2 / 144`.
- A plain `api:start` runtime on `4013` returns `404` for `/local-ops`, confirming the env gate works.

## What changed

- Added a local-only browser console at `/local-ops`
- Added loopback-only API endpoints for local ops actions
- Added a shared local ops service layer that can execute:
  - `probe`
  - `register`
  - `stage`
  - `run`
  - `refresh-series`
  - `refresh-match`
  - `compute-season`
  - `compute-composite`
  - `enrich-profiles`
  - `compute-intelligence`
  - `validate-series`
  - `publish-series`
- Added a local overview endpoint so the page can show configured series and latest artifacts
- Added `ops:ui:start` convenience script
- Adjusted `ops:ui:start` to use `env LOCAL_OPS_ENABLE_UI=true` so the flag reliably reaches the Node process on this machine
- Updated the console page to display the actual recommended start command: `PORT=<port> npm run ops:ui:start`

## Exact deploy status

- No hosted frontend deploy
- No Render deploy
- Local-only console slice

## Blockers or known gaps

- Operations still run synchronously in the request path, so long-running actions will hold the browser request open until completion.
- No live streaming/log tail yet.
- No auth layer is added here because this console is restricted to loopback and requires an explicit env flag.

## Good to go with next step

- Yes

## What the next step will do

Step 35 should finalize the full runbook path around this console and the terminal path, then Step 36 should use the locked flow to fully onboard MilC 2025 end to end.

# Stage Lock: Phase 10 Step 41 - Local Ops Background Queue Complete

Date: 2026-04-30

## Goal of the slice

Move heavy localhost local-ops actions off the request path into a background queue, then surface queue state, recent run history, and retry affordances in the local operator console.

## Exact files changed

- `bay-area-u15/apps/api/src/services/localOpsService.js`
- `bay-area-u15/apps/api/src/render/localOpsPage.js`
- `bay-area-u15/stage_lock_phase10_step41_local_ops_background_queue_complete_2026-04-30.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15

node -e "require('./apps/api/src/services/localOpsService'); console.log('localOpsService-ok')"
node -e "require('./apps/api/src/render/localOpsPage'); console.log('localOpsPage-ok')"

set -a; source .env; set +a; PORT=4012 LOCAL_OPS_ENABLE_UI=true node apps/api/src/server.js

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/compute-intelligence \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27"}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/compute-composite \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27"}'

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const series=data.series.find((entry)=>entry.slug==='bay-area-youth-cricket-hub-2025-milc-2025-27'); console.log(JSON.stringify({backgroundQueue:data.backgroundQueue, latestRun:series?.latestRun ?? null, recentRuns:(series?.recentRuns ?? []).slice(0,5)}, null, 2));"

curl -sS http://127.0.0.1:4012/local-ops | rg -n "Local Action Queue|Recent Runs|Retry Run|Latest Operator Run"

find storage/exports/_local_ops/series/bay-area-youth-cricket-hub-2025-milc-2025-27/runs -maxdepth 2 \( -name status.json -o -name output.log \) | sort | tail -n 6
```

## Exact URLs verified

- `http://127.0.0.1:4012/local-ops`
- `http://127.0.0.1:4012/api/local-ops/overview`
- `http://127.0.0.1:4012/api/local-ops/actions/compute-intelligence`
- `http://127.0.0.1:4012/api/local-ops/actions/compute-composite`

## Exact deploy status

- Local only
- No hosted frontend deploy
- No Render deploy
- No Supabase migration or deploy

## What changed

- Heavy local-ops actions now enqueue into a local background worker queue instead of holding the browser request open.
- Queue-backed actions currently include:
  - `stage`
  - `run`
  - `compute-season`
  - `compute-composite`
  - `enrich-profiles`
  - `compute-intelligence`
  - `refresh-series`
  - `refresh-match`
  - `validate-series`
  - `publish-series`
- Light actions remain inline:
  - `probe`
  - `register`
- Queue execution is intentionally single-worker right now:
  - `LOCAL_OPS_BACKGROUND_CONCURRENCY = 1`
- Each queued run now persists:
  - per-run `status.json`
  - per-run `output.log`
  - per-series `latest_run.json`
  - global `latest_run.json`
- The overview payload now includes:
  - top-level `backgroundQueue`
  - `series[].latestRun`
  - `series[].recentRuns`
- The local-ops page now renders:
  - `Local Action Queue`
  - `Latest Operator Run`
  - `Recent Runs`
  - `Retry Run` controls for completed/failed/stale work
- Verification confirmed the queue behavior end to end:
  - `compute-intelligence` started immediately
  - `compute-composite` queued behind it
  - the queue drained cleanly
  - both runs finished and persisted logs/artifacts

## Blockers or known gaps

- The queue is in-process memory plus persisted run state; queued jobs do not survive an API restart mid-flight.
- There is no cancel, reprioritize, or concurrency tuning control in the UI yet.
- Live progress is polling-based from persisted files, not websocket/SSE streaming.
- Retry currently replays the stored input for a prior action; there is not yet a higher-level chained workflow retry.

## Cumulative status

| Step | What it is doing | Status |
|---|---|---|
| 34 | Local operator console / localhost admin surface | Done |
| 35 | Runbook finalization across the full ops flow | Done |
| 36 | Full MilC onboarding through locked runbook/agent | Done |
| 37 | Dual-report viewer access and report switcher | Done |
| 38 | Multi-series workspace activation readiness | Done |
| 39 | Local ops workflow hardening and queue-aware next-step guidance | Done |
| 40 | Local ops run visibility and stale live-series follow-up cleanup | Done |
| 41 | Local background queue, recent runs, and retry visibility | Done |

## Good to go with next step

- Yes

## What the next step will do

Step 42 should turn the existing workflow tracks into queue-backed operator presets so onboarding and refresh become guided multi-step runs instead of isolated button presses. That means chained execution for `New Series` and `Refresh Existing`, guarded by validation/publish rules and backed by the new run-history model added here.

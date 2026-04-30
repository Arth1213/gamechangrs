# Stage Lock: Phase 10 Step 44 - Local Ops Restart Recovery Complete

Date: 2026-04-30

## Goal of the slice

Harden the local ops console so unfinished local workflow runs survive an API restart safely:

- detect persisted `queued` and `running` local ops runs after restart
- mark them as `interrupted` instead of silently losing them
- preserve the run detail path and status file path for operator inspection
- derive a manual resume action from the first unfinished workflow step
- keep restart recovery manual, not automatic, so live publish work never restarts unexpectedly

## Exact files changed

- `bay-area-u15/apps/api/src/services/localOpsService.js`
- `bay-area-u15/apps/api/src/render/localOpsPage.js`
- `bay-area-u15/stage_lock_phase10_step44_local_ops_restart_recovery_complete_2026-04-30.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy

node -c bay-area-u15/apps/api/src/services/localOpsService.js
node -c bay-area-u15/apps/api/src/render/localOpsPage.js
node -e "require('./bay-area-u15/apps/api/src/services/localOpsService'); console.log('localOpsService-ok')"
node -e "require('./bay-area-u15/apps/api/src/render/localOpsPage'); console.log('localOpsPage-ok')"

cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15

set -a
source .env
set +a
PORT=4012 LOCAL_OPS_ENABLE_UI=true node apps/api/src/server.js

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-refresh \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27","dryRun":true,"fromStep":"compute-intelligence"}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-publish \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","dryRun":true}'

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const milc=data.series.find((entry)=>entry.slug==='bay-area-youth-cricket-hub-2025-milc-2025-27'); const bay=data.series.find((entry)=>entry.slug==='bay-area-usac-hub-2026'); console.log(JSON.stringify({milcLatest:milc?.latestRun ? {runId:milc.latestRun.runId,status:milc.latestRun.status,workflowSteps:(milc.latestRun.workflowSteps||[]).map((step)=>({key:step.key,status:step.status}))}: null, bayLatest:bay?.latestRun ? {runId:bay.latestRun.runId,status:bay.latestRun.status,workflowSteps:(bay.latestRun.workflowSteps||[]).map((step)=>({key:step.key,status:step.status}))}: null, queue:data.backgroundQueue}, null, 2));"

lsof -ti tcp:4012
kill -9 <server_pid>

set -a
source .env
set +a
PORT=4012 LOCAL_OPS_ENABLE_UI=true node apps/api/src/server.js

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const milc=data.series.find((entry)=>entry.slug==='bay-area-youth-cricket-hub-2025-milc-2025-27'); const bay=data.series.find((entry)=>entry.slug==='bay-area-usac-hub-2026'); console.log(JSON.stringify({milcLatest:milc?.latestRun ? {runId:milc.latestRun.runId,status:milc.latestRun.status,summary:milc.latestRun.summary,detailPath:milc.latestRun.detailPath,resumeLabel:milc.latestRun.workflowResume?.label || null,resumePayload:milc.latestRun.workflowResume?.payload || null,workflowStopReason:milc.latestRun.workflowStopReason,workflowSteps:(milc.latestRun.workflowSteps||[]).map((step)=>({key:step.key,status:step.status,summary:step.summary}))}: null, bayLatest:bay?.latestRun ? {runId:bay.latestRun.runId,status:bay.latestRun.status,summary:bay.latestRun.summary,detailPath:bay.latestRun.detailPath,resumeLabel:bay.latestRun.workflowResume?.label || null,resumePayload:bay.latestRun.workflowResume?.payload || null,workflowStopReason:bay.latestRun.workflowStopReason,workflowSteps:(bay.latestRun.workflowSteps||[]).map((step)=>({key:step.key,status:step.status,summary:step.summary}))}: null, queue:data.backgroundQueue}, null, 2));"

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-refresh \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27","dryRun":true,"fromStep":"compute-intelligence"}'

node -e "const fs=require('fs'); const p='storage/exports/_local_ops/series/bay-area-youth-cricket-hub-2025-milc-2025-27/runs/local-ops-1777576796437-9a62d0d5/status.json'; console.log(fs.readFileSync(p,'utf8'));"

curl -sS http://127.0.0.1:4012/local-ops | rg -n "Interrupted|Run Detail|Status File"
```

## Exact URLs verified

- `http://127.0.0.1:4012/local-ops`
- `http://127.0.0.1:4012/api/local-ops/overview`
- `http://127.0.0.1:4012/api/local-ops/actions/workflow-refresh`
- `http://127.0.0.1:4012/api/local-ops/actions/workflow-publish`

## Exact deploy status

- Local only
- No hosted frontend deploy
- No Render deploy
- No Supabase migration or deploy

## What changed

- Added restart-safe persisted path metadata on each run record:
  - `detailPath`
  - `statusPath`
  - existing `logPath`
- Added first-request recovery on API startup:
  - scan persisted `status.json` files under local ops run directories
  - convert unfinished `queued` or `running` runs into `interrupted`
  - clear stale in-memory queue expectations after restart
- Added workflow restart derivation:
  - if a workflow was actively running, resume from the first unfinished step
  - if a workflow was only queued, resume from the preserved workflow payload
- Rebuilt latest-run pointers from disk after recovery so the console surfaces the recovered run immediately.
- Updated the UI to render:
  - `Interrupted` status
  - run detail path
  - status file path
  - resumed workflow controls on recovered runs

## Verification results

- Verified syntax and module load for both updated files.
- Verified a running workflow and a queued workflow existed before forced restart:
  - MilC running run id: `local-ops-1777576764249-d9a06d0a`
  - Bay Area queued run id: `local-ops-1777576764275-2851a5f1`
- Verified forced restart recovery after `kill -9` on the local API server:
  - MilC run recovered as `interrupted`
  - Bay Area queued publish run recovered as `interrupted`
  - both preserved `detailPath`
  - MilC resume control pointed to `fromStep=compute-intelligence`
  - Bay Area resume control reused the saved publish payload
- Verified post-restart manual resume works:
  - resumed MilC run id: `local-ops-1777576796437-9a62d0d5`
  - resumed workflow completed all 3 remaining steps:
    - `compute-intelligence`
    - `validate-series`
    - `publish-series-dry-run`
- Verified `/local-ops` includes the new interrupted-state UI labels and run detail/status path sections.

## Blockers or known gaps

- Recovery is intentionally manual. The server does not auto-restart interrupted local ops work after reboot or API restart.
- A graceful shutdown can still let an in-flight workflow finish before process exit. The restart-recovery path was therefore verified with a forced process kill, which is the correct durability test for this slice.
- Resume controls currently live only in the local ops console and local API payloads; there is still no separate dedicated run-detail page per run id.

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
| 42 | Guided workflow presets plus operator console start guide | Done |
| 43 | Queue cancel, rerun-from-step, resume metadata, and split dry/live presets | Done |
| 44 | Restart recovery for queued/running local ops runs | Done |

## Good to go with next step

- Yes

## What the next step will do

Step 45 should move from restart recovery into operator execution efficiency:

- add a dedicated run-detail view or deep-linked run inspector for a single run id
- surface stronger per-step log slices and artifact links without scanning raw JSON
- make operator debugging faster when onboarding or refreshing a new series from localhost

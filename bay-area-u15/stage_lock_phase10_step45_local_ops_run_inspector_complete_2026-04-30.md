# Stage Lock: Phase 10 Step 45 - Local Ops Run Inspector Complete

Date: 2026-04-30

## Goal of the slice

Add a dedicated local run inspector so operators can open one saved run directly instead of scanning the full console:

- deep-link into a single run by run id
- expose raw status, artifact, and log endpoints for that run
- render per-step workflow log slices in the inspector for completed workflow runs
- add `Open Run` links from the main local ops console

## Exact files changed

- `bay-area-u15/apps/api/src/services/localOpsService.js`
- `bay-area-u15/apps/api/src/render/localOpsPage.js`
- `bay-area-u15/apps/api/src/render/localOpsRunPage.js`
- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/stage_lock_phase10_step45_local_ops_run_inspector_complete_2026-04-30.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy

node -c bay-area-u15/apps/api/src/services/localOpsService.js
node -c bay-area-u15/apps/api/src/render/localOpsPage.js
node -c bay-area-u15/apps/api/src/render/localOpsRunPage.js
node -c bay-area-u15/apps/api/src/server.js
node -e "const svc=require('./bay-area-u15/apps/api/src/services/localOpsService'); console.log(typeof svc.getLocalOpsRunDetail)"
node -e "require('./bay-area-u15/apps/api/src/render/localOpsRunPage'); console.log('localOpsRunPage-ok')"

cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15

set -a
source .env
set +a
PORT=4012 LOCAL_OPS_ENABLE_UI=true node apps/api/src/server.js

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const bay=data.series.find((entry)=>entry.slug==='bay-area-usac-hub-2026'); const milc=data.series.find((entry)=>entry.slug==='bay-area-youth-cricket-hub-2025-milc-2025-27'); console.log(JSON.stringify({bayLatest:{runId:bay?.latestRun?.runId,status:bay?.latestRun?.status}, bayInterrupted:(bay?.recentRuns||[]).find((run)=>run.status==='interrupted')?.runId || null, milcLatest:{runId:milc?.latestRun?.runId,status:milc?.latestRun?.status}}, null, 2));"

curl -sS http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576764275-2851a5f1 | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({runId:data.run?.runId,status:data.run?.status,resumeLabel:data.run?.workflowResume?.label,detailPath:data.files?.detailPath,logLines:data.logLines?.length,stepLogCount:data.workflowStepLogs?.length}, null, 2));"

curl -sS http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5 | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({runId:data.run?.runId,status:data.run?.status,artifactPath:data.files?.artifactPath,stepLogs:(data.workflowStepLogs||[]).map((step)=>({key:step.key,status:step.status,logLines:step.logLines?.length || 0}))}, null, 2));"

curl -sS http://127.0.0.1:4012/local-ops/runs/local-ops-1777576764275-2851a5f1 | rg -n "Local Ops Run Inspector|Resume queued workflow|Saved Paths|Overview JSON|Status JSON|Open Log"

curl -sS http://127.0.0.1:4012/local-ops/runs/local-ops-1777576796437-9a62d0d5 | rg -n "Workflow Steps|Recompute player intelligence|Validate refreshed state|Run publish dry run|Saved JSON|Artifact JSON"

curl -sS http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5/artifact | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({ok:data.ok,dryRun:data.dryRun,message:data.message}, null, 2));"

curl -sS http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5/log | tail -n 6

curl -sS http://127.0.0.1:4012/local-ops | rg -n "Open Run"

tmpfile=/tmp/localops-console-step45.$RANDOM.js && curl -sS http://127.0.0.1:4012/local-ops | perl -0ne 'print $1 if /<script>(.*)<\\/script>/s' > "$tmpfile" && node --check "$tmpfile" && rm "$tmpfile"

tmpfile=/tmp/localops-run-step45.$RANDOM.js && curl -sS http://127.0.0.1:4012/local-ops/runs/local-ops-1777576764275-2851a5f1 | perl -0ne 'print $1 if /<script>(.*)<\\/script>/s' > "$tmpfile" && node --check "$tmpfile" && rm "$tmpfile"
```

## Exact URLs verified

- `http://127.0.0.1:4012/local-ops`
- `http://127.0.0.1:4012/local-ops/runs/local-ops-1777576764275-2851a5f1`
- `http://127.0.0.1:4012/local-ops/runs/local-ops-1777576796437-9a62d0d5`
- `http://127.0.0.1:4012/api/local-ops/overview`
- `http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576764275-2851a5f1`
- `http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5`
- `http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5/status`
- `http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5/artifact`
- `http://127.0.0.1:4012/api/local-ops/runs/local-ops-1777576796437-9a62d0d5/log`

## Exact deploy status

- Local only
- No hosted frontend deploy
- No Render deploy
- No Supabase migration or deploy

## What changed

- Added `getLocalOpsRunDetail(runId)` to load one persisted run and hydrate:
  - saved paths
  - raw status payload
  - parsed artifact payload
  - log tail
  - step-scoped workflow log slices
- Added new local-only routes:
  - `/local-ops/runs/:runId`
  - `/api/local-ops/runs/:runId`
  - `/api/local-ops/runs/:runId/status`
  - `/api/local-ops/runs/:runId/artifact`
  - `/api/local-ops/runs/:runId/log`
- Added a dedicated inspector page with:
  - run summary
  - saved paths
  - inline resume/retry/cancel controls
  - raw JSON panels
  - workflow step cards with step-scoped log tails
- Added `Open Run` links to the main `/local-ops` console so the operator can jump straight into a saved run.

## Verification results

- Verified syntax and module load for:
  - `localOpsService.js`
  - `localOpsPage.js`
  - `localOpsRunPage.js`
  - `server.js`
- Verified interrupted Bay Area run detail:
  - run id `local-ops-1777576764275-2851a5f1`
  - status `interrupted`
  - resume label `Resume queued workflow`
  - persisted `detailPath` present
- Verified completed MilC run detail:
  - run id `local-ops-1777576796437-9a62d0d5`
  - status `completed`
  - artifact path present
  - workflow step log slices captured for:
    - `compute-intelligence`
    - `validate-series`
    - `publish-series-dry-run`
- Verified raw artifact endpoint returned:
  - `ok: true`
  - `dryRun: true`
  - `message: "Dry-run publish validated."`
- Verified raw log endpoint returned the expected final publish log tail.
- Verified `/local-ops` now exposes `Open Run` links.
- Verified both inline browser scripts parse with `node --check`.

## Blockers or known gaps

- The run inspector is read-heavy and local-only; it does not yet support comparing two runs side-by-side.
- Step log slicing is based on workflow start markers in the saved log. It is reliable for current guided workflows, but older runs without workflow markers will fall back to the full run log only.
- The inspector exposes run-level artifact JSON, not step-specific artifact JSON, because step-level artifacts are not yet persisted as separate pointers inside the run record.

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
| 45 | Dedicated local ops run inspector and raw run endpoints | Done |

## Good to go with next step

- Yes

## What the next step will do

Step 46 should improve operator comparison and cleanup:

- compare the latest run against the previous run for the same series
- show what changed in validation/publish readiness between runs
- make interrupted or failed runs easier to triage without opening multiple run pages manually

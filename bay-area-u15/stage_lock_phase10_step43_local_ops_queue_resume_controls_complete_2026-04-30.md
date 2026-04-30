# Stage Lock: Phase 10 Step 43 - Local Ops Queue, Rerun, and Resume Controls Complete

Date: 2026-04-30

## Goal of the slice

Add operator-grade control to the local ops console so guided workflows are no longer one-shot queue entries with only a log tail:

- split dry-run and live-publish presets explicitly in the UI
- persist workflow step summaries into each run record
- add rerun-from-step controls for completed workflow steps
- add queued-run cancellation for local background jobs
- expose resume metadata for blocked or failed workflow runs

## Exact files changed

- `bay-area-u15/apps/api/src/services/localOpsService.js`
- `bay-area-u15/apps/api/src/render/localOpsPage.js`
- `bay-area-u15/stage_lock_phase10_step43_local_ops_queue_resume_controls_complete_2026-04-30.md`

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

curl -sS http://127.0.0.1:4012/local-ops | rg -n "Run Onboarding Dry Run|Run Onboarding Live Publish|Run Refresh Dry Run|Run Refresh Live Publish|Validate \\+ Dry Run|Validate \\+ Live Publish|Recent Runs|Step Summary|Cancel Queued Run"

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-publish \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","dryRun":true,"fromStep":"publish-series-dry-run"}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-publish \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","dryRun":false,"fromStep":"publish-series-live"}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/compute-intelligence \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27"}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-publish \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","dryRun":true}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/cancel-run \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","runId":"local-ops-1777574843221-0d89f0ef"}'

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const bay=data.series.find((entry)=>entry.slug==='bay-area-usac-hub-2026'); const detailed=(bay.recentRuns||[]).find((run)=>run.workflowKey==='publish' && run.workflowStartStepKey==='publish-series-live'); console.log(JSON.stringify(detailed ? {runId:detailed.runId,status:detailed.status,workflowKey:detailed.workflowKey,startStep:detailed.workflowStartStepKey,requestedSteps:detailed.workflowRequestedSteps,stepStatuses:(detailed.workflowSteps||[]).map((step)=>({key:step.key,status:step.status,summary:step.summary}))} : null, null, 2));"

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const bay=data.series.find((entry)=>entry.slug==='bay-area-usac-hub-2026'); const canceled=(bay.recentRuns||[]).find((run)=>run.status==='canceled')||null; console.log(JSON.stringify(canceled ? {runId:canceled.runId,status:canceled.status,summary:canceled.summary} : null, null, 2));"

tmpfile=/tmp/localops-step43-script.$RANDOM.js && curl -sS http://127.0.0.1:4012/local-ops | perl -0ne 'print $1 if /<script>(.*)<\\/script>/s' > "$tmpfile" && node --check "$tmpfile" && rm "$tmpfile"
```

## Exact URLs verified

- `http://127.0.0.1:4012/local-ops`
- `http://127.0.0.1:4012/api/local-ops/overview`
- `http://127.0.0.1:4012/api/local-ops/actions/workflow-publish`
- `http://127.0.0.1:4012/api/local-ops/actions/compute-intelligence`
- `http://127.0.0.1:4012/api/local-ops/actions/cancel-run`

## Exact deploy status

- Local only
- No hosted frontend deploy
- No Render deploy
- No Supabase migration or deploy

## What changed

- Workflow tracks now render split preset buttons instead of a single ambiguous chain trigger:
  - dry-run path
  - live-publish path
- Workflow run records now persist:
  - `workflowKey`
  - `workflowLabel`
  - `workflowStartStepKey`
  - `workflowStartStepLabel`
  - `workflowRequestedSteps`
  - `workflowSkippedSteps`
  - `workflowPlanSteps`
  - `workflowSteps`
  - `workflowRerunOptions`
  - `workflowResume`
  - `workflowStoppedEarly`
  - `workflowStopReason`
- Guided workflow command previews now include:
  - `--from-step <step>`
  - `--live-publish` when applicable
- Added `cancel-run` for queued local background work.
- Local queue cards and run history now surface cancel actions for queued runs.
- Recent workflow runs now render step-level outcome summaries and rerun-from-step buttons.
- Latest run view now shows workflow metadata instead of only top-level summary and log tail.

## Verification results

- Verified split workflow buttons are present in the page source:
  - `Run Onboarding Dry Run`
  - `Run Onboarding Live Publish`
  - `Run Refresh Dry Run`
  - `Run Refresh Live Publish`
  - `Validate + Dry Run`
  - `Validate + Live Publish`
- Verified a publish workflow can rerun from an exact step:
  - run id `local-ops-1777574814691-784a1620`
  - started from `publish-series-dry-run`
  - completed exactly 1 workflow step
- Verified a live publish workflow can rerun from the live step only:
  - run id `local-ops-1777574814714-f3c46d4f`
  - started from `publish-series-live`
  - completed exactly 1 workflow step
- Verified queued cancel while another local background job held the worker slot:
  - active job: MilC `compute-intelligence`
  - queued job: Bay Area `workflow-publish`
  - canceled run id `local-ops-1777574843221-0d89f0ef`
  - run state persisted as `canceled`
- Verified extracted `/local-ops` browser script still parses with `node --check`.

## Blockers or known gaps

- Resume controls are implemented in run metadata and UI, but the current local series state is healthy enough that this verification pass did not naturally produce a blocked or failed workflow run to surface the resume button live.
- Guided workflow execution is still in-process and local-only; an API restart still interrupts the active workflow.
- The latest-run pointer for a series now reflects the newest action exactly, which means a canceled queued run can become the current latest run until the next successful action lands. That is accurate, but operators need to read the status pill rather than assume the latest run was successful.

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

## Good to go with next step

- Yes

## What the next step will do

Step 44 should harden workflow durability:

- reload queued or interrupted workflow state after API restart
- persist a richer per-run handoff artifact so operators can reopen run detail without relying on `latest_run.json`
- make resume truly restart-safe instead of only queue-safe within a single API process

# Stage Lock: Phase 10 Step 42 - Local Ops Workflow Presets Complete

Date: 2026-04-30

## Goal of the slice

Turn the local-ops workflow tracks into queue-backed guided presets so the operator can launch full onboarding, refresh, or validate-and-publish chains from `/local-ops` instead of firing each low-level action manually.

This slice also adds the operator start guide for the local console.

## Exact files changed

- `bay-area-u15/apps/api/src/services/localOpsService.js`
- `bay-area-u15/apps/api/src/render/localOpsPage.js`
- `bay-area-u15/local_ops_operator_console_start_guide.md`
- `bay-area-u15/stage_lock_phase10_step42_local_ops_workflow_presets_complete_2026-04-30.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15

node -e "require('./apps/api/src/services/localOpsService'); console.log('localOpsService-ok')"
node -e "require('./apps/api/src/render/localOpsPage'); console.log('localOpsPage-ok')"

set -a
source .env
set +a
PORT=4012 LOCAL_OPS_ENABLE_UI=true node apps/api/src/server.js

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const out=data.series.map((s)=>({slug:s.slug,headline:s.workflow?.headline,onboarding:s.workflow?.onboarding?.status,onboardingPreset:s.workflow?.onboarding?.preset?.label||null,refresh:s.workflow?.refresh?.status,refreshPreset:s.workflow?.refresh?.preset?.label||null,publish:s.workflow?.publish?.status,publishPreset:s.workflow?.publish?.preset?.label||null})); console.log(JSON.stringify({runbooks:data.runbooks,series:out},null,2));"

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-onboarding \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-youth-cricket-hub-2025-milc-2025-27","dryRun":true}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-refresh \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","matchId":"7574","dryRun":true}'

curl -sS -X POST http://127.0.0.1:4012/api/local-ops/actions/workflow-publish \
  -H 'Content-Type: application/json' \
  --data '{"series":"bay-area-usac-hub-2026","dryRun":true}'

curl -sS http://127.0.0.1:4012/api/local-ops/overview | node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(0,'utf8')); const milc=data.series.find((entry)=>entry.slug==='bay-area-youth-cricket-hub-2025-milc-2025-27'); const bay=data.series.find((entry)=>entry.slug==='bay-area-usac-hub-2026'); console.log(JSON.stringify({backgroundQueue:data.backgroundQueue,milcLatest:milc?.latestRun ?? null,bayLatest:bay?.latestRun ?? null}, null, 2));"

tmpfile=/tmp/localops-script.$RANDOM.js && curl -sS http://127.0.0.1:4012/local-ops | perl -0ne 'print $1 if /<script>(.*)<\\/script>/s' > "$tmpfile" && node --check "$tmpfile"
```

## Exact URLs verified

- `http://127.0.0.1:4012/local-ops`
- `http://127.0.0.1:4012/api/local-ops/overview`
- `http://127.0.0.1:4012/api/local-ops/actions/workflow-onboarding`
- `http://127.0.0.1:4012/api/local-ops/actions/workflow-refresh`
- `http://127.0.0.1:4012/api/local-ops/actions/workflow-publish`

## Exact deploy status

- Local only
- No hosted frontend deploy
- No Render deploy
- No Supabase migration or deploy

## What changed

- Added three guided workflow actions:
  - `workflow-onboarding`
  - `workflow-refresh`
  - `workflow-publish`
- Guided workflow actions now execute inside the same local background queue model as heavy single-step actions.
- The queue runner now supports two execution modes:
  - spawned worker commands for existing heavy actions
  - in-process background task execution for guided workflow chains
- Added per-track preset metadata to the workflow overview so the UI can render preset buttons directly from service state.
- The local-ops page now renders guided preset buttons in the workflow cards:
  - `Run Onboarding Chain`
  - `Run Refresh Chain`
  - `Run Validate + Publish Chain`
- Guided presets honor the existing `Dry run publish only` checkbox:
  - when checked, the chain stops at publish simulation
  - when unchecked, publish chains can continue to live publish after validation
- Refresh preset behavior now supports:
  - full series refresh
  - one-match refresh when `matchId` or internal DB match id is provided in the form
- Added the permanent operator start guide:
  - `local_ops_operator_console_start_guide.md`
- Fixed two verification-found issues in the same slice:
  - workflow runs were incorrectly surfacing as `stale` mid-flight when their own artifacts updated
  - the local-ops browser script had a newline escaping bug that prevented dynamic UI sections from rendering

## Verification results

- MilC onboarding preset completed in dry-run-safe mode:
  - recomputed player intelligence
  - reran validation
  - did not apply live publish because dry run stayed enabled
- Bay Area refresh preset completed in dry-run-safe mode:
  - refreshed the selected match
  - recomputed season aggregation
  - recomputed composite scoring
  - recomputed player intelligence
  - reran validation
  - ran publish dry run only
- Bay Area validate-and-publish preset completed in dry-run-safe mode:
  - reran validation
  - reran publish dry run
- Browser verification confirmed:
  - local series cards render
  - workflow tracks render
  - preset buttons render
  - operator guide appears in the runbooks block

## Blockers or known gaps

- Guided workflow runs are stored as one top-level run with step logs inside the same run log; there is not yet a nested per-step history browser.
- There is still no cancel or reprioritize control for the local background queue.
- Workflow chains are local-only and in-process; they do not survive an API restart mid-flight.
- Refresh preset currently defaults `skipPipeline` to `true` so the guided chain can own recompute explicitly; that is intentional, but it should be documented in future UI copy if operators need that distinction explained.

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

## Good to go with next step

- Yes

## What the next step will do

Step 43 should add operator-grade control over these guided presets:

- explicit resume and rerun-from-step controls
- cancel support for queued local jobs
- richer per-step summaries in the UI instead of only log-tail inspection
- cleaner split between dry-run preset buttons and live-publish preset buttons

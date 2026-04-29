# Stage Lock: Phase 10 Step 33 - Local Validate Publish Gating Complete

Date: 2026-04-29

## Goal of the slice

Add the first explicit local validate/publish gate so series onboarding can stop relying on implicit engineering judgment before frontend activation.

This slice adds:

- a local readiness validator
- a local publish command that blocks on failed validation
- operator documentation for the new gate

## Exact files changed

- `bay-area-u15/apps/worker/src/ops/localValidate.js`
- `bay-area-u15/apps/worker/src/ops/localPublish.js`
- `bay-area-u15/apps/worker/src/index.js`
- `bay-area-u15/package.json`
- `bay-area-u15/README.md`
- `bay-area-u15/ops_runbook_compute_publish.md`
- `bay-area-u15/ops_runbook_manual_refresh.md`
- `bay-area-u15/stage_lock_phase10_step33_local_validate_publish_gating_complete_2026-04-29.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node --check apps/worker/src/ops/localValidate.js
node --check apps/worker/src/ops/localPublish.js
node --check apps/worker/src/index.js
npm run ops:help
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:validate:series -- --series bay-area-usac-hub-2026
npm run ops:validate:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run ops:publish:series -- --series bay-area-usac-hub-2026 --dryRun
npm run ops:publish:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --dryRun
```

## Exact URLs verified

- None in this slice

## Verification result

- `npm run ops:validate:series -- --series bay-area-usac-hub-2026`
  - result: `publishReady = true`
  - coverage: `42/42` parsed matches
  - season rows: `320`
  - composite rows: `320`
  - intelligence profiles: `472`
  - warnings only:
    - parse-status drift
    - analytics-status drift
    - `7` reconciliation warnings
- `npm run ops:validate:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27`
  - result: `publishReady = false`
  - fail reason:
    - parsed coverage only `2/144` matches
  - season rows: `35`
  - composite rows: `35`
  - intelligence profiles: `66`
- `npm run ops:publish:series -- --series bay-area-usac-hub-2026 --dryRun`
  - result: dry-run publish validated
  - would promote `42` match refresh rows to `analytics_status = computed`
  - would keep `config/leagues.yaml -> enabled = true`
  - would keep `series_source_config.is_active = true`
- `npm run ops:publish:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --dryRun`
  - result: blocked by validation gate
  - exit code: `1`
  - reason: MilC is not publish-ready yet

## What changed

- Added `ops:validate:series` / `validate-series`
- Added `ops:publish:series` / `publish-series`
- `validate-series` now checks:
  - local config presence
  - active scoring model presence
  - active report profile presence
  - staged division/match/refresh coverage
  - parsed match coverage
  - executive season rows
  - executive composite rows
  - player intelligence rows
- `validate-series` also reports warning-only drift for:
  - parse status
  - analytics status
  - reconciliation
  - missing validation player lists
- `publish-series` now:
  - reruns validation
  - blocks if required checks fail
  - supports `--dryRun`
  - promotes refresh-state rows to computed on successful publish
  - activates `series_source_config.is_active`
  - enables the local `config/leagues.yaml` series entry

## Exact deploy status

- No hosted frontend deploy
- No Render deploy
- Local ops slice only

## Blockers or known gaps

- Reconciliation enforcement is still warning-level because `apps/worker/src/validate/reconcile.js` remains placeholder-only.
- The localhost operator console is not built yet.
- This slice adds the readiness boundary, not the full-series MilC extraction run itself.

## Good to go with next step

- Yes

## What the next step will do

Step 34 should add a localhost operator console so the same probe/register/stage/refresh/validate/publish flow is available from a local web surface as well as the terminal.

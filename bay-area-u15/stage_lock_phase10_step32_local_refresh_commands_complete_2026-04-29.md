# Stage Lock: Phase 10 Step 32 - Local Refresh Commands Complete

Date: 2026-04-29

## Goal of the slice

Add explicit local operator refresh commands so a series can be refreshed from the local machine without relying on the hosted frontend or the queue tables as the only operator surface.

This slice adds:

- a series-wide local refresh command
- a single-match local refresh command
- refresh runbook updates

## Exact files changed

- `bay-area-u15/apps/worker/src/ops/localRefresh.js`
- `bay-area-u15/apps/worker/src/pipeline/runMatchPipeline.js`
- `bay-area-u15/apps/worker/src/index.js`
- `bay-area-u15/package.json`
- `bay-area-u15/README.md`
- `bay-area-u15/ops_runbook_manual_refresh.md`
- `bay-area-u15/stage_lock_phase10_step32_local_refresh_commands_complete_2026-04-29.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node --check apps/worker/src/ops/localRefresh.js
node --check apps/worker/src/pipeline/runMatchPipeline.js
node --check apps/worker/src/index.js
npm run ops:help
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:refresh:series -- --series bay-area-usac-hub-2026 --skipPipeline true --headless true --matchLimit 2
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:refresh:match -- --series bay-area-usac-hub-2026 --matchId 7574 --skipPipeline true --headless true
```

## Exact URLs verified

- None in this slice

## Verification outcome

- `npm run ops:refresh:series -- --series bay-area-usac-hub-2026 --skipPipeline true --headless true --matchLimit 2`
  - discovery persisted 4 target divisions
  - inventory persisted 42 matches
  - selected 2 flagged matches for preview refresh
  - wrote `storage/exports/bay-area-usac-hub-2026/series_refresh_summary.json`
- `npm run ops:refresh:match -- --series bay-area-usac-hub-2026 --matchId 7574 --skipPipeline true --headless true`
  - discovery persisted 4 target divisions
  - inventory persisted 42 matches
  - selected the requested source match `7574`
  - wrote `storage/exports/bay-area-usac-hub-2026/match_refresh_summary_7574.json`

## What changed

- Added new local operator commands:
  - `npm run ops:refresh:series -- --series <series-key>`
  - `npm run ops:refresh:match -- --series <series-key> --matchId <source-match-id>`
- Added optional flags:
  - `--skipPipeline true`
  - `--headless true`
  - `--matchLimit <n>`
  - `--dbMatchId <internal-db-match-id>`
- `refresh-series` now:
  - reruns discovery
  - reruns inventory
  - persists inventory changes into the analytics database
  - selects flagged matches from `match_refresh_state`
  - optionally runs the existing fact-ingest pipeline against those selected matches
- `refresh-match` now:
  - resolves one requested source match id or internal db match id
  - reruns discovery/inventory
  - optionally runs the fact-ingest pipeline for that one match
- The worker `run` command now accepts `--headless true` and preserves current visible-browser behavior unless explicitly changed.

## Exact deploy status

- No hosted frontend deploy in this slice
- No Render deploy in this slice
- Local operator surface only

## Blockers or known gaps

- `ops:validate:series` is not built yet.
- `ops:publish:series` is not built yet.
- The current fact-ingest pipeline is still engineering-grade and not yet the final publish-gated operator workflow.
- Queue-based refresh processing still exists and is unchanged.
- No localhost operator console exists yet.

## Good to go with next step

Yes.

## What the next step will do

The next ops slice should add:

- `ops:validate:series`
- explicit validation artifacts
- series readiness checks before publish

That is the next missing operator boundary before a true local publish command.

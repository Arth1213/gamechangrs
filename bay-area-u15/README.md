# Bay Area U15 Local Ops Workspace

This folder is the local analytics workspace that prepares cricket data for the hosted Game-Changrs app.

## Boundary

- Hosted `game-changrs.com`: read-only consumer of prepared analytics data
- Local workspace under `bay-area-u15`: source probing, onboarding, extraction, refresh, compute, validation, and publish preparation

The hosted app does not own scraping, refresh orchestration, or publish control.

## Operator modes

Use either of these surfaces from inside `bay-area-u15`:

1. Terminal commands
2. Localhost operator console at `http://127.0.0.1:<port>/local-ops`

The browser console is:

- local-only
- loopback-only
- env-gated
- not part of the hosted frontend bundle

## Current operator surface

Terminal commands:

```bash
npm run ops:help
npm run ops:doctor
npm run ops:probe -- --series bay-area-usac-hub-2026
npm run ops:probe -- --source cricclubs --url "https://cricclubs.com/..."
npm run ops:register -- --source cricclubs --url "https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036" --label "MilC 2025" --seasonYear 2025 --targetAgeGroup Open
npm run ops:stage -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run ops:refresh:series -- --series bay-area-usac-hub-2026 --skipPipeline true
npm run ops:refresh:match -- --series bay-area-usac-hub-2026 --matchId 7574
npm run worker:compute:series -- --series bay-area-usac-hub-2026
npm run worker:score:series -- --series bay-area-usac-hub-2026
npm run worker:intelligence:series -- --series bay-area-usac-hub-2026
npm run ops:validate:series -- --series bay-area-usac-hub-2026
npm run ops:publish:series -- --series bay-area-usac-hub-2026 --dryRun
```

Start the local console:

```bash
PORT=4012 npm run ops:ui:start
```

Then open:

```text
http://127.0.0.1:4012/local-ops
```

## Locked local workflow

1. `ops:doctor`
2. `ops:probe`
3. `ops:register`
4. `ops:stage`
5. `run` or `refresh`
6. `compute-season`
7. `compute-composite`
8. `compute-intelligence`
9. `validate-series`
10. `publish-series --dryRun`
11. `publish-series`
12. verify the hosted app

## Runbooks

- `ops_runbook_new_series.md`
- `ops_runbook_manual_refresh.md`
- `ops_runbook_compute_publish.md`

## Important paths

- worker entry: `apps/worker/src/index.js`
- local API runtime: `apps/api/src/server.js`
- local ops service: `apps/api/src/services/localOpsService.js`
- local ops page: `apps/api/src/render/localOpsPage.js`
- worker config: `config/leagues.yaml`
- weights config: `config/weights.yaml`
- local scripts: `scripts`
- generated exports: `storage/exports`

## What exists today

- local API for the current cricket analytics/report experience
- terminal-first worker pipeline
- local series probe, register, stage, refresh, validate, and publish commands
- localhost operator console for the same flow
- player intelligence compute pipeline and frontend route
- publish gating that keeps the hosted app read-only

## What is still incomplete

- no live log streaming in the localhost console
- no background job runner behind the console actions
- no generalized multi-source extraction adapters beyond the current CricClubs-first path
- reconciliation enforcement remains warning-level in validation

## Current limitations

- `probe` implements a real adapter for CricClubs; other source families still need dedicated adapters
- `register` is currently CricClubs-first
- `apps/worker/src/pipeline/runMatchPipeline.js` is still an engineering ingest path rather than the final queue-driven operator flow
- long-running localhost console actions hold the request open until completion

## Current verification snapshot

- `bay-area-usac-hub-2026`: publish-ready
- `bay-area-youth-cricket-hub-2025-milc-2025-27`: not publish-ready because parsed match coverage is `2 / 144`

## Purpose of this workspace

This local workspace exists so future series onboarding and refresh work can be done in a controlled operator boundary, then published into Supabase for the hosted Game-Changrs experience to consume.

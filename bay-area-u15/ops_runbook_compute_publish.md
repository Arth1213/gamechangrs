# Local Ops Runbook: Compute And Publish

## Goal

Prepare executive and intelligence outputs locally, validate readiness, then publish only the ready dataset for the hosted frontend to consume.

## Operator surfaces

Terminal path:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run worker:compute:series -- --series <series-key>
npm run worker:score:series -- --series <series-key>
npm run worker:intelligence:series -- --series <series-key>
npm run ops:validate:series -- --series <series-key>
npm run ops:publish:series -- --series <series-key> --dryRun
npm run ops:publish:series -- --series <series-key>
```

Console path:

```bash
PORT=4012 npm run ops:ui:start
```

Then open `http://127.0.0.1:4012/local-ops` and use:

- `Compute season aggregation`
- `Compute composite scoring`
- `Compute player intelligence`
- `Validate publish readiness`
- `Publish current DB state`

The localhost console workflow panel now makes this explicit per series by showing:

- whether onboarding is already complete
- whether a refresh has introduced stale compute steps
- whether validation or publish needs to be rerun
- the exact terminal command for the recommended next action

## Locked execution order

1. fact ingest or refresh completes
2. season aggregation runs
3. composite scoring runs
4. player intelligence runs
5. validation runs
6. publish dry-run runs
7. real publish runs
8. hosted app verification runs

## What validate checks now

- local config entry exists for the series slug
- active scoring model exists
- active report profile exists
- divisions, matches, and refresh-state rows are staged
- parsed ball-by-ball coverage reaches all tracked matches
- executive season rows exist
- executive composite rows exist
- player intelligence rows exist

Validation also reports warning-only items for:

- parse-status drift
- analytics-status drift
- reconciliation warnings or pending rows
- missing validation-player lists in `config/leagues.yaml`

## What publish does now

`publish-series` reruns validation first.

It blocks if any required validation check fails.

On success it:

- promotes all series match refresh rows to parsed and computed
- clears `needs_rescrape`, `needs_reparse`, and `needs_recompute`
- marks `series_source_config.is_active = true`
- sets the local `config/leagues.yaml` entry to `enabled: true`

Use `--dryRun` first. That validates the publish transaction without committing database or config changes.

## Current verification snapshot

- `bay-area-usac-hub-2026`: `publishReady = true`
- `bay-area-youth-cricket-hub-2025-milc-2025-27`: `publishReady = false`

MilC is blocked because parsed coverage is only `2 / 144`.

## Hosted verification after publish

After a successful real publish:

1. restart or confirm the local API if needed
2. verify the report routes you expect
3. verify the hosted Game-Changrs flow reads the updated series correctly

## Operator rule

The hosted frontend only reads prepared outputs.

It does not:

- scrape new series
- trigger extraction
- trigger raw recompute
- own refresh orchestration

All of that remains local.

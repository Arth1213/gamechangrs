# Local Ops Runbook: Manual Refresh

## Goal

Refresh newly available match data for an existing series from the local machine only, then revalidate before any publish.

## Operator surfaces

Terminal commands:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:refresh:series -- --series <series-key>
npm run ops:refresh:match -- --series <series-key> --matchId <source-match-id>
npm run ops:validate:series -- --series <series-key>
npm run ops:publish:series -- --series <series-key> --dryRun
```

Console:

```bash
PORT=4012 npm run ops:ui:start
```

Then open `http://127.0.0.1:4012/local-ops` and use the series action buttons.

## Series-wide refresh

Terminal:

```bash
npm run ops:refresh:series -- --series bay-area-usac-hub-2026
```

Console:

- use `Refresh series inventory + flagged matches`

Useful flags:

```bash
--skipPipeline true
--headless true
--matchLimit 5
```

What it does:

1. reruns live discovery
2. reruns live inventory
3. persists inventory changes into the analytics database
4. selects flagged matches from `match_refresh_state`
5. optionally reruns fact ingest for those matches

Writes:

- `storage/exports/<series-key>/discovery.json`
- `storage/exports/<series-key>/match_inventory.json`
- `storage/exports/<series-key>/series_refresh_summary.json`

## Single-match refresh

Terminal:

```bash
npm run ops:refresh:match -- --series bay-area-usac-hub-2026 --matchId 7574
```

Console:

- use `Refresh one match`

Useful flags:

```bash
--skipPipeline true
--headless true
--dbMatchId <internal-db-match-id>
```

Writes:

- `storage/exports/<series-key>/match_refresh_summary_<source-match-id>.json`

## Required follow-up after refresh

Always run:

```bash
npm run worker:compute:series -- --series <series-key>
npm run worker:score:series -- --series <series-key>
npm run worker:intelligence:series -- --series <series-key>
npm run ops:validate:series -- --series <series-key>
npm run ops:publish:series -- --series <series-key> --dryRun
```

Console equivalents:

- `Compute season aggregation`
- `Compute composite scoring`
- `Compute player intelligence`
- `Validate publish readiness`
- `Publish current DB state` with `dryRun`

## Operator rule

Do not rely on the hosted Game-Changrs admin UI for refresh operations.

Refresh stays local-only. The hosted app remains a read-only consumer of prepared outputs.

## Current limitations

- the console does not stream progress logs yet
- long-running actions hold the browser request open
- reconciliation enforcement is still warning-level

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

The localhost console now shows:

- whether the selected series is currently live or still mid-refresh
- which recompute or validation step is next
- the latest queue summaries written by the worker-side refresh processors

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
4. selects only completed matches that are new, changed, or flagged in `match_refresh_state`
5. defers scheduled and in-progress matches into the refresh summary
6. ingests scorecard, commentary/ball-by-ball when available, reconciliation, and match analytics
7. recomputes season aggregation, composite scoring, and player intelligence after a fully successful ingest
8. validates the series automatically

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

## Refresh completion and publishing

Normal refresh commands automatically recompute and validate. They never publish.

Run only the publish dry run after the refresh summary reports `completed` or `completed-with-deferred` and validation is publish-ready:

```bash
npm run ops:publish:series -- --series <series-key> --dryRun
```

Standalone `compute-season`, `compute-composite`, `compute-intelligence`, and `validate-series` commands remain recovery tools for an interrupted or historical operation.

## Failure and deferral rules

- A source-access failure or any selected match ingest failure fails the refresh and writes a partial summary.
- A scheduled or in-progress match is deferred; it is not scraped or marked complete.
- A requested completed match uses the same inventory, ingest, recompute, and validation contract as a series refresh.

## Operator rule

Do not rely on the hosted Game-Changrs admin UI for refresh operations.

Refresh stays local-only. The hosted app remains a read-only consumer of prepared outputs.

## Current limitations

- the console does not stream progress logs yet
- long-running actions hold the browser request open
- reconciliation enforcement is still warning-level

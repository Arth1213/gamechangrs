# Local Ops And Series Management Start Here

Date: 2026-05-10

Use this file as the operator quick-start for:

- starting the analytics/local-ops service locally
- opening the local operator console
- onboarding a new series
- managing refresh, validation, compute, and publish flows for a series

## Working directory

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
```

## Start the local service

Load the local environment, then start the API with the local-ops UI enabled.

```bash
set -a
source .env
set +a
PORT=4012 npm run ops:ui:start
```

Notes:

- `4012` is the standard local-ops port in the current runbooks.
- if port `4012` is busy, pick another local port and use the same value in the browser URLs below
- the console is loopback-only and intended to be used on the same machine

## URLs to use

Main console:

```text
http://127.0.0.1:4012/local-ops
```

Overview JSON:

```text
http://127.0.0.1:4012/api/local-ops/overview
```

Health check:

```text
http://127.0.0.1:4012/health
```

If you changed the port, replace `4012` with your chosen local port.

## Quick sanity checks

```bash
curl -sS http://127.0.0.1:4012/health
curl -sS http://127.0.0.1:4012/api/local-ops/overview
```

## New series addition

Primary runbook:

- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/ops_runbook_new_series.md`

What that runbook covers:

1. workspace and env validation
2. source probe
3. series registration
4. discovery and match inventory staging
5. initial ingest
6. handoff into compute, validate, and publish

## Series management and publish flow

Use these runbooks in order as needed:

- start console:
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/local_ops_operator_console_start_guide.md`
- new series onboarding:
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/ops_runbook_new_series.md`
- manual refresh:
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/ops_runbook_manual_refresh.md`
- compute, validate, and publish:
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/ops_runbook_compute_publish.md`

## What the operator should mainly use in the UI

- `Series Overview`
- `Selected Series Workflow`
- `Series Actions`
- `Run Comparison`
- `Run Triage`
- `Recent Runs`

## Restore expectation

For a full restore-oriented backup, the restore folder should include or reference:

- this file
- `docs/LATEST_RESTORE_GUIDE.html`
- `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt`
- `LOCAL_OPS_SERIES_MANAGEMENT_START_HERE_CURRENT.md`
- the local env restore copies

That way, if the files are placed on disk, Codex can take over the restore flow end to end.

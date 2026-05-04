# Local Ops Access And Start Reference

Date: 2026-04-30

## Subject

How to start and use the Game-Changrs local ops console on this machine

## What this is

The local ops console is the local-only operator surface for:

- new series intake
- series staging and ingest
- refresh and recompute work
- validation and publish gating
- run comparison and triage

This is not part of the hosted `game-changrs.com` frontend. It runs only on this machine and is used to prepare analytics data before the hosted app reads it.

## Working directory

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
```

## Start the local ops service

Load the local environment, then start the API with the local ops UI enabled.

```bash
set -a
source .env
set +a
PORT=4012 npm run ops:ui:start
```

Notes:

- `4012` is the standard local-ops port.
- If `4012` is already in use, choose another local port and use that same port in the browser URL.
- Leave this terminal window open while you use local ops.

## Open the console

Open this URL in the browser after startup:

```text
http://127.0.0.1:4012/local-ops
```

If you changed the port:

```text
http://127.0.0.1:<PORT>/local-ops
```

## Quick health checks

Health:

```bash
curl -sS http://127.0.0.1:4012/health
```

Overview JSON:

```bash
curl -sS http://127.0.0.1:4012/api/local-ops/overview
```

## What to use inside the console

Use these sections in this order:

1. `Series Overview`
   Use this to confirm which series are configured and which one you want to operate on.

2. `Selected Series Workflow`
   Use the guided buttons here for the main local paths:
   - onboarding a new series
   - refreshing an existing series
   - validating and publishing

3. `Run Comparison`
   Use this to compare the latest saved run against the immediately previous run for the same series. This is where you can see whether validation state, publish readiness, coverage, or the recommended next step changed.

4. `Run Triage`
   Use this to find interrupted, failed, stale, or canceled runs that still need attention. Resume from the saved workflow step when possible.

5. `Latest Operator Run` and `Recent Runs`
   Use these when you need command previews, file paths, or direct links into a saved run.

6. `Open Run`
   Use this button on any saved run to open the dedicated run inspector page.

## Run inspector URL pattern

If you already know a run id, open it directly like this:

```text
http://127.0.0.1:4012/local-ops/runs/<RUN_ID>
```

The run inspector shows:

- run summary
- previous-run comparison
- series triage
- saved status path
- saved log path
- artifact JSON
- raw status JSON

## Safe operating rules

- Keep all scrape, extract, refresh, compute, validate, and publish work in local ops only.
- Do not treat the hosted Game-Changrs frontend as the place to run source-side operations.
- Use dry-run publish first when you want to confirm the publish gate without applying a live local publish.
- Use live publish only when the validation state is clean and you intentionally want to promote the prepared dataset.

## How to stop the service

Press `Ctrl-C` in the terminal where the local ops API is running.

## Useful local docs

- `ops_runbook_new_series.md`
- `ops_runbook_manual_refresh.md`
- `ops_runbook_compute_publish.md`
- `local_ops_operator_console_start_guide.md`

## Boundary reminder

The local ops console is loopback-only and operator-facing. The hosted app remains the consumer of prepared analytics data and should not be used for raw ingestion or refresh orchestration.

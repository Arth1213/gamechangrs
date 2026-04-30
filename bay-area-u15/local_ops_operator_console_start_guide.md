# Local Ops Operator Console Start Guide

Date: 2026-04-30

## Purpose

Use the local operator console to run series onboarding, refresh, compute, validation, and publish work from this machine only.

The hosted Game-Changrs app does not expose these controls.

## Working directory

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
```

## Start the service

Load the local environment first, then start the API with the local-ops UI enabled.

```bash
set -a
source .env
set +a
PORT=4012 npm run ops:ui:start
```

Notes:

- `PORT=4012` is the standard local-ops port used in the current runbooks.
- If `4012` is already in use, pick another local port and use the same value in the browser URL.
- The console is loopback-only and is intended to be opened on the same machine.

## Local URL

Open the operator console here after startup:

```text
http://127.0.0.1:4012/local-ops
```

If you changed the port, use:

```text
http://127.0.0.1:<PORT>/local-ops
```

## Quick sanity checks

Health:

```bash
curl -sS http://127.0.0.1:4012/health
```

Local ops overview JSON:

```bash
curl -sS http://127.0.0.1:4012/api/local-ops/overview
```

## What the operator should use

- `Series Overview` to see every configured series and current state.
- `Selected Series Workflow` to run guided presets:
  - `Run Onboarding Chain`
  - `Run Refresh Chain`
  - `Run Validate + Publish Chain`
- `Series Actions` only when a specific low-level step needs to be run manually.
- `Queue Visibility`, `Latest Operator Run`, and `Recent Runs` to monitor active work and retry prior runs.

## Publish safety

- The `Dry run publish only` checkbox is checked by default in the form.
- Leave it checked when you want validation plus publish simulation only.
- Uncheck it only when you intentionally want the workflow or publish action to apply a live local publish.

## Stop the service

Press `Ctrl-C` in the terminal where the API is running.

## Related local docs

- `ops_runbook_new_series.md`
- `ops_runbook_manual_refresh.md`
- `ops_runbook_compute_publish.md`

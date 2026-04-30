# Local Ops Runbook: New Series

## Goal

Assess a new series locally, register it safely, stage discovery and inventory, then hand it into the compute and publish flow without exposing unfinished data to the hosted app.

## Operator surfaces

Use one of these:

1. Terminal commands from inside `bay-area-u15`
2. Localhost console at `http://127.0.0.1:<port>/local-ops`

The localhost console now includes:

- per-series workflow tracks
- current artifact-backed step status
- a recommended next action for the selected series
- queue summary visibility for the local workers

Start the console with:

```bash
PORT=4012 npm run ops:ui:start
```

## Step 1: Check the local workspace

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:doctor
```

Confirm:

- `.env` exists
- database connection works
- `config/leagues.yaml` exists
- `config/weights.yaml` exists
- Playwright resolves a Chromium runtime

## Step 2: Probe the source URL

Terminal:

```bash
npm run ops:probe -- --source cricclubs --url "https://cricclubs.com/..."
```

Console:

- use the `Probe source URL` form on `/local-ops`

What the probe tells you:

- detected source family
- likely source series id
- likely division or group structure
- scorecard support
- commentary support
- whether Executive Report looks viable
- whether Player Intelligence Report looks viable or partial

Probe artifacts are written under:

- `storage/exports/probes/.../probe.json`
- `storage/exports/probes/.../raw/probe_page.html`
- `storage/exports/probes/.../raw/probe_links.json`

## Step 3: Register the series locally

Terminal:

```bash
npm run ops:register -- --source cricclubs --url "https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036" --label "MilC 2025" --seasonYear 2025 --targetAgeGroup Open
```

Console:

- use the `Register new series` form on `/local-ops`

What registration does:

- creates the `series` and `series_source_config` rows locally
- clones the active scoring model from the template series
- assigns the active report profile from the template series
- writes a matching entry into `config/leagues.yaml`

Safety default:

- the new series is registered as inactive in the database
- the new config entry is written with `enabled: false`

That keeps the hosted app insulated until validation and publish are complete.

## Step 4: Stage discovery and inventory

Terminal:

```bash
npm run ops:stage -- --series <series-key>
```

Console:

- use `Stage discovery + inventory` for the selected series

What staging does:

- reruns discovery
- writes `discovery.json`
- persists divisions or groups into the analytics database
- reruns live inventory
- writes `match_inventory.json`
- persists match rows and refresh-state rows

Artifacts live under:

- `storage/exports/<series-key>/`

## Step 5: Run initial ingest

Terminal:

```bash
npm run worker:run:series -- --series <series-key>
```

Console:

- use `Run current ingest sample`

Current rule:

- use this for engineering ingest and fact loading
- if the source is large, start with a limited sample or targeted match set first

## Step 6: Hand off into compute and publish

Next runbook:

- `ops_runbook_compute_publish.md`

The new series is not ready for the hosted app until:

1. season aggregation is built
2. composite scoring is built
3. player intelligence is built
4. `validate-series` passes
5. `publish-series` completes

## Current limitations

- probe and register are CricClubs-first today
- long-running console actions are synchronous
- multi-source onboarding adapters still need future slices

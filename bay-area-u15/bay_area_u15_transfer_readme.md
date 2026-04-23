# Bay Area U15 Transfer Bundle README

## Purpose

This bundle is intended to let you move the Bay Area U15 Cricket Performance Intelligence project to another laptop and continue building with Codex immediately.

## What Is Included

The bundle contains:

- the master plan
- the implementation blueprint
- the SQL schema
- the executive report and HTML sample
- the getting-started instructions
- the config files
- the worker scaffold
- the Node project files needed to run the starter worker

## What To Do On The New Laptop

### Step 1. Copy The Zip

Copy the zip file to the new laptop.

Suggested folder:

- `~/Downloads`

### Step 2. Extract The Zip

In Terminal on the new laptop:

```bash
mkdir -p ~/bay-area-u15-cricket-intelligence
unzip ~/Downloads/bay_area_u15_transfer_bundle.zip -d ~/bay-area-u15-cricket-intelligence
cd ~/bay-area-u15-cricket-intelligence
```

### Step 3. Open The Folder In Codex

Start Codex in:

- `~/bay-area-u15-cricket-intelligence`

### Step 4. Install Dependencies

In the project folder:

```bash
npm install
npx playwright install chromium
```

### Step 5. Read These Files First

Open these in order:

1. `bay_area_u15_getting_started_readme.md`
2. `bay_area_u15_executive_report_sample.html`
3. `bay_area_u15_cricket_plan.md`
4. `bay_area_u15_implementation_blueprint.md`

## Exact Prompts To Give Codex On The Other Computer

Copy one of these prompts directly into Codex, depending on what you want to do next.

### Prompt A: Start With Discovery And Match Inventory

Use the files in this workspace to build the first working slice of the Bay Area U15 CricClubs pipeline.

Read first:

- `bay_area_u15_getting_started_readme.md`
- `bay_area_u15_cricket_plan.md`
- `bay_area_u15_implementation_blueprint.md`
- `config/leagues.yaml`
- `config/weights.yaml`
- `apps/worker/src/*`

Then implement and verify:

- `apps/worker/src/discovery/seriesDiscovery.js`
- `apps/worker/src/extract/matchInventory.js`

Requirements:

- use Playwright
- auto-discover the 4 target divisions from the series URL
- enumerate all matches for those divisions
- save raw HTML and raw JSON artifacts under `storage/exports`
- do not stop at planning
- run and verify the implementation locally

### Prompt B: Build Scorecard And Commentary Parsing

Using the Bay Area U15 scaffold already in this workspace, implement the next working slice:

- `apps/worker/src/extract/matchDetail.js`
- `apps/worker/src/parse/scorecardParser.js`
- `apps/worker/src/parse/commentaryParser.js`

Requirements:

- pull scorecard data and commentary for inventoried matches
- normalize innings, batting, bowling, fielding, and `ball_event` rows
- distinguish batter runs from extras
- distinguish bowler-earned wickets from run outs
- save normalized outputs for inspection
- verify on a DCL Legends match if available

### Prompt C: Load Into Database And Reconcile

Using `bay_area_u15_schema.sql` and the worker scaffold in this workspace, implement:

- `apps/worker/src/load/repository.js`
- `apps/worker/src/validate/reconcile.js`

Requirements:

- upsert normalized entities into the Postgres-compatible schema
- write reconciliation checks for innings totals, wickets, batting runs, and bowling figures
- output quality issues cleanly
- verify with at least one completed match

### Prompt D: Compute Selector-Facing Analytics

Using the existing Bay Area U15 project files in this workspace, implement:

- `apps/worker/src/analytics/compute.js`

Requirements:

- compute ball-by-ball derived stats
- compute opponent-adjusted stats using `config/weights.yaml`
- compute consistency and development indicators
- produce a selector-friendly JSON summary for Shreyak Porecha or a DCL Legends sample player

### Prompt E: Build The Dashboard And Report Layer

Use the executive sample HTML and existing Bay Area U15 project files to build a selector-facing dashboard and report layer.

Read first:

- `bay_area_u15_executive_report_sample.html`
- `bay_area_u15_executive_report.md`

Requirements:

- preserve the same visual direction
- make the dashboard read quickly for selectors and coaches
- support player comparison
- support report download
- include batting, bowling, fielding, and wicketkeeping in the assessment snapshot
- keep the composite selector score focused on the player’s primary role
- include standard CricClubs stats in two views:
  - current series
  - overall CricClubs
- present those stats as visual panels or tiles
- preserve:
  - recommendation badge
  - peer comparison strip
  - trend graphics for recent form and strong-opposition performance

### Prompt F: Preserve All Report Fine-Tunings

Before changing the dashboard or executive report implementation, read:

- `bay_area_u15_cricket_plan.md`
- `bay_area_u15_implementation_blueprint.md`
- `bay_area_u15_executive_report.md`
- `bay_area_u15_executive_report_sample.html`

Then make sure the implementation preserves all current report design decisions, including:

- full four-skill assessment snapshot
- primary-role weighted recommendation
- current series and overall CricClubs stats panels
- visual selector interpretation cards
- recommendation badge
- peer comparison strip
- trend graphics

## If You Want The Safest Build Sequence

Use this order:

1. discovery
2. match inventory
3. raw artifact capture
4. scorecard parsing
5. commentary parsing
6. database loading
7. reconciliation
8. analytics
9. dashboard and reports

## What To Open To Preview The Executive Report

To see the executive sample visually, open:

- `bay_area_u15_executive_report_sample.html`

You can open it in a browser by double-clicking it or running:

```bash
open bay_area_u15_executive_report_sample.html
```

## Final Note

This bundle gives you a strong handoff foundation, but the implementation is still intentionally scaffolded. The next Codex session should focus on converting the discovery and parsing modules from stubs into working production code.

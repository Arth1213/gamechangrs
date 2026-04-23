# Bay Area U15 Transfer Manifest

This manifest lists the files that should be copied to another laptop to continue building the Bay Area U15 Cricket Performance Intelligence solution with Codex.

## Core Documents

- `bay_area_u15_cricket_plan.md`
- `bay_area_u15_implementation_blueprint.md`
- `bay_area_u15_schema.sql`
- `bay_area_u15_executive_report.md`
- `bay_area_u15_executive_report_sample.html`
- `bay_area_u15_getting_started_readme.md`

## Configuration

- `config/leagues.yaml`
- `config/weights.yaml`

## Worker Scaffold

- `apps/worker/README.md`
- `apps/worker/src/index.js`
- `apps/worker/src/lib/config.js`
- `apps/worker/src/lib/fs.js`
- `apps/worker/src/lib/browser.js`
- `apps/worker/src/discovery/seriesDiscovery.js`
- `apps/worker/src/extract/matchInventory.js`
- `apps/worker/src/extract/matchDetail.js`
- `apps/worker/src/parse/scorecardParser.js`
- `apps/worker/src/parse/commentaryParser.js`
- `apps/worker/src/load/repository.js`
- `apps/worker/src/validate/reconcile.js`
- `apps/worker/src/analytics/compute.js`
- `apps/worker/src/pipeline/runMatchPipeline.js`

## Project Runtime Files

- `package.json`
- `package-lock.json`

## Optional Helpful Files

- `check_cricclubs_discovery.js`

## Recommended Target Structure On The New Laptop

Place the zip contents into a clean project folder such as:

- `~/bay-area-u15-cricket-intelligence`

Then run Codex from that folder so the relative paths in the scaffolding and docs continue to make sense.

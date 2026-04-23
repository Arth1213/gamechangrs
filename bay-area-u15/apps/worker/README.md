# Bay Area U15 Worker Scaffold

This worker is a starter scaffold for the CricClubs ingestion pipeline.

It is intentionally organized to mirror the implementation blueprint:

- discovery
- extraction
- parsing
- loading
- validation
- analytics

## Entry Points

- `node apps/worker/src/index.js discover --config config/leagues.yaml --series bay-area-usac-hub-2026`
- `node apps/worker/src/index.js inventory --config config/leagues.yaml --series bay-area-usac-hub-2026`
- `node apps/worker/src/index.js run --config config/leagues.yaml --series bay-area-usac-hub-2026`

## Current Status

This is a scaffold, not a finished scraper. It provides:

- configuration loading
- pipeline stage structure
- file and logging conventions
- starter Playwright discovery routines
- normalized output contracts

The next implementation pass should focus on:

1. completing the browser request interception layer
2. wiring database loaders
3. building parser logic for scorecards and commentary
4. adding reconciliation and analytics computations

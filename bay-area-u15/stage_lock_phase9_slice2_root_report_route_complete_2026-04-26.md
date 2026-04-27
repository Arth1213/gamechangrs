# Stage Lock: Phase 9 Slice 2 Root Report Route Complete

## Scope

Implemented the second repo-native integration slice only:

- added a root-app player report route
- kept `bay-area-u15/apps/api` unchanged
- kept the existing Express report HTML unchanged
- reused the existing cricket Express report route as the report source
- updated root analytics results to navigate into the new root-app report route instead of only sending users to the raw Express URL

## Exact Files Changed

- `src/App.tsx`
- `src/lib/cricketApi.ts`
- `src/pages/Analytics.tsx`
- `src/pages/AnalyticsReport.tsx`

Added checkpoint:

- `bay-area-u15/stage_lock_phase9_slice2_root_report_route_complete_2026-04-26.md`

## Exact Route Added

- `/analytics/reports/:playerId`

Supported query parameter:

- `divisionId`

Examples verified:

- `/analytics/reports/176?divisionId=3`
- `/analytics/reports/177?divisionId=3`

## Exact Env Vars Used

- `VITE_CRICKET_API_BASE`
- `CRICKET_API_PROXY_TARGET`

No new env vars were introduced in this slice.

## Exact Run Commands

Repo-side cricket API:

```sh
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15 && set -a && source ./.env && set +a && PORT=4011 npm run api:start
```

Root Vite app:

```sh
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo && npm run dev -- --host 127.0.0.1 --port 8080
```

Root app build verification:

```sh
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo && npm run build
```

## Exact URLs Verified

Root app:

- `http://127.0.0.1:8080/analytics`
- `http://127.0.0.1:8080/analytics/reports/176?divisionId=3`
- `http://127.0.0.1:8080/analytics/reports/177?divisionId=3`

Root-to-cricket bridge:

- `http://127.0.0.1:8080/cricket-api/api/players/search?q=Shreyak`
- `http://127.0.0.1:8080/cricket-api/players/176?divisionId=3`

Existing Express report routes:

- `http://127.0.0.1:4011/players/176?divisionId=3`
- `http://127.0.0.1:4011/players/177?divisionId=3`

## Verification Result

- root analytics search still returns live API-backed results
- search results now expose an in-app route: `/analytics/reports/:playerId?divisionId=...`
- root report route for player `176`, `divisionId=3` rendered the shell with:
  - back-to-search action
  - open-standalone action
  - embedded iframe sourced from `/cricket-api/players/176?divisionId=3`
- root report route for player `177`, `divisionId=3` rendered the shell with:
  - back-to-search action
  - open-standalone action
  - embedded iframe sourced from `/cricket-api/players/177?divisionId=3`
- existing Express report routes still returned the unchanged selector report HTML
- root app production build completed successfully after this slice

## What Behavior Changed

- root app now has an in-app player report route
- analytics result cards now route users into the new root-app report shell
- the new root report page embeds the existing Express report instead of sending users directly out of the app flow
- the root report page provides explicit `Back to Search` and `Open Standalone Report` actions

## What Behavior Was Intentionally Left Unchanged

- `bay-area-u15/apps/api`
- Express report HTML rendering
- report payload shape
- scraping flow
- schema
- recompute logic
- raw data loading
- underlying report URL behavior

## Assumptions / Gaps

- local dev assumes the repo-side cricket API is running on `4011` unless `CRICKET_API_PROXY_TARGET` is overridden
- the in-app route is intentionally a lightweight shell and uses an iframe rather than recreating report content in React
- direct visits to the root report route work without route state, but may show a generic header like `Player 176` if no display metadata was carried from the search page
- deployment/reverse-proxy wiring outside local dev remains out of scope for this slice
- unrelated pre-existing repo modifications were not altered by this slice

## Stop Point

This stage lock is limited to the second reversible root report route slice only.

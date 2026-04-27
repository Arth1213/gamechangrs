# Stage Lock: Phase 8 Repo Parity Complete

## 1. landing zone used

`bay-area-u15/apps/api`

The Phase 8 repo-side API was migrated into the existing `bay-area-u15` subproject and kept as a standalone Express/CommonJS runtime under that landing zone.

## 2. exact files changed

Added:

- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/apps/api/src/render/pages.js`
- `bay-area-u15/apps/api/src/lib/utils.js`
- `bay-area-u15/apps/api/src/lib/env.js`
- `bay-area-u15/apps/api/src/lib/connection.js`
- `bay-area-u15/apps/api/src/services/seriesService.js`
- `bay-area-u15/apps/api/src/services/playerApiService.js`
- `bay-area-u15/apps/api/src/services/reportService.js`
- `bay-area-u15/apps/api/src/services/adminService.js`
- `bay-area-u15/.env.example`

Updated:

- `bay-area-u15/package.json`
- `bay-area-u15/package-lock.json`

## 3. exact local run command using bay-area-u15/.env

```sh
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15 && set -a && source ./.env && set +a && PORT=4011 npm run api:start
```

## 4. exact URLs verified

Repo-side migrated API:

- `http://127.0.0.1:4011/`
- `http://127.0.0.1:4011/health`
- `http://127.0.0.1:4011/players/176?divisionId=3`
- `http://127.0.0.1:4011/players/177?divisionId=3`

Standalone parity baseline used during verification:

- `http://127.0.0.1:4010/`
- `http://127.0.0.1:4010/health`
- `http://127.0.0.1:4010/players/176?divisionId=3`
- `http://127.0.0.1:4010/players/177?divisionId=3`

## 5. parity result

- `/` matched.
- `/health` matched except for live `serverTime`.
- `/players/176?divisionId=3` matched except for live `generatedAt` timestamps.
- `/players/177?divisionId=3` matched except for live `generatedAt` timestamps.
- Normalized parity checks passed for all four required routes.

## 6. whether .gitignore changed and why

No net `.gitignore` change was left as part of this checkpoint.

There was already an existing local `.gitignore` modification in the repo before this migration step. A temporary edit was made during migration and then removed so that `.gitignore` was not part of the repo-side API parity deliverable.

## 7. assumptions/gaps

- The repo-side API remains an Express/CommonJS app and was not rewritten into Supabase edge functions.
- The repo-side API was not folded into the root Vite app.
- The repo-side API expects a valid local `bay-area-u15/.env` file derived from `bay-area-u15/.env.example`.
- The `bay-area-u15/.env` file must provide at minimum `DATABASE_URL` and `DATABASE_SSL_MODE` for the same Supabase source-of-truth dataset.
- No secrets were committed into the repo.
- No scraping, schema redesign, or raw data loading was restarted in this checkpoint.
- No runtime behavior changes were introduced intentionally beyond moving the API into the approved repo landing zone.

## 8. what remains next

- Create a real local `bay-area-u15/.env` from `bay-area-u15/.env.example` with the Supabase Postgres connection used by the Phase 8 dataset.
- Decide whether the next step should be:
  - keeping this API as an internal repo-side service only, or
  - wiring selected routes into the wider Game-Changrs product intentionally.
- If product integration is approved later, add a bounded handoff from the root app to this repo-side API without changing the verified report logic first.
- If deployment is needed later, define the repo-native deployment path for `bay-area-u15/apps/api` separately from this parity checkpoint.

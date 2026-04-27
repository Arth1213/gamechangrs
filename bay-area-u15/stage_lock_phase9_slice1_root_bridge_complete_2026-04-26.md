# Stage Lock: Phase 9 Slice 1 Root Bridge Complete

## Scope

Implemented the first repo-native integration slice only:

- the root Game-Changrs `/analytics` page now uses the verified cricket analytics API as its live search source of truth
- the existing `bay-area-u15/apps/api` service remains authoritative
- the existing Express player report routes remain unchanged
- no scraping, schema, recompute, or Supabase data-loading logic was touched

## Exact Files Changed

- `src/lib/cricketApi.ts`
- `src/pages/Analytics.tsx`
- `src/vite-env.d.ts`
- `vite.config.ts`

Added checkpoint:

- `bay-area-u15/stage_lock_phase9_slice1_root_bridge_complete_2026-04-26.md`

## Exact Env Vars Added Or Used

Used:

- `VITE_CRICKET_API_BASE`
- `CRICKET_API_PROXY_TARGET`

Behavior:

- if `VITE_CRICKET_API_BASE` is set, the root app uses that as the frontend bridge base
- otherwise the root app defaults to `/cricket-api`
- for local Vite dev, `vite.config.ts` proxies `/cricket-api` to `CRICKET_API_PROXY_TARGET`
- if `CRICKET_API_PROXY_TARGET` is not set, it defaults to `http://127.0.0.1:4011`

## Exact Run Commands

Repo-side cricket API:

```sh
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15 && set -a && source ./.env && set +a && PORT=4011 npm run api:start
```

Root Vite app:

```sh
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo && npm run dev -- --host 127.0.0.1 --port 8080
```

## Exact URLs Verified

Root app:

- `http://127.0.0.1:8080/analytics`

Root-to-cricket bridge:

- `http://127.0.0.1:8080/cricket-api/api/players/search?q=Shreyak`
- `http://127.0.0.1:8080/cricket-api/players/176?divisionId=3`

Repo-side cricket API source:

- `http://127.0.0.1:4011/api/players/search?q=Shreyak`
- `http://127.0.0.1:4011/players/176?divisionId=3`

## Verification Result

- root `/analytics` renders a real search form
- searching `Shreyak` returns live API-backed player results
- result cards show real player data from the verified cricket API
- result cards expose clear `Open Full Report` actions
- those actions point to the existing Express player report routes via the bridge path
- proxied player report HTML loads correctly through the root bridge
- production build completed successfully for the root app after the slice

## What Behavior Changed

- root `/analytics` no longer uses the old mock/local/preview player search flow
- root `/analytics` no longer calls the `cricclubs-player-analytics` Supabase edge function for this slice
- root `/analytics` now performs live player search against the verified cricket Express API
- root `/analytics` now acts as a thin launcher into the existing Express report pages

## What Behavior Was Intentionally Left Unchanged

- `bay-area-u15/apps/api` route behavior
- Express HTML player report rendering
- report payload shape
- report URLs and report contents
- scraping pipeline
- schema
- recompute logic
- raw data loading
- standalone/local repo-side cricket service architecture

## Assumptions / Gaps

- local dev assumes the repo-side cricket API is running on `4011` unless `CRICKET_API_PROXY_TARGET` is overridden
- deployment wiring for this bridge is not part of this slice; non-dev environments should set `VITE_CRICKET_API_BASE` explicitly or provide an equivalent reverse proxy path
- the root app now launches the Express report route instead of rendering report content in React, which is intentional for this phase
- unrelated pre-existing repo modifications were not altered by this slice

## Stop Point

This stage lock is limited to the first reversible root-app bridge slice only.

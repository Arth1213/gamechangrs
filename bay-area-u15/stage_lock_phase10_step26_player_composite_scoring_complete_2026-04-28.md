# Stage Lock: Phase 10 Step 26 - Player Composite Scoring Complete

Date: 2026-04-28

## Goal of the slice

Compute first-pass `player_composite_score` rows for a series from persisted `player_season_advanced` rows using the active scoring-model composite weights.

This slice keeps composite scoring as a separate local compute step after season aggregation.

## Exact files changed

- `bay-area-u15/apps/worker/src/analytics/compositeScore.js`
- `bay-area-u15/apps/worker/src/pipeline/runCompositeScoring.js`
- `bay-area-u15/apps/worker/src/index.js`
- `bay-area-u15/package.json`
- `bay-area-u15/stage_lock_phase10_step26_player_composite_scoring_complete_2026-04-28.md`

## Exact migration applied

No Supabase migration was applied in this slice.

The change is application-level only:

- add first-pass role-aware composite scoring logic
- add a dedicated local `compute-composite` worker command
- write fresh `player_composite_score` rows per series
- compute `development_score` as the average of `recent_form_score` and `development_trend_score`
- for `wicketkeeper_batter`, use the average `player_match_advanced.fielding_impact_score` for `role_type = 'wicketkeeping'` as the wicketkeeping component

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
node --check bay-area-u15/apps/worker/src/analytics/compositeScore.js
node --check bay-area-u15/apps/worker/src/pipeline/runCompositeScoring.js
node --check bay-area-u15/apps/worker/src/index.js
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run worker:score:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
```

## Exact URLs verified

No new external or frontend URLs were verified in this slice.

Verification was local-only against:

- `bay-area-u15/storage/exports/bay-area-youth-cricket-hub-2025-milc-2025-27/composite_scoring_summary.json`
- direct Postgres queries against the configured Supabase database

## Verification result

MilC 2025 composite result:

- source series: `bay-area-youth-cricket-hub-2025-milc-2025-27`
- scoring model id: `7`
- score version: `v1`
- input `player_season_advanced` rows: `35`
- output `player_composite_score` rows: `35`
- composite weight rows loaded: `28`
- wicketkeeping summaries loaded: `1`
- division buckets: `1`

Verified aggregate output for series `8` / `All Divisions`:

- row count: `35`
- percentile range: `1.4706` to `100.0000`
- average composite score: `47.4910`

Verified top leaderboard rows:

- `S Patel` (`bowling_all_rounder`) -> composite `77.2008`, percentile `100.0000`
- `A Patel` (`bowling`) -> composite `76.4425`, percentile `97.0588`
- `Stephen Wig` (`bowling`) -> composite `74.2529`, percentile `94.1176`
- `Zia Ul Haq` (`bowling`) -> composite `70.5274`, percentile `91.1765`
- `Faraz Ali` (`batting`) -> composite `65.9997`, percentile `85.2941`

Summary artifact:

- `bay-area-u15/storage/exports/bay-area-youth-cricket-hub-2025-milc-2025-27/composite_scoring_summary.json`

## Exact deploy status

No deploy was performed.

This remains a local-only worker/control-plane slice and does not change the hosted frontend/runtime boundary.

## Blockers or known gaps

- Composite scoring is first-pass and currently depends on the active scoring-model weights already stored in Supabase.
- Duplicate player display names can still legitimately produce multiple leaderboard rows when they are different underlying player ids.
- This slice computes and stores composite rows only; it does not yet validate report rendering or chat/query behavior for the MilC series through the API layer.
- No publish/promote step exists yet for moving a newly computed series into broader frontend visibility.

## Good to go with next step

Yes.

## What the next step will do

Step 27 should validate the full local-to-API analytics consumption path for MilC by querying the existing API/report services against the newly computed season and composite rows, then define the local publish/visibility checklist for onboarding a new series into Game-Changrs safely.

# NCCA Top Players Page Design

## Goal

Add an NCCA-only SME-branded top-player page that ranks the top 20 players by existing composite selector score within Premier A, Premier B, and Premier C.

## Scope

The route is available only for `bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a`. It uses the existing `player_composite_score` calculation; it does not add a batter/bowler-specific formula or compare players across divisions.

## Page

The page has three division tabs: Premier A, Premier B, and Premier C. Each tab displays up to 20 players ordered by composite selector score descending, with stable tie-breaking by percentile and player name.

Each row includes rank, player name, team, primary role, composite selector score, percentile, confidence/sample context, an Assessment link, and a Threat Report link. Assessment uses the existing player report route with the selected `divisionId`; Threat Report uses the existing intelligence/threat-report route for the same player and division.

The page uses the current SME visual tokens, typography, cards, table behavior, and mobile layout. It is not exposed as a generic all-series leaderboard.

## Data and Readiness

The endpoint queries `player_composite_score`, joined to player, team, division, and season-advanced context. It returns no result until NCCA recomputation has produced current composite rows. The UI explains that rankings are unavailable while the NCCA refresh/recompute remains incomplete.

## Testing

Tests cover NCCA-only route access, division filtering, top-20 limiting and sort order, and correct assessment/threat links. No test uses or creates a new scoring formula.

# Lovable NCCA Top Players Publish Design

## Goal

Publish the approved NCCA Top Players experience inside the existing Game-Changrs Lovable application.

## Route and Access

Add the protected route `/analytics/ncca/top-players`. It is visible only to signed-in users with viewer access to the fixed NCCA Summer 2026 series key. The page calls the existing NCCA-only API endpoint through `src/lib/cricketApi.ts`; it does not calculate scores in the frontend or use fixture data.

## Page

The page preserves the current Player Assessment and Threat Report look and behavior used by the Lovable analytics surfaces: the Game-Changrs navigation, dark analytics shell, display typography, cards, table treatment, link treatment, and responsive layout. It has Premier A, Premier B, and Premier C tabs, displaying up to 20 players per division in the order supplied by the API.

Each row shows rank, player, team, role, composite selector score, percentile, confidence, Player Assessment, and Threat Report. The report links use the existing Lovable routes `/analytics/reports/:playerId` and `/analytics/intelligence/:playerId`, passing the NCCA `series` and row `divisionId` query values.

## Data and Failure States

The frontend consumes the API payload from `GET /api/series/:seriesConfigKey/top-players`, with the authenticated Supabase access token sent via the existing cricket API bridge. Loading, no-ranking/recompute, unavailable-access, and API-error states use the existing analytics page patterns. NCCA identity remains enforced by the API as well as the frontend route.

## Publishing

After build and route verification pass locally, commit and push the Lovable frontend changes to `main`. Publish the linked Lovable project from its existing signed-in workspace, then verify the production route while authenticated.

## Non-Goals

This does not expose a generic cross-series leaderboard, add a new scoring formula, bypass analytics access control, or publish the worker/API service itself.

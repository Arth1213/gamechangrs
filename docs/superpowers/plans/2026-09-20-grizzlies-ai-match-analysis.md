# Grizzlies AI Match Analysis Implementation Plan

## Trigger

Begin only after MiLC 2026 completed-match ingestion, season aggregates, composite scores, player intelligence, and validation finish. Do not publish the MiLC series as part of this work.

## Scope

Add a signed-in-only **AI Match Analysis** tab to `/analytics/grizzlies/2026`. It initially contains two West Division MiLC 2026 reports:

1. A neutral Silicon Valley Strikers match analysis covering both participating teams, plus Grizzlies scouting implications.
2. A Grizzlies-specific analysis of the San Ramon Grizzlies six-wicket win, including post-match review and opponent scouting.

Reports open as GameChangrs-styled detail pages with a **Back to Grizzlies 2026 Analytics** link. They stay inside the protected Grizzlies portal.

## West Division Schedule and Entry Points

Replace the portal's static `Starting Soon` and hard-coded fixture cards with the active MiLC 2026 West Division inventory. The protected **AI Match Analysis** tab at `/analytics/grizzlies/2026` must show every current and future West fixture, regardless of whether San Ramon Grizzlies participate.

Each fixture card shows date, venue, teams, status, and completed scoreline/result when available. Scheduled or live fixtures have no report action. A completed fixture with persisted scorecard and ball-by-ball facts exposes an **AI Match Analysis** card/button. Initially, this applies to the two completed West matches: the Silicon Valley Strikers match and the San Ramon Grizzlies six-wicket win.

The action opens a protected GameChangrs-styled report detail route with a **Back to Grizzlies 2026 Analytics** link. Report availability derives from persisted facts, not from client-side team-name checks or hard-coded match IDs.

## Data and Evidence

Before any AI generation, assemble a deterministic evidence bundle for each match: result, innings totals, run rates, wickets, toss, phase scoring, wickets by phase, dot-ball and boundary rates, partnerships, collapses, bowling impact, dismissal/bowler-type patterns where available, fielding events, and three to five quantified momentum shifts.

AI may use only that evidence bundle. Every conclusion must carry evidence and a confidence level. Missing or weak evidence must produce an explicit insufficient-data statement rather than a fabricated claim.

## Report Structure

For each match produce:

1. Strengths for both participating teams.
2. Weaknesses for both participating teams.
3. Critical-moment timeline with overs, events, score changes, and impact.
4. Strategic turning points distinct from individual moments.
5. Grizzlies Watch-out: opponent-specific risks even for a match that did not include Grizzlies.
6. Grizzlies game plan: batting, bowling, phase targets, fielding pressure, and matchup guidance.

## Backend

Create persisted report records keyed by series and match, with report type, draft/generated/reviewed status, evidence JSON, analysis JSON, generation metadata, source-data checksum, and timestamps. Extend the existing protected Grizzlies portal API with list, detail, and admin-only regenerate endpoints.

Extend the existing Grizzlies portal payload to return the live West Division fixture inventory and per-match report availability. The API must preserve the existing Grizzlies access guard and return only the MiLC 2026 West Division scope for this tab.

## Frontend

Add an AI Match Analysis tab to the existing Grizzlies portal. Render match cards with teams, result, date, report status, a Grizzlies takeaway, and an Open Report action. Detail reports use the GameChangrs dark report surface, Grizzlies red accents, GameChangrs green for insights/actions, evidence chips, confidence badges, generation timestamp, and a source-data note.

The schedule view removes `Starting Soon`, stale static dates, and `TBD` placeholders. It renders server-supplied West Division status and report-action states.

## Validation

Test deterministic moment detection, evidence-required generation, portal access control, list/detail API contracts, tab navigation, back navigation, West-only schedule filtering, completed-only report actions, and the fact that neutral reports do not imply Grizzlies played when they did not. Review both generated reports before making them visible.

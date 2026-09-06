# NCCA League-Wide Threat Recalibration Design

## Goal

Replace the current threat presentation, which uses the maximum per-division percentile for a player, with one NCCA 2026 Summer league-wide threat score. The new score must give Premier A the greatest value, account for sample size, and drive both the Grizzlies portal and Player Threat reports.

## Problem

`player_composite_score.percentile_rank` is calculated within each division. Taking `max(percentile_rank)` across Premier A, B, and C rewards a player for a single strong result in any division and ignores division strength and evidence volume. It is not a valid league-wide threat measure.

## Scope

This design applies to the NCCA 2026 Summer series only. It adds a league-wide derived threat score; it does not replace existing division-level composite scores, Player Assessment scores, raw scorecard data, or player role classification.

## Inputs and Eligibility

The source of truth is the completed NCCA season aggregation:

- `player_composite_score.composite_score` for the player and division.
- `player_season_advanced.matches_played` for the same player and division.
- NCCA divisions identified by source label: `2026 Premier A`, `2026 Premier B`, and `2026 Premier C`.

A player is eligible for league-wide ranking only if they have at least one recorded match in one of these three divisions. Players with no eligible evidence receive no threat tier.

## Calculation

For each player-division row, calculate:

```text
division_weight = Premier A: 1.00, Premier B: 0.70, Premier C: 0.45
confidence = min(matches_played / 4, 1.00)
confidence_adjusted_composite =
  composite_score * confidence + 50.00 * (1.00 - confidence)
```

`50.00` is the neutral baseline. A player reaches full evidence weight at four matches; lower samples are deliberately pulled toward neutral rather than treated as proof of elite or poor performance.

For each eligible player, calculate:

```text
league_threat_score =
  sum(division_weight * confidence_adjusted_composite)
  / sum(division_weight)
```

The denominator includes only divisions in which that player participated. This lets a Premier A season stand on its own, allows B/C evidence to supplement it, and prevents non-participation from acting as a zero.

Rank `league_threat_score` across all eligible NCCA players using the existing deterministic percentile method. Persist the result as `league_percentile_rank`.

## Tier Rules

- **Red:** league percentile at or above 85, and at least three total NCCA matches.
- **Amber:** league percentile from 60 (inclusive) to below 85, or percentile at or above 85 with one or two total matches.
- **Green:** league percentile below 60.
- **Unknown:** no eligible NCCA match evidence.

The hard red evidence gate prevents one- and two-match samples from being displayed as top-tier threats. The tier reflects NCCA evidence only and is not a scouting judgment outside that evidence.

## Storage and Pipeline Boundary

Create a dedicated league-wide derived table keyed by `(series_id, player_id)`. It must store the calculated score, percentile, total matches, division evidence, model version, and calculation timestamp. Keep `player_composite_score` unchanged because it remains a division-specific score used by division reports and leaderboards.

The season post-processing order becomes:

1. Aggregate division season statistics.
2. Compute division composite scores.
3. Compute and replace league-wide NCCA threat rows.
4. Generate player intelligence artifacts.

The threat step must run idempotently inside a transaction and must replace only the target series' rows.

## Consumers

- **Grizzlies Squad Intelligence:** use the persisted league-wide tier rather than `max(percentile_rank)`.
- **Player Threat reports:** use the persisted league-wide score, percentile, total-match evidence, and tier in the threat header. Preserve division composites as supporting breakdowns.
- **Other report/leaderboard consumers:** retain their current division-specific behavior unless explicitly changed in a later request.

## Role Classification

`role_type` is not part of this recalibration. There are no player-specific role overrides. A later role-model review may adjust the general batting/bowling all-rounder rule, but it is not required for this threat-score correction.

## Verification

- Unit-test Premier A/B/C weighting, neutral shrinkage, partial-division participation, percentile ranking, and tier boundaries.
- Unit-test the red hard gate for one and two total matches.
- Integration-test that the recomputation replaces only NCCA rows and is idempotent.
- Test both portal and Player Threat report APIs consume the same stored tier.
- Run the full NCCA recomputation and audit selected players including Vivaan and Kashyap against persisted evidence, without role overrides.

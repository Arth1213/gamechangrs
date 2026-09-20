# Grizzlies tactical-report standard

User-approved direction, 20 September 2026. Apply to future match-analysis and scouting reports in this project.

## Presentation

- Situation → named player → action → supporting statistic.
- Lead with one or two short action bullets per card. Keep detailed statistics, season splits, references and limitations expandable.
- Professional, restrained layout: clear headings, aligned cards, neutral dark surfaces, limited red/green/gold accents. No redundant hero-card labels or decorative clutter.
- Keep the match summary a concise narrative. Tactical sections must help the coach decide, not merely describe rates.

## Required decisions

- Named Grizzlies bowling options by powerplay, middle and death; direct opposition samples separate from transferred phase evidence.
- Phase-specific opposing batting threats and named bowling counters.
- Strike bowlers for each team's current observed XI: wicket-taking frequency, economy, bowling strike rate and weaker observed phases. A one-match spike is not consistency.
- Dot-ball pressure by phase with explicit legal-ball denominator and scoring context. Do not claim dots caused wickets without testing that relationship.
- Collapse repair, manageable chase and immediate acceleration batting options, using first-six-ball starts, early dismissals and consistency samples.
- Partnerships to break and Grizzlies partnerships to build. Strong means >30 legal balls and ≥8 RPO setting, or ≥entry required rate chasing. Short explosive stands remain relevant.
- Conditional field trials only; never invent shot direction, pitch map, handedness or fitness.

## Evidence and confidence

- Combine usable MiLC 2025/2026 history, preserving season splits and explicit as-of cutoff; no future leakage.
- Latest available scorecard determines the provisional XI even if shortened. Exclude shortened or unreconciled innings from standard T20 phase claims.
- Publish only reviewed, source-backed reports. Preserve previous report versions.
- Phase minimums are coverage gates, not statistical confidence thresholds. Show samples; do not imply high confidence from them.

## Improvement process — not automatic model training

1. Preserve the recommendation, model version, data checksum and decision-time inputs before the next game.
2. Record whether the recommended player/action was available and actually used, and its phase-specific outcomes.
3. Evaluate on chronologically held-out matches against simple phase-role baselines; avoid hindsight and selection bias.
4. Measure error and confidence calibration with adequate samples. Review weights and thresholds before promoting a new version.
5. Keep exploratory/limited labels until prospective evidence supports stronger claims.

Current implementation is an evidence-based heuristic system. It does not automatically train itself, learn causality or guarantee wins. Future outcome logging and calibrated training remain separate implementation work.

# T20 Contextual Match Intelligence Design

## Purpose

Upgrade the Grizzlies AI Match Analysis system from scoreline-oriented summaries to evidence-backed T20 match narratives that explain how pressure, partnerships, collapses, and phase performance changed the game. The same logic must apply to every completed match with sufficient evidence, including matches in which the Grizzlies did not participate.

The system must remain auditable. It may improve through explicitly versioned rules and reviewed evidence, but it must not silently “learn” from unverified prose or overwrite an approved report.

## Success Criteria

- Every completed, eligible match is evaluated with the same T20-context model.
- Match summaries identify the most consequential supported performance or partnership, not merely the winner and final run rates.
- Turning points distinguish sustained changes in match state from isolated critical moments.
- Chases incorporate target, required rate, scoring rate, wickets remaining, and pressure before and after the decisive passage.
- Target-setting innings incorporate powerplay platform, middle-over control or slowdown, death-over acceleration, and wickets available.
- Reports name players only when the persisted evidence supports the claim.
- Incomplete evidence produces a conservative fallback rather than invented context.
- Reviewed or published reports are never silently overwritten when the calculation model changes.
- Schedule cards show concise dates without JavaScript timezone strings or midnight timestamps.
- Report hero cards omit redundant eyebrow labels such as `Match narrative` and `Scorecard snapshot`.

## Scope

### Included

- Generalized partnership and T20 match-state evidence for all completed eligible MiLC West matches.
- Versioned deterministic selection of critical moments and turning points.
- Evidence-bounded match-summary construction.
- Regeneration of the two current match reports as new reviewable versions.
- Tests for chase, defense, recovery, collapse, incomplete-evidence, and date-format behavior.
- Removal of redundant hero-card labels and raw timestamp text.

### Excluded

- Training or fine-tuning a machine-learning model on user feedback.
- Automatic publication of regenerated reports.
- Rewriting raw match, scorecard, innings, or ball-event data.
- Expanding the portal beyond the configured MiLC 2026 West scope in this change.
- Claiming win probability without a calibrated probability model.

## Architecture

The feature keeps the current source-of-truth and review flow:

1. Persisted match, innings, batting, bowling, wicket, and ball-event facts are read for one eligible match.
2. A pure evidence builder produces canonical T20 match-state evidence.
3. A deterministic evaluator ranks candidate critical moments and turning points.
4. A narrative builder converts the selected evidence into bounded structured claims and a match summary.
5. The report is stored with an evidence checksum and an explicit model version.
6. A reviewer approves a regenerated report before it can replace the currently published report.
7. The protected API serves only reviewed or published reports.

The calculations belong in the worker analytics layer. The API may compose presentation-friendly output, but it must not independently invent a different turning-point model.

## Evidence Contract

The evidence bundle advances to `grizzlies-match-analysis-v2` and adds the following concepts.

### Match and innings context

- Match format and scheduled maximum overs when available.
- Teams, result, target, innings totals, legal balls, and wickets.
- Run rate for each innings.
- Chase required rate at the start and at each over boundary.
- Wickets remaining and balls remaining at each match-state checkpoint.
- Powerplay, middle, and death phase totals, wickets, dot-ball rate, and boundary rate.

When the configured competition rules do not explicitly supply phase boundaries, use documented T20 defaults:

- Powerplay: overs 1–6.
- Middle: overs 7–15.
- Death: overs 16–20.

### Partnerships

For each wicket-to-wicket batting segment, calculate:

- Both batter identities when available.
- Start and end score.
- Partnership runs and legal balls.
- Partnership run rate.
- Wickets lost before entry and after exit.
- For a chase: target remaining, balls remaining, required rate, and current run rate at entry and exit.
- Each batter's runs and balls within the partnership when derivable.
- Boundaries, dot balls, and dismissal ending the partnership.

If striker/non-striker continuity cannot be reconstructed reliably, mark the partnership identities or individual contributions unavailable. Do not infer them from the final batting table alone.

### Collapses and recoveries

- A collapse candidate is a clustered loss of wickets over a bounded number of legal balls with limited scoring.
- A recovery candidate is a partnership or phase that follows elevated wicket/rate pressure and materially restores scoring control or wickets-in-hand stability.
- Thresholds must be constants with names and tests, not unexplained inline values.

### Data quality

Each evidence family carries an availability flag and any missing source fields. Report generation may still proceed with a conservative summary when totals are complete but partnership reconstruction is unavailable. Partnership-specific claims require complete partnership evidence.

## T20 Match-State Evaluation

### Critical moments

A critical moment is a short, localized event or sequence, such as:

- A wicket of a set or high-impact batter.
- A multi-boundary over that materially changes chase pressure.
- A low-scoring over under high required-rate pressure.
- A late-innings wicket cluster.
- A decisive finishing over.

Critical moments include the innings, over or legal-ball interval, score before and after, quantified effect, evidence references, and confidence.

### Turning points

A turning point is a sustained passage that materially changes the strategic state of the match. Candidate types include:

- Chase recovery partnership.
- Chase acceleration partnership.
- Target-setting platform partnership.
- Middle-overs squeeze.
- Collapse.
- Death-over surge.
- Bowling spell that changes wickets and scoring pressure over multiple overs.

Each candidate receives a deterministic impact score assembled from applicable normalized components:

- Run-rate swing.
- Required-rate relief or pressure increase.
- Wicket preservation or wicket cluster.
- Share of target or innings total.
- Phase leverage, with late chase events weighted by reduced balls remaining.
- Result alignment, used only as supporting context rather than retroactive proof.

The output must expose the component metrics used. Do not present the score itself as a win probability.

For a successful chase, a recovery partnership should outrank the final winning ball when it contributed more to restoring control. For match 2376, the Vivaan Jagtiani–Bilal Basheer partnership is selected only if the reconstructed evidence shows that it materially improved or stabilized the chase.

## Narrative Rules

The summary follows this order when evidence is available:

1. Target-setting context and the first innings' principal contribution.
2. Chase or defense situation, including relevant pressure at the decisive passage's entry.
3. The highest-ranked supported turning point, with players, runs/balls, and match-state change.
4. The finishing or deciding performance.
5. Concise result statement.

Example structure, not hard-coded output:

> East Bay set 167 after [verified first-innings performance]. Silicon Valley's chase was [verified match state] when Vivaan Jagtiani and Bilal Basheer added [runs] from [balls]. The stand moved the chase from [entry pressure] to [exit state], preserving [wickets] for the finish. [Verified finishing contribution] completed the six-wicket win.

The structured `turningPoints` section uses the same selected evidence as the summary. This prevents the summary and AI Insights section from contradicting each other.

Fallback behavior:

- If partnership reconstruction is unavailable, use verified phase and individual-performance evidence.
- If only innings totals are complete, retain a concise scoreline-based summary and mark detailed turning-point evidence insufficient.
- Never hard-code player names, match IDs, or prose for a specific game.

## Versioning and Review Lifecycle

- Add `analysisModelVersion: "t20-context-v2"` to generation metadata and structured analysis.
- The source checksum continues to represent canonical source facts.
- The analysis version is tracked independently so unchanged source facts can still produce a new review candidate after a model upgrade.
- Regeneration with the same source checksum and model version is idempotent.
- Regeneration with a new model version creates or updates a non-public review candidate; it does not overwrite the currently reviewed/published report.
- The two current reports are recalculated with `t20-context-v2`, compared against their evidence, and shown for review before publication.
- Future eligible matches use the same versioned generator after ingestion and analytics complete.

“Continue to learn” therefore means improving explicit, tested analysis versions from reviewed cricket requirements. It does not mean allowing unreviewed generated text to retrain or modify production logic.

## API Contract

The protected report detail response continues to expose match, evidence, analysis, scorecard, status, timestamps, and checksum. It additionally exposes:

- Analysis model version.
- Selected turning-point type and component metrics.
- Partnership details used by the summary when available.
- Availability/data-quality notes needed to explain conservative fallbacks.

The API must return one internally consistent report version. It must not combine a v2 summary with v1 turning-point data.

## Presentation Changes

### Match report

- Keep the section heading `Match Summary` and useful hero-card title `How the match was decided` or equivalent.
- Remove redundant eyebrow labels `Match narrative` and `Scorecard snapshot`.
- Keep the scorecard title `Top performances`.
- Maintain equal-height, responsive summary and scorecard cards.
- Continue showing both teams' top batting and bowling performers where evidence exists.

### Schedule page

- Convert server-provided match dates to a stable date-only presentation such as `Sep 19, 2026`.
- Treat date-only database values as calendar dates rather than UTC instants to avoid day shifting.
- Never render `Date.toString()` output, midnight timestamps, timezone suffixes, or `GMT+0000 (Coordinated Universal Time)`.
- Venue remains separately displayed after the concise date.

## Failure Handling

- Missing required innings or ball-event evidence blocks detailed generation and records the missing inputs.
- Partial partnership evidence suppresses partnership-specific claims while allowing safer phase-based analysis.
- Unsupported match formats do not reuse T20 thresholds silently; they require a matching rule set or conservative fallback.
- A failed regeneration leaves the current reviewed/published report unchanged.
- API timeouts continue to produce the existing bounded service error rather than indefinite loading.

## Testing Strategy

### Pure worker tests

- Successful chase recovered by a middle-order partnership.
- Successful chase dominated from the start.
- Failed chase under rising required-rate pressure.
- Defended target decided by middle-overs wickets.
- Target-setting platform followed by death-over acceleration.
- Collapse and recovery in the same innings.
- Partnership identity unavailable despite valid totals.
- Source checksum and analysis-version idempotency behavior.

Assertions cover partnership runs/balls, entry/exit match state, ranking, evidence references, and conservative fallback behavior.

### API tests

- Summary and turning point use the same selected evidence.
- Report payload contains a single consistent analysis version.
- Per-team top batting and bowling performers remain correct.
- Reviewed/published report access controls remain unchanged.

### Frontend tests

- Redundant hero labels are absent.
- Useful card titles remain.
- Raw GMT/time strings never render on fixture cards.
- Date-only values render consistently independent of browser timezone.
- Existing report and back-navigation behavior remains intact.

### Verification before publication

- Run focused worker and API tests.
- Run the complete repository test suite and production build.
- Regenerate the two current reports as review candidates.
- Manually compare the selected turning point, summary, and top performances with persisted scorecard and ball-event evidence.
- Publish only after explicit report review approval.

## Rollout

1. Add failing tests for partnership reconstruction, T20 pressure, narrative consistency, and date rendering.
2. Implement v2 evidence and turning-point calculations.
3. Implement versioned report generation and protected API response.
4. Apply the report-card label and schedule-date presentation changes.
5. Regenerate the two current reports as non-public candidates.
6. Present both reports for factual review.
7. After approval, transition the candidates to reviewed/published and publish the matching frontend build.
8. Verify the live URLs and confirm the public frontend asset contains the approved UI version.

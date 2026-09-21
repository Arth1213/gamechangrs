# T20 learning pipeline and professional report presentation

Status: proposed design for user review; not implemented or validated ML.

## User objective

Make Grizzlies tactical reports improve from previous recommendations and subsequent match evidence. Preserve named-player decisions for bowling, batting scenarios, partnerships, strike bowlers, and dot-ball pressure. Display concise, professional reports with less color and fewer decorative effects.

This explicitly extends the older contextual-match-intelligence specification, which excluded trained ML. The full end state is a repeatable supervised training/evaluation/inference pipeline, connected to validated ingestion and the report visualization. A saved standard, outcome table, or one successful training run alone does not complete the objective.

## Current-state findings

Inspected at repository commit `9e21d9c` on 2026-09-20:

- `bay-area-u15/apps/worker/src/analytics/t20TacticalIntelligence.js` builds deterministic phase/player recommendations, not fitted models. Its confidence remains limited.
- `bay-area-u15/apps/worker/src/ops/grizzliesMatchAnalysis.js` stores evidence, analysis, checksum, and analysis version. Its upsert can replace a same-version report when the checksum changes. This is not an immutable prediction ledger.
- The report schema versions by series/match/report type/analysis-model version, not by prediction time and evidence revision.
- Historical selection uses a date-level cutoff and name-normalized cross-season matching. These are useful for scouting but insufficient by themselves for leak-free, identity-safe ML.
- `bay-area-u15/apps/worker/src/ops/localRefresh.js` already has a post-ingestion validation gate suitable for enqueueing learning work without training in an HTTP request.
- Report UI still contains team-specific colored gradients, colored section labels, and a glowing gold frame. The tactical cards add further colored borders/text.

## Recommended approach and alternatives

Use supervised statistical models with chronological evaluation, immutable recommendation records, and controlled retraining. Begin with regularized regression/classification; compare more complex models only after the baseline is measured.

Retrieval of previous reports is useful for displaying prior advice but is not model learning. Fine-tuning a language model on generated reports risks reproducing unverified claims and does not establish tactical accuracy. Reinforcement learning is not the initial approach: the available scorecards do not record outcomes for unchosen bowlers or batting orders, nor randomize coaching choices.

## Read-only source readiness audit

Queried the authorized analytics database at `2026-09-21T00:58:53.843Z` (September 20 local time). No production writes. Scope was the two configured MiLC series, metadata plus batting/bowling player identities; this was not a ball-by-ball reconciliation audit.

| Inventory | MiLC 2025 | MiLC 2026 |
| --- | ---: | ---: |
| Completed, parsed, computed matches | 139 | 20 |
| Completed but parsing skipped | 5 | 2 |
| Scheduled matches | 0 | 2 |

The 159 metadata-eligible matches cover 24 dates in 2025 and three dates in 2026. Every scoped match has a match date but no `match_datetime`; same-date grouping is therefore mandatory. The 2026 candidate block has one match on September 17, eight on September 18, and eleven on September 19. Do not choose splits by looking at their eventual model performance, and do not claim these metadata counts establish usable training labels.

Across scoped scorecards, 802 distinct database player rows collapse to 654 normalized display names. All have a nonblank source player ID, but those IDs include legacy numeric IDs, newer opaque IDs and synthetic placeholders. For example, Carmi Le Roux and Aarnav Iyer each appear under three database IDs. This is evidence of identity-linkage work, not proof every matching name is the same person. Synthetic IDs must not be treated as verified external identifiers. The initial crosswalk must explicitly distinguish source-confirmed links, candidate links, and unresolved collisions.

Receipts: `/Users/artharun/.codex/visualizations/2026/09/07/01a079c5-457f-79f2-981f-74c75b543fa4/grizzlies-east-bay/ml-readiness.json`; reproducible read-only query script: `/private/tmp/grizzlies-ml-readiness.cjs`. The existing bundled Python runtime has NumPy/pandas but not scikit-learn or pytest; the trainer requires an isolated, pinned dependency environment rather than assuming those dependencies exist.

## Data contract and identity

Use verified MiLC 2025 and 2026 source matches, not just the two displayed reports. Scope the training inventory explicitly and record included/excluded matches and reasons. Reuse bounded reads and local versioned exports; no training or full-history scans on the report GET path.

Training labels come from reconciled innings, scorecards, and ball events. Generated narrative, user approval, a match win, or an LLM's confidence is never an outcome label. Previous reports provide the recommendation and its inputs; later source records provide outcomes. Coach feedback is separately typed as availability, use, correction, or commentary.

Use source-backed player identifiers and a reviewed cross-season identity mapping. Names can propose a mapping but cannot silently merge players. Unknown identities fall back to team/phase priors or are excluded from player-specific training. Record that fallback in the report.

Reject duplicate event identities, inconsistent totals, impossible states, ambiguous player mappings, and unsupported shortened/DLS innings. Store exclusions; do not repair unexplained score gaps to force reconciliation.

Features must reflect information available before the decision. Where only match dates are trustworthy, exclude all other matches on the same date from prior-match features. Within a match, accumulate earlier deliveries only. Final totals, future partnerships, eventual result, full-innings statistics, and future roster knowledge cannot be inputs.

Retrospective replay is labeled retrospective: historical data may have been corrected after play. Prospectively created source snapshots additionally track when information became available, enabling a genuine real-time evaluation later.

## Prediction tasks

### Over-boundary bowling forecasts

Unit: a verified complete six-legal-ball over at its start, including all associated extras in its run outcome. Exclude partial terminal overs from this task and report that coverage limitation. Never mistake over notation such as 3.4 for a decimal number.

Inputs: phase, score, wickets, balls remaining, target/required rate for a chase, prior dot-ball sequence, batter start/set status, candidate bowler workload, and lagged batter/bowler/opponent phase statistics. Missing pitch maps, shot direction, fitness, or bowling style remain missing.

Targets: total runs in the over; whether the bowler takes a credited wicket; legal-ball dot fraction. Run-outs are not credited bowler wickets. Dot fraction uses six legal deliveries; no-balls/wides contribute to over runs but not this denominator.

Models: regularized run/dot regressions and regularized logistic wicket prediction. Clip physical bounds for output, log raw/out-of-range predictions for diagnosis, and measure the clipped serving predictions consistently. No calibrated numerical wicket probability is shown until calibration is demonstrated on held-out data.

Rank only confirmed eligible bowlers. Enforce overs remaining and no consecutive overs when those inputs are supplied. Otherwise display conditional scenario options, not an executable 20-over plan. Separate expected containment from expected wicket-taking; do not invent a single causal "best bowler" label.

### Incoming-batter forecasts

Unit: batter entry, with state and historical features frozen before the first faced delivery. Estimate first-six-ball scoring and dismissal risk. Early dismissals remain in the population. Innings ending before six balls without dismissal is right-censored, not a successful six-ball survival; track and exclude those rows from fixed-horizon training unless a censor-aware model is introduced.

Show a recovery/acceleration trade-off for unbatted, available players. A player already out or batting cannot be recommended as an incoming batter. Historical batting-order selection is confounded; forecasts for alternative orders remain hypotheses rather than proven effects.

### Partnership and team strategy

Preserve verified historical partnership evidence and the user's strong-partnership definition (>30 legal balls, >=8 RPO setting or >=entry required rate chasing). Connect named bowling/batting choices to supported model forecasts. Do not advertise a separate learned partnership model unless one is actually trained and evaluated. Keep observed evidence and predicted outcomes visibly distinct.

## Immutable learning records

Add narrow, server-owned records for:

1. Source/feature snapshots: checksum, feature schema, data availability cutoff, source matches/revisions, identity-map version, exclusions.
2. Model runs: dataset hash, training/validation/test match IDs, parameters, software/code versions, seeds, fitted artifact checksum, metrics and promotion decision.
3. Decision snapshots: report revision, creation time, situation, eligible candidates, selected options, numeric forecasts, model version, feature snapshot hash, and explanation evidence references.
4. Outcome observations: linked source revision, actual player used and measured outcome; distinguish unobserved, not used, unavailable, and observed. Never label an unused recommendation a failure.
5. Feedback events: author/timestamp/category and correction references, append-only rather than modifying prior predictions.

Existing post-match narratives must not be backfilled as pre-match predictions. Preserve them as retrospective source/report records. Same-source replay is idempotent; corrected source creates a new observation revision and invalidates affected evaluations without erasing the original.

Keep existing published reports available while a new revision is generated and reviewed. Separate report revision identity from model identity. ML model promotion does not silently republish reports.

New tables follow the analytics database's existing protected service architecture. No browser write access, new public report visibility, user-role changes, or auth-project changes are part of this feature. Apply restrictive grants/RLS where relevant and test unauthenticated and unauthorized access.

## Training, evaluation, and artifact serving

Node worker exports validated, chronological feature rows. A pinned Python/scikit-learn training command fits the models offline. Export a strict JSON artifact with feature order, transforms, coefficients, intercepts, target definitions and validation metadata; never load arbitrary pickle objects on the API server. Node inference must match Python inference on shared golden fixtures.

Keep entire matches and same-date groups in one split. Fit imputers, scaling, identity encodings, priors and hyperparameters using training data only. Use expanding chronological folds for development, then an untouched later block for final evaluation. Repeatedly tuning on that final block requires declaring it development data and waiting for a new future test block.

Compare with simple phase/innings-state priors and existing rule rankings where the same observational task is measurable. Metrics include runs/dot-rate error, wicket log loss and Brier score, and reliability bins. Bootstrap uncertainty by match rather than pretending deliveries are independent. Report performance by season/phase and low-support player groups.

Initial promotion policy is deliberately conservative and versioned, not a claim that these sample sizes guarantee accuracy:

- At least 30 distinct training matches, 10 later validation matches and 10 untouched later test matches per target; date groups cannot straddle boundaries.
- For wicket/dismissal targets, at least 20 positive and 20 negative observations in each validation/test block. Fewer observations produce an exploratory candidate with no probability display or promotion.
- Candidate improves the predeclared primary held-out loss (MAE for runs/dots, log loss for wicket/dismissal) by at least 5% over the baseline and a 95% match-cluster bootstrap interval supports improvement. Classification Brier score must not worsen. Zero baseline loss cannot be improved and therefore blocks promotion.
- Reject promotion if a phase with at least five held-out matches has more than 10% worse primary loss than the baseline; unsupported phases stay in fallback rather than borrowing a global validation claim.
- Finite artifact/schema checks and Python/Node parity within `1e-8` on golden fixtures are mandatory. Promote targets independently; success on runs does not validate wicket probabilities.

These are initial operational gates to review alongside the coverage audit, not thresholds tuned until a model passes. Any change creates a new evaluation-policy version before a fresh holdout is used. A failed or inconclusive gate leaves the incumbent unchanged. "More data" does not automatically increase confidence.

The first candidate may remain in shadow mode if evidence is insufficient. The pipeline must still actually fit, evaluate, and retrain on new verified outcomes; fallback cannot conceal a missing trainer. Promotion is an explicit reviewed action; automatic training does not mean automatic deployment.

## Repeatable learning workflow

After a successful validated ingestion of relevant matches, enqueue an idempotent learning job keyed by source revision. Do not delay or fail raw ingestion because a training candidate fails.

The learning worker reconciles new outcomes, updates the dataset manifest, and retrains only when the verified dataset hash changes and training is feasible. Initial retraining cadence is five new verified matches since the last completed candidate, or an explicit operator request. Source corrections invalidate affected evaluation receipts immediately and enqueue a replacement candidate even below that cadence. Promotion coverage gates do not prevent exploratory fitting when a target is trainable; they prevent unsupported deployment. Serialize jobs per model family, deduplicate repeated refreshes, use bounded retries/timeouts and retain failure reasons. No empty or unchanged-data training loops.

No external scheduler or paid service is required for the initial architecture: use the application's worker/queue deployment. Automatic ongoing operation is incomplete until an actual deployed worker consumes these events and its health is verified. Document the invocation and deployment requirements; do not describe a local one-off command as background learning.

## Professional visual design

Apply to the web report and the requested standalone visualization/export using the same presentation rules:

- Neutral dark background, one consistent card surface, subtle gray borders, white primary text and readable muted secondary text.
- Remove team-colored gradients, gold glow, colored bullet text, and repeated gold top borders. Retain a thin subdued gold page perimeter from the earlier branding request; retain Grizzlies red only in brand/team identification.
- Use one section hierarchy and consistent spacing. Match header plus compact score strip, concise narrative summary with scorecard beside it, then tactical decisions grouped by opponent and scenario.
- Each tactical card: situation, named player, one or two short action bullets. Put samples, season splits, alternatives and source references in expandable details.
- Distinguish "Observed", "Rule-based option", "ML estimate", and "Limited evidence" with text, not colors alone. Do not turn observational confidence into predicted probability.
- Provide a compact model/evidence disclosure: model version, data cutoff, evaluated scope and status. Hide numeric forecasts when the model is unvalidated; show the honest fallback status instead.
- Preserve opponent selection, report links/back navigation, critical-moment paragraphs, scorecard figures, named partnerships and all existing tactical sections. No removal of evidence to make the page look cleaner.
- Desktop aligned columns, mobile single-column cards, no horizontal page overflow. Tables can scroll within their own container. Visible keyboard focus and accessible contrast are required.

## Acceptance evidence

Completion requires all of the following, not just passing UI tests:

1. Real reconciled MiLC source inventory and reproducible feature export with coverage/exclusion audit.
2. Automated tests proving no future/same-date leakage, no ambiguous identity merges, correct cricket denominators and early-dismissal/censor handling.
3. A fitted model artifact from real data, baseline comparison, chronological holdout metrics and an explicit promotion/shadow outcome.
4. Python/Node prediction parity; deterministic dataset/run hashes; no training side effects on report GET.
5. Immutable decisions and revisioned outcomes demonstrated before/after a later result; source corrections cannot rewrite old forecasts.
6. Two-cycle integration test: new verified outcomes change the dataset and trigger retraining; duplicate/unchanged ingestion does not. Unsafe candidates cannot replace the incumbent.
7. Application integration that uses promoted forecasts in named-player tactical cards, or explicitly shows unvalidated/fallback status with no fabricated confidence.
8. Deployed ingestion-to-learning job execution verified, including retry/failure handling. Live activation is separately confirmed; until then the status is implemented locally, not running continuously.
9. Full relevant worker/API/frontend tests, type checking, production build, and desktop/mobile render plus opponent/details interaction checks.
10. New neutral report appearance verified in the website and requested standalone visualization, with all existing information and protected access preserved.

## Rollout boundary

Implement and verify locally first. Use read-only production exports with bounded queries where needed. Production schema migrations, background worker activation, model promotion, website publication and backups are separate observable steps. Do not conflate committing code with any of them. Existing reports remain available on failure; rollback selects the prior artifact/report version without deleting history.

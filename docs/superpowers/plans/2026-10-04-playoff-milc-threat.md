# Playoff MiLC Threat Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use checkbox syntax.

**Goal:** Apply MiLC 2026-only assessments and threat colors to Dallas Xforia Giants, Baltimore Royals, and Manhattan Yorkers.

**Architecture:** A shared series/team policy controls API scope and tier calculation. A separate, versioned worker model ranks current MiLC composite scores against the season pool and persists only playoff players. Existing NCCA paths remain unchanged.

**Tech Stack:** Node, PostgreSQL, React, node:test, Playwright.

**Spec:** User-approved design in this chat, limited by “apply only for playoff's team”.

## Global Constraints

- Red percentile >=85; amber >=60; green <60. Fewer than 3 matches, missing evidence or unresolved identities are gray.
- Use MiLC 2026 only; no NCCA or career performance in playoff assessments.
- Division opponents and Grizzlies ratings remain unchanged. Assessment buttons remain neutral.
- Local implementation initially excluded release. The user subsequently authorized commit, push and publication on 2026-10-04. Credential and access changes remain out of scope.

## Review Focus

- Missing/blank percentile must not become green through numeric coercion.
- Rounded display percentiles must not change tiers at 60/85.
- Duplicate player/name grains must not merge unrelated accounts.
- Other teams/seasons/model versions must remain unchanged.
- Career profile evidence must not leak into playoff assessment narratives.

### Task 1: MiLC model and isolated persistence

**Files:** `bay-area-u15/shared/milcPlayoffThreat.js`, worker `analytics/milcPlayoffThreat.js`, `pipeline/runLeagueThreatScoring.js`, tests `milcPlayoffThreat.test.js` and `leagueThreatScoringPipeline.test.js`.

**Interfaces:** `isMilcPlayoff(seriesKey, teamName)`, `getMilcThreatTier(row)`, `buildMilcPlayoffThreatRows(inputs)` producing the existing threat row shape; pipeline accepts `dryRun`.

- [x] Write tests for exact scope, thresholds, insufficient evidence, tie ranking, duplicate identities and playoff-only output.
- [x] Run those tests and observe failure; implement shared policy and MiLC-specific ranking.
- [x] Verify dry-run has no writes, active model filtering, and replacement is scoped by series and score version.
- [x] Run worker focused tests; expected all pass. Preserve NCCA behavior.

### Task 2: Portal and report consumers

**Files:** API `grizzliesPortalService.js`, `playerIntelligenceService.js`, `reportService.js`, `render/pages.js` and their tests.

**Interfaces:** Both portal and report consume `getMilcThreatTier`; report headers add MiLC-only scope metadata. `loadAssessmentOverallStats(client,input,loader)` skips career loading only for selected playoff scope.

- [x] Write failing portal/report tests at thresholds and insufficient sample, wrong version and wrong season.
- [x] Connect MiLC rows to portal and threat reports, keep NCCA branch unchanged.
- [x] Suppress cross-season career loader and panel only for playoff assessments; test loader is not invoked.
- [x] Run focused API tests; expected all pass.

### Task 3: Verification

- [x] Dry-run using current database; validate finite scores, identity holds and source counts.
- [x] Test against transaction-scoped derived scores without publishing database writes; compare old-team and NCCA snapshots.
- [x] Run full worker/API/frontend tests, typecheck, build and local browser checks.
- [x] Independent review, fix material findings with regression tests, report exact local/release status.

## Execution record

- Current composite grain checked: MiLC 2026 has no duplicate player rows in composite or season aggregates.
- Current branch continues the already approved local portal work; existing edits preserved.
- Persisted production scoring/publication deferred to release approval. Verification uses rollback-only transaction or local fixtures.
- Validation: 365 current MiLC composite inputs, 363 eligible cohort players (two unresolved same-name accounts excluded), 42 playoff scoring rows. 7 red, 8 amber, 13 green, 14 gray (<3 matches). Three additional portal entries have no report links: two without analytics, one unresolved identity group.
- All threat-table row contents/counts unchanged before/after the rollback test. Existing Division and Grizzlies portal payloads deep-equal to the prior snapshot.
- 84 live-data report checks passed using test-only injection of rollback-verified ratings; all playoff assessments have empty career evidence, correct MiLC series and player identity; all report/button tiers match.
- Full verification: 81 worker tests, 31 API tests, 41 frontend-helper tests; typecheck/build passed. Targeted frontend lint: zero errors, one pre-existing hook-dependency warning. Build retains existing large-chunk warning.
- Browser: local desktop/mobile, all 42 color classes, report navigation/source, career-panel absence, unchanged tabs, fallback and signed-out access passed. Fonts blocked deliberately during browser QA; expected simulated 503 exercised fallback.
- Independent review: no critical/important findings. Minor note retained from earlier portal work: unknown button ratings use neutral gray rather than the previous green default. No NCCA scoring changed; existing non-playoff payloads are identical. Gray is intentionally retained so missing evidence never implies low threat.
- Evidence: `/private/tmp/milc-playoff-threat-G1mbAk/verification.json`, `/private/tmp/grizzlies-playoffs-ZpCN1X/report-checks.json`, `/private/tmp/grizzlies-playoffs-ZpCN1X/browser-checks.json`.

## Release step

Release authorized on 2026-10-04. Fresh release checks passed: 81 worker tests, 31 API tests, 41 frontend-helper tests, typecheck and production build. Persist the isolated model, deploy the API/frontend, and verify the live portal before claiming publication complete.

After release approval, run from `bay-area-u15` with the configured analytics database environment:

```sh
node apps/worker/src/index.js compute-league-threat --config config/leagues.yaml --series bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug
```

This persists only the playoff model rows in MiLC 2026. Deploy the tested API/frontend changes together, then verify live portal colors and reports. No schema migration is required.

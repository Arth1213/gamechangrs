# T20 Contextual Match Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate auditable, partnership- and pressure-aware T20 summaries and turning points for every eligible completed MiLC West match, while cleaning the Grizzlies report labels and schedule dates.

**Architecture:** A pure worker module reconstructs phases, partnerships, and chase state from persisted innings and ball events, then deterministically ranks critical moments and turning points. Versioned report rows keep the existing published v1 report visible while a `t20-context-v2` candidate is generated and reviewed; the protected API serves one internally consistent reviewed/published version, and the frontend only formats presentation data.

**Tech Stack:** Node.js CommonJS, PostgreSQL/Supabase migrations, `pg`, Node built-in test runner, Express 5, React 18, TypeScript, React Router, Tailwind/shadcn, Vite.

**Spec:** `docs/superpowers/specs/2026-09-20-t20-contextual-match-intelligence-design.md`

## Global Constraints

- Raw match, innings, batting, bowling, wicket, and ball-event facts are read-only inputs.
- Apply one generalized T20 model to every eligible completed MiLC West match; do not hard-code match IDs, player names, or narratives.
- Partnership claims require reconstructable striker/non-striker evidence.
- The summary and `turningPoints` must reference the same selected turning-point evidence.
- `analysisModelVersion` is exactly `t20-context-v2` for this release.
- A generated v2 candidate must not replace a reviewed/published v1 report until explicit review approval.
- Date-only database values are calendar dates, not UTC instants.
- Never display `Date.toString()`, midnight timestamps, timezone suffixes, or `GMT+0000 (Coordinated Universal Time)`.
- Remove `Match narrative` and `Scorecard snapshot`; retain useful headings and `Top performances`.
- Keep the protected Grizzlies authorization boundary unchanged.

## Review Focus

- Wicket events with a non-striker run-out must close the correct partnership without charging the wrong batter; Task 1 adds a non-striker run-out test.
- Wides/no-balls may add runs without consuming a legal ball; Task 1 adds an illegal-delivery chase-state test.
- A tied or abandoned match must not receive successful-chase language; Task 2 adds a non-win fallback test.
- Multiple visible report versions must resolve deterministically without duplicate fixtures; Task 4 adds a v1/v2 selection test.
- Date-only values must render the same in positive and negative UTC offsets; Task 5 adds timezone-independent date tests.

---

## File Structure

- Create `bay-area-u15/apps/worker/src/analytics/t20MatchIntelligence.js` — pure phase, partnership, match-state, critical-moment, and turning-point calculations.
- Modify `bay-area-u15/apps/worker/src/analytics/grizzliesMatchEvidence.js` — v2 evidence/analysis composition and narrative generation.
- Modify `bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js` — pure evidence and narrative contract tests.
- Create `supabase/migrations/20260920220000_version_grizzlies_match_analysis.sql` — versioned report uniqueness and visibility support.
- Create `bay-area-u15/apps/worker/src/ops/grizzliesMatchAnalysis.js` — DB evidence loading, generation, preview, review, and publication transitions.
- Modify `bay-area-u15/apps/worker/src/index.js` — register explicit generation and review commands.
- Modify `bay-area-u15/package.json` — add named operator scripts.
- Modify `bay-area-u15/apps/api/src/services/grizzliesPortalService.js` — select one visible version and serve its internally consistent summary/analysis.
- Modify `bay-area-u15/apps/api/test/grizzliesPortal.test.js` — version-selection and v2 response tests.
- Create `src/lib/grizzliesMatchPresentation.js` — stable date-only formatting.
- Create `src/lib/grizzliesMatchPresentation.test.js` — timezone-independent presentation tests.
- Modify `src/pages/AnalyticsGrizzlies2026.tsx` — use clean fixture date labels.
- Modify `src/pages/AnalyticsGrizzliesMatchReport.tsx` — remove redundant hero labels while preserving useful titles.
- Modify `src/lib/cricketApi.ts` — type v2 evidence, turning-point, and model-version fields.

### Task 1: Reconstruct T20 phases, partnerships, and chase state

**Files:**
- Create: `bay-area-u15/apps/worker/src/analytics/t20MatchIntelligence.js`
- Modify: `bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

**Interfaces:**
- Consumes: normalized innings rows and chronological ball events with `innings`, `eventIndex`, `over`, `ballInOver`, `strikerPlayerId`, `nonStrikerPlayerId`, `playerOutId`, `runs`, `batterRuns`, `legal`, `wicket`, `scoreAfterRuns`, and `wicketsAfter`.
- Produces: `buildT20MatchIntelligence({ innings, ballEvents, playersById }) -> { phaseMetrics, partnerships, criticalMoments, turningPointCandidates, dataQuality }`.

- [ ] **Step 1: Add failing partnership and chase-state tests**

Add fixtures that model a 167 target, two early wickets, and a Vivaan/Bilal recovery. Assert exact start/end scores, partnership runs and legal balls, entry/exit required rates, and player names. Add separate fixtures for a non-striker run-out and an illegal delivery that adds runs without consuming a ball.

```js
assert.deepEqual(result.partnerships[1], {
  innings: 2,
  batterNames: ["Vivaan Jagtiani", "Bilal Basheer"],
  startScore: 31,
  startWickets: 2,
  endScore: 126,
  endWickets: 3,
  runs: 95,
  legalBalls: 62,
  entryRequiredRate: 9.07,
  exitRequiredRate: 6.83,
  complete: true,
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: FAIL because `t20MatchIntelligence.js` and `buildT20MatchIntelligence` do not exist.

- [ ] **Step 3: Implement normalized event ordering and phase metrics**

Export constants `T20_PHASES`, `RECOVERY_THRESHOLDS`, and functions `sortBallEvents`, `buildPhaseMetrics`, `buildPartnerships`, and `buildT20MatchIntelligence`. Order by innings, `eventIndex`, over, and ball; count balls only when `legal === true`; use overs 1–6, 7–15, and 16–20 for powerplay, middle, and death.

```js
const T20_PHASES = Object.freeze({
  powerplay: { firstOver: 1, lastOver: 6 },
  middle: { firstOver: 7, lastOver: 15 },
  death: { firstOver: 16, lastOver: 20 },
});
```

- [ ] **Step 4: Implement partnership segmentation and match-state checkpoints**

Start a segment from the first valid striker/non-striker pair, accumulate all team runs, increment legal balls only for legal events, and close on a wicket that changes the active pair or on innings completion. Calculate target/balls/runs remaining and required rate for innings two from the innings target or first-innings total plus one.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: PASS for phase, partnership, run-out, and illegal-delivery tests.

```bash
git add bay-area-u15/apps/worker/src/analytics/t20MatchIntelligence.js bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "feat: reconstruct T20 partnership pressure"
```

### Task 2: Rank turning points and build consistent v2 narratives

**Files:**
- Modify: `bay-area-u15/apps/worker/src/analytics/t20MatchIntelligence.js`
- Modify: `bay-area-u15/apps/worker/src/analytics/grizzliesMatchEvidence.js`
- Modify: `bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

**Interfaces:**
- Consumes: Task 1 `buildT20MatchIntelligence` output plus match, innings, batting, and bowling facts.
- Produces: `buildGrizzliesMatchEvidence(input)` with `analysisModelVersion`, `phaseMetrics`, `partnerships`, `criticalMoments`, `turningPointCandidates`, and data-quality flags; `buildGrizzliesMatchAnalysis({ evidence })` with `matchSummary` and structured claims.

- [ ] **Step 1: Add failing ranking tests for six match patterns**

Cover a recovery chase, front-running chase, failed chase, defended target, death-over surge, and collapse/recovery combination. Assert that a sustained recovery partnership outranks the final winning ball when required-rate relief and wicket preservation are greater. Add a tied-result fixture and assert it contains no `completed the chase` claim.

```js
assert.equal(analysis.analysisModelVersion, "t20-context-v2");
assert.equal(analysis.turningPoints[0].type, "chase_recovery_partnership");
assert.match(analysis.turningPoints[0].statement, /Vivaan Jagtiani and Bilal Basheer/);
assert.equal(analysis.matchSummary.includes(analysis.turningPoints[0].evidenceLabel), true);
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: FAIL because v2 ranking, evidence labels, and narrative fields are absent.

- [ ] **Step 3: Implement transparent candidate scoring**

For each candidate return `type`, `innings`, `startBall`, `endBall`, `statementFacts`, `evidenceRefs`, `confidence`, and component metrics. Rank using named normalized components; retain the components in the output.

```js
impactScore = round(
  requiredRateRelief * 0.30 +
  runRateSwing * 0.20 +
  wicketPreservation * 0.20 +
  inningsShare * 0.15 +
  phaseLeverage * 0.15,
  4
);
```

For target-setting candidates, replace required-rate relief with platform/surge value; for collapses, score wickets clustered, scoring suppression, and phase leverage. Clamp every normalized component to `[0, 1]`.

- [ ] **Step 4: Build one structured narrative source**

Make `buildGrizzliesMatchAnalysis` select the highest supported candidate and use it for both `turningPoints[0]` and `matchSummary`. Include first-innings context, entry pressure, passage outcome, finishing performance, and result. If partnerships are incomplete, fall back to phase evidence; if only totals are complete, return the existing conservative scoreline narrative with `confidence: "insufficient"`.

- [ ] **Step 5: Verify pure behavior and commit**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: all v1 safety tests and new v2 scenario tests PASS.

```bash
git add bay-area-u15/apps/worker/src/analytics/t20MatchIntelligence.js bay-area-u15/apps/worker/src/analytics/grizzliesMatchEvidence.js bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "feat: rank contextual T20 turning points"
```

### Task 3: Store report versions without replacing published output

**Files:**
- Create: `supabase/migrations/20260920220000_version_grizzlies_match_analysis.sql`
- Modify: `bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

**Interfaces:**
- Produces: `analysis_model_version text not null`, unique `(series_id, match_id, report_type, analysis_model_version)`, and a deterministic visible-report index.

- [ ] **Step 1: Add a migration contract test**

Read the migration text and assert it adds `analysis_model_version`, removes the three-column uniqueness constraint, creates four-column uniqueness, and indexes visible version selection. This repository’s existing migration tests are text-contract tests and must not mutate production.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Write the migration**

The migration must:

```sql
alter table public.grizzlies_match_analysis_report
  add column if not exists analysis_model_version text;

update public.grizzlies_match_analysis_report
set analysis_model_version = 'legacy-v1'
where analysis_model_version is null;

alter table public.grizzlies_match_analysis_report
  alter column analysis_model_version set not null;
```

Resolve the existing unique constraint name from `pg_constraint` in a guarded `do` block, drop only the unique constraint whose key is `(series_id, match_id, report_type)`, then add `unique (series_id, match_id, report_type, analysis_model_version)`. Add an index on `(series_id, match_id, status, published_at desc nulls last, reviewed_at desc nulls last)`.

- [ ] **Step 4: Run the contract test and commit**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: PASS.

```bash
git add supabase/migrations/20260920220000_version_grizzlies_match_analysis.sql bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "feat: version Grizzlies match reports"
```

### Task 4: Add explicit generation, preview, review, and publish operations

**Files:**
- Create: `bay-area-u15/apps/worker/src/ops/grizzliesMatchAnalysis.js`
- Create: `bay-area-u15/apps/worker/test/grizzliesMatchAnalysisOps.test.js`
- Modify: `bay-area-u15/apps/worker/src/index.js`
- Modify: `bay-area-u15/package.json`

**Interfaces:**
- Produces:
  - `generateGrizzliesMatchAnalysis({ seriesConfigKey, divisionLabel, matchIds, dryRun, client })`.
  - `reviewGrizzliesMatchAnalysis({ matchId, analysisModelVersion, action, reviewerUserId, client })` where `action` is `review` or `publish`.
  - CLI commands `generate-grizzlies-match-analysis` and `review-grizzlies-match-analysis`.

- [ ] **Step 1: Add failing operation tests with a fake query client**

Assert eligibility rejects scheduled, non-West, unparsed, uncomputed, and ball-event-empty matches before writes. Assert identical checksum/version reruns are idempotent, a v2 generated row coexists with a v1 published row, and publish changes the v1 row to `superseded` in the same transaction. Assert `--dry-run` returns the complete candidate without writes.

- [ ] **Step 2: Run the operation tests and confirm failure**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchAnalysisOps.test.js`

Expected: FAIL because the operation module does not exist.

- [ ] **Step 3: Implement one evidence loader query**

Load match, teams, innings, batting, bowling, and chronological ball events for each selected match. Include both striker and non-striker display names. Reject unless division is exactly the configured West label, match is completed, refresh state is parsed/computed, and at least one ball event exists.

- [ ] **Step 4: Implement idempotent v2 generation**

Generate evidence and analysis, then upsert on `(series_id, match_id, report_type, analysis_model_version)`. Store `analysis.matchSummary` inside `analysis_json`, `t20-context-v2` in both the column and generation metadata, and never alter the visible legacy row during generation.

- [ ] **Step 5: Implement transactional review and publication**

`review` changes only `generated -> reviewed`. `publish` requires the v2 row already be reviewed, supersedes any other reviewed/published version for the same match/report type, and changes v2 to published in the same transaction. Reject missing reviewer identity and invalid transitions.

- [ ] **Step 6: Register commands and scripts**

Add:

```json
"ops:generate:grizzlies-match-analysis": "node apps/worker/src/index.js generate-grizzlies-match-analysis --config config/leagues.yaml",
"ops:review:grizzlies-match-analysis": "node apps/worker/src/index.js review-grizzlies-match-analysis --config config/leagues.yaml"
```

The generation command accepts `--series`, repeated/comma-separated `--matchIds`, and `--dryRun`. The review command requires `--matchId`, `--model t20-context-v2`, `--action review|publish`, and `--reviewerUserId`.

- [ ] **Step 7: Verify and commit**

Run: `node --test bay-area-u15/apps/worker/test/grizzliesMatchAnalysisOps.test.js bay-area-u15/apps/worker/test/grizzliesMatchEvidence.test.js`

Expected: PASS.

```bash
git add bay-area-u15/apps/worker/src/ops/grizzliesMatchAnalysis.js bay-area-u15/apps/worker/test/grizzliesMatchAnalysisOps.test.js bay-area-u15/apps/worker/src/index.js bay-area-u15/package.json
git commit -m "feat: generate reviewable T20 match reports"
```

### Task 5: Serve one internally consistent visible report version

**Files:**
- Modify: `bay-area-u15/apps/api/src/services/grizzliesPortalService.js`
- Modify: `bay-area-u15/apps/api/test/grizzliesPortal.test.js`
- Modify: `src/lib/cricketApi.ts`

**Interfaces:**
- Consumes: versioned rows created in Tasks 3–4.
- Produces: a detail response containing `analysisModelVersion`, v2 `evidence`, v2 `analysis`, and `matchSummary` from the same row.

- [ ] **Step 1: Add failing API version-selection tests**

Provide fake rows for a published legacy report, generated v2 candidate, and published v2 report. Assert the generated candidate remains hidden while legacy is published; after v2 publication, assert exactly one fixture and one v2 detail response. Assert a v2 response never uses the API’s legacy `buildGrizzliesMatchSummary` output.

- [ ] **Step 2: Run the API test and confirm failure**

Run: `node --test bay-area-u15/apps/api/test/grizzliesPortal.test.js`

Expected: FAIL because queries do not select by version and response types omit the model version.

- [ ] **Step 3: Make list/detail SQL choose one visible version**

Use a lateral join ordered by published status/time, reviewed time, generated time, and id; restrict portal visibility to `reviewed` or `published`. Remove grouping ambiguity and prevent duplicate fixture rows when multiple versions exist.

- [ ] **Step 4: Serve stored v2 narrative with legacy fallback**

Set `matchSummary` to `analysis_json.matchSummary` when `analysis_model_version = 't20-context-v2'`; call `buildGrizzliesMatchSummary` only for legacy rows. Return `analysisModelVersion` and expand TypeScript types for candidate components, partnership evidence, availability flags, and evidence references.

- [ ] **Step 5: Run API tests and commit**

Run: `node --test bay-area-u15/apps/api/test/grizzliesPortal.test.js`

Expected: PASS.

```bash
git add bay-area-u15/apps/api/src/services/grizzliesPortalService.js bay-area-u15/apps/api/test/grizzliesPortal.test.js src/lib/cricketApi.ts
git commit -m "feat: serve versioned T20 match intelligence"
```

### Task 6: Clean report labels and schedule dates

**Files:**
- Create: `src/lib/grizzliesMatchPresentation.js`
- Create: `src/lib/grizzliesMatchPresentation.test.js`
- Modify: `src/pages/AnalyticsGrizzlies2026.tsx`
- Modify: `src/pages/AnalyticsGrizzliesMatchReport.tsx`

**Interfaces:**
- Produces: `formatGrizzliesFixtureDate(value) -> string` using `YYYY-MM-DD` components without timezone conversion.

- [ ] **Step 1: Add failing presentation tests**

```js
assert.equal(formatGrizzliesFixtureDate("2026-09-19"), "Sep 19, 2026");
assert.equal(formatGrizzliesFixtureDate("2026-09-19T00:00:00.000Z"), "Sep 19, 2026");
assert.equal(formatGrizzliesFixtureDate(""), "Date pending");
assert.doesNotMatch(renderedText, /GMT|00:00:00|Coordinated Universal Time/);
```

Spawn child Node processes with `TZ=Pacific/Honolulu` and `TZ=Pacific/Kiritimati`; both must return `Sep 19, 2026`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test src/lib/grizzliesMatchPresentation.test.js`

Expected: FAIL because the formatter does not exist.

- [ ] **Step 3: Implement calendar-date formatting**

Extract the first `YYYY-MM-DD` when present, validate year/month/day, and format through a fixed English month-name array rather than `new Date(value).toString()` or locale timezone conversion. Return `Date pending` for invalid/empty values.

- [ ] **Step 4: Apply presentation changes**

Use `formatGrizzliesFixtureDate(fixture.startsAt || fixture.dateLabel)` in schedule cards. Remove only the `Match narrative` paragraph and `Scorecard snapshot` paragraph. Keep `Match Summary`, `How the match was decided`, and `Top performances`, with the two hero cards aligned through the existing `items-stretch`/`h-full` layout.

- [ ] **Step 5: Verify tests/build and commit**

Run:

```bash
node --test src/lib/grizzliesMatchPresentation.test.js
npm run build
```

Expected: tests PASS and production build succeeds; pre-existing Browserslist/chunk-size warnings may remain but no new error is allowed.

```bash
git add src/lib/grizzliesMatchPresentation.js src/lib/grizzliesMatchPresentation.test.js src/pages/AnalyticsGrizzlies2026.tsx src/pages/AnalyticsGrizzliesMatchReport.tsx
git commit -m "style: simplify Grizzlies match presentation"
```

### Task 7: Full verification and review-candidate generation

**Files:**
- Modify only if a failing verification exposes a defect in the owning task’s files.

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: two factual, non-public `t20-context-v2` report candidates and a review summary.

- [ ] **Step 1: Run all automated verification**

```bash
npm --prefix bay-area-u15 test
node --test bay-area-u15/apps/api/test/grizzliesPortal.test.js
node --test src/lib/grizzliesMatchPresentation.test.js
npm run build
git diff --check
```

Expected: all tests PASS, build succeeds, and `git diff --check` emits no output.

- [ ] **Step 2: Apply the migration through the repository migration command**

Run `npm run db:apply:analytics` only after confirming `db:status:analytics` targets the intended analytics project. Inspect the migration output and query `information_schema.columns`/`pg_constraint` read-only to confirm the model-version column and four-column uniqueness.

- [ ] **Step 3: Generate both current reports in dry-run mode**

```bash
npm --prefix bay-area-u15 run ops:generate:grizzlies-match-analysis -- --series bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug --dryRun
```

With no `--matchIds`, the command selects every eligible completed West match. Verify that the dry-run returns exactly the two currently eligible matches, including match `2376`, and that each output names the selected partnership/phase, entry and exit state, checksum, and `t20-context-v2`.

- [ ] **Step 4: Generate non-public candidates**

Run the same command without `--dryRun`. Confirm both new rows are `generated`; confirm the existing visible reports remain reviewed/published.

- [ ] **Step 5: Present factual review output**

For each candidate report, provide the match summary, top turning point, its component metrics, critical moments, and evidence/data-quality notes. Stop for explicit user approval before any `review` or `publish` transition.

- [ ] **Step 6: Commit any final test-only corrections**

If verification required no correction, do not create an empty commit. If corrections were required, rerun the owning task’s focused tests plus the complete verification set before committing.

### Task 8: Approved publication and live verification

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: explicit user approval of both generated report candidates.
- Produces: reviewed/published v2 reports, pushed `main`, deployed Render API, and published Lovable frontend at the same source commit.

- [ ] **Step 1: Transition approved candidates**

Run `review-grizzlies-match-analysis` with `--action review` and then `--action publish` for each approved match. Query the table read-only and confirm exactly one reviewed/published visible version per match and legacy rows are superseded.

- [ ] **Step 2: Push the verified commits to `main`**

Confirm `git status --short --branch` contains only known user-owned untracked directories plus the intended commits, then run `git push origin main`.

- [ ] **Step 3: Verify Render deploys the exact pushed commit**

Check the Render deployment dashboard/API until the service is live at the pushed SHA. Do not change Supabase environment variables as part of this deployment.

- [ ] **Step 4: Publish the matching Lovable source version**

Confirm Lovable preview identifies the exact pushed SHA before publishing. After publish, fetch the live HTML and JavaScript asset and confirm the new bundle contains the approved report headings and omits the removed labels.

- [ ] **Step 5: Verify both live report URLs and schedule**

As an authorized user, verify both detail URLs show v2 summaries and turning points, schedule cards show concise dates, no GMT text appears, back navigation works, and the two completed fixtures link to the reports. Record the exact live URLs and deployment SHA.

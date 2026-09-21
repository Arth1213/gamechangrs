# T20 Learning Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit, evaluate, serve and repeatedly retrain evidence-backed T20 player forecasts from verified MiLC outcomes, with immutable recommendations and honest uncertainty.

**Architecture:** Node validates and replays source events into chronological feature snapshots; an isolated Python trainer fits simple supervised models and exports strict JSON coefficients. A protected, revisioned ledger and durable worker queue connect validated ingestion, later outcomes and reviewed model promotion. Reports consume only eligible promoted outputs or explicitly labeled existing rule-based options; no training occurs on GET requests.

**Tech Stack:** Existing Node/CommonJS worker, PostgreSQL/pg, Node test runner, React/TypeScript. New isolated Python 3.12 environment with scikit-learn 1.7.2 and pytest; JSON artifacts only, no pickle loading. Lock all resolved Python dependencies before real fitting.

**Spec:** `docs/superpowers/specs/2026-09-20-t20-learning-pipeline-design.md`, approved 2026-09-20. Companion presentation plan: `docs/superpowers/plans/2026-09-20-professional-grizzlies-reports.md`.

## Global Constraints

- Training labels come from reconciled innings, scorecards, and ball events.
- Generated narrative, user approval, a match win, or an LLM's confidence is never an outcome label.
- Names can propose a mapping but cannot silently merge players.
- Features must reflect information available before the decision.
- Where only match dates are trustworthy, exclude all other matches on the same date from prior-match features.
- Within a match, accumulate earlier deliveries only.
- Run-outs are not credited bowler wickets.
- Never mistake over notation such as 3.4 for a decimal number.
- Early dismissals remain in the population.
- Never label an unused recommendation a failure.
- ML model promotion does not silently republish reports.
- No browser write access, new public report visibility, user-role changes, or auth-project changes are part of this feature.
- At least 30 distinct training matches, 10 later validation matches and 10 untouched later test matches per target; date groups cannot straddle boundaries.
- Classification validation/test each need at least 20 positive and 20 negative observations.
- Promotion: >=5% primary-loss improvement; 95% match-cluster interval supports improvement; classification Brier must not worsen; baseline loss zero blocks promotion.
- A phase with >=5 test matches cannot regress >10%; unsupported phases remain fallback.
- Python/Node parity tolerance is `1e-8`. Targets promote independently and explicitly.
- Retraining cadence starts at five new verified matches, changed dataset only; corrections bypass cadence, not validation or promotion gates.
- Native execution; use an isolated worktree and TDD. Preserve unrelated `.superpowers/` and `work/` files. Production migration, activation, promotion and publication require their separate rollout authorization.

## Review Focus

1. Same-day matches and corrected historical data can leak future knowledge: strict date groups, availability metadata and untouched-test receipts (Tasks 1–3, 6, 10).
2. Same names, synthetic IDs and mid-over substitutions can create false player labels: reject ambiguous links, keep prior fallback, exclude mixed-bowler overs (Tasks 1–2).
3. Early dismissals, run-outs, byes, wides and terminal chases distort denominators: target-specific tests and censor/exclusion counters (Task 2).
4. Concurrent jobs, crashes and corrections can overwrite decisions or deploy invalid models: append-only evidence, leases/fencing, explicit promotions and immediate invalidation (Tasks 4, 7–8, 10).
5. Unavailable players or stale model metadata can create unsafe named recommendations: eligibility filtering, independent target/scope gates, no invented probabilities, protected access tests (Tasks 7, 9).

## Execution order and file ownership

Complete the three presentation tasks first; they do not wait for ML success. Then implement this plan in order. Model failure to improve is an acceptable scientific result, not permission to omit fitting or weaken gates.

Paths in all commands are relative to repository root unless stated. Worker learning modules below live under `bay-area-u15/apps/worker/src/learning/`:

| Module/files | Ownership |
| --- | --- |
| `contracts.js`, `sourceQuality.js`, `identity.js`, `fixtures.js` (test helper) | Strict normalized source/identity boundary and provenance |
| `features.js`, `history.js` | Over-start and batter-entry replay; lagged raw statistics |
| `dataset.js`, `splitPolicy.js` | Canonical hashes, coverage and frozen date partitions |
| `repository.js`, two new analytics migrations | Immutable ledger, report revisions, queue/registry records |
| `bay-area-u15/ml/t20_learning/{train,evaluate,artifact}.py` | Offline fit, held-out comparison and JSON export |
| `inference.js`, `eligibility.js`, `promotion.js` | Validated local prediction, candidate eligibility, explicit registry changes |
| `jobs.js`, `runner.js`, `outcomes.js`, `feedback.js` | Durable retraining, observed outcomes and typed coaching feedback |
| `reportIntegration.js` | Persist forecast-backed tactical cards at report generation, not request time |
| `bay-area-u15/apps/worker/src/ops/{localRefresh,grizzliesMatchAnalysis}.js` | Existing validation hook and report producer integration |
| `bay-area-u15/apps/worker/src/index.js`, `bay-area-u15/package.json` | Operator commands and worker invocation |
| `bay-area-u15/apps/api/src/services/grizzliesPortalService.js` | Read-only report revision/disclosure serialization |
| `bay-area-u15/apps/worker/test/t20Learning*.test.js` | Unit/integration/cricket invariants |
| `bay-area-u15/ml/tests/` | Python split/fit/evaluation tests and parity fixtures |
| `docs/operations/t20-learning.md`, `docs/verification/2026-09-20-t20-learning.md` | Runbook, receipts, measured limitations |

### Task 1: Verified source and identity boundary

**Files:** Create `contracts.js`, `sourceQuality.js`, `identity.js` in the learning directory; `bay-area-u15/config/t20-learning-identities.json`; tests `t20LearningSource.test.js` and `test/helpers/t20LearningFixtures.js`.

**Interfaces:**
- `normalizeLearningMatch(row, {identityMap, playerSources, seriesKeys, availableAt, mode}) -> {match, exclusions}`; `row` is the existing `loadMatchEvidenceRows` shape. `playerSources` maps database player IDs to `{sourceSystem,league,sourceId}`; `seriesKeys` maps database series IDs to configured series keys. Neither mapping is inferred from names.
- `resolveIdentity(player, identityMap) -> {key: string|null, basis: "source"|"reviewed"|"unresolved"}`.
- `validateInnings(innings) -> {accepted:boolean, reasons:string[]}`.
- Normalized `match = {matchId:string, seriesKey:string, date:string, sourceRevision:string, availableAt:string, mode:"retrospective"|"prospective", innings:LearningInnings[]}`.
- `LearningInnings = {number:1|2, battingTeam:string, bowlingTeam:string, scheduledBalls:120, target:number|null, runs:number, wickets:number, legalBalls:number, events:LearningEvent[], batters:object[], bowlers:object[], reconciled:boolean}`.
- `LearningEvent = {eventIndex:number, runs:number, batterRuns:number, extras:number, legal:boolean, countsAsFaced:boolean, wicket:boolean, creditedWicket:boolean, strikerId:string|null, nonStrikerId:string|null, bowlerId:string|null, playerOutId:string|null}`. IDs are identity keys or match-scoped unresolved tokens; only verified keys may access player history.
- Test helper exports `event(overrides={})`, `innings(overrides={})`, `match(overrides={})`; defaults form a six-legal-ball 6/0 complete *chase* with target 6, verified players `source:a`, `source:b`, `source:c`, unique event indexes. A full 120-ball first innings fixture is generated separately, not disguised as a shortened game.

- [ ] **Step 1: Write source and identity failures.**

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const { resolveIdentity } = require("../src/learning/identity");
const { validateInnings } = require("../src/learning/sourceQuality");
const { innings } = require("./helpers/t20LearningFixtures");
test("display names do not link different identities", () => {
  const a = { sourceSystem:"cricclubs", league:"MiLC", sourceId:"123", name:"Aryan Patel" };
  const b = { ...a, sourceId:"987" };
  assert.notEqual(resolveIdentity(a, []).key, resolveIdentity(b, []).key);
  assert.equal(resolveIdentity({...a, sourceId:"synthetic:aryan-patel"}, []).key, null);
});
test("duplicate or inconsistent events cannot become labels", () => {
  const i = innings();
  assert.equal(validateInnings({...i, events:[...i.events, i.events[0]]}).accepted, false);
  assert.equal(validateInnings({...i, runs:i.runs + 1}).accepted, false);
});
```

- [ ] **Step 2: Run red.**

`node --test bay-area-u15/apps/worker/test/t20LearningSource.test.js` must fail because learning modules do not yet exist.

- [ ] **Step 3: Implement the normalized contract and conservative identity resolver.**

```js
function resolveIdentity(player, mappings) {
  const key = `${player.sourceSystem}:${player.league}:${player.sourceId}`;
  const verified = mappings.filter(m => m.status === "reviewed" && m.sourceKeys.includes(key));
  if (verified.length > 1) throw new Error("ambiguous_identity_mapping");
  if (verified.length === 1 && verified[0].evidenceRefs.length && verified[0].reviewedBy)
    return { key: verified[0].canonicalKey, basis:"reviewed" };
  if (!player.sourceId || player.sourceId.startsWith("synthetic:"))
    return { key:null, basis:"unresolved" };
  return { key, basis:"source" };
}
function validateInnings(i) {
  const reasons = [];
  const seen = new Set(); let runs = 0; let wickets = 0; let balls = 0;
  for (const e of i.events) {
    if (!Number.isInteger(e.eventIndex) || seen.has(e.eventIndex)) reasons.push("event_identity");
    seen.add(e.eventIndex);
    if (!Number.isInteger(e.runs) || e.runs < 0 || e.batterRuns < 0 || e.extras < 0 ||
        e.runs !== e.batterRuns + e.extras) reasons.push("run_semantics");
    if (wickets >= 10 || balls >= i.scheduledBalls) reasons.push("event_after_terminal_state");
    runs += e.runs; wickets += Number(e.wicket); balls += Number(e.legal);
  }
  if (runs !== i.runs || wickets !== i.wickets || balls !== i.legalBalls) reasons.push("scorecard_mismatch");
  return { accepted: reasons.length === 0, reasons:[...new Set(reasons)] };
}
```

Use existing `normalizeRunEvidence` and `buildMatchProfile` as cross-checks, not as proof that unresolved source semantics are correct. Record every explicit commentary repair and the normalizer version. Resolve ambiguous commentary aliases to exclusions, never arbitrary IDs. Reconcile credited bowler runs/wickets and each batter's runs/balls to scorecards. Exclude a mixed-source conflict even when a guessed repair makes final totals match. DLS/revised targets/reduced allocation or missing trustworthy standard-T20 allocation are excluded; preserve a valid second innings when the first fails event reconciliation only. `countsAsFaced` follows verified scorecard semantics (wides excluded; eligible no-balls can count as faced); don't equate it to `legal`. Non-striker run-out victim comes from `playerOutId`, not striker. Freeze availability metadata; retrospective exports do not claim historical real-time availability. Start the cross-season mapping file with an empty reviewed list and candidate list from the audit; only source-backed reviewed links unlock merged history.

- [ ] **Step 4: Run green and boundary variants.**

Run `node --test bay-area-u15/apps/worker/test/t20LearningSource.test.js bay-area-u15/apps/worker/test/t20TacticalIntelligence.test.js`. Add table-driven variants to the same source test for negative totals, tenth-wicket terminal state, DLS exclusion, duplicate reviewed mapping, unavailable date and synthetic IDs. Each must return the documented reason or throw the documented contract error. No production writes.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/apps/worker/src/learning/contracts.js bay-area-u15/apps/worker/src/learning/sourceQuality.js bay-area-u15/apps/worker/src/learning/identity.js bay-area-u15/config/t20-learning-identities.json bay-area-u15/apps/worker/test/t20LearningSource.test.js bay-area-u15/apps/worker/test/helpers/t20LearningFixtures.js
git commit -m "feat: validate T20 learning sources and reviewed identities"
```

### Task 2: Chronological over-start and batter-entry examples

**Files:** Create learning `features.js`, `history.js`; test `t20LearningFeatures.test.js`.

**Interfaces:**
- Consumes normalized matches from Task 1.
- `buildExamples(matches, {cutoff}) -> {rows:Example[], exclusions:object[]}`; `priorMatches(matches,date)` returns only `m.date < date`.
- `Example = {rowId,matchId,date,season,phase,task:"over"|"entry",playerKey,opponent,sourceRevision,mode,features:Record<string,number|null>,targets:Record<string,number>}`.
- Five target keys: `over_runs`, `over_wicket`, `over_dot_fraction`, `entry_runs6`, `entry_dismissed6`.
- `featuresAt(state, playerHistory) -> features` is used identically for replay and later inference; `advanceState(state,event) -> nextState` is pure. Export both.
- `State = {innings:1|2,phase:"powerplay"|"middle"|"death",score:number,wickets:number,legalBalls:number,target:number|null,priorDotStreak:number,strikerId:string|null,nonStrikerId:string|null,ballsFaced:Record<string,number>,ballsBowled:Record<string,number>,candidateId:string|null,lastBowlerId:string|null,availabilityConfirmed:boolean}`. `playerHistory` contains raw earlier player/opponent phase run, ball, credited-wicket and legal-dot counts; divide only positive denominators, otherwise return null. Export the fixed `FEATURE_NAMES` array from `contracts.js` and use it in both dataset and serving.
- Fixed numeric feature order: `innings2,phasePowerplay,phaseMiddle,phaseDeath,score,wickets,ballsRemaining,runsRequired,requiredRate,priorDotStreak,strikerBalls,nonStrikerBalls,candidateBallsBowled,candidateOversRemaining,priorPlayerBalls,priorPlayerRunsPerBall,priorPlayerWicketsPerBall,priorPlayerDotFraction,priorOpponentBalls,priorOpponentRunsPerBall`. Missing values are null, never future-derived. Entry tasks reuse the state features and batter-history interpretation; keep different artifacts/target definitions.

- [ ] **Step 1: Write replay invariance and target-denominator tests.**

```js
const { buildExamples, priorMatches } = require("../src/learning/features");
test("later and same-day matches cannot change earlier features", () => {
  const m = match({date:"2026-09-18"});
  const future = match({matchId:"next", date:"2026-09-19"});
  const sameDay = {...future, date:m.date};
  const first = buildExamples([m], {cutoff:"2026-09-20"}).rows[0].features;
  assert.deepEqual(buildExamples([m, sameDay, future], {cutoff:"2026-09-20"}).rows
    .find(r => r.matchId === m.matchId).features, first);
  assert.deepEqual(priorMatches([m, sameDay, future], m.date), []);
});
test("wide affects over runs, not legal dot denominator; run-out is not bowler wicket", () => {
  const i = innings({events:[event({eventIndex:0,runs:1,batterRuns:0,extras:1,legal:false,countsAsFaced:false}),
    ...Array.from({length:6}, (_,n) => event({eventIndex:n+1,runs:0,batterRuns:0,
      wicket:n===5,creditedWicket:false,playerOutId:n===5 ? "source:a":null})),
    ...Array.from({length:114}, (_,n) => event({eventIndex:n+7,runs:1,batterRuns:1,
      strikerId:"source:d",bowlerId:`source:bowler${(Math.floor(n/6)+1)%5}`}))],
    runs:115,wickets:1,legalBalls:120,target:115});
  const over = buildExamples([match({innings:[i]})], {cutoff:"2026-09-20"}).rows.find(r=>r.task==="over");
  assert.deepEqual(over.targets, {over_runs:1, over_wicket:0, over_dot_fraction:1});
});
```

- [ ] **Step 2: Run red.**

`node --test bay-area-u15/apps/worker/test/t20LearningFeatures.test.js`; expect missing replay module.

- [ ] **Step 3: Implement ordered state replay and label windows.**

```js
function priorMatches(matches, date) { return matches.filter(m => m.date < date); }
function overTargets(events) {
  const legal = events.filter(e => e.legal);
  if (legal.length !== 6 || new Set(events.map(e => e.bowlerId)).size !== 1) return null;
  return {over_runs:events.reduce((s,e)=>s+e.runs,0),
    over_wicket:Number(events.some(e=>e.creditedWicket)),
    over_dot_fraction:legal.filter(e=>e.runs===0).length/6};
}
function entryTargets(events, playerId) {
  let runs=0, balls=0;
  for (const e of events) {
    if (e.strikerId === playerId) { runs+=e.batterRuns; balls+=Number(e.countsAsFaced); }
    if (e.wicket && e.playerOutId === playerId) return {entry_runs6:runs,entry_dismissed6:1};
    if (balls >= 6) return {entry_runs6:runs,entry_dismissed6:0};
  }
  return null; // Right-censored; record reason, do not turn this into survival.
}
```

Iterate sorted date groups, but process each match with history strictly before its date. Derive over boundaries from completed legal balls, not floating notation; retain associated extras before the sixth legal delivery. Capture features before consuming the label window; apply `advanceState` afterward, including both batters' balls faced and bowler workload. Exclude incomplete overs, substitutions, missing striker/non-striker identity for player features and unsupported states with explicit counters. Infer incoming batter state from introduction to the crease (including non-striker) before their first delivery; pre-entry waiting at the non-striker end is context, not scoring exposure. An out before facing a ball is still a dismissal if source linkage is certain. Do not derive availability from eventual full match participation for prospective candidates.

`history.js` aggregates raw earlier match player/opponent phase counts. No outcome after the decision enters these counts. Use null player history for unresolved identities; retain context-only examples if the target is reliable. Same-name records stay separate. Add tests using first-ball dismissal (runs0, dismissed1), five-ball not-out chase end (excluded), two-bowler over (excluded), no-ball faced denominator, non-striker run-out, 3.4 overs ->22 legal balls, and changing a later partnership/result without changing earlier features.

- [ ] **Step 4: Verify target and leak tests.**

Run all `t20LearningSource.test.js`, `t20LearningFeatures.test.js` and existing tactical tests. Confirm exact target numerators/denominators and source exclusion reasons, not only nonempty output.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/apps/worker/src/learning/features.js bay-area-u15/apps/worker/src/learning/history.js bay-area-u15/apps/worker/src/learning/contracts.js bay-area-u15/apps/worker/test/t20LearningFeatures.test.js
git commit -m "feat: replay leakage-safe T20 forecast examples"
```

### Task 3: Reproducible private datasets and frozen chronological split policy

**Files:** Create learning `dataset.js`, `splitPolicy.js`; config `bay-area-u15/config/t20-learning-policy.json`; test `t20LearningDataset.test.js`; CLI dispatch in worker `index.js`.

**Interfaces:**
- `canonicalJson(value) -> string`, `contentHash(value) -> sha256hex` (exclude volatile export timestamps, include source/identity/schema versions).
- `buildDataset({matches,identityVersion,featureVersion,cutoff}) -> {datasetHash,manifest,rows}`; consumes already normalized `LearningMatch[]`, not raw loader rows. `exportDataset` performs normalization using the sidecar before calling it.
- `assignDateSplits(rows) -> {trainDates,validationDates,testDates,matchIds}` using oldest 70% / next15% / final15% of sorted unique dates, never label performance. Return insufficient-date status if any block empty.
- `exportDataset({snapshotPath,sourceMetadataPath,outDir,cutoff,identityPath,policyPath}) -> receipt`; CLI `learning-export --snapshot /absolute/private/ml-source-snapshot.json --sourceMetadata /absolute/private/ml-source-identities.json --outDir /absolute/private/learning-export --cutoff 2026-09-20` works offline after the bounded metadata export below. Optional `--from-db` uses existing read-only source loader in <=15-match batches and a repeatable-read transaction, statement timeout25s.

- [ ] **Step 1: Write deterministic hash/group tests.**

```js
test("row ordering and export time cannot change dataset identity", () => {
  assert.equal(contentHash({b:2,a:1}), contentHash({a:1,b:2}));
  const one = buildDataset({matches:[match()], identityVersion:"v1",featureVersion:"v1",cutoff:"2026-09-20"});
  const two = buildDataset({matches:[match()], identityVersion:"v1",featureVersion:"v1",cutoff:"2026-09-20"});
  assert.equal(one.datasetHash,two.datasetHash);
});
test("whole date groups and matches stay in one partition", () => {
  const rows = Array.from({length:20},(_,i)=>({date:`2025-09-${String(i+1).padStart(2,"0")}`,matchId:String(i)}));
  const s=assignDateSplits([...rows,{...rows[18],matchId:"extra"}]);
  assert.equal(new Set([...s.trainDates,...s.validationDates,...s.testDates]).size,20);
  assert.ok(s.trainDates.at(-1)<s.validationDates[0]);
  assert.ok(s.validationDates.at(-1)<s.testDates[0]);
});
```

- [ ] **Step 2: Run red.**

`node --test bay-area-u15/apps/worker/test/t20LearningDataset.test.js`; expect missing dataset exports.

- [ ] **Step 3: Implement canonical manifests and policy.**

```js
const { createHash } = require("node:crypto");
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort()
    .map(k=>`${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("nonfinite_dataset");
  if (value === undefined) throw new Error("undefined_dataset_value");
  return JSON.stringify(value);
}
function contentHash(value) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }
function assignDateSplits(rows) {
  const dates=[...new Set(rows.map(r=>r.date))].sort();
  const a=Math.floor(dates.length*0.70),b=Math.floor(dates.length*0.85);
  return {trainDates:dates.slice(0,a),validationDates:dates.slice(a,b),testDates:dates.slice(b),
    matchIds:Object.fromEntries(dates.map(d=>[d,[...new Set(rows.filter(r=>r.date===d).map(r=>r.matchId))].sort()]))};
}
```

Manifest includes target definitions/features in fixed order, source revisions, matched/excluded innings, raw candidate vs final examples, identity support, cutoff, mode, split membership, normalizer version and policy hash. Sort rows by date/match/task/rowId before hashing. Export policy/config before fitting; persist the holdout date set. Do not recompute 70/15/15 after viewing test losses. A new training dataset either uses a fresh later untouched test block or is explicitly development/shadow; old test labels may enter future training only after retiring that receipt. Source corrections invalidate receipts referencing the old revision.

Use this exact policy object so Python, Node and tests share keys:

```json
{"version":"t20-evaluation-v1","minTrain":30,"minValidation":10,"minTest":10,"minClassCount":20,"minRelativeGain":0.05,"maxPhaseRegression":0.10,"minPhaseMatches":5,"maxECE":0.10,"seed":20260920,"bootstrapDraws":2000,"ridgeAlphas":[0.1,1,10],"logisticCs":[0.1,1,10],"developmentFolds":3,"reliabilityBins":5}
```

The ECE gate is declared before test access; failing it blocks probability display even if other targets pass. Avoid identifiers as encoded model features. Write datasets mode0600 under ignored `bay-area-u15/storage/learning/`; never commit raw exports.

The existing 159-match snapshot is a raw array and contains only `{id,displayName}` in `players_json`, not external player IDs. Before offline export, collect database IDs from its scorecards/events, then perform one bounded read-only metadata export (batches<=250 IDs) plus series-key lookup:

```sql
select id, source_system, league_name, source_player_id
from public.player where id = any($1::bigint[]) order by id;
select series_id, config_key from public.series_source_config
where series_id = any($1::bigint[]) order by series_id, config_key;
```

Persist that metadata privately with fetch time/hash and original snapshot hash. Reject ambiguous series-key matches and missing player mappings instead of fabricating external IDs. This small export is necessary; re-exporting all ball events is not. The CLI may accept an envelope `{matches,playerSources,seriesKeys}` for later exports, but must explicitly adapt the existing raw-array format with its required sidecar.

- [ ] **Step 4: Verify deterministic replay and an offline real-data export.**

Run the dataset/source/features tests. Run `learning-export` against the previously authorized private `ml-source-snapshot.json`; no fresh production scan needed. Report final eligible counts independently of the earlier 4,494 candidate-over count. Reorder source input and rerun: dataset hash must match. Stop on conflicting identities or unexplained reconciliation differences; record exclusions rather than fabricate labels.

- [ ] **Step 5: Commit code/policy, not datasets.**

```bash
git add bay-area-u15/apps/worker/src/learning/dataset.js bay-area-u15/apps/worker/src/learning/splitPolicy.js bay-area-u15/config/t20-learning-policy.json bay-area-u15/apps/worker/test/t20LearningDataset.test.js bay-area-u15/apps/worker/src/index.js
git commit -m "feat: export versioned T20 datasets and chronological partitions"
```

### Task 4: Immutable learning ledger and nonoverwriting report revisions

**Files:** Create `supabase/migrations/20260921010000_t20_learning_ledger.sql`, `20260921011000_grizzlies_report_revisions.sql`, learning `repository.js`; modify analytics migration manifest, existing `ops/grizzliesMatchAnalysis.js`, worker `index.js`, API `grizzliesPortalService.js`; tests `t20LearningRepository.test.js`, existing report worker/API tests.

**Interfaces:**
- `createLearningRepository(client) -> {putSnapshot,putRun,appendDecision,appendOutcome,appendFeedback,appendRunEvent,getCurrentOutcome}`. All inputs are validated objects; returns persisted row including id. Same content key is idempotent; conflicting body for same key throws.
- Tables: `t20_learning_snapshot` (hash PK, immutable manifest), `t20_model_run` (run_key PK, immutable dataset/policy/split/config/artifact/metrics), `t20_model_run_event` (append-only evaluation/promotion/invalidation), `t20_decision` (id UUID, unique decision_key, report_id FK, snapshot_hash FK, model run FK nullable, payload), `t20_outcome` (decision_id + source_revision unique, status, payload), `t20_feedback` (id UUID/idempotency key unique, decision_id FK, author, category, correction_ref, payload). Database records store JSON artifacts initially (small linear coefficients) to avoid reliance on ephemeral disk.
- Report identity: existing report `id` plus new `report_revision_key` = hash of analysis version, source checksum, selected model artifact hashes and persisted decision context. Published payload never overwritten.
- `reviewGrizzliesMatchAnalysis` accepts new `reportId`; old matchId+model selection works only when exactly one unambiguous candidate exists, otherwise explicit error requesting reportId.

- [ ] **Step 1: Write local Postgres-backed revision tests before migration.**

```js
test("same source replay deduplicates and correction appends", async () => {
  const a=await repo.appendOutcome({decisionId,sourceRevision:"r1",status:"observed",payload:{runs:6}});
  const replay=await repo.appendOutcome({decisionId,sourceRevision:"r1",status:"observed",payload:{runs:6}});
  const b=await repo.appendOutcome({decisionId,sourceRevision:"r2",status:"observed",payload:{runs:7}});
  assert.equal(a.id,replay.id); assert.notEqual(a.id,b.id);
  await assert.rejects(repo.appendOutcome({decisionId,sourceRevision:"r1",status:"observed",payload:{runs:8}}),/immutable/);
});
```

Use a dedicated `LEARNING_TEST_DATABASE_URL` on localhost only, provision minimal existing match/report foreign-key fixtures and a fresh test schema/database. Fail loudly if the integration command lacks it; unit suite may separately skip DB-tagged tests, but acceptance cannot count skipped DB tests as passed. Never default to `DATABASE_URL`. Assert an UPDATE of immutable payload is rejected, raw `anon`/`authenticated` roles have no SELECT/INSERT privileges, and existing published report stays selected while a new same-model revision is merely generated.

- [ ] **Step 2: Run red.**

`node --test bay-area-u15/apps/worker/test/t20LearningRepository.test.js`; with the explicit local test database, expect missing tables/functions, not production connection attempts.

- [ ] **Step 3: Implement server-owned append-only records and revision selection.**

```sql
create or replace function public.t20_reject_mutation() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin raise exception 'immutable learning record'; end $$;
create table public.t20_learning_snapshot (
  hash text primary key check (hash ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null,
  created_at timestamptz not null default now()
);
create trigger t20_snapshot_immutable before update or delete
on public.t20_learning_snapshot for each row execute function public.t20_reject_mutation();
alter table public.t20_learning_snapshot enable row level security;
revoke all on public.t20_learning_snapshot from public, anon, authenticated;
```

Apply that immutable payload pattern to every ledger table; explicit privileged worker INSERT/SELECT only. Index outcome/feedback decision FKs, snapshot/run references and run-event lookup by run/time. Outcome statuses are exactly `unobserved`, `not_used`, `unavailable`, `observed`; feedback categories `availability`, `use`, `correction`, `commentary`. Do not FK authors to the analytics project's `auth.users`: existing auth is external; validate actor through existing server authorization.

Backfill existing report revision keys deterministically, then replace the named `grizzlies_match_analysis_report_version_key` with `(series_id,match_id,report_type,report_revision_key)` uniqueness. Preserve legacy row IDs/content/status. Block changes to evidence, analysis, source checksum and version once a row exists; allow the existing reviewed/published/superseded lifecycle metadata. Replace UPSERT body mutation with insert-on-conflict-do-nothing then select and compare. Publish inside a match-scoped transaction/advisory lock, superseding other published rows by ID, not merely different model versions. API selection retains published-first sorting and exposes reportId/revisionKey. New generated rows must not displace published ones.

- [ ] **Step 4: Verify local grants, migration and legacy paths.**

Run repository, existing `grizzliesMatchAnalysisOps.test.js`, API `grizzliesPortal.test.js`; apply both migrations on a local copy containing legacy published/generated rows, then query row counts/content hashes before/after. Test concurrent inserts, conflicting replay payload, revision-specific review and rollback by selecting prior report without deleting history. Register only in `migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt`. Do not run the production apply script at this stage.

- [ ] **Step 5: Commit the migrations and integrations.**

```bash
git add supabase/migrations/20260921010000_t20_learning_ledger.sql supabase/migrations/20260921011000_grizzlies_report_revisions.sql migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt bay-area-u15/apps/worker/src/learning/repository.js bay-area-u15/apps/worker/src/ops/grizzliesMatchAnalysis.js bay-area-u15/apps/worker/src/index.js bay-area-u15/apps/api/src/services/grizzliesPortalService.js bay-area-u15/apps/worker/test/t20LearningRepository.test.js bay-area-u15/apps/worker/test/grizzliesMatchAnalysisOps.test.js bay-area-u15/apps/api/test/grizzliesPortal.test.js
git commit -m "feat: preserve immutable learning records and report revisions"
```

### Task 5: Actual pinned offline fitting and portable artifacts

**Files:** Create `bay-area-u15/ml/requirements.in`, `requirements.lock`, `t20_learning/__init__.py`, `train.py`, `artifact.py`, `tests/test_train.py`; learning `trainerProcess.js`; `.gitignore` entries for ML venv, private datasets and caches.

**Interfaces:**
- CLI `.venv/bin/python -m t20_learning.train --dataset PATH --policy PATH --output PATH` from `bay-area-u15/ml`.
- `fit_target(train_rows, target, feature_names, regularization, seed) -> fitted sklearn Pipeline | None`.
- `artifact_from_pipeline(pipeline, target, feature_names) -> TargetArtifact`; `predict_artifact(artifact, features) -> float` in Python.
- `TargetArtifact = {schemaVersion:1,target,featureNames,impute:number[],mean:number[],scale:number[],coef:number[],intercept:number,link:"identity"|"logistic",clip:[number|null,number|null],calibrator:{slope:number,intercept:number}|null}`.
- Run artifact wraps `{family:"t20-v1",datasetHash,policyHash,identityVersion,featureVersion,trainCutoff,targets,software,seed}`; artifactHash is computed with the Node canonical JSON contract. Do not encode rows/identities/session data in coefficients file.
- `runTrainer({datasetPath,policyPath,outDir,pythonPath,timeoutMs=900000}) -> {artifactPath,metricsPath,exitCode}` uses `spawn` without shell, bounded stdout/stderr and single numerical thread.

- [ ] **Step 1: Add failing fit and train-only transform tests.**

```python
import numpy as np
from t20_learning.train import fit_target
from t20_learning.artifact import artifact_from_pipeline, predict_artifact

def test_transform_fits_only_training_and_json_predicts():
    rows = [{"features": {"score": float(i)}, "targets": {"over_runs": 2*i+3}}
            for i in range(20)]
    model = fit_target(rows, "over_runs", ["score"], 0.1, 20260920)
    artifact = artifact_from_pipeline(model, "over_runs", ["score"])
    assert artifact["impute"] == [9.5]
    assert artifact["mean"] == [9.5]
    actual = max(0.0, float(model.predict([[7.0]])[0]))
    assert abs(predict_artifact(artifact, {"score": 7.0}) - actual) < 1e-8
    assert np.isfinite(predict_artifact(artifact, {"score": None}))
```

- [ ] **Step 2: Install only the isolated environment and run red.**

From `bay-area-u15/ml`, use the approved Python3.12 runtime to create `.venv`; requirements.in pins `scikit-learn==1.7.2`, `numpy==2.2.6`, `scipy==1.15.3`, `joblib==1.5.2`, `threadpoolctl==3.6.0`, `pytest==8.4.2`. Resolve once, generate a complete exact-version lock, recreate an isolated verification venv from that lock, and run `python -m pip check`. Do not install globally. `python -m pytest tests/test_train.py -q` must fail for the missing trainer, not be reported as a fitted model.

Version choice is a reproducibility pin, not a claim it is latest: [scikit-learn 1.7.2 package metadata](https://pypi.org/pypi/scikit-learn/1.7.2/json) lists Python3.12 support. JSON coefficient serving avoids Python-object loading; see [scikit-learn model-persistence guidance](https://scikit-learn.org/stable/model_persistence.html).

- [ ] **Step 3: Implement fitted baselines and train-only preprocessing.**

```python
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge, LogisticRegression
import numpy as np

def fit_target(train_rows, target, feature_names, regularization, seed):
    rows = [r for r in train_rows if target in r["targets"]]
    X = np.asarray([[np.nan if r["features"].get(k) is None else r["features"][k]
                     for k in feature_names] for r in rows], dtype=float)
    y = np.asarray([r["targets"][target] for r in rows], dtype=float)
    classifier = target in {"over_wicket", "entry_dismissed6"}
    if len(rows) < 2 or (classifier and len(set(y)) < 2):
        return None
    estimator = LogisticRegression(C=regularization, max_iter=2000, random_state=seed) if classifier else Ridge(alpha=regularization)
    model = Pipeline([("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
                      ("scale", StandardScaler()), ("model", estimator)])
    return model.fit(X, y)
```

Fit separate models for all five targets; no labels shared across tasks. Select regularization by three expanding date-group folds entirely within the training block, scoring the clipped inference outputs (MAE regressions/log-loss classification). Use a fixed tie-break: more regularization. If too few training dates for folds, fit the declared default1 and mark exploratory. Fit imputer/scaler separately inside every fold. Record constant/untrainable targets explicitly. Baseline is the training-only phase+innings target mean, with global training mean fallback where group count<20; no baseline fit on validation/test.

Export `statistics_`, `mean_`, `scale_`, `coef_`, `intercept_`, target link and bounds; reject nonfinite arrays and mismatched dimensions. `over_runs` and `entry_runs6` clip to >=0, dot fraction to[0,1], classification probabilities to[1e-12,1-1e-12] for scoring. Save raw prediction range/out-of-bound counts separately. Optional Platt calibration is fitted only on chronological out-of-fold training logits; insufficient two-class OOF support leaves calibrator null. Evaluate the same calibrated/un-calibrated path in Python and Node; probability display still depends on held-out gates.

JSON writing uses `allow_nan=False`, stable field order, atomic local temp-file rename and file permission0600. Include dependency versions/seed/config/feature order. CLI returns nonzero for malformed dataset, forbidden split overlap, expired evaluation reservation, timeout or invalid artifact; it returns successful run with target status `untrainable` where fitting is mathematically impossible. No DB credentials are passed to the Python child.

- [ ] **Step 4: Verify actual fitting and artifact bounds.**

Run Python fit tests, add cases for entirely missing feature, one-class labels, constant baseline, null input and all five target shapes; expect finite outputs or explicit untrainable status. Run a small real private dataset fit in shadow mode and inspect output artifacts/metrics, not only synthetic fixture success. Record dependency lock and environment build without committing venv/data.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/ml/requirements.in bay-area-u15/ml/requirements.lock bay-area-u15/ml/t20_learning bay-area-u15/ml/tests/test_train.py bay-area-u15/apps/worker/src/learning/trainerProcess.js .gitignore
git commit -m "feat: fit reproducible offline T20 statistical models"
```

### Task 6: Untouched holdout evaluation and independent promotion gates

**Files:** Create `bay-area-u15/ml/t20_learning/evaluate.py`, `ml/tests/test_evaluate.py`, learning `evaluationReservations.js`; test `t20LearningEvaluation.test.js`. Extend repository with evaluation reservations/events in the queue/registry migration introduced by Task 8 (during this task create migration `supabase/migrations/20260921012000_t20_learning_control.sql` and register it; Task 8 extends only before any production apply).

**Interfaces:**
- `evaluate_target(rows, predictions, baseline_predictions, target, policy) -> metrics` including split counts, primary loss, Brier/ECE, match-cluster CI, season/phase/support slices and exclusions.
- `promotion_decision(metrics, policy) -> {eligible:bool,reasons:list[str],supportedPhases:list[str],calibrated:bool}`.
- `reserveEvaluation(client,{datasetHash,policyHash,testMatchIds,modelFamily,configHash}) -> reservationId`; an identical reservation/run resumes idempotently; changing a tuned configuration against exposed final test IDs becomes development-only. A corrected test source invalidates—not magically renews—the test block.

- [ ] **Step 1: Add failures for gate boundaries and holdout reuse.**

```python
from t20_learning.evaluate import promotion_decision
def test_zero_baseline_and_small_class_support_cannot_promote():
    metrics = {"trainMatches":40,"validationMatches":12,"testMatches":11,
               "baselineLoss":0.0,"candidateLoss":0.0,"improvementCI":[0,0],
               "classification":True,"validationPos":19,"validationNeg":80,
               "testPos":40,"testNeg":90,"brierDelta":0,"ece":0.03,"phases":{}}
    result=promotion_decision(metrics,{"minTrain":30,"minValidation":10,"minTest":10,
      "minClassCount":20,"minRelativeGain":0.05,"maxPhaseRegression":0.10,"maxECE":0.10})
    assert not result["eligible"]
    assert "zero_baseline_loss" in result["reasons"]
    assert "insufficient_class_support" in result["reasons"]
```

Add Node local-DB test: reserve configA on matchIDs1–10, mark evaluation exposed, request configB on the same IDs => development-only; an exact configA retry returns the same reservation. Reservation precedes reading test labels.

- [ ] **Step 2: Run red.**

From ML directory run `.venv/bin/python -m pytest tests/test_evaluate.py -q`; run Node `t20LearningEvaluation.test.js` with local test DB. Expect missing evaluation code/migration.

- [ ] **Step 3: Implement primary losses, bootstrap and gates.**

```python
import numpy as np
def match_cluster_interval(loss_delta, match_ids, seed=20260920, draws=2000):
    groups = sorted(set(match_ids))
    rng = np.random.default_rng(seed)
    by_match = {m: np.flatnonzero(np.asarray(match_ids) == m) for m in groups}
    gains=[]
    for _ in range(draws):
        sampled=rng.choice(groups, size=len(groups), replace=True)
        indices=np.concatenate([by_match[m] for m in sampled])
        gains.append(float(np.mean(np.asarray(loss_delta)[indices])))
    return [float(v) for v in np.quantile(gains,[0.025,0.975])]
```

Loss delta is baseline minus candidate on the exact same rows. Compute MAE for regressions, clipped log loss and Brier for classifications; reliability uses five fixed[0,.2,.4,.6,.8,1] bins with counts/observed rate/mean prediction and ECE. Gates require both validation and test coverage and no incompatible feature/schema/identity versions. Require relative test primary improvement>=.05 and positive lower CI, BrierDelta<=0, no phase with>=5 test matches worse by>.10. Scope includes only supported phases; no global high-confidence claim for absent phases. Probability display additionally needs ECE<=.10 on validation and test, adequate class counts and a completed calibration assessment; preserve the chosen calibration method in the artifact.

Record model-vs-rule comparisons only where the rule makes a measurable numerical prediction for that same target; otherwise `not_comparable`, never fabricate a loss for prose. Report target-by-target results by season and history support (`0`, `1–29`, `>=30` prior balls). Report confidence intervals/coverage even when gates fail. Use independent untouched later test dates on subsequent promotion attempts; continuing development fits can run without promotion eligibility. Never relax gates in response to failing results.

- [ ] **Step 4: Verify gates with adversarial examples.**

Tests cover exactly5% boundary, CI crossing0, regression in a supported phase, absent phase, Brier deterioration, ECE failure, date leakage, heldout reuse and zero baseline. A metrics-only forged `eligible:true` must not bypass checks; promotion recalculates from the stored trusted receipt. Store evaluation code/policy hashes and test membership in the immutable run.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/ml/t20_learning/evaluate.py bay-area-u15/ml/tests/test_evaluate.py bay-area-u15/apps/worker/src/learning/evaluationReservations.js bay-area-u15/apps/worker/test/t20LearningEvaluation.test.js supabase/migrations/20260921012000_t20_learning_control.sql migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt
git commit -m "feat: gate T20 models with chronological outcome evaluation"
```

### Task 7: Safe Node inference, eligibility and reviewed model registry

**Files:** Create learning `inference.js`, `eligibility.js`, `promotion.js`; test `t20LearningInference.test.js`; Python `ml/tests/test_parity.py`; golden `bay-area-u15/ml/tests/fixtures/parity.json` generated from a synthetic fitted model, not hand-picked coefficients. Extend control migration with registry/promotion event records before production apply.

**Interfaces:**
- `validateArtifact(artifact) -> artifact` rejects unsupported schema, unexpected keys/types/nonfinite values/dimension mismatch.
- `predictTarget(targetArtifact,features) -> {raw:number,value:number}`; `eligibleCandidates({kind,players,state}) -> {eligible:Player[],conditional:Player[],exclusions:object[]}`.
- Player `{id,name,available:boolean|null,ballsBowled:number|null,status:"unbatted"|"batting"|"out"|null}`; eligibility consumes `Pick<State,"lastBowlerId"|"availabilityConfirmed">` from Task 2, while prediction consumes the full `State`.
- `promoteTarget(client,{runKey,target,actor,reason})`, `rollbackTarget(client,{family,target,priorRunKey,actor,reason})` -> registry selection event. Immutable promotion events + one transactionally updated current pointer per family/target. Neither changes report rows.

- [ ] **Step 1: Write parity and player exclusion tests.**

```js
test("cannot allocate an unavailable, exhausted or consecutive bowler", () => {
  const result=eligibleCandidates({kind:"bowler",state:{lastBowlerId:"b",availabilityConfirmed:true},
    players:[{id:"a",available:true,ballsBowled:24},{id:"b",available:true,ballsBowled:6},
      {id:"c",available:false,ballsBowled:0},{id:"d",available:true,ballsBowled:6}]});
  assert.deepEqual(result.eligible.map(p=>p.id),["d"]);
});
test("unknown roster makes conditional options, not an executable plan", () => {
  const r=eligibleCandidates({kind:"batter",state:{availabilityConfirmed:false},
    players:[{id:"x",available:null,status:"unbatted"}]});
  assert.equal(r.eligible.length,0); assert.equal(r.conditional.length,1);
});
for (const row of golden.rows) {
  test(`Python/Node parity ${row.id}`, () => {
    assert.ok(Math.abs(predictTarget(golden.artifact,row.features).value-row.expected)<1e-8);
  });
}
```

- [ ] **Step 2: Run red.**

Run `node --test bay-area-u15/apps/worker/test/t20LearningInference.test.js`; expect missing inference/eligibility exports. Golden expected predictions are produced by the Python trainer in Task 5 and checked by the Python parity test, not copied from Node.

- [ ] **Step 3: Implement exact JSON inference and guarded promotion.**

```js
function predictTarget(a, features) {
  let raw=a.intercept;
  a.featureNames.forEach((name,i)=>{
    const x=features[name] == null ? a.impute[i] : features[name];
    if (!Number.isFinite(x)) throw new Error("nonfinite_feature");
    raw += ((x-a.mean[i])/a.scale[i])*a.coef[i];
  });
  let value=raw;
  if (a.link === "logistic") {
    const z=a.calibrator ? a.calibrator.slope*raw+a.calibrator.intercept : raw;
    value=z>=0 ? 1/(1+Math.exp(-z)) : Math.exp(z)/(1+Math.exp(z));
  }
  if (a.clip[0] !== null) value=Math.max(a.clip[0],value);
  if (a.clip[1] !== null) value=Math.min(a.clip[1],value);
  if (!Number.isFinite(value)) throw new Error("nonfinite_prediction");
  return {raw,value};
}
```

Validation enforces positive finite scales and all declared array lengths. Exact target names/features only, artifact size<=1MiB, no eval/dynamic import/network artifact URLs. Compare file hash with immutable run hash before loading. Gate prediction on evaluated phase, current source validity and compatible feature/identity versions. Unknown/out-of-training-range contextual states return fallback or explicitly conditional options, not extrapolated certainty; persist a support range audit from train data.

Eligible bowler: confirmed selected/available, <24 legal balls, not previous-over bowler, at least6 quota balls remaining for a full-over forecast. Eligibility rules apply to known workload, not guessed from a historical XI. Eligible incoming batter: confirmed available and unbatted, not currently batting/out. Maintain separate containment, wicket and batting recovery/acceleration rankings; do not collapse them into a causal "best" score.

Promotion is operator-only, requiring stored parity pass, matching hashes, valid evaluation reservation, successful target gates and no later invalidation. Use row-level locks/current-pointer compare-and-swap to prevent racing promotions. Keep prior artifact for rollback. Invalidating a selected run immediately suppresses serving for affected targets; no implicit rollback to an unverified version. Never expose numeric uncalibrated wicket/dismissal probabilities.

- [ ] **Step 4: Verify all five targets and protected mutation.**

Run Python parity tests + Node inference tests for missing values/extreme finite logits/clipping/unknown fields. Test batters already out/batting, exhausted/last-over bowler, unsupported phase and unreviewed promotion. Assert model promotion creates no report publish/update query. Corrupt artifact hash must select fallback.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/apps/worker/src/learning/inference.js bay-area-u15/apps/worker/src/learning/eligibility.js bay-area-u15/apps/worker/src/learning/promotion.js bay-area-u15/apps/worker/test/t20LearningInference.test.js bay-area-u15/ml/tests/test_parity.py bay-area-u15/ml/tests/fixtures/parity.json supabase/migrations/20260921012000_t20_learning_control.sql
git commit -m "feat: serve validated T20 forecasts with player eligibility gates"
```

### Task 8: Durable ingestion-to-learning jobs with bounded resource use

**Files:** Create learning `jobs.js`, `runner.js`; extend `20260921012000_t20_learning_control.sql`; modify worker `ops/localRefresh.js`, `index.js`, `bay-area-u15/package.json`; tests `t20LearningJobs.test.js`, `t20LearningIngestion.test.js`.

**Interfaces:**
- `enqueueValidatedLearning({client,seriesKey,matchRevisions,validation,reason}) -> {queued:boolean,jobId?,reason?}`; validation must be explicitly `publishReady:true`, relevant MiLC series only.
- `shouldTrain({datasetHash,lastDatasetHash,newVerifiedMatches,correction,manual}) -> boolean`.
- `processLearningJob({client,jobId,workerId,exporter,trainer,reconcileOutcomes,clock}) -> receipt`; exporter is Task 3 `exportDataset`, trainer Task 5 `runTrainer`, reconciler Task 9 `reconcileOutcomes` (initial tests inject a no-op promise to isolate queue behavior).
- `runLearningWorker({pollMs:30000,signal,once:false})` serial consumer; `learning-worker --once` for deterministic integration, `learning-worker` persistent loop. Defaults disabled unless `T20_LEARNING_ENABLED=true`.
- Control tables: `t20_learning_job` with unique `(family,source_revision_key,reason)` and status/attempts/lease/fencing_token/available_at/error; `t20_learning_family` with current dataset watermark/lease owner/expiry/fencing token/heartbeat; `t20_evaluation_reservation`, `t20_model_registry` and immutable promotion events from Tasks 6–7. Server-owned grants/RLS on every table, partial queue index `(available_at,id) WHERE status IN ('pending','retry')`.

- [ ] **Step 1: Write cadence, validation and concurrency failures.**

```js
test("same source does not train; correction bypasses cadence only", () => {
  assert.equal(shouldTrain({datasetHash:"a",lastDatasetHash:"a",newVerifiedMatches:50,manual:true}),false);
  assert.equal(shouldTrain({datasetHash:"b",lastDatasetHash:"a",newVerifiedMatches:4}),false);
  assert.equal(shouldTrain({datasetHash:"b",lastDatasetHash:"a",newVerifiedMatches:5}),true);
  assert.equal(shouldTrain({datasetHash:"b",lastDatasetHash:"a",newVerifiedMatches:0,correction:true}),true);
});
test("missing validation is never approval to enqueue", async () => {
  const queries=[];
  const result=await enqueueValidatedLearning({client:{query:async(sql)=>queries.push(sql)},
    seriesKey:"milc-fixture",matchRevisions:[],validation:null,reason:"ingestion"});
  assert.equal(result.queued,false); assert.equal(queries.length,0);
});
```

Local-DB tests claim one family from two worker clients simultaneously: exactly one training attempt; duplicate revision returns original job; stale fencing token cannot commit a result.

- [ ] **Step 2: Run red.**

Run both new Node test files with explicit local test DB. Expect missing queue implementation, not a silent skip.

- [ ] **Step 3: Implement idempotent jobs, short leases and recoverable failure.**

```js
function shouldTrain({datasetHash,lastDatasetHash,newVerifiedMatches,correction=false,manual=false}) {
  return datasetHash !== lastDatasetHash && (manual || correction || newVerifiedMatches >= 5);
}
// In refreshSeries, after downstream work and actual validation:
if (summary.validation?.publishReady === true && typeof options.operations?.enqueueLearning === "function") {
  try {
    summary.learning=await options.operations.enqueueLearning({seriesKey:options.series.slug,
      matchIds:summary.candidates.map(c=>c.matchId),validation:summary.validation});
  } catch (error) {
    summary.learning={queued:false,reason:"enqueue_failed",retryRequired:true};
    logger("[learning] enqueue failed; ingestion retained; rerun validated enqueue");
  }
}
```

The CLI adapter resolves match source revisions after validation and calls `enqueueValidatedLearning`; it is injected into both refresh-series and refresh-match. Add `learning-enqueue --series KEY --validated-export PATH` recovery command that rechecks stored source hashes/validation before queuing; it must not trust a client-provided publishReady flag alone. `validate-series` followed by aggregation/validation recovery can explicitly enqueue, but raw ingestion/inventory-only/skipped/failed validation cannot.

Claim job in a short transaction using `FOR UPDATE SKIP LOCKED`; acquire family lease atomically with monotonically increasing fencing token. Release DB transaction before fitting. Lease120s, heartbeat every30s, job/child timeout15min, max3 attempts with delays60s/300s/900s. A crash lets the lease expire; a new worker increments the token, so an old child cannot publish a late result. Recheck source hash after fit before storing success; newer corrections invalidate the receipt and leave current artifact unchanged. Corrections append run invalidation events when ingested, even if training is disabled or not trainable. Keep artifacts/run receipts in DB; local training files may be ephemeral.

Process flow: reconcile outcomes -> export changed sources -> compare dataset -> record cadence skip or fit all feasible targets -> store immutable run/metrics/artifact -> mark shadow/candidate status -> complete job. Target fit failure does not replace incumbent. No auto-promotion. First manual historical candidate bypasses five-new-match cadence but not validation/evaluation. Retain error categories without logging secrets or full data. The persistent loop emits heartbeat/job IDs/hash/target statuses only. Existing report API and ingestion HTTP handlers never spawn Python.

- [ ] **Step 4: Verify retry, timing and ingestion separation.**

Tests simulate timeout, crash, lease takeover, stale-result fencing, duplicate refresh, irrelevant series, null validation and trainer failure. Assert refresh retains successful ingestion status and records an actionable queue warning on enqueue failure. Assert unchanged/no-row data cannot create a retraining loop. Run two local consumers; count trainer invocations exactly once per source revision. Check queue `EXPLAIN` on populated test data uses the intended pending-job index, and no long transaction surrounds Python execution.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/apps/worker/src/learning/jobs.js bay-area-u15/apps/worker/src/learning/runner.js supabase/migrations/20260921012000_t20_learning_control.sql bay-area-u15/apps/worker/src/ops/localRefresh.js bay-area-u15/apps/worker/src/index.js bay-area-u15/package.json bay-area-u15/apps/worker/test/t20LearningJobs.test.js bay-area-u15/apps/worker/test/t20LearningIngestion.test.js
git commit -m "feat: queue controlled learning after verified ingestion"
```

### Task 9: Later outcomes and typed feedback, without hindsight scoring

**Files:** Create learning `outcomes.js`, `feedback.js`; tests `t20LearningOutcomes.test.js`; add worker CLI `learning-feedback` and `learning-reconcile-outcomes`.

**Interfaces:**
- `observeDecision(decision, verifiedSource) -> {status:"unobserved"|"not_used"|"unavailable"|"observed", sourceRevision, payload}`.
- Decision payload includes immutable `{mode,createdAt,availableAt,matchId,innings,eventBoundary,kind,candidateId,features,forecast,artifactHash,evidenceRefs}`. General scouting cards without a specific future match/state boundary cannot receive execution-performance labels.
- `reconcileOutcomes({client,matchIds}) -> {observed,notUsed,unavailable,unobserved,corrected}` uses Task 4 repository and source validation.
- `recordFeedback({client,decisionId,actor,category,sourceRef,note,idempotencyKey})` -> appended event. Only existing authorized operator flow; do not add a public write endpoint in this iteration.

- [ ] **Step 1: Write no-hindsight/no-counterfactual tests.**

```js
test("unused bowler is not a failed forecast", () => {
  const d={mode:"prospective",createdAt:"2026-09-19T10:00:00Z",matchId:"m",innings:2,
    eventBoundary:30,kind:"over",candidateId:"source:a"};
  const source={verified:true,sourceRevision:"r1",availableAt:"2026-09-19T12:00:00Z",
    matchId:"m",innings:2,eventBoundary:30,actualPlayerId:"source:b",outcome:{over_runs:18}};
  assert.equal(observeDecision(d,source).status,"not_used");
  assert.equal(observeDecision({...d,mode:"retrospective"},source).status,"unobserved");
});
test("generic scouting advice has no execution label", () => {
  assert.equal(observeDecision({kind:"scouting",matchId:null},{}).status,"unobserved");
});
```

- [ ] **Step 2: Run red.**

`node --test bay-area-u15/apps/worker/test/t20LearningOutcomes.test.js`; expect missing outcome resolver.

- [ ] **Step 3: Implement exact-boundary matching and append-only feedback.**

```js
function observeDecision(d,s) {
  const base={sourceRevision:s.sourceRevision || null,payload:{}};
  if (d.mode !== "prospective" || !d.matchId || !s.verified ||
      d.matchId !== s.matchId || d.innings !== s.innings || d.eventBoundary !== s.eventBoundary)
    return {...base,status:"unobserved"};
  if (s.confirmedUnavailableIds?.includes(d.candidateId)) return {...base,status:"unavailable"};
  if (!s.actualPlayerId) return {...base,status:"unobserved"};
  if (s.actualPlayerId !== d.candidateId) return {...base,status:"not_used"};
  if (!s.outcome) return {...base,status:"unobserved"};
  return {...base,status:"observed",payload:s.outcome};
}
```

Before calling this function, repository-level validation verifies decision creation before the observed event and trustworthy availability timestamps; if only a match date exists, same-date prospective timing cannot be established and remains unobserved. Verified event replay still supplies retrospective training labels independently. Link outcomes only to the exact observed player and state; no assigning unchosen counterfactual outcomes. An innings ending before a batter's horizon remains censored; do not fill zero loss. Source correction writes new outcome revision plus model evaluation invalidation, keeping old rows. Define latest outcome by source revision availability and stable row ID, never by destructive upsert.

`recordFeedback` validates category against the four allowed values, authorized actor, note length<=2000, correction source reference when category=correction, and idempotency key. Feedback creates review candidates, never automatically changes identities, labels or fitted confidence. Coach "used" feedback without source-confirmed state/player does not create a measured outcome. Add CLI help documenting this distinction.

- [ ] **Step 4: Verify corrected-source history and authorization.**

Run outcome and repository tests. Create a decision in local DB, append r1 actual result, then r2 corrected result; original decision and r1 byte hashes stay unchanged, current outcome selects r2, dependent evaluation is invalidated. Test unauthorized feedback author, duplicate feedback key with changed note, unavailable vs unused, missing timestamps and backfilled historical reports.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/apps/worker/src/learning/outcomes.js bay-area-u15/apps/worker/src/learning/feedback.js bay-area-u15/apps/worker/test/t20LearningOutcomes.test.js bay-area-u15/apps/worker/src/index.js
git commit -m "feat: reconcile verified outcomes without hindsight labels"
```

### Task 10: Named-player report integration with explicit fallback

**Files:** Create learning `reportIntegration.js`; modify `ops/grizzliesMatchAnalysis.js`, API `grizzliesPortalService.js`, `src/lib/cricketApi.ts`, `src/components/GrizzliesTacticalPlan.tsx`, `src/components/GrizzliesMatchReportContent.tsx`; tests `t20LearningReport.test.js`, existing worker/API tests and UI harness.

**Interfaces:**
- `buildForecastCards({rulePlan,scenario,players,registry,history,cutoff}) -> {plan,learning,decisionDrafts}`. `history={identityVersion:string,matches:LearningMatch[]}`; `registry` maps each of the five target names to its validated selection or null. `scenario:null` means no executable forecast state and must preserve labeled rule-based advice.
- `scenario = {kind:"over"|"entry",state,matchId:string|null,innings,eventBoundary:number|null,mode:"prospective"|"retrospective"}`. Unknown future state/roster yields conditional named options; default report remains post-match scouting, not a retrospectively invented prematch prediction.
- `learning` uses the companion presentation plan's `LearningDisclosure`. Add optional per-claim `learning`, `forecasts` (typed targets with values only when allowed), `playerIds`, `decisionId` to `CricketTacticalClaim`.
- The existing published API remains protected; adds `reportId`, `reportRevisionKey` and sanitized learning disclosure. Decision drafts are persisted only in report generation transaction, not GET.

- [ ] **Step 1: Write report fallback and no-GET-side-effect tests.**

```js
test("shadow model leaves named rule advice without numeric confidence", () => {
  const rulePlan={bowlingPlan:[{title:"Bowler A: powerplay",action:"Use conditionally after XI confirmation.",
    observation:"Observed prior phase figures",evidenceRefs:["match:1"]}]};
  const out=buildForecastCards({rulePlan,scenario:null,players:[],registry:{},history:{identityVersion:"v1",matches:[]},cutoff:"2026-09-20"});
  assert.equal(out.plan.bowlingPlan[0].title,"Bowler A: powerplay");
  assert.equal(out.learning.status,"fallback");
  assert.equal(out.plan.bowlingPlan[0].forecasts,undefined);
});
```

Add API query-spy test: repeated protected GET makes no INSERT/UPDATE, no trainer invocation and no full-history scan. Invalidated selected model suppresses numeric estimates in the returned view even when the immutable report stored them; retain historical estimates only in protected audit storage, not current actionable cards.

- [ ] **Step 2: Run red.**

Run new report unit test, existing report worker/API tests and presentation-state tests. Expect missing forecast-card adapter, not changed auth expectations.

- [ ] **Step 3: Integrate promoted targets without fabricating tactics.**

```js
// Selection logic inside buildForecastCards, independently for each target:
const usable = selection && selection.status === "promoted" && !selection.invalidated &&
  selection.supportedPhases.includes(scenario?.state?.phase) &&
  selection.featureVersion === "t20-features-v1" && selection.identityVersion === history.identityVersion;
const learning = usable
  ? {status:"promoted",modelVersion:selection.runKey,cutoff,
     evaluatedScope:selection.supportedPhases,calibrated:selection.calibrated,target}
  : {status:"fallback",modelVersion:null,cutoff,evaluatedScope:[],calibrated:false,
     target,reason:"No validated model for this scenario"};
```

Construct scenario vectors through the same `featuresAt` function as Task 2; apply eligible/conditional lists from Task 7. For known supported scenarios, sort containment by predicted runs ascending, strike options by calibrated wicket probability descending, and incoming batting options by scoring vs dismissal trade-off. Retain separate ranking purposes and alternatives in details. Only two short main bullets: player + situation + action, then the supporting number/sample if validated. Include current/historical MiLC season counts and source references; no invented field placement, bowling style, player availability or pitch map. Observed partnership thresholds remain >30 legal balls and >=8 RPO setting / >=entry required rate chasing. Keep all strike-bowler, weak-phase, dot-pressure, partnership, batting and field-trial sections.

Generate `t20-context-v5` report candidates with revision key including model hashes. Persist decision drafts linked to exact report row ID/feature snapshot; preserve published v4 until explicit review/publish. API computes current invalidation disclosure with one indexed registry/run-event lookup, not retraining or rewriting stored analysis. UI uses text evidence labels and hides stale/unvalidated numeric estimates; no probability from historical "confidence". Export uses the same safe returned view and same content component.

- [ ] **Step 4: Verify protected routes and visual disclosure.**

Run worker/API tests, frontend presentation tests, UI harness, `npx tsc --noEmit`, `npm run build`. Test anonymous401, authenticated unentitled403 and existing authorized viewer200 without granting admin. Test only runs promoted while wicket is shadow; only runs may appear. Test registry invalidation after report publication, unknown player, missing eligibility/phase, legacy report and back navigation. Inspect desktop/mobile with fallback and promoted synthetic fixtures; real report may honestly remain fallback.

- [ ] **Step 5: Commit.**

```bash
git add bay-area-u15/apps/worker/src/learning/reportIntegration.js bay-area-u15/apps/worker/src/ops/grizzliesMatchAnalysis.js bay-area-u15/apps/api/src/services/grizzliesPortalService.js bay-area-u15/apps/worker/test/t20LearningReport.test.js bay-area-u15/apps/worker/test/grizzliesMatchAnalysisOps.test.js bay-area-u15/apps/api/test/grizzliesPortal.test.js src/lib/cricketApi.ts src/components/GrizzliesTacticalPlan.tsx src/components/GrizzliesMatchReportContent.tsx tests/report-ui
git commit -m "feat: attach evaluated forecasts and honest fallback to tactics"
```

### Task 11: Real-data fitting and two-cycle learning acceptance

**Files:** Create `bay-area-u15/apps/worker/test/t20LearningLifecycle.test.js`, `bay-area-u15/scripts/verifyT20Learning.js`, `docs/verification/2026-09-20-t20-learning.md`. Private receipts under ignored `bay-area-u15/storage/learning/`; never commit source snapshots.

**Interfaces:** `verifyT20Learning({snapshotPath,localDatabaseUrl,outDir,pythonPath}) -> receipt` runs the same source/export/trainer/repository/queue interfaces already defined. Database URL must be localhost and explicit. It never writes production or promotes without an explicit separate operator action.

- [ ] **Step 1: Add the two-cycle lifecycle acceptance test.**

```js
test("new verified outcomes retrain, duplicates do not, unsafe candidates stay shadow", async () => {
  const first=await verifyT20Learning({snapshotPath:process.env.T20_TEST_SNAPSHOT,
    localDatabaseUrl:process.env.LEARNING_TEST_DATABASE_URL,outDir:privateTemp,pythonPath});
  assert.notEqual(first.cycle1.datasetHash,first.cycle2.datasetHash);
  assert.equal(first.cycle1.fitted,true); assert.equal(first.cycle2.fitted,true);
  assert.equal(first.duplicateReplay.additionalTrainingRuns,0);
  assert.equal(first.correction.oldDecisionHash,first.correction.retainedDecisionHash);
  assert.equal(first.correction.receiptInvalidated,true);
  assert.equal(first.failedCandidate.registryChanged,false);
  assert.ok(first.maxParityError<1e-8);
});
```

Test setup creates `privateTemp` via `mkdtemp`, uses the task venv's Python, reads `T20_TEST_SNAPSHOT` explicitly, and cleans only its own temporary directory after preserving requested receipts. Tests without real snapshot are a separate fast synthetic suite, not claimed as real-data acceptance.

- [ ] **Step 2: Run red.**

Run `node --test bay-area-u15/apps/worker/test/t20LearningLifecycle.test.js` with local DB and the existing authorized private snapshot; expect missing acceptance harness until implemented. No raw scorecards or secrets in console output.

- [ ] **Step 3: Implement reproducible chronological two-cycle replay.**

```js
// Partition source inventory before looking at labels or model performance:
const dates=[...new Set(matches.map(m=>m.date))].sort();
const nextDate=dates.at(-1);
const cycle1Matches=matches.filter(m=>m.date<nextDate);
const cycle2Matches=matches;
// Cycle 1: export, manual enqueue, consume, fit/evaluate, persist shadow receipt.
// Cycle 2: append the later whole-date group, validate, enqueue and consume.
// Then replay identical source, and apply a synthetic correction in local fixtures only.
```

Use real source events for both fitting cycles, but label the exercise historical replay—not observed prospective improvement. If the final group has fewer than five valid new matches, use explicit manual reason for the second real fit and separately test automatic five-match cadence on synthetic fixtures. Training cannot automatically reuse the first cycle's exposed test block for a new promotion claim; second cycle is development/shadow unless a fresh later block meets all gates. Record final sample counts per target, exclusions, source/identity/schema hashes, baseline/candidate losses, CIs, phase/season breakdown, calibration, split IDs and promotion reasons. Distinguish actual fitted targets from untrainable ones. Any source crosswalk still unresolved remains separate, with lower player support clearly disclosed.

Local correction simulation must not edit the original cached production export; create a fixture revision with consistent scorecard+events. Verify append-only outcomes/decisions and immediate model invalidation. Run an intentionally failing candidate (bad schema/metrics) and demonstrate incumbent unchanged. Record exact commands, exit codes, elapsed duration and model artifact hashes. Update the runbook with measured runtime, not guessed ETA.

- [ ] **Step 4: Full verification and review gate.**

Run `npm --prefix bay-area-u15 test`, `node --test bay-area-u15/apps/api/test/*.test.js`, `.venv/bin/python -m pytest tests -q` from ML directory, `node --test src/lib/grizzlies*Presentation.test.js scripts/export-grizzlies-report.test.mjs`, `node scripts/test-grizzlies-report-ui.mjs`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. Record failures and any genuinely preexisting failures; do not say "all pass" with skipped integration tests. Review the whole branch under `superpowers:requesting-code-review` before merge; Native remains the implementation method. Correct findings with regression tests.

- [ ] **Step 5: Commit acceptance evidence, excluding private data.**

```bash
git add bay-area-u15/apps/worker/test/t20LearningLifecycle.test.js bay-area-u15/scripts/verifyT20Learning.js docs/verification/2026-09-20-t20-learning.md
git commit -m "test: verify real T20 fitting and repeatable learning lifecycle"
```

### Task 12: Worker packaging, rollout and observable activation

**Files:** Create `bay-area-u15/scripts/t20LearningDoctor.js`, `docs/operations/t20-learning.md`; modify `bay-area-u15/package.json` to expose worker/doctor/operator commands; test `t20LearningDoctor.test.js`. Only after explicit rollout approval, use current configured deployment mechanism; do not invent a new paid Render service or change Supabase auth settings.

**Interfaces:** `learningDoctor({client,pythonPath,now}) -> {schemaReady,pythonReady,workerHeartbeatAgeSeconds,queueDepth,failedJobs,activeTargets,invalidatedTargets,status}`. Doctor is read-only; `status` cannot be healthy when no consumer is deployed.

- [ ] **Step 1: Add the missing-consumer readiness test.**

```js
test("installed CLI without a running consumer is not continuous learning", async () => {
  const r=await learningDoctor({client:fakeReadyDatabaseWithoutHeartbeat,pythonPath,now:Date.now()});
  assert.equal(r.status,"inactive");
  assert.equal(r.workerHeartbeatAgeSeconds,null);
});
```

The test double implements the doctor's three named read queries with schema-present, empty heartbeat and empty queue/registry results. Add stale heartbeat>120s ->degraded, absent schema/Python ->blocked and invalidated active target ->degraded fixtures.

- [ ] **Step 2: Run red.**

`node --test bay-area-u15/apps/worker/test/t20LearningDoctor.test.js`; expect missing doctor module.

- [ ] **Step 3: Implement diagnostics and the deployment runbook.**

```js
const age = heartbeat ? Math.max(0,(now-Date.parse(heartbeat))/1000) : null;
const status = !schemaReady || !pythonReady ? "blocked"
  : age === null ? "inactive"
  : age > 120 || invalidatedTargets.length || failedJobs > 0 ? "degraded" : "healthy";
```

Runbook specifies: Node runtime version from existing lock/build; Python3.12 venv built from committed lock; `OMP_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`; `T20_LEARNING_PYTHON` absolute runtime path; `T20_LEARNING_ENABLED=false` by default; persistent entry command from the same worker codebase. Database connections use existing analytics configuration, never the frontend auth URL. Artifacts/queue live in DB, scratch files in a bounded private temporary directory; prune only completed per-job scratch owned by the worker. Health logs contain IDs/hash/status, not PII/source text/credentials.

Document ordered rollout: verify rollback/restore receipt -> inspect analytics migration dry-run -> apply only approved migrations -> deploy compatible API/worker code with learning disabled -> validate read-only doctor/auth/report smoke tests -> explicitly enable existing worker consumer -> manual shadow job -> verify heartbeat, one completed job and persisted artifact -> later verified ingestion automatically enqueues exactly once -> optionally review/promote each passing target -> separately review/publish report revisions and website -> update authorized Git/OneDrive restore package. If the existing deployment lacks Python/background-process support, stop activation and present the exact infrastructure requirement/cost before provisioning; local implementation can remain complete while live activation is honestly blocked.

- [ ] **Step 4: Verify local packaging, then authorized live activation.**

Run doctor tests and local `learning-worker --once`; terminate/restart mid-training and verify lease recovery. Production checks only after rollout authorization: actual deployment revision, current schema versions, worker heartbeat<=120s, successful shadow job receipt, no duplicate training after identical enqueue, existing protected report200 and unauthorized denial, no increased full-history GET query workload. Do not call it continuously learning before these are observed. If no new live match exists, report smoke-tested consumer plus historical replay, not a live prospective training cycle.

- [ ] **Step 5: Commit runbook/doctor and report separate release receipts.**

```bash
git add bay-area-u15/scripts/t20LearningDoctor.js bay-area-u15/apps/worker/test/t20LearningDoctor.test.js bay-area-u15/package.json docs/operations/t20-learning.md
git commit -m "ops: document and verify controlled T20 learning activation"
```

## Acceptance coverage and handoff

| Spec acceptance item | Owning tasks/evidence |
| --- | --- |
| 1. Real source inventory/reproducible export | 1–3, 11; private manifest/coverage/hash |
| 2. Leakage/identity/cricket/censor tests | 1–3; target-specific regression suite |
| 3. Real fitted artifacts/evaluation/outcome | 5–6, 11; immutable fit/evaluation receipts |
| 4. Parity/determinism/no GET training | 3, 5, 7, 10 |
| 5. Immutable decisions/later corrected outcomes | 4, 9, 11 |
| 6. Two-cycle learning and unsafe candidate rejection | 7–8, 11 |
| 7. Actual application inference or honest fallback | 7, 10; visual disclosure assertions |
| 8. Deployed job/health/retry evidence | 8, 12; live activation separately authorized |
| 9. Tests/build/desktop/mobile/interactions | 10–11 plus presentation plan |
| 10. Neutral site and standalone export, access retained | All presentation tasks, 10 |

Self-review before handoff: source/feature/task/artifact contracts use the same target names; reviewed identity mapping is never replaced by name matching; untouched holdout is a stored resource, not a re-randomized split; source invalidation is independent of training success; all five Review Focus items have owning tests. Completion means all acceptance items with evidence, not "training started" or "a table was created". A failed promotion gate leaves the model in shadow and is reported honestly. No claim that observational rankings guarantee winning or that every additional match increases accuracy.

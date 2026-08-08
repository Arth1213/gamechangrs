# Unified Refresh Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `refresh-series` and `refresh-match` execute one reliable, completed-match-only refresh contract: live inventory, delta selection, fact ingest, recomputation, and validation.

**Architecture:** Extract pure refresh-selection rules from the local operation wrapper so they can be unit-tested without a database or browser. The wrapper will inventory first, select only source-completed matches that are newly discovered, changed, or flagged, run the existing scorecard/commentary pipeline, and run downstream aggregate/score/intelligence/validation only after a fully successful ingest.

**Tech Stack:** Node.js CommonJS, PostgreSQL via `pg`, Playwright, Node built-in `node:test`.

## Global Constraints

- Preserve existing user work outside `bay-area-u15`.
- Never ingest a scheduled or in-progress source match.
- A source access or match-ingest failure must make the refresh fail and leave a machine-readable summary.
- Keep `--skipPipeline` as an explicit inventory-only escape hatch.
- Do not publish as part of a refresh.

---

## File Structure

- Create: `apps/worker/src/ops/refreshPolicy.js` — pure completed-match classification, candidate filtering, and execution-summary predicates.
- Create: `apps/worker/test/refreshPolicy.test.js` — unit coverage for the refresh policy.
- Modify: `apps/worker/src/ops/localRefresh.js` — orchestrate the approved series and single-match refresh contract.
- Modify: `apps/worker/src/index.js` — pass the existing downstream operations into refresh commands and retain summary-file behavior.
- Modify: `README.md` — document that refresh is self-contained and no longer requires manual recompute commands.
- Modify: `ops_runbook_manual_refresh.md` — document selection, deferred live games, failure semantics, and output summaries.

### Task 1: Add deterministic refresh-policy tests and implementation

**Files:**
- Create: `apps/worker/test/refreshPolicy.test.js`
- Create: `apps/worker/src/ops/refreshPolicy.js`

**Interfaces:**
- Produces: `isCompletedInventoryMatch(match) => boolean`
- Produces: `partitionRefreshCandidates(candidates, options) => { selected, deferred, rejectedRequestedIds }`
- Produces: `isPipelineSuccessful(summary) => boolean`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { isCompletedInventoryMatch, partitionRefreshCandidates, isPipelineSuccessful } = require('../src/ops/refreshPolicy');

test('selects flagged completed matches and defers live matches', () => {
  const result = partitionRefreshCandidates([
    { sourceMatchId: 'done', sourceStatus: 'completed', needsRescrape: true },
    { sourceMatchId: 'live', sourceStatus: 'scheduled', needsRescrape: true },
  ]);
  assert.deepEqual(result.selected.map((match) => match.sourceMatchId), ['done']);
  assert.deepEqual(result.deferred.map((match) => match.sourceMatchId), ['live']);
});

test('a requested live match is deferred instead of ingested', () => {
  const result = partitionRefreshCandidates([
    { sourceMatchId: 'live', sourceStatus: 'scheduled', needsRescrape: false },
  ], { requestedSourceMatchIds: ['live'] });
  assert.equal(result.selected.length, 0);
  assert.equal(result.deferred[0].sourceMatchId, 'live');
});

test('pipeline success requires every selected match to be processed without failures', () => {
  assert.equal(isPipelineSuccessful({ attemptedMatchCount: 2, processedMatchCount: 2, failedMatchCount: 0 }), true);
  assert.equal(isPipelineSuccessful({ attemptedMatchCount: 2, processedMatchCount: 1, failedMatchCount: 1 }), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/worker/test/refreshPolicy.test.js`

Expected: FAIL because `../src/ops/refreshPolicy` does not exist.

- [ ] **Step 3: Implement the minimal pure policy**

```js
function isCompletedInventoryMatch(match = {}) {
  return String(match.sourceStatus || '').trim().toLowerCase() === 'completed';
}

function partitionRefreshCandidates(candidates = [], options = {}) {
  const requested = new Set((options.requestedSourceMatchIds || []).map(String));
  const selected = [];
  const deferred = [];
  for (const candidate of candidates) {
    const explicitlyRequested = requested.has(String(candidate.sourceMatchId));
    const needsRefresh = candidate.needsRescrape || candidate.needsReparse || candidate.needsRecompute;
    if (!explicitlyRequested && !needsRefresh) continue;
    if (isCompletedInventoryMatch(candidate)) selected.push(candidate);
    else deferred.push(candidate);
  }
  return { selected, deferred, rejectedRequestedIds: [] };
}

function isPipelineSuccessful(summary = {}) {
  return summary.attemptedMatchCount === summary.processedMatchCount && summary.failedMatchCount === 0;
}

module.exports = { isCompletedInventoryMatch, partitionRefreshCandidates, isPipelineSuccessful };
```

- [ ] **Step 4: Run the policy tests**

Run: `node --test apps/worker/test/refreshPolicy.test.js`

Expected: PASS with three tests.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/ops/refreshPolicy.js apps/worker/test/refreshPolicy.test.js
git commit -m "test: define completed-match refresh policy"
```

### Task 2: Enforce the unified local refresh contract

**Files:**
- Modify: `apps/worker/src/ops/localRefresh.js`
- Test: `apps/worker/test/refreshPolicy.test.js`

**Interfaces:**
- Consumes: `partitionRefreshCandidates()` and `isPipelineSuccessful()` from Task 1.
- Produces: `refreshSeries(options) => summary` with `selectedMatchCount`, `deferredMatchCount`, `deferredMatches`, `pipeline`, `downstream`, and `validation`.
- Produces: `refreshSingleMatch(options) => summary` using the same series workflow and candidate policy.

- [ ] **Step 1: Extend the candidate query to return source status**

Add `m.status as source_status` to `loadRefreshCandidates`, map it to `sourceStatus`, and include it in `buildCandidateSummary`. Retain the existing `needsRescrape`, `needsReparse`, and `needsRecompute` fields.

- [ ] **Step 2: Select through the policy after inventory persistence**

Replace direct use of `allCandidates` with:

```js
const candidatePartition = partitionRefreshCandidates(allCandidates, {
  requestedSourceMatchIds,
});
const selectedCandidates = requestedLimit
  ? candidatePartition.selected.slice(0, requestedLimit)
  : candidatePartition.selected;
```

Write deferred candidates into the summary; do not send them to `runMatchPipeline`.

- [ ] **Step 3: Make pipeline failures hard failures**

After `runMatchPipeline`, check `isPipelineSuccessful(pipeline)`. If false, set the refresh summary’s `status` to `failed`, preserve `pipeline.failedMatches`, write the summary in the command layer, and throw an error containing processed and failed counts. Do not run downstream operations.

- [ ] **Step 4: Run downstream recomputation only after successful ingest**

Accept injected operations in `refreshSeries`:

```js
operations: { runSeasonAggregation, runCompositeScoring, runPlayerIntelligence, validateSeries }
```

When at least one match was successfully processed, call those operations in this order with `{ series, outDir, log }`; store each result as `downstream.seasonAggregation`, `downstream.compositeScoring`, `downstream.intelligence`, and `validation`. If validation returns `ready: false`, mark the summary failed and throw. Do not call publish.

- [ ] **Step 5: Make single-match status explicit**

If a requested match resolves but is not completed, return a summary with `status: 'deferred'`, `selectedMatchCount: 0`, and one entry under `deferredMatches`; do not treat it as an unresolved match. If it is missing from inventory, retain the existing error.

- [ ] **Step 6: Run the policy test suite**

Run: `node --test apps/worker/test/refreshPolicy.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/ops/localRefresh.js apps/worker/test/refreshPolicy.test.js
git commit -m "feat: enforce unified refresh contract"
```

### Task 3: Wire commands and document the new operator contract

**Files:**
- Modify: `apps/worker/src/index.js`
- Modify: `README.md`
- Modify: `ops_runbook_manual_refresh.md`

**Interfaces:**
- Consumes: `refreshSeries()` and `refreshSingleMatch()` from Task 2.
- Produces: CLI summaries that include inventory, selected/deferred matches, ingest status, downstream recomputation, and validation.

- [ ] **Step 1: Inject downstream operations into both CLI refresh commands**

Pass the imported `runSeasonAggregation`, `runCompositeScoring`, `runPlayerIntelligence`, and `validateSeries` functions to both `refreshSeries()` and `refreshSingleMatch()` under the `operations` option. Pass `configPath` to validation.

- [ ] **Step 2: Preserve summary output on failure**

Wrap each command’s refresh call so a thrown refresh error writes the partial summary if the error exposes `refreshSummary`, then rethrows. This keeps source-block or match-failure evidence in `storage/exports/<series>/`.

- [ ] **Step 3: Update documentation**

Replace the manual follow-up block with this contract:

```text
refresh-series and refresh-match now inventory first, ingest only completed matches, recompute series analytics after successful ingest, and validate automatically. They do not publish. Scheduled and in-progress matches are deferred and reported in the refresh summary.
```

Keep the standalone compute commands documented as recovery tools, not normal refresh steps.

- [ ] **Step 4: Run static and CLI smoke checks**

Run: `node --check apps/worker/src/ops/refreshPolicy.js && node --check apps/worker/src/ops/localRefresh.js && node --check apps/worker/src/index.js && node apps/worker/src/index.js help`

Expected: all syntax checks succeed and help exits `0`.

- [ ] **Step 5: Run the automated tests**

Run: `node --test apps/worker/test/refreshPolicy.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/index.js README.md ops_runbook_manual_refresh.md
git commit -m "docs: document automatic refresh recomputation"
```

## Self-Review

- Spec coverage: Task 2 handles inventory-first operation, completed-only ingest, delta/flag selection, commentary pipeline use, downstream recomputation, validation, and hard failure. Task 3 preserves machine-readable summaries and documents non-publishing behavior.
- Placeholder scan: no TODO/TBD placeholders present.
- Type consistency: Task 1 exports the exact functions Task 2 consumes; Task 2 accepts `operations` that Task 3 provides.

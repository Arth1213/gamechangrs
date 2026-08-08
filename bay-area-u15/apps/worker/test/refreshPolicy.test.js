const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isCompletedInventoryMatch,
  partitionRefreshCandidates,
  isPipelineSuccessful,
} = require("../src/ops/refreshPolicy");

test("selects flagged completed matches and defers live matches", () => {
  const result = partitionRefreshCandidates([
    { sourceMatchId: "done", sourceStatus: "completed", needsRescrape: true },
    { sourceMatchId: "live", sourceStatus: "scheduled", needsRescrape: true },
  ]);

  assert.deepEqual(result.selected.map((match) => match.sourceMatchId), ["done"]);
  assert.deepEqual(result.deferred.map((match) => match.sourceMatchId), ["live"]);
});

test("a requested live match is deferred instead of ingested", () => {
  const result = partitionRefreshCandidates(
    [{ sourceMatchId: "live", sourceStatus: "scheduled", needsRescrape: false }],
    { requestedSourceMatchIds: ["live"] }
  );

  assert.equal(result.selected.length, 0);
  assert.equal(result.deferred[0].sourceMatchId, "live");
});

test("a match is completed only when the source status is completed", () => {
  assert.equal(isCompletedInventoryMatch({ sourceStatus: "completed" }), true);
  assert.equal(isCompletedInventoryMatch({ sourceStatus: "scheduled" }), false);
  assert.equal(isCompletedInventoryMatch({ sourceStatus: "inventory_seen" }), false);
});

test("pipeline success requires every selected match to be processed without failures", () => {
  assert.equal(
    isPipelineSuccessful({ attemptedMatchCount: 2, processedMatchCount: 2, failedMatchCount: 0 }),
    true
  );
  assert.equal(
    isPipelineSuccessful({ attemptedMatchCount: 2, processedMatchCount: 1, failedMatchCount: 1 }),
    false
  );
});

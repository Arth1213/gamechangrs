import assert from "node:assert/strict";
import test from "node:test";
import { srgBatsFirst, svsBatsFirst } from "./grizzliesPlayoffCalculator.js";

test("calculates the SVS chase time required after Grizzlies score 150", () => {
  const result = srgBatsFirst(150);
  assert.equal(result.scenario, "Grizzlies bat first");
  assert.equal(result.siliconValleyTarget, 151);
  assert.equal(result.minimumSiliconValleyBalls, 105);
  assert.equal(result.minimumSiliconValleyOvers, "17.3");
  assert.ok(result.projectedGrizzliesNRR > result.projectedSiliconValleyNRR);
});

test("calculates the minimum Grizzlies score after SVS score 150", () => {
  assert.deepEqual(svsBatsFirst(150), {
    scenario: "Silicon Valley bats first",
    siliconValleyScore: 150,
    minimumGrizzliesScore: 131,
    maximumSiliconValleyWinningMargin: 19,
  });
});

test("rejects negative and fractional scores", () => {
  assert.throws(() => srgBatsFirst(-1), /non-negative whole number/);
  assert.throws(() => svsBatsFirst(150.5), /non-negative whole number/);
});

test("does not return a negative Grizzlies score for an impossible low SVS total", () => {
  assert.deepEqual(svsBatsFirst(0), {
    scenario: "Silicon Valley bats first",
    siliconValleyScore: 0,
    possible: false,
    message: "Grizzlies cannot remain ahead on NRR while losing at this Silicon Valley score.",
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { visibleHomepageStats } from "./publicHomepageStats.js";

test("keeps core analytics counts while suppressing placeholder one-value counters", () => {
  assert.deepEqual(
    visibleHomepageStats({ playerCount: 42, computedMatchCount: 18, videoAnalysisCount: 1, gearDonationCount: 1 }),
    [
      { value: 42, label: "Athletes Analyzed" },
      { value: 18, label: "Matches Analyzed" },
    ],
  );
});

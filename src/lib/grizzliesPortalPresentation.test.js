import test from "node:test";
import assert from "node:assert/strict";

import { minorLeagueLaunch } from "./grizzliesPortalPresentation.js";

test("publishes the approved Minor League launch copy and verified Grizzlies fixtures", () => {
  assert.equal(minorLeagueLaunch.heading, "Minor League 2026 — Starting Soon");
  assert.equal(
    minorLeagueLaunch.supportingText,
    "Stay tuned for Match Analytics once the series starts."
  );
  assert.equal(minorLeagueLaunch.logoSrc, "/milc-logo.png");
  assert.equal(minorLeagueLaunch.fixtures.length, 4);
  assert.deepEqual(
    minorLeagueLaunch.fixtures.map((fixture) => fixture.homeTeam),
    ["San Ramon Grizzlies", "San Ramon Grizzlies", "TBD", "Silicon Valley Strikers"]
  );
  assert.match(minorLeagueLaunch.officialScheduleUrl, /minorleaguecricket\.com\/MiLC\/schedules/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { deriveBackfillProfile } = require("../src/load/repository");

test("does not propagate a profile URL through an exact-name backfill", () => {
  const result = deriveBackfillProfile({
    profile_url: "https://cricclubs.com/USACricketJunior/viewPlayer.do?playerId=2650754",
    batting_style: "Right Handed Batter",
  });

  assert.equal(result.battingStyleBucket, "right_hand_batter");
  assert.equal(result.profileUrl, "");
});

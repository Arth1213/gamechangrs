const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBattingIdentityConflicts } = require("../src/ops/battingIdentity");

test("drops duplicate did-not-bat entries for a player who batted", () => {
  const result = normalizeBattingIdentityConflicts({
    sourceMatchId: "match-1",
    battingInnings: [
      { inningsNo: 1, playerSourceId: "p1", playerName: "Player", didNotBat: false, battingPosition: 1 },
      { inningsNo: 1, playerSourceId: "p1", playerName: "Player", didNotBat: true, battingPosition: 11 },
    ],
  });
  assert.equal(result.battingInnings.length, 1);
  assert.equal(result.droppedDidNotBatCount, 1);
});

test("gives a conflicting active duplicate a match-scoped synthetic identity", () => {
  const result = normalizeBattingIdentityConflicts({
    sourceMatchId: "match-1",
    battingInnings: [
      { inningsNo: 1, playerSourceId: "p1", playerName: "Player", didNotBat: false, battingPosition: 1 },
      { inningsNo: 1, playerSourceId: "p1", playerName: "Player", didNotBat: false, battingPosition: 2 },
    ],
  });
  assert.match(result.battingInnings[1].playerSourceId, /^synthetic:match:match-1:innings:1:position:2$/);
  assert.equal(result.syntheticPlayers.length, 1);
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { parseCommentary } = require("../src/parse/commentaryParser");

const parsedScorecard = {
  playerRegistry: [
    { sourcePlayerId: "1", displayName: "Carmi Le Roux", aliases: ["C Le Roux", "Carmi Le Roux"] },
    { sourcePlayerId: "2", displayName: "Bilal Basheer", aliases: ["B Basheer", "Bilal Basheer"] },
  ],
  innings: [{ inningsNo: 1, battingTeamName: "Strikers", bowlingTeamName: "Blazers" }],
};

test("ordinary player initials are not parsed as caught or bowled dismissals", () => {
  const result = parseCommentary({
    sections: [{
      inningsNo: 1,
      rows: [
        { leftText: "0 0.1", commentaryText: "C Le Roux to B Basheer, 0 run", links: [] },
        { leftText: "1 0.2", commentaryText: "C Le Roux to B Basheer, 1 run", links: [] },
      ],
    }],
  }, parsedScorecard);

  assert.deepEqual(result.ballEvents.map((event) => event.wicketFlag), [false, false]);
  assert.deepEqual(result.ballEvents.map((event) => event.dismissalType), [null, null]);
  assert.deepEqual(result.ballEvents.map((event) => event.playerOutSourcePlayerId), [null, null]);
  assert.deepEqual(result.ballEvents.map((event) => event.wicketsAfter), [0, 0]);
});

test("an explicit OUT delivery remains a dismissal", () => {
  const result = parseCommentary({
    sections: [{
      inningsNo: 1,
      rows: [{
        leftText: "W 0.1",
        commentaryText: "C Le Roux to B Basheer OUT! BOWLED Bilal Basheer b C Le Roux",
        links: [],
      }],
    }],
  }, parsedScorecard);

  assert.equal(result.ballEvents[0].wicketFlag, true);
  assert.equal(result.ballEvents[0].dismissalType, "bowled");
  assert.equal(result.ballEvents[0].playerOutSourcePlayerId, "2");
  assert.equal(result.ballEvents[0].wicketsAfter, 1);
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildGrizzliesMatchEvidence,
  buildGrizzliesMatchAnalysis,
  calculateEvidenceChecksum,
} = require("../src/analytics/grizzliesMatchEvidence");

const match = {
  id: 42,
  sourceMatchId: "west-completed",
  resultText: "Silicon Valley Strikers won by 6 wickets",
  teams: ["Silicon Valley Strikers", "East Bay Blazers"],
};

const innings = [
  { battingTeam: "East Bay Blazers", runs: 120, wickets: 8, legalBalls: 120 },
  { battingTeam: "Silicon Valley Strikers", runs: 121, wickets: 4, legalBalls: 108 },
];

const ballEvents = [
  { innings: 1, over: 1, legal: true, runs: 0, wicket: false, boundary: false },
  { innings: 1, over: 1, legal: true, runs: 4, wicket: false, boundary: true },
  { innings: 1, over: 7, legal: true, runs: 0, wicket: true, boundary: false },
  { innings: 2, over: 16, legal: true, runs: 6, wicket: false, boundary: true },
];

test("evidence bundle computes innings rates and ordered momentum shifts", () => {
  const evidence = buildGrizzliesMatchEvidence({ match, innings, ballEvents, grizzliesTeamName: "San Ramon Grizzlies" });

  assert.equal(evidence.complete, true);
  assert.equal(evidence.grizzliesParticipated, false);
  assert.equal(evidence.innings[0].runRate, 6);
  assert.equal(evidence.innings[1].runRate, 6.72);
  assert.equal(evidence.innings[0].dotBallRate, 66.67);
  assert.equal(evidence.momentum[0].impactScore >= evidence.momentum[1].impactScore, true);
});

test("evidence bundle blocks analysis when ball-by-ball facts are missing", () => {
  const evidence = buildGrizzliesMatchEvidence({ match, innings, ballEvents: [], grizzliesTeamName: "San Ramon Grizzlies" });

  assert.equal(evidence.complete, false);
  assert.deepEqual(evidence.missing, ["ball_events"]);
  assert.throws(() => buildGrizzliesMatchAnalysis({ evidence }), /complete evidence bundle/i);
});

test("evidence checksum changes when a persisted match fact changes", () => {
  const first = calculateEvidenceChecksum({ match, innings, ballEvents });
  const second = calculateEvidenceChecksum({ match, innings: [{ ...innings[0], runs: 121 }, innings[1]], ballEvents });

  assert.notEqual(first, second);
});

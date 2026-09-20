"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildGrizzliesMatchEvidence,
  buildGrizzliesMatchAnalysis,
  calculateEvidenceChecksum,
} = require("../src/analytics/grizzliesMatchEvidence");
const {
  buildT20MatchIntelligence,
} = require("../src/analytics/t20MatchIntelligence");

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

function makeEvent(overrides = {}) {
  return {
    innings: 2,
    eventIndex: 1,
    over: 1,
    ballInOver: 1,
    strikerPlayerId: 1,
    nonStrikerPlayerId: 2,
    playerOutId: null,
    batterRuns: 1,
    runs: 1,
    legal: true,
    wicket: false,
    scoreAfterRuns: 1,
    wicketsAfter: 0,
    ...overrides,
  };
}

test("reconstructs a recovery partnership and its chase pressure", () => {
  const chaseEvents = [];
  let score = 0;
  let wickets = 0;
  for (let index = 1; index <= 30; index += 1) {
    const isFirstWicket = index === 12;
    const isSecondWicket = index === 30;
    const runs = index === 30 ? 2 : 1;
    score += runs;
    if (isFirstWicket || isSecondWicket) wickets += 1;
    chaseEvents.push(makeEvent({
      eventIndex: index,
      over: Math.ceil(index / 6),
      ballInOver: ((index - 1) % 6) + 1,
      strikerPlayerId: isSecondWicket ? 3 : 1,
      nonStrikerPlayerId: isSecondWicket ? 4 : 2,
      playerOutId: isFirstWicket ? 1 : isSecondWicket ? 3 : null,
      runs,
      batterRuns: runs,
      wicket: isFirstWicket || isSecondWicket,
      scoreAfterRuns: score,
      wicketsAfter: wickets,
    }));
  }

  for (let offset = 1; offset <= 62; offset += 1) {
    const runs = offset <= 33 ? 2 : 1;
    score += runs;
    const endsPartnership = offset === 62;
    if (endsPartnership) wickets += 1;
    const legalIndex = 30 + offset;
    chaseEvents.push(makeEvent({
      eventIndex: legalIndex,
      over: Math.ceil(legalIndex / 6),
      ballInOver: ((legalIndex - 1) % 6) + 1,
      strikerPlayerId: offset % 2 ? 10 : 11,
      nonStrikerPlayerId: offset % 2 ? 11 : 10,
      playerOutId: endsPartnership ? 10 : null,
      runs,
      batterRuns: runs,
      wicket: endsPartnership,
      scoreAfterRuns: score,
      wicketsAfter: wickets,
    }));
  }

  const result = buildT20MatchIntelligence({
    innings: [
      { innings: 1, runs: 166, wickets: 7, legalBalls: 120 },
      { innings: 2, runs: 167, wickets: 4, legalBalls: 114, targetRuns: 167 },
    ],
    ballEvents: chaseEvents,
    playersById: new Map([[10, "Vivaan Jagtiani"], [11, "Bilal Basheer"]]),
  });

  const partnership = result.partnerships.find((row) => row.batterNames.includes("Vivaan Jagtiani"));
  assert.deepEqual(partnership, {
    innings: 2,
    batterIds: [10, 11],
    batterNames: ["Vivaan Jagtiani", "Bilal Basheer"],
    startScore: 31,
    startWickets: 2,
    endScore: 126,
    endWickets: 3,
    runs: 95,
    legalBalls: 62,
    entryRequiredRate: 9.07,
    exitRequiredRate: 8.79,
    complete: true,
  });
});

test("non-striker run-out closes the active partnership", () => {
  const result = buildT20MatchIntelligence({
    innings: [{ innings: 1, runs: 12, wickets: 1, legalBalls: 2 }],
    ballEvents: [
      makeEvent({ innings: 1, eventIndex: 1, strikerPlayerId: 10, nonStrikerPlayerId: 11, scoreAfterRuns: 1 }),
      makeEvent({ innings: 1, eventIndex: 2, strikerPlayerId: 10, nonStrikerPlayerId: 11, playerOutId: 11, wicket: true, scoreAfterRuns: 2, wicketsAfter: 1 }),
    ],
    playersById: new Map([[10, "Vivaan Jagtiani"], [11, "Bilal Basheer"]]),
  });

  assert.equal(result.partnerships.length, 1);
  assert.equal(result.partnerships[0].endWickets, 1);
  assert.equal(result.partnerships[0].complete, true);
});

test("illegal delivery adds chase runs without consuming a ball", () => {
  const result = buildT20MatchIntelligence({
    innings: [{ innings: 2, runs: 7, wickets: 0, legalBalls: 1, targetRuns: 20 }],
    ballEvents: [
      makeEvent({ eventIndex: 1, legal: false, runs: 2, batterRuns: 1, scoreAfterRuns: 2 }),
      makeEvent({ eventIndex: 2, legal: true, runs: 5, batterRuns: 4, scoreAfterRuns: 7 }),
    ],
    playersById: new Map([[1, "A"], [2, "B"]]),
  });

  assert.equal(result.partnerships[0].runs, 7);
  assert.equal(result.partnerships[0].legalBalls, 1);
});

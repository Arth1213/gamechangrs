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
  rankTurningPoints,
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
    startLegalBalls: 30,
    endLegalBalls: 92,
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

test("ranks a recovery stand above an isolated winning event", () => {
  const candidates = rankTurningPoints({
    innings: [
      { innings: 1, runs: 166, wickets: 7, legalBalls: 120 },
      { innings: 2, runs: 167, wickets: 4, legalBalls: 114, targetRuns: 167 },
    ],
    partnerships: [{
      innings: 2,
      batterIds: [10, 11],
      batterNames: ["Vivaan Jagtiani", "Bilal Basheer"],
      startScore: 31,
      startWickets: 2,
      endScore: 126,
      endWickets: 3,
      startLegalBalls: 30,
      endLegalBalls: 92,
      runs: 95,
      legalBalls: 62,
      entryRequiredRate: 9.07,
      exitRequiredRate: 8.79,
      complete: true,
    }],
    phaseMetrics: [],
  });

  assert.equal(candidates[0].type, "chase_recovery_partnership");
  assert.match(candidates[0].evidenceLabel, /95-run Vivaan Jagtiani–Bilal Basheer partnership/);
  assert.equal(candidates[0].components.inningsShare > 0.5, true);
  assert.equal(candidates[0].evidenceRefs.includes("partnership:2:30-92"), true);
});

test("classifies front-running, failed-chase, defense, death-surge, and collapse passages", () => {
  const scenarios = [
    {
      name: "front-running chase",
      input: {
        innings: [{ innings: 1, runs: 150, legalBalls: 120 }, { innings: 2, runs: 151, wickets: 1, legalBalls: 102, targetRuns: 151 }],
        partnerships: [{ innings: 2, batterIds: [1, 2], batterNames: ["A", "B"], startScore: 0, startWickets: 0, endScore: 110, endWickets: 1, startLegalBalls: 0, endLegalBalls: 72, runs: 110, legalBalls: 72, entryRequiredRate: 7.55, exitRequiredRate: 5.13, complete: true }],
        phaseMetrics: [],
      },
      expected: "front_running_chase",
    },
    {
      name: "failed chase pressure",
      input: {
        innings: [{ innings: 1, runs: 180, legalBalls: 120 }, { innings: 2, runs: 155, wickets: 8, legalBalls: 120, targetRuns: 181 }],
        partnerships: [{ innings: 2, batterIds: [3, 4], batterNames: ["C", "D"], startScore: 80, startWickets: 4, endScore: 118, endWickets: 6, startLegalBalls: 72, endLegalBalls: 96, runs: 38, legalBalls: 24, entryRequiredRate: 12.63, exitRequiredRate: 15.75, complete: true }],
        phaseMetrics: [],
      },
      expected: "chase_pressure_partnership",
    },
    {
      name: "defended target",
      input: {
        innings: [{ innings: 1, runs: 160, legalBalls: 120 }, { innings: 2, runs: 132, wickets: 9, legalBalls: 120, targetRuns: 161 }],
        partnerships: [],
        phaseMetrics: [{ innings: 2, phase: "middle", runs: 42, wickets: 4, legalBalls: 54, runRate: 4.67, dotBallRate: 55.56, boundaryRate: 5.56 }],
      },
      expected: "middle_overs_squeeze",
    },
    {
      name: "death surge",
      input: {
        innings: [{ innings: 1, runs: 190, legalBalls: 120 }],
        partnerships: [{ innings: 1, batterIds: [5, 6], batterNames: ["E", "F"], startScore: 125, startWickets: 5, endScore: 190, endWickets: 6, startLegalBalls: 90, endLegalBalls: 120, runs: 65, legalBalls: 30, entryRequiredRate: null, exitRequiredRate: null, complete: true }],
        phaseMetrics: [],
      },
      expected: "death_over_surge",
    },
    {
      name: "collapse",
      input: {
        innings: [{ innings: 1, runs: 145, wickets: 9, legalBalls: 120 }],
        partnerships: [],
        phaseMetrics: [{ innings: 1, phase: "middle", runs: 28, wickets: 5, legalBalls: 54, runRate: 3.11, dotBallRate: 68.52, boundaryRate: 3.7 }],
      },
      expected: "collapse",
    },
  ];

  for (const scenario of scenarios) {
    const candidates = rankTurningPoints(scenario.input);
    assert.equal(candidates.some((candidate) => candidate.type === scenario.expected), true, scenario.name);
  }
});

test("v2 summary and turning point use the same recovery evidence", () => {
  const evidence = {
    complete: true,
    analysisModelVersion: "t20-context-v2",
    match: {
      id: 2376,
      resultText: "Silicon Valley Strikers won by 6 wickets",
    },
    innings: [
      { innings: 1, battingTeam: "East Bay Blazers", runs: 166, wickets: 7, legalBalls: 120, runRate: 8.3 },
      { innings: 2, battingTeam: "Silicon Valley Strikers", runs: 167, wickets: 4, legalBalls: 114, runRate: 8.79 },
    ],
    criticalMoments: [],
    turningPointCandidates: rankTurningPoints({
      innings: [{ innings: 1, runs: 166, legalBalls: 120 }, { innings: 2, runs: 167, wickets: 4, legalBalls: 114, targetRuns: 167 }],
      partnerships: [{ innings: 2, batterIds: [10, 11], batterNames: ["Vivaan Jagtiani", "Bilal Basheer"], startScore: 31, startWickets: 2, endScore: 126, endWickets: 3, startLegalBalls: 30, endLegalBalls: 92, runs: 95, legalBalls: 62, entryRequiredRate: 9.07, exitRequiredRate: 8.79, complete: true }],
      phaseMetrics: [],
    }),
    dataQuality: { partnershipIdentitiesAvailable: true },
  };

  const analysis = buildGrizzliesMatchAnalysis({ evidence });
  assert.equal(analysis.analysisModelVersion, "t20-context-v2");
  assert.equal(analysis.turningPoints[0].type, "chase_recovery_partnership");
  assert.match(analysis.turningPoints[0].statement, /Vivaan Jagtiani and Bilal Basheer/);
  assert.equal(analysis.matchSummary.includes(analysis.turningPoints[0].evidenceLabel), true);
});

test("tied match narrative never claims a completed chase", () => {
  const analysis = buildGrizzliesMatchAnalysis({
    evidence: {
      complete: true,
      analysisModelVersion: "t20-context-v2",
      match: { id: 90, resultText: "Match tied" },
      innings: [
        { innings: 1, battingTeam: "A", runs: 155, wickets: 6, legalBalls: 120, runRate: 7.75 },
        { innings: 2, battingTeam: "B", runs: 155, wickets: 8, legalBalls: 120, runRate: 7.75 },
      ],
      criticalMoments: [],
      turningPointCandidates: [],
      dataQuality: { partnershipIdentitiesAvailable: false },
    },
  });

  assert.doesNotMatch(analysis.matchSummary, /completed (?:the )?chase/i);
  assert.match(analysis.matchSummary, /Match tied/);
});

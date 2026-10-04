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

test("an ambiguous abbreviated batter is not assigned to the first matching player", () => {
  const scorecard = { innings: parsedScorecard.innings, playerRegistry: [
    { sourcePlayerId: "bowler", displayName: "Carmi Le Roux", aliases: ["C Le Roux"] },
    { sourcePlayerId: "one", displayName: "Arjun Patel", aliases: ["A Patel", "Arjun Patel"] },
    { sourcePlayerId: "two", displayName: "Amit Patel", aliases: ["A Patel", "Amit Patel"] },
  ] };
  const result = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "0 0.1", commentaryText: "C Le Roux to A Patel, 0 run", links: [] },
    { leftText: "1 0.2", commentaryText: "C Le Roux to Amit Patel, 1 run", links: [] },
  ] }] }, scorecard);
  assert.equal(result.ballEvents[0].strikerSourcePlayerId, "");
  assert.equal(result.ballEvents[1].strikerSourcePlayerId, "two");
});

test("same initials on opposite teams resolve using the batting innings roster", () => {
  const scorecard = { innings: parsedScorecard.innings, playerRegistry: [
    { sourcePlayerId: "bowler", displayName: "Carmi Le Roux", aliases: ["C Le Roux"] },
    { sourcePlayerId: "one", displayName: "Arshdeep Singh", aliases: ["A Singh", "Arshdeep Singh"] },
    { sourcePlayerId: "two", displayName: "Abheyender Singh", aliases: ["A Singh", "Abheyender Singh"] },
  ], battingInnings: [{ inningsNo: 1, playerSourceId: "one" }, { inningsNo: 2, playerSourceId: "two" }] };
  const ball = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "1 0.1", commentaryText: "C Le Roux to A Singh, 1 run", links: [] },
  ] }] }, scorecard).ballEvents[0];
  assert.equal(ball.strikerSourcePlayerId, "one");
});

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

for (const [token, description, runs, batRuns] of [
  ["1nb", "7 runs SIX NO BALL", 7, 6],
  ["1nb", "3 runs NO BALL", 3, 2],
  ["1nb", "2 runs NO BALL", 2, 1],
  ["1nb", "1 run NO BALL", 1, 0],
  ["3nb", "NO BALL", 3, 2],
]) {
  test(`no-ball ${token} uses explicit delivery total for ${description}`, () => {
    const result = parseCommentary({ sections: [{ inningsNo: 1, rows: [{
      leftText: `${token} 0.1`, commentaryText: `C Le Roux to B Basheer, ${description}`, links: [],
    }] }] }, parsedScorecard);
    const ball = result.ballEvents[0];
    assert.equal(ball.totalRuns, runs);
    assert.equal(ball.batterRuns, batRuns);
    assert.equal(ball.extras, 1);
    assert.equal(ball.isLegalBall, false);
    assert.equal(ball.extraType, "no_ball");
    assert.equal(ball.scoreAfterRuns, runs);
  });
}

test("a no-ball plus four byes is not credited as a batter boundary", () => {
  const ball = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "5nb 1.5", commentaryText: "C Le Roux to B Basheer, 5 runs FOUR1 NO BALL, 4 BYES", links: [] },
  ] }] }, parsedScorecard).ballEvents[0];
  assert.equal(ball.totalRuns, 5);
  assert.equal(ball.batterRuns, 0);
  assert.equal(ball.extras, 5);
  assert.equal(ball.extraType, "no_ball");
  assert.equal(ball.isLegalBall, false);
});

test("a separate non-striker run-out annotation on a no-ball does not consume another ball", () => {
  const scorecard = {
    innings: [{ inningsNo: 1, battingTeamName: "Eagles", bowlingTeamName: "Philadelphians" }],
    playerRegistry: [
      { sourcePlayerId: "bowler", displayName: "Jaykishan Parwani", aliases: ["J Parwani"] },
      { sourcePlayerId: "striker", displayName: "Aditya Seth", aliases: ["A Seth"] },
      { sourcePlayerId: "non-striker", displayName: "Raghav Satheesh", aliases: ["Raghav Satheesh", "R Satheesh"] },
    ],
  };
  const result = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "1nb 10.6", commentaryText: "J Parwani to A Seth, 1 run NO BALL", links: [] },
    { leftText: "W 10.6", commentaryText: "A Seth OUT! RUN OUT Raghav Satheesh Run Out (J Parwani) 6 (34balls 0 fours, 0 sixes) SR 17.65", links: [] },
    { leftText: "1 10.6", commentaryText: "J Parwani to A Seth, 1 run", links: [] },
  ] }] }, scorecard);
  assert.equal(result.ballEvents.length, 2);
  assert.deepEqual(result.ballEvents.map(b => b.isLegalBall), [false, true]);
  assert.deepEqual(result.ballEvents.map(b => b.wicketFlag), [true, false]);
  assert.deepEqual(result.ballEvents.map(b => b.wicketsAfter), [1, 1]);
  assert.equal(result.ballEvents[0].playerOutSourcePlayerId, "non-striker");
  assert.equal(result.ballEvents[0].strikerSourcePlayerId, "striker");
  assert.equal(result.ballEvents[0].wicketCreditedToBowler, false);
  assert.equal(result.ballEvents[1].scoreAfterRuns, 2);
  assert.equal(result.overSummaries[0].legalBalls, 1);
  assert.equal(result.fieldingEvents.length, 1);
});

test("a full run-out delivery after a no-ball remains a separate legal delivery", () => {
  const result = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "1nb 0.1", commentaryText: "C Le Roux to B Basheer, 1 run NO BALL", links: [] },
    { leftText: "W 0.1", commentaryText: "C Le Roux to B Basheer OUT! RUN OUT Bilal Basheer run out (C Le Roux)", links: [] },
  ] }] }, parsedScorecard);
  assert.equal(result.ballEvents.length, 2);
  assert.deepEqual(result.ballEvents.map(b => b.isLegalBall), [false, true]);
  assert.deepEqual(result.ballEvents.map(b => b.wicketFlag), [false, true]);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMatchProfile, buildTacticalPlan, classifyPartnership, strikeBowlerProfiles } = require("../src/analytics/t20TacticalIntelligence");

function inningsRow({ id = 1, date = "2025-09-01", battingTeam = "East Bay Blazers", bowler = "Active Bowler", runs = 120, balls = 120 } = {}) {
  return {
    match_id: id, match_date: date, home_team: battingTeam, away_team: "San Ramon Grizzlies",
    innings_json: [{ innings: 1, battingTeam, runs, wickets: 0, legalBalls: balls }],
    batting_json: [{ innings_no: 1, player_id: 1, player_name: "Target Batter", runs, balls_faced: balls, batting_position: 1, is_not_out: true }],
    bowling_json: [{ innings_no: 1, player_id: 2, player_name: bowler, runs_conceded: runs, legal_balls: balls, wickets: 0 }],
    ball_events_json: Array.from({ length: balls }, (_, idx) => ({ innings: 1, eventIndex: idx + 1, over: Math.floor(idx / 6), ballInOver: idx % 6 + 1, strikerPlayerId: 1, bowlerPlayerId: 2, runs: runs / balls, batterRuns: runs / balls, legal: true, wicket: false })),
  };
}

test("explicit no-ball commentary repairs bat runs without assigning unexplained score gaps", () => {
  const row = inningsRow({ runs: 13, balls: 6 });
  row.ball_events_json = Array.from({ length: 6 }, (_, i) => ({ ...row.ball_events_json[i], runs: 1, batterRuns: 1 }));
  row.ball_events_json.unshift({ ...row.ball_events_json[0], eventIndex: 0, legal: false, runs: 1, batterRuns: 0, extras: 1, commentaryText: "A Bowler to T Batter, 7 runs SIX NO BALL" });
  row.batting_json[0].runs = 12; row.batting_json[0].balls_faced = 7;
  assert.equal(buildMatchProfile(row).innings[0].reconciled, true);
  row.innings_json[0].runs = 14;
  assert.equal(buildMatchProfile(row).innings[0].reconciled, false);
});

test("as-of cutoff handles database Date objects and excludes future evidence", () => {
  const target = inningsRow({ id: 1, date: new Date("2026-09-18T00:00:00Z") });
  const plan = buildTacticalPlan({ opponentMatch: target, contextMatches: [inningsRow({ id: 2, date: "2026-09-21" })], asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler"] });
  assert.deepEqual(plan.sourceMatchIds, [1]);
  assert.equal(plan.coverage[0].date, "2026-09-18");
});

test("current roster excludes a departed historical player from recommendations", () => {
  const plan = buildTacticalPlan({ opponentMatch: inningsRow({ id: 2, date: "2026-09-18", runs: 180 }), contextMatches: [inningsRow({ bowler: "Departed Bowler", runs: 0 })], asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler"] });
  assert.ok(plan.bowlingPlan.length);
  assert.ok(plan.bowlingPlan.every(p => p.player === "Active Bowler"));
  assert.doesNotMatch(JSON.stringify(plan.bowlingPlan), /Departed Bowler/);
});

test("direct opponent sample and each season remain separate from general phase statistics", () => {
  const plan = buildTacticalPlan({ opponentMatch: inningsRow({ id: 2, date: "2026-09-18", runs: 180 }), contextMatches: [inningsRow()], asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler"] });
  const pp = plan.bowlingPlan.find(p => p.phase === "powerplay");
  assert.equal(pp.statistics.direct.balls, 72);
  assert.equal(pp.statistics.bySeason["2025"].runs, 36);
  assert.equal(pp.statistics.bySeason["2026"].runs, 54);
});

test("shortened innings and unreconciled totals do not contaminate standard T20 phase recommendations", () => {
  const corrupt = inningsRow({ id: 3, bowler: "Corrupt Bowler" }); corrupt.innings_json[0].runs = 140;
  const plan = buildTacticalPlan({ opponentMatch: inningsRow({ id: 2, date: "2026-09-18" }), contextMatches: [inningsRow({ bowler: "Reduced Bowler", balls: 72, runs: 0 }), corrupt], asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler", "Reduced Bowler", "Corrupt Bowler"] });
  assert.doesNotMatch(JSON.stringify(plan.bowlingPlan), /Reduced Bowler|Corrupt Bowler/);
  assert.ok(plan.coverage.find(p => p.matchId === 1).excludedReason);
});

test("historical batter evidence follows a current player who changed teams", () => {
  const old = inningsRow({ battingTeam: "Old Club", id: 1 });
  const current = inningsRow({ battingTeam: "San Ramon Grizzlies", id: 2, date: "2026-09-18" });
  current.away_team = "East Bay Blazers";
  const plan = buildTacticalPlan({ opponentMatch: current, contextMatches: [old], asOfDate: "2026-09-20", currentPlayerNames: ["Target Batter"] });
  assert.equal(plan.batterReadiness.find(b => b.name === "Target Batter").innings, 2);
});

test("direct player matchups include only the named opponent, with separate seasons", () => {
  const plan = buildTacticalPlan({ opponentMatch: inningsRow({ id: 2, date: "2026-09-18", runs: 180 }), contextMatches: [inningsRow(), inningsRow({ id: 3, battingTeam: "Different Opponent", runs: 60 })], asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler"] });
  const pair = plan.directMatchups.find(p => p.bowler === "Active Bowler");
  assert.equal(pair.runs, 300);
  assert.equal(pair.balls, 240);
  assert.equal(pair.bySeason["2025"].runs, 120);
});

test("strong partnership requires more than five legal overs and context-appropriate scoring", () => {
  for (const [input, expected] of [
    [{ innings: 1, legalBalls: 30, runs: 60 }, "short_impact"],
    [{ innings: 1, legalBalls: 31, runs: 42 }, "strong"],
    [{ innings: 1, legalBalls: 36, runs: 42 }, "recovery_below_rate"],
    [{ innings: 2, legalBalls: 36, runs: 42, entryRequiredRate: 6 }, "strong"],
    [{ innings: 2, legalBalls: 36, runs: 54, entryRequiredRate: 10 }, "recovery_below_rate"],
  ]) assert.equal(classifyPartnership(input).classification, expected);
});

test("reviewed match cannot bypass the scouting cutoff or shortened-match gate", () => {
  assert.throws(() => buildTacticalPlan({ opponentMatch: inningsRow({ date: "2026-09-21" }), asOfDate: "2026-09-20" }), /after the scouting cutoff/);
  const plan = buildTacticalPlan({ opponentMatch: inningsRow({ balls: 72, runs: 72 }), asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler"] });
  assert.deepEqual(plan.fieldPlans, []);
  assert.deepEqual(plan.matchPassages, []);
  assert.deepEqual(plan.oppositionBowling, []);
});

test("latest shortened scorecard still determines the current XI", () => {
  const old = inningsRow({ bowler: "Departed Bowler" });
  const latest = inningsRow({ id: 2, date: "2026-09-19", bowler: "New Bowler", balls: 72, runs: 72 });
  const plan = buildTacticalPlan({ opponentMatch: old, contextMatches: [latest], asOfDate: "2026-09-20" });
  assert.match(plan.rosterBasis, /match 2/);
  assert.doesNotMatch(JSON.stringify(plan.bowlingPlan), /Departed Bowler/);
});

test("strike bowler profiles separate repeat wicket-taking from a one-match spike and show the weakest phase", () => {
  const profiles = [1,2,3].map(matchId => ({ matchId, date: `2025-09-0${matchId}`, innings: [{ innings: 1, battingTeam: "Other", reconciled: true, bowlers: [{
    id: 5, name: "Strike Bowler", team: "East Bay Blazers", reconciled: true, scorecardRuns: 32, scorecardBalls: 24, scorecardWickets: matchId === 3 ? 0 : 2,
    phases: { powerplay: { runs: 8, balls: 12, wickets: 2 }, death: { runs: 24, balls: 12, wickets: 0 } },
  }], matchups: [], batters: [] }] }));
  profiles[0].innings[0].bowlers.push({ id: 6, name: "One Game", team: "East Bay Blazers", reconciled: true, scorecardRuns: 19, scorecardBalls: 24, scorecardWickets: 5, phases: { middle: { runs: 19, balls: 24, wickets: 5 } } });
  const cards = strikeBowlerProfiles(profiles, new Map([["East Bay Blazers", new Set(["strikebowler", "onegame"])]]), "San Ramon Grizzlies");
  const repeat = cards.find(c => c.player === "Strike Bowler");
  assert.equal(repeat.statistics.wicketSpells, 2);
  assert.equal(repeat.statistics.spells, 3);
  assert.equal(repeat.statistics.weakestPhase.phase, "death");
  assert.equal(repeat.statistics.weakestPhase.economy, 12);
  assert.equal(repeat.statistics.bySeason["2025"].wickets, 4);
  assert.match(cards.find(c => c.player === "One Game").classification, /provisional/);
  assert.equal(repeat.bullets.length, 2);
});

test("phase threats and dot-ball pressure retain named counters and exact legal-ball denominators", () => {
  const row = inningsRow({ date: "2026-09-18" });
  row.ball_events_json.forEach((e,i) => { e.runs = e.batterRuns = i < 6 ? 0 : i < 12 ? 2 : 1; });
  const plan = buildTacticalPlan({ opponentMatch: row, asOfDate: "2026-09-20", currentPlayerNames: ["Active Bowler"] });
  const pp = plan.dotBallPressure.find(c => c.phase === "powerplay");
  assert.equal(pp.statistics.dots, 6);
  assert.equal(pp.statistics.balls, 36);
  assert.equal(pp.statistics.dotPercentage, 16.67);
  assert.match(pp.action, /Active Bowler/);
  assert.match(plan.phaseBattingThreats[0].title, /Target Batter/);
  assert.equal(plan.phaseBattingThreats[0].bullets.length, 2);
});

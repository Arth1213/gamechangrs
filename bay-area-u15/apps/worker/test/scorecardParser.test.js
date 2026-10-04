"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseScorecard } = require("../src/parse/scorecardParser");
const { parseCommentary } = require("../src/parse/commentaryParser");

const row = (...values) => ({ cells: values.map((text) => ({ text, links: [] })) });

function twoInningsScorecard(secondBowler) {
  return {
    headings: ["Orlando Galaxy Innings", "145-9 (20 Ov)", "Baltimore Royals Innings", "150-5 (17.4 Ov)"],
    tables: [
      { rows: [row("Batter", "R", "B", "4s", "6s", "SR")] },
      { rows: [row("Bowler", "O", "M", "Dot", "R", "W", "Econ", "Extras"), row("Aaryan Batra", "2", "1", "9", "6", "1", "3.00", "")] },
      { rows: [row("Batter", "R", "B", "4s", "6s", "SR")] },
      { rows: [row("Bowler", "O", "M", "Dot", "R", "W", "Econ", "Extras"), row(secondBowler, "2", "0", "5", "18", "2", "9.00", "")] },
    ],
  };
}

test("distinct full names sharing a generated short alias remain separate players", () => {
  const parsed = parseScorecard(twoInningsScorecard("Aaryan Boddupally"));
  assert.deepEqual(parsed.bowlingSpells.map(({ playerName, teamName, wickets, runsConceded }) => ({ playerName, teamName, wickets, runsConceded })), [
    { playerName: "Aaryan Batra", teamName: "Baltimore Royals", wickets: 1, runsConceded: 6 },
    { playerName: "Aaryan Boddupally", teamName: "Orlando Galaxy", wickets: 2, runsConceded: 18 },
  ]);
  assert.equal(parsed.playerRegistry.length, 2);
  assert.notEqual(parsed.bowlingSpells[0].playerSourceId, parsed.bowlingSpells[1].playerSourceId);
});

test("a supplied unambiguous short name still resolves to its registered full name", () => {
  const parsed = parseScorecard(twoInningsScorecard("Aaryan B"));
  assert.equal(parsed.playerRegistry.length, 1);
  assert.equal(parsed.bowlingSpells[1].playerName, "Aaryan Batra");
  assert.equal(parsed.bowlingSpells[0].playerSourceId, parsed.bowlingSpells[1].playerSourceId);
});

function modernIdentityFixture() {
  const batter = row("Bilal Basheer (c) c&b V Desai", "4", "2", "1", "0", "200");
  batter.rowKey = "bat-1-bilal-id-with-hyphens";
  const bowler = row("Vraj Desai", "1", "0", "4", "4", "1", "4.00", "");
  bowler.rowKey = "bowl-1-vraj-id";
  const fall = row("B Basheer", "4-1", "0.2");
  fall.cells[0].links = [{ text: "B Basheer", playerId: "bilal-id-with-hyphens", href: "https://cricclubs.com/MiLC/user/bilal-id-with-hyphens" }];
  return { headings: ["Strikers Innings", "4-1 (1 Ov)"], tables: [
    { rows: [row("Batter", "R", "B", "4s", "6s", "SR"), batter] },
    { rows: [row("Bowler", "O", "M", "Dot", "R", "W", "Econ", "Extras"), bowler] },
    { rows: [row("Fall of Wickets", "Score", "Overs"), fall] },
  ] };
}

test("modern row IDs join full scorecard names and commentary initials without synthetic duplicates", () => {
  const parsed = parseScorecard(modernIdentityFixture());
  assert.equal(parsed.playerRegistry.length, 2);
  assert.equal(parsed.battingInnings[0].playerSourceId, "bilal-id-with-hyphens");
  assert.equal(parsed.battingInnings[0].playerName, "Bilal Basheer");
  assert.equal(parsed.battingInnings[0].dismissalType, "caught");
  assert.equal(parsed.battingInnings[0].dismissedBySourcePlayerId, "vraj-id");
  assert.equal(parsed.battingInnings[0].primaryFielderSourcePlayerId, "vraj-id");
  assert.equal(parsed.bowlingSpells[0].playerSourceId, "vraj-id");
  const balls = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "4 0.1", commentaryText: "V Desai to B Basheer, 4 runs FOUR", links: [] },
  ] }] }, parsed).ballEvents;
  assert.equal(balls[0].strikerSourcePlayerId, "bilal-id-with-hyphens");
  assert.equal(balls[0].bowlerSourcePlayerId, "vraj-id");
  assert.equal(parsed.playerRegistry.find(p => p.sourcePlayerId === "bilal-id-with-hyphens").isCaptain, true);
});

test("different source IDs with the same full name never merge", () => {
  const raw = twoInningsScorecard("Aaryan Batra");
  raw.tables[1].rows[1].rowKey = "bowl-1-player-one";
  raw.tables[3].rows[1].rowKey = "bowl-2-player-two";
  const parsed = parseScorecard(raw);
  assert.deepEqual(parsed.bowlingSpells.map(p => p.playerSourceId), ["player-one", "player-two"]);
  assert.equal(parsed.playerRegistry.length, 2);
});

test("bowled notation cannot split a batter surname ending in b", () => {
  const raw = modernIdentityFixture();
  raw.tables[0].rows[1].cells[0].text = "Arnav Jhamb (wk) b V Desai";
  raw.tables[2].rows = [raw.tables[2].rows[0]];
  const parsed = parseScorecard(raw);
  assert.equal(parsed.battingInnings[0].playerName, "Arnav Jhamb");
  assert.equal(parsed.battingInnings[0].dismissalText, "b V Desai");
  assert.equal(parsed.playerRegistry.find(p => p.displayName === "Arnav Jhamb").isWicketkeeper, true);
});

test("modern DNB labels without colon do not create a fake first player", () => {
  const raw = modernIdentityFixture();
  const dnb = row("Did not batVraj Desai , Carmi Le Roux");
  dnb.cells[0].links = [
    { text: "Vraj Desai", playerId: "vraj-id", href: "https://cricclubs.com/MiLC/user/vraj-id" },
    { text: "Carmi Le Roux", playerId: "carmi-id", href: "https://cricclubs.com/MiLC/user/carmi-id" },
  ];
  raw.tables[0].rows.push(dnb);
  const parsed = parseScorecard(raw);
  assert.deepEqual(parsed.battingInnings.filter(p => p.didNotBat).map(p => p.playerSourceId), ["vraj-id", "carmi-id"]);
  assert.equal(parsed.playerRegistry.length, 3);
});

test("initial plus last surname resolves a multi-part name when unambiguous", () => {
  const raw = modernIdentityFixture();
  raw.tables[0].rows[1].cells[0].text = "Vishal Reddy Thanugundla not out";
  raw.tables[2].rows = [raw.tables[2].rows[0]];
  const parsed = parseScorecard(raw);
  const ball = parseCommentary({ sections: [{ inningsNo: 1, rows: [
    { leftText: "1 0.1", commentaryText: "V Desai to V Thanugundla, 1 run", links: [] },
  ] }] }, parsed).ballEvents[0];
  assert.equal(ball.strikerSourcePlayerId, "bilal-id-with-hyphens");
});

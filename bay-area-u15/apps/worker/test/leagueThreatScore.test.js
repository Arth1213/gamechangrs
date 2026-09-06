const assert = require("node:assert/strict");
const test = require("node:test");

const { buildLeagueThreatRows, getLeagueThreatTier } = require("../src/analytics/leagueThreatScore");

test("weights Premier A above identical Premier B and C single-division evidence", () => {
  const result = buildLeagueThreatRows([
    { divisionLabel: "2026 Premier A", playerId: 1, compositeScore: 80, matchesPlayed: 4 },
    { divisionLabel: "2026 Premier B", playerId: 2, compositeScore: 80, matchesPlayed: 4 },
    { divisionLabel: "2026 Premier C", playerId: 3, compositeScore: 80, matchesPlayed: 4 },
  ]);

  const premierA = result.rows.find((row) => row.playerId === 1);
  const premierB = result.rows.find((row) => row.playerId === 2);
  const premierC = result.rows.find((row) => row.playerId === 3);

  assert.ok(premierA.leagueThreatScore > premierB.leagueThreatScore);
  assert.ok(premierB.leagueThreatScore > premierC.leagueThreatScore);
});

test("shrinks a one-match score toward neutral 50", () => {
  const [row] = buildLeagueThreatRows([
    { divisionLabel: "2026 Premier B", playerId: 1, compositeScore: 90, matchesPlayed: 1 },
  ]).rows;

  assert.equal(row.leagueThreatScore, 53.2558);
});

test("excludes divisions outside Premier A B and C", () => {
  assert.equal(
    buildLeagueThreatRows([
      { divisionLabel: "Overall", playerId: 1, compositeScore: 100, matchesPlayed: 10 },
    ]).rows.length,
    0
  );
});

test("prevents one and two match samples from being red", () => {
  assert.equal(getLeagueThreatTier({ leaguePercentileRank: 85, totalMatches: 3 }), "red");
  assert.equal(getLeagueThreatTier({ leaguePercentileRank: 99, totalMatches: 2 }), "amber");
  assert.equal(getLeagueThreatTier({ leaguePercentileRank: 60, totalMatches: 1 }), "amber");
  assert.equal(getLeagueThreatTier({ leaguePercentileRank: 59.99, totalMatches: 8 }), "green");
  assert.equal(getLeagueThreatTier(null), "unknown");
});

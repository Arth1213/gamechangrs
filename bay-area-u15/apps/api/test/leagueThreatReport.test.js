const assert = require("node:assert/strict");
const test = require("node:test");

const { buildThreatHeader } = require("../src/services/playerIntelligenceService");
const { renderPlayerIntelligenceReportPage } = require("../src/render/pages");

test("player threat header preserves division metrics but uses the league-wide tier", () => {
  const header = buildThreatHeader({
    league_threat_score: 64.2,
    league_percentile_rank: 91.5,
    total_matches: 2,
  });

  assert.deepEqual(header, {
    leagueThreatScore: 64.2,
    leaguePercentileRank: 91.5,
    leagueTotalMatches: 2,
    leagueThreatTier: "amber",
  });
});

test("player threat header is unknown without league-wide evidence", () => {
  assert.equal(buildThreatHeader(null).leagueThreatTier, "unknown");
});

test("player threat page renders the persisted league-wide tier", () => {
  const html = renderPlayerIntelligenceReportPage({
    header: {
      playerName: "Test Player",
      teamName: "Test Team",
      roleLabel: "Batter",
      leagueThreatTier: "amber",
      leagueTotalMatches: 2,
      percentileRank: 10,
    },
    meta: { series: { name: "NCCA" }, scope: { scopeLabel: "NCCA" } },
  });

  assert.match(html, /Threat Level[\s\S]*Amber/);
  assert.doesNotMatch(html, /Threat Level[\s\S]*Green/);
});

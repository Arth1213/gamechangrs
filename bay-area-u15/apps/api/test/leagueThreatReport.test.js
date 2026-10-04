const assert = require("node:assert/strict");
const test = require("node:test");

const { buildThreatHeader } = require("../src/services/playerIntelligenceService");
const { renderPlayerIntelligenceReportPage } = require("../src/render/pages");
const { MILC_2026_KEY, MILC_THREAT_VERSION } = require('../../../shared/milcPlayoffThreat');
const { loadAssessmentOverallStats } = require('../src/services/reportService');
const { renderPlayerReportPage } = require('../src/render/pages');

test('playoff assessment hides career panel without hiding it for other teams', () => {
  const report = { visualReadout: [{ value: 70, note: 'Current series evidence' }], header: { playerName: 'Player' }, meta: { series: { name: 'MiLC 2026' }, evidenceScope: 'MiLC 2026 only' } };
  assert.doesNotMatch(renderPlayerReportPage(report), /<h3>Overall CricClubs<\/h3>/);
  assert.match(renderPlayerReportPage({ ...report, meta: { series: { name: 'NCCA' } } }), /<h3>Overall CricClubs<\/h3>/);
});

test('MiLC playoff report uses the raw tier and no career statistics', async () => {
  const scope = { seriesConfigKey: MILC_2026_KEY, teamName: 'Dallas Xforia Giants' };
  const header = buildThreatHeader({ league_threat_score: 70, league_percentile_rank: 84.999, total_matches: 3, score_version: MILC_THREAT_VERSION }, scope);
  assert.equal(header.leagueThreatTier, 'amber');
  assert.equal(header.leagueThreatSource, 'MiLC 2026');
  assert.equal(buildThreatHeader({ league_percentile_rank: 99, total_matches: 2, score_version: MILC_THREAT_VERSION }, scope).leagueThreatTier, 'unknown');
  assert.equal(buildThreatHeader({ league_percentile_rank: 99, total_matches: 4, score_version: 'ncca-league-threat-v1' }, scope).leagueThreatTier, 'unknown');
  let calls = 0;
  const loader = async () => { calls++; return { batting: { runs: 9999 } }; };
  assert.deepEqual(await loadAssessmentOverallStats(null, scope, loader), {});
  assert.equal(calls, 0);
  assert.deepEqual(await loadAssessmentOverallStats(null, { ...scope, teamName: 'San Ramon Grizzlies' }, loader), { batting: { runs: 9999 } });
  assert.equal(calls, 1);
});

test('MiLC threat report identifies its source and limited evidence as gray', () => {
  const scope = { seriesConfigKey: MILC_2026_KEY, teamName: 'Baltimore Royals' };
  for (const matches of [2,3]) {
    const html = renderPlayerIntelligenceReportPage({ header: { playerName: 'Player', ...buildThreatHeader({ league_threat_score: 80, league_percentile_rank: 90, total_matches: matches, score_version: MILC_THREAT_VERSION }, scope) }, meta: { series: { name: 'MiLC 2026' } } });
    assert.match(html, /MiLC 2026/);
    assert.doesNotMatch(html, /NCCA matches/);
    assert.match(html, matches === 2 ? /Gray/ : /Threat Level[\s\S]*Red/);
    if (matches === 2) assert.match(html, /hero-fact-value neutral">Gray/);
  }
});

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

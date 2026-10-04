const assert = require('node:assert/strict');
const test = require('node:test');
const { MILC_2026_KEY, isMilcPlayoff, getMilcThreatTier } = require('../../../shared/milcPlayoffThreat');
const { buildMilcPlayoffThreatRows } = require('../src/analytics/milcPlayoffThreat');
const teamName = 'Dallas Xforia Giants';

test('MiLC policy applies only to the three playoff teams in the exact 2026 series', () => {
  for (const team of [teamName, 'Baltimore Royals', 'Manhattan Yorkers']) assert.equal(isMilcPlayoff(MILC_2026_KEY, team), true);
  for (const team of ['San Ramon Grizzlies', 'Silicon Valley Strikers', 'East Bay Blazers']) assert.equal(isMilcPlayoff(MILC_2026_KEY, team), false);
  assert.equal(isMilcPlayoff('ncca-2026', teamName), false);
  assert.equal(isMilcPlayoff('milc-2025', teamName), false);
});

test('MiLC tier uses raw percentile boundaries and requires three matches', () => {
  for (const [percentile, expected] of [[85, 'red'], [84.999, 'amber'], [60, 'amber'], [59.999, 'green'], [0, 'green']]) {
    assert.equal(getMilcThreatTier({ leaguePercentileRank: percentile, totalMatches: 3 }), expected);
    assert.equal(getMilcThreatTier({ leaguePercentileRank: percentile, totalMatches: 2 }), 'unknown');
  }
  for (const percentile of [null, undefined, '', ' ', NaN, Infinity, -1, 101]) assert.equal(getMilcThreatTier({ leaguePercentileRank: percentile, totalMatches: 5 }), 'unknown');
  assert.equal(getMilcThreatTier({ leaguePercentileRank: 90, totalMatches: null }), 'unknown');
});

const row = (playerId, compositeScore, extra = {}) => ({ playerId, compositeScore, matchesPlayed: 4, teamName, playerName: `Player ${playerId}`, sourcePlayerId: `source-${playerId}`, divisionLabel: 'Central', ...extra });

test('MiLC ranks across the season pool but returns only playoff players; ties share midrank', () => {
  const result = buildMilcPlayoffThreatRows([row(1, 10), row(2, 20), row(3, 20, { teamName: 'East Bay Blazers' }), row(4, 30, { teamName: 'Other' })]);
  assert.deepEqual(result.rows.map(r => [r.playerId, r.leagueThreatScore, r.leaguePercentileRank, r.totalMatches]), [[1,10,0,4], [2,20,50,4]]);
  assert.equal(result.summary.playerCount, 4);
});

test('MiLC never merges unresolved names or duplicate composite grains into ratings', () => {
  const result = buildMilcPlayoffThreatRows([
    row(1, 10), row(2, 20), row(2, 30),
    row(3, 40, { playerName: 'Same Name' }), row(4, 50, { playerName: 'Same Name' }),
    row(5, 60, { sourcePlayerId: 'synthetic:5' }), row(6, null),
    row(7, 70, { identityReview: true }), row(8, 80, { matchesPlayed: 1 }),
  ]);
  assert.deepEqual(result.rows.map(r => r.playerId), [1,8]);
  assert.equal(getMilcThreatTier(result.rows[1]), 'unknown');
  assert.equal(result.summary.playerCount, 2);
});

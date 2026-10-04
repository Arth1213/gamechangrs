"use strict";

const { PLAYOFF_TEAM_NAMES, finiteMetric } = require('../../../../shared/milcPlayoffThreat');

// One current composite per player. Do not reuse NCCA division weights or merge
// ambiguous source accounts. All valid MiLC players form the comparison pool;
// fewer than three matches remain unrated in the shared presentation policy.
function buildMilcPlayoffThreatRows(inputs) {
  const ids = new Map();
  const names = new Map();
  for (const row of inputs) {
    ids.set(row.playerId, (ids.get(row.playerId) || 0) + 1);
    const key = `${row.teamName}:${String(row.playerName || '').trim().toLowerCase()}`;
    if (!names.has(key)) names.set(key, new Set());
    names.get(key).add(row.playerId);
  }
  const cohort = inputs.filter(row => {
    const score = finiteMetric(row.compositeScore);
    const key = `${row.teamName}:${String(row.playerName || '').trim().toLowerCase()}`;
    return Number.isSafeInteger(row.playerId) && row.playerId > 0 && ids.get(row.playerId) === 1
      && names.get(key).size === 1 && !row.identityReview && Boolean(row.playerName && row.sourcePlayerId)
      && !String(row.sourcePlayerId).startsWith('synthetic:')
      && score !== null && score >= 0 && score <= 100
      && Number.isInteger(row.matchesPlayed) && row.matchesPlayed > 0;
  });
  const scores = cohort.map(row => Number(row.compositeScore));
  const rows = cohort.filter(row => PLAYOFF_TEAM_NAMES.includes(row.teamName) && cohort.length > 1).map(row => {
    const score = Number(row.compositeScore);
    const below = scores.filter(value => value < score).length;
    const equal = scores.filter(value => value === score).length;
    return {
      playerId: row.playerId,
      leagueThreatScore: score,
      leaguePercentileRank: Number((100 * (below + (equal - 1) / 2) / (scores.length - 1)).toFixed(4)),
      totalMatches: row.matchesPlayed,
      divisionEvidence: [{ divisionLabel: row.divisionLabel, compositeScore: score, matchesPlayed: row.matchesPlayed, cohortPlayerCount: cohort.length }],
    };
  });
  return { rows, summary: { playerCount: cohort.length, excludedInputCount: inputs.length - cohort.length } };
}

module.exports = { buildMilcPlayoffThreatRows };

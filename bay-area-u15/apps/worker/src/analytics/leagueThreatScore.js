const { normalizeText, toInteger, toNumber } = require("../lib/cricket");

const DIVISION_WEIGHTS = new Map([
  ["2026 Premier A", 1],
  ["2026 Premier B", 0.7],
  ["2026 Premier C", 0.45],
]);

const NEUTRAL_COMPOSITE_SCORE = 50;
const FULL_DIVISION_WEIGHT = 2.15;

function roundMetric(value, digits = 4) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : null;
}

function percentileScore(value, values) {
  const numeric = Number(value);
  const filtered = values.map(Number).filter(Number.isFinite);
  if (!Number.isFinite(numeric) || !filtered.length) return 0;
  if (filtered.length === 1) return 100;

  let lessCount = 0;
  let equalCount = 0;
  for (const entry of filtered) {
    if (entry < numeric) lessCount += 1;
    if (entry === numeric) equalCount += 1;
  }
  return roundMetric(((lessCount + Math.max(equalCount - 1, 0) / 2) / (filtered.length - 1)) * 100);
}

function getLeagueThreatTier(input) {
  const percentile = Number(input?.leaguePercentileRank);
  const totalMatches = toInteger(input?.totalMatches);
  if (!Number.isFinite(percentile)) return "unknown";
  if (percentile >= 85 && totalMatches >= 3) return "red";
  if (percentile >= 60 || percentile >= 85) return "amber";
  return "green";
}

function buildLeagueThreatRows(inputRows) {
  const byPlayer = new Map();

  for (const input of Array.isArray(inputRows) ? inputRows : []) {
    const divisionLabel = normalizeText(input?.divisionLabel);
    const divisionWeight = DIVISION_WEIGHTS.get(divisionLabel);
    const playerId = toInteger(input?.playerId);
    if (!divisionWeight || !playerId) continue;

    const compositeScore = toNumber(input?.compositeScore, NEUTRAL_COMPOSITE_SCORE);
    const matchesPlayed = Math.max(toInteger(input?.matchesPlayed), 0);
    const confidence = Math.min(matchesPlayed / 4, 1);
    const confidenceAdjustedComposite =
      compositeScore * confidence + NEUTRAL_COMPOSITE_SCORE * (1 - confidence);
    const weightedDeviation = divisionWeight * confidence * (compositeScore - NEUTRAL_COMPOSITE_SCORE);
    const player = byPlayer.get(playerId) || { playerId, weightedDeviation: 0, totalMatches: 0, divisionEvidence: [] };
    player.weightedDeviation += weightedDeviation;
    player.totalMatches += matchesPlayed;
    player.divisionEvidence.push({
      divisionLabel,
      divisionWeight,
      matchesPlayed,
      confidence: roundMetric(confidence),
      compositeScore: roundMetric(compositeScore),
      confidenceAdjustedComposite: roundMetric(confidenceAdjustedComposite),
    });
    byPlayer.set(playerId, player);
  }

  const stagedRows = [...byPlayer.values()].map((row) => ({
    playerId: row.playerId,
    leagueThreatScore: roundMetric(NEUTRAL_COMPOSITE_SCORE + row.weightedDeviation / FULL_DIVISION_WEIGHT),
    totalMatches: row.totalMatches,
    divisionEvidence: row.divisionEvidence.sort((left, right) => right.divisionWeight - left.divisionWeight),
  }));
  const scores = stagedRows.map((row) => row.leagueThreatScore);
  const rows = stagedRows.map((row) => ({
    ...row,
    leaguePercentileRank: percentileScore(row.leagueThreatScore, scores),
  }));

  return {
    rows,
    summary: { playerCount: rows.length, divisionCount: DIVISION_WEIGHTS.size },
  };
}

module.exports = {
  DIVISION_WEIGHTS,
  FULL_DIVISION_WEIGHT,
  NEUTRAL_COMPOSITE_SCORE,
  buildLeagueThreatRows,
  getLeagueThreatTier,
};

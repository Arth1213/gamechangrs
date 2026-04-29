const { normalizeText, toInteger, toNumber } = require("../lib/cricket");

function clamp(value, minimum = 0, maximum = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return minimum;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
}

function roundMetric(value, digits = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Number(parsed.toFixed(digits));
}

function safeDivide(numerator, denominator, fallback = 0) {
  const left = Number(numerator);
  const right = Number(denominator);
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return fallback;
  }
  return left / right;
}

function average(values, fallback = 0) {
  const filtered = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return fallback;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function weightedAverage(values, weights, fallback = 0) {
  if (!Array.isArray(values) || !Array.isArray(weights) || values.length !== weights.length) {
    return fallback;
  }

  let total = 0;
  let totalWeight = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    const weight = Number(weights[index]);
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) {
      continue;
    }

    total += value * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return fallback;
  }

  return total / totalWeight;
}

function standardDeviation(values) {
  const filtered = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (filtered.length <= 1) {
    return 0;
  }

  const mean = average(filtered, 0);
  const variance =
    filtered.reduce((sum, value) => sum + (value - mean) ** 2, 0) / filtered.length;
  return Math.sqrt(variance);
}

function linearTrend(values) {
  const filtered = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (filtered.length <= 1) {
    return 0;
  }

  const n = filtered.length;
  const meanX = (n - 1) / 2;
  const meanY = average(filtered, 0);
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < filtered.length; index += 1) {
    numerator += (index - meanX) * (filtered[index] - meanY);
    denominator += (index - meanX) ** 2;
  }

  return safeDivide(numerator, denominator, 0);
}

function percentileScore(value, values, options = {}) {
  const filtered = values.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry));
  const numeric = Number(value);
  const neutral = Number.isFinite(Number(options.neutral)) ? Number(options.neutral) : 0;

  if (!Number.isFinite(numeric)) {
    return neutral;
  }

  if (!filtered.length) {
    return neutral;
  }

  if (filtered.length === 1) {
    if (!Number.isFinite(filtered[0]) || filtered[0] === 0) {
      return neutral;
    }
    return numeric > 0 ? 100 : neutral;
  }

  const sorted = [...filtered].sort((left, right) => left - right);
  let lessCount = 0;
  let equalCount = 0;

  for (const entry of sorted) {
    if (entry < numeric) {
      lessCount += 1;
      continue;
    }
    if (entry === numeric) {
      equalCount += 1;
    }
  }

  const rank = lessCount + Math.max(equalCount - 1, 0) / 2;
  return roundMetric((rank / (sorted.length - 1)) * 100, 4);
}

function modeValue(values) {
  const counts = new Map();
  for (const value of values) {
    const normalized = toInteger(value);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  let selected = null;
  let selectedCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > selectedCount) {
      selected = value;
      selectedCount = count;
    }
  }

  return selected;
}

function getGateValue(gates, key, fallback) {
  const value = gates && Object.prototype.hasOwnProperty.call(gates, key) ? gates[key] : fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function determineRoleType(input) {
  const minMatches = getGateValue(input.gates, "min_matches_for_confident_ranking", 3);
  const minBatBalls = getGateValue(input.gates, "min_balls_for_batting_confidence", 40);
  const minBowlBalls = getGateValue(input.gates, "min_balls_for_bowling_confidence", 36);

  const battingActive =
    input.battingBalls >= minBatBalls * 0.5 ||
    input.battingMatchCount >= Math.max(1, Math.ceil(minMatches / 2)) ||
    input.rawRuns >= 20;
  const bowlingActive =
    input.bowlingBalls >= minBowlBalls * 0.5 ||
    input.bowlingMatchCount >= Math.max(1, Math.ceil(minMatches / 2)) ||
    input.rawWickets >= 2;
  const wicketkeepingActive = input.wicketkeepingEventCount > 0;

  if (battingActive && bowlingActive) {
    return input.battingMetricRaw >= input.bowlingMetricRaw
      ? "batting_all_rounder"
      : "bowling_all_rounder";
  }

  if (wicketkeepingActive && (battingActive || input.rawRuns > 0 || input.battingMatchCount > 0)) {
    return "wicketkeeper_batter";
  }

  if (bowlingActive) {
    return "bowling";
  }

  return "batting";
}

function buildVersatilityScore(input) {
  if (input.roleType === "batting_all_rounder" || input.roleType === "bowling_all_rounder") {
    return 91;
  }

  if (input.roleType === "wicketkeeper_batter") {
    return 54;
  }

  let score = 22;
  if (input.secondarySkillPresent) {
    score += 22;
  }
  if (input.fieldingImpactRaw > 0) {
    score += 10;
  }

  return Math.min(score, 91);
}

function buildConfidenceScore(input) {
  const minMatches = getGateValue(input.gates, "min_matches_for_confident_ranking", 3);
  const minBatBalls = getGateValue(input.gates, "min_balls_for_batting_confidence", 40);
  const minBowlBalls = getGateValue(input.gates, "min_balls_for_bowling_confidence", 36);

  const matchCoverage = clamp(safeDivide(input.matchesPlayed, minMatches, 0), 0, 1);
  let sampleCoverage = 0;

  if (input.roleType === "bowling") {
    sampleCoverage = clamp(safeDivide(input.bowlingBalls, minBowlBalls, 0), 0, 1);
  } else if (input.roleType === "batting") {
    sampleCoverage = clamp(safeDivide(input.battingBalls, minBatBalls, 0), 0, 1);
  } else if (
    input.roleType === "batting_all_rounder" ||
    input.roleType === "bowling_all_rounder"
  ) {
    const battingCoverage = clamp(safeDivide(input.battingBalls, minBatBalls, 0), 0, 1);
    const bowlingCoverage = clamp(safeDivide(input.bowlingBalls, minBowlBalls, 0), 0, 1);
    sampleCoverage = average([battingCoverage, bowlingCoverage], 0);
  } else if (input.roleType === "wicketkeeper_batter") {
    const battingCoverage = clamp(safeDivide(input.battingBalls, minBatBalls, 0), 0, 1);
    const keepingCoverage = input.wicketkeepingEventCount > 0 ? 1 : 0.35;
    sampleCoverage = average([battingCoverage, keepingCoverage], 0);
  }

  return roundMetric((matchCoverage * 0.45 + sampleCoverage * 0.55) * 100, 4);
}

function summarizePlayer(rows, gates) {
  const battingRows = rows.filter((row) => row.roleType === "batting");
  const bowlingRows = rows.filter((row) => row.roleType === "bowling");
  const wicketkeepingRows = rows.filter((row) => row.roleType === "wicketkeeping");
  const scoringRows = rows.filter(
    (row) => row.roleType === "batting" || row.roleType === "bowling" || row.roleType === "wicketkeeping"
  );

  const matchIds = [...new Set(rows.map((row) => row.matchId).filter(Boolean))];
  const battingMatchIds = [...new Set(battingRows.map((row) => row.matchId).filter(Boolean))];
  const bowlingMatchIds = [...new Set(bowlingRows.map((row) => row.matchId).filter(Boolean))];
  const battingBalls = battingRows.reduce((sum, row) => sum + (toInteger(row.ballsFaced) || 0), 0);
  const bowlingBalls = bowlingRows.reduce(
    (sum, row) => sum + (toInteger(row.legalBallsBowled) || 0),
    0
  );
  const rawRuns = battingRows.reduce((sum, row) => sum + (toInteger(row.batterRuns) || 0), 0);
  const rawWickets = bowlingRows.reduce((sum, row) => {
    const legalBalls = toInteger(row.legalBallsBowled) || 0;
    const wicketBallPct = toNumber(row.wicketBallPct, 0);
    return sum + Math.round(legalBalls * wicketBallPct);
  }, 0);
  const fieldingImpactRaw = rows.reduce((sum, row) => sum + toNumber(row.fieldingImpactScore, 0), 0);

  const battingMetricRaw = battingBalls
    ? weightedAverage(
        battingRows.map(
          (row) =>
            toNumber(row.matchImpactScore, 0) * 0.5 +
            toNumber(row.playerStrengthAdjustedScore, 0) * 0.25 +
            toNumber(row.leverageAdjustedScore, 0) * 0.25
        ),
        battingRows.map((row) => Math.max(toInteger(row.ballsFaced) || 0, 1)),
        0
      )
    : 0;
  const bowlingMetricRaw = bowlingBalls
    ? weightedAverage(
        bowlingRows.map(
          (row) =>
            toNumber(row.matchImpactScore, 0) * 0.5 +
            toNumber(row.playerStrengthAdjustedScore, 0) * 0.25 +
            toNumber(row.leverageAdjustedScore, 0) * 0.25
        ),
        bowlingRows.map((row) => Math.max(toInteger(row.legalBallsBowled) || 0, 1)),
        0
      )
    : 0;

  const leverageRows = scoringRows.length ? scoringRows : rows;
  const leverageRaw = average(
    leverageRows.map((row) => toNumber(row.leverageAdjustedScore, 0)),
    0
  );
  const strongOppositionRaw = average(
    leverageRows.map((row) => toNumber(row.teamStrengthAdjustedScore, 0)),
    0
  );

  const matchScoreMap = new Map();
  for (const row of rows) {
    if (!row.matchId) {
      continue;
    }
    const bucket = matchScoreMap.get(row.matchId) || {
      matchDate: row.matchDate,
      scores: [],
    };
    bucket.matchDate = bucket.matchDate || row.matchDate;
    bucket.scores.push(toNumber(row.matchImpactScore, 0));
    matchScoreMap.set(row.matchId, bucket);
  }

  const matchScores = [...matchScoreMap.values()]
    .map((entry) => ({
      matchDate: entry.matchDate,
      score: average(entry.scores, 0),
    }))
    .sort((left, right) => {
      const leftTime = left.matchDate ? new Date(left.matchDate).getTime() : 0;
      const rightTime = right.matchDate ? new Date(right.matchDate).getTime() : 0;
      return leftTime - rightTime;
    });

  const matchScoreValues = matchScores.map((entry) => entry.score);
  const recentScores = matchScoreValues.slice(-2);
  const consistencyRaw =
    matchScoreValues.length >= 2 ? safeDivide(1, 1 + standardDeviation(matchScoreValues), 0) : 0;
  const recentFormRaw = recentScores.length ? average(recentScores, 0) : 0;
  const developmentTrendRaw =
    matchScoreValues.length >= 2 ? linearTrend(matchScoreValues) : 0;

  const roleType = determineRoleType({
    gates,
    battingBalls,
    battingMatchCount: battingMatchIds.length,
    bowlingBalls,
    bowlingMatchCount: bowlingMatchIds.length,
    rawRuns,
    rawWickets,
    wicketkeepingEventCount: wicketkeepingRows.length,
    battingMetricRaw,
    bowlingMetricRaw,
  });

  const versatilityScore = buildVersatilityScore({
    roleType,
    secondarySkillPresent:
      battingRows.length > 0 && bowlingRows.length > 0 && roleType !== "batting_all_rounder" && roleType !== "bowling_all_rounder",
    fieldingImpactRaw,
  });

  const confidenceScore = buildConfidenceScore({
    gates,
    roleType,
    matchesPlayed: matchIds.length,
    battingBalls,
    bowlingBalls,
    wicketkeepingEventCount: wicketkeepingRows.length,
  });

  return {
    divisionId: toInteger(rows[0]?.divisionId),
    playerId: toInteger(rows[0]?.playerId),
    teamId: modeValue(rows.map((row) => row.teamId)),
    matchesPlayed: matchIds.length,
    inningsCount: battingRows.length + bowlingRows.length,
    ballsSample: battingBalls + bowlingBalls,
    rawRuns,
    rawWickets,
    roleType,
    battingBalls,
    bowlingBalls,
    wicketkeepingEventCount: wicketkeepingRows.length,
    battingMetricRaw: roundMetric(battingMetricRaw),
    bowlingMetricRaw: roundMetric(bowlingMetricRaw),
    leverageRaw: roundMetric(leverageRaw),
    consistencyRaw: roundMetric(consistencyRaw, 6),
    fieldingImpactRaw: roundMetric(fieldingImpactRaw),
    strongOppositionRaw: roundMetric(strongOppositionRaw),
    recentFormRaw: roundMetric(recentFormRaw),
    developmentTrendRaw: roundMetric(developmentTrendRaw, 6),
    versatilityScore,
    confidenceScore,
  };
}

function buildPlayerSeasonAdvancedRows(playerMatchAdvancedRows, options = {}) {
  const gates = options.qualityGates || {};
  const groups = new Map();

  for (const row of Array.isArray(playerMatchAdvancedRows) ? playerMatchAdvancedRows : []) {
    const divisionId = toInteger(row.divisionId);
    const playerId = toInteger(row.playerId);
    if (!divisionId || !playerId) {
      continue;
    }

    const key = `${divisionId}:${playerId}`;
    const bucket = groups.get(key) || [];
    bucket.push({
      divisionId,
      playerId,
      teamId: toInteger(row.teamId),
      roleType: normalizeText(row.roleType),
      matchId: toInteger(row.matchId),
      matchDate: row.matchDate,
      ballsFaced: toInteger(row.ballsFaced),
      batterRuns: toInteger(row.batterRuns),
      legalBallsBowled: toInteger(row.legalBallsBowled),
      totalRunsConceded: toInteger(row.totalRunsConceded),
      wicketBallPct: toNumber(row.wicketBallPct, 0),
      fieldingImpactScore: toNumber(row.fieldingImpactScore, 0),
      teamStrengthAdjustedScore: toNumber(row.teamStrengthAdjustedScore, 0),
      playerStrengthAdjustedScore: toNumber(row.playerStrengthAdjustedScore, 0),
      leverageAdjustedScore: toNumber(row.leverageAdjustedScore, 0),
      matchImpactScore: toNumber(row.matchImpactScore, 0),
    });
    groups.set(key, bucket);
  }

  const summaries = [...groups.values()].map((rows) => summarizePlayer(rows, gates));
  const divisionBuckets = new Map();

  for (const summary of summaries) {
    const bucket = divisionBuckets.get(summary.divisionId) || [];
    bucket.push(summary);
    divisionBuckets.set(summary.divisionId, bucket);
  }

  const seasonRows = [];

  for (const divisionSummaries of divisionBuckets.values()) {
    const battingValues = divisionSummaries
      .filter((entry) => entry.battingBalls > 0)
      .map((entry) => entry.battingMetricRaw);
    const bowlingValues = divisionSummaries
      .filter((entry) => entry.bowlingBalls > 0)
      .map((entry) => entry.bowlingMetricRaw);
    const leverageValues = divisionSummaries.map((entry) => entry.leverageRaw);
    const consistencyValues = divisionSummaries
      .filter((entry) => entry.matchesPlayed >= 2)
      .map((entry) => entry.consistencyRaw);
    const fieldingValues = divisionSummaries
      .filter((entry) => entry.fieldingImpactRaw > 0)
      .map((entry) => entry.fieldingImpactRaw);
    const strongOppositionValues = divisionSummaries.map((entry) => entry.strongOppositionRaw);
    const recentFormValues = divisionSummaries
      .filter((entry) => entry.matchesPlayed > 0)
      .map((entry) => entry.recentFormRaw);
    const developmentTrendValues = divisionSummaries
      .filter((entry) => entry.matchesPlayed >= 2)
      .map((entry) => entry.developmentTrendRaw);

    for (const summary of divisionSummaries) {
      seasonRows.push({
        divisionId: summary.divisionId,
        playerId: summary.playerId,
        teamId: summary.teamId,
        roleType: summary.roleType,
        matchesPlayed: summary.matchesPlayed,
        inningsCount: summary.inningsCount,
        ballsSample: summary.ballsSample,
        rawRuns: summary.rawRuns,
        rawWickets: summary.rawWickets,
        battingWeightedEfficiency:
          summary.battingBalls > 0
            ? percentileScore(summary.battingMetricRaw, battingValues, { neutral: 0 })
            : 0,
        bowlingWeightedEfficiency:
          summary.bowlingBalls > 0
            ? percentileScore(summary.bowlingMetricRaw, bowlingValues, { neutral: 0 })
            : 0,
        leverageScore: percentileScore(summary.leverageRaw, leverageValues, { neutral: 0 }),
        consistencyScore:
          summary.matchesPlayed >= 2
            ? percentileScore(summary.consistencyRaw, consistencyValues, { neutral: 50 })
            : 50,
        versatilityScore: roundMetric(summary.versatilityScore),
        fieldingScore:
          summary.fieldingImpactRaw > 0
            ? percentileScore(summary.fieldingImpactRaw, fieldingValues, { neutral: 0 })
            : 0,
        strongOppositionScore: percentileScore(summary.strongOppositionRaw, strongOppositionValues, {
          neutral: 0,
        }),
        recentFormScore:
          summary.matchesPlayed > 0
            ? percentileScore(summary.recentFormRaw, recentFormValues, { neutral: 50 })
            : 50,
        developmentTrendScore:
          summary.matchesPlayed >= 2
            ? percentileScore(summary.developmentTrendRaw, developmentTrendValues, {
                neutral: 50,
              })
            : 50,
        confidenceScore: summary.confidenceScore,
      });
    }
  }

  return {
    rows: seasonRows,
    summary: {
      playerCount: seasonRows.length,
      divisionCount: divisionBuckets.size,
      roleCounts: seasonRows.reduce((accumulator, row) => {
        const roleKey = normalizeText(row.roleType) || "unclassified";
        accumulator[roleKey] = (accumulator[roleKey] || 0) + 1;
        return accumulator;
      }, {}),
    },
  };
}

module.exports = {
  buildPlayerSeasonAdvancedRows,
};

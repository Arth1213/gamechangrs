const { normalizeText, toInteger, toNumber } = require("../lib/cricket");

function roundMetric(value, digits = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Number(parsed.toFixed(digits));
}

function percentileScore(value, values, options = {}) {
  const filtered = values.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry));
  const numeric = Number(value);
  const neutral = Number.isFinite(Number(options.neutral)) ? Number(options.neutral) : 0;

  if (!Number.isFinite(numeric) || !filtered.length) {
    return neutral;
  }

  if (filtered.length === 1) {
    return roundMetric(filtered[0] === numeric ? 100 : neutral, 4);
  }

  const sorted = [...filtered].sort((left, right) => left - right);
  let lessCount = 0;
  let equalCount = 0;

  for (const entry of sorted) {
    if (entry < numeric) {
      lessCount += 1;
    } else if (entry === numeric) {
      equalCount += 1;
    }
  }

  const rank = lessCount + Math.max(equalCount - 1, 0) / 2;
  return roundMetric((rank / (sorted.length - 1)) * 100, 4);
}

function buildWeightLookup(weightRows) {
  const lookup = new Map();

  for (const row of Array.isArray(weightRows) ? weightRows : []) {
    const roleType = normalizeText(row.primaryRole);
    const componentKey = normalizeText(row.componentKey);
    if (!roleType || !componentKey) {
      continue;
    }

    const roleMap = lookup.get(roleType) || new Map();
    roleMap.set(componentKey, toNumber(row.weightValue, 0));
    lookup.set(roleType, roleMap);
  }

  return lookup;
}

function averageDevelopmentScore(row) {
  return roundMetric(
    (toNumber(row.recentFormScore, 0) + toNumber(row.developmentTrendScore, 0)) / 2,
    4
  );
}

function resolveComponentValue(componentKey, row) {
  const key = normalizeText(componentKey);

  switch (key) {
    case "batting_efficiency":
      return toNumber(row.battingScore, 0);
    case "bowling_efficiency":
      return toNumber(row.bowlingScore, 0);
    case "fielding":
      return toNumber(row.fieldingScore, 0);
    case "wicketkeeping":
      return toNumber(row.wicketkeepingScore, 0);
    case "leverage":
      return toNumber(row.leverageScore, 0);
    case "consistency":
      return toNumber(row.consistencyScore, 0);
    case "versatility":
      return toNumber(row.versatilityScore, 0);
    case "strong_opposition":
      return toNumber(row.strongOppositionScore, 0);
    case "development":
      return toNumber(row.developmentScore, 0);
    default:
      return 0;
  }
}

function computeCompositeScore(weightMap, row) {
  let weightedSum = 0;

  for (const [componentKey, weightValue] of weightMap.entries()) {
    weightedSum += resolveComponentValue(componentKey, row) * toNumber(weightValue, 0);
  }

  return roundMetric(weightedSum, 4);
}

function buildPlayerCompositeRows(seasonRows, weightRows, wicketkeepingRows) {
  const weightLookup = buildWeightLookup(weightRows);
  const wicketkeepingLookup = new Map();

  for (const row of Array.isArray(wicketkeepingRows) ? wicketkeepingRows : []) {
    const key = `${toInteger(row.divisionId)}:${toInteger(row.playerId)}`;
    wicketkeepingLookup.set(key, toNumber(row.wicketkeepingScore, 0));
  }

  const stagedRows = (Array.isArray(seasonRows) ? seasonRows : []).map((row) => {
    const roleType = normalizeText(row.roleType);
    const weightMap = weightLookup.get(roleType) || weightLookup.get("batting") || new Map();
    const wicketkeepingScore =
      wicketkeepingLookup.get(`${toInteger(row.divisionId)}:${toInteger(row.playerId)}`) || 0;

    const staged = {
      divisionId: toInteger(row.divisionId),
      playerId: toInteger(row.playerId),
      teamId: toInteger(row.teamId),
      roleType,
      battingScore: toNumber(row.battingWeightedEfficiency, 0),
      bowlingScore: toNumber(row.bowlingWeightedEfficiency, 0),
      fieldingScore: toNumber(row.fieldingScore, 0),
      leverageScore: toNumber(row.leverageScore, 0),
      consistencyScore: toNumber(row.consistencyScore, 0),
      versatilityScore: toNumber(row.versatilityScore, 0),
      strongOppositionScore: toNumber(row.strongOppositionScore, 0),
      developmentScore: averageDevelopmentScore(row),
      wicketkeepingScore,
    };

    return {
      ...staged,
      compositeScore: computeCompositeScore(weightMap, staged),
    };
  });

  const divisionBuckets = new Map();
  for (const row of stagedRows) {
    const bucket = divisionBuckets.get(row.divisionId) || [];
    bucket.push(row);
    divisionBuckets.set(row.divisionId, bucket);
  }

  const rows = [];
  for (const bucketRows of divisionBuckets.values()) {
    const compositeValues = bucketRows.map((row) => row.compositeScore);
    for (const row of bucketRows) {
      rows.push({
        divisionId: row.divisionId,
        playerId: row.playerId,
        teamId: row.teamId,
        battingScore: roundMetric(row.battingScore),
        bowlingScore: roundMetric(row.bowlingScore),
        fieldingScore: roundMetric(row.fieldingScore),
        leverageScore: roundMetric(row.leverageScore),
        consistencyScore: roundMetric(row.consistencyScore),
        versatilityScore: roundMetric(row.versatilityScore),
        strongOppositionScore: roundMetric(row.strongOppositionScore),
        developmentScore: roundMetric(row.developmentScore),
        compositeScore: roundMetric(row.compositeScore),
        percentileRank: percentileScore(row.compositeScore, compositeValues, { neutral: 100 }),
      });
    }
  }

  return {
    rows,
    summary: {
      playerCount: rows.length,
      divisionCount: divisionBuckets.size,
    },
  };
}

module.exports = {
  buildPlayerCompositeRows,
};

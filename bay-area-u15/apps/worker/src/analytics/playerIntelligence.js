const { normalizeText, toInteger, toNumber } = require("../lib/cricket");

function roundMetric(value, digits = 4) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
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

function average(values) {
  const filtered = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function rateOrNull(numerator, denominator, multiplier = 1, digits = 2) {
  const right = Number(denominator);
  if (!Number.isFinite(right) || right <= 0) {
    return null;
  }
  return roundMetric(safeDivide(numerator * multiplier, denominator, 0), digits);
}

function normalizePhase(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.includes("powerplay")) {
    return "powerplay";
  }
  if (normalized.includes("death")) {
    return "death";
  }
  return "middle";
}

function isHighLeverageEvent(event) {
  return normalizePhase(event.phase) === "death" || toNumber(event.leverageScore, 1) > 1.05;
}

function buildScopeEntries(divisionId) {
  const entries = [{ scopeType: "series", divisionId: null }];
  if (toInteger(divisionId)) {
    entries.push({ scopeType: "division", divisionId: toInteger(divisionId) });
  }
  return entries;
}

function humanizeBucket(group, value, rawLabel) {
  const normalized = normalizeText(value);
  if (group === "overall") {
    return "Overall";
  }

  const map = {
    right_arm_pace: "Right-Arm Pace",
    left_arm_pace: "Left-Arm Pace",
    off_spinner: "Off-Spin",
    leg_spinner: "Leg-Spin",
    left_arm_spinner: "Left-Arm Spin",
    spinner: "Spin",
    pace: "Pace",
    right: "Right-Hand Batter",
    left: "Left-Hand Batter",
    unknown: "Unknown",
  };

  if (map[normalized]) {
    return map[normalized];
  }

  if (normalizeText(rawLabel)) {
    return normalizeText(rawLabel);
  }

  return normalized
    ? normalized
        .split("_")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ")
    : "Unknown";
}

function createMatchupBucket(scopeType, divisionId, playerId, perspective, splitGroup, splitValue, splitLabel, phaseBucket) {
  return {
    scopeType,
    divisionId: toInteger(divisionId),
    playerId: toInteger(playerId),
    perspective,
    splitGroup,
    splitValue,
    splitLabel,
    phaseBucket,
    matchIds: new Set(),
    deliveryEvents: 0,
    legalBalls: 0,
    runsScored: 0,
    runsConceded: 0,
    dismissals: 0,
    wickets: 0,
    dotBalls: 0,
    boundaries: 0,
    wides: 0,
    noBalls: 0,
  };
}

function createProfileBucket(scopeType, divisionId, playerId) {
  return {
    scopeType,
    divisionId: toInteger(divisionId),
    playerId: toInteger(playerId),
    battingMatchIds: new Set(),
    bowlingMatchIds: new Set(),
    battingLegalBalls: 0,
    bowlingLegalBalls: 0,
    battingRotationEvents: 0,
    battingBoundaryEvents: 0,
    battingHighLeverageBalls: 0,
    battingHighLeverageRuns: 0,
    bowlingHighLeverageBalls: 0,
    bowlingHighLeverageRuns: 0,
    bowlingPressureEvents: 0,
    bowlingPressureControlErrors: 0,
    boundaryDotSamples: [],
    dismissalDotSamples: [],
    boundaryAfterThreeDotsOpportunities: 0,
    boundaryAfterThreeDotsSuccesses: 0,
    dismissalAfterThreeDotsOpportunities: 0,
    dismissalAfterThreeDotsSuccesses: 0,
  };
}

function makeMatchupKey(bucket) {
  return [
    bucket.scopeType,
    bucket.divisionId || "all",
    bucket.playerId,
    bucket.perspective,
    bucket.splitGroup,
    bucket.splitValue,
    bucket.phaseBucket,
  ].join(":");
}

function makeProfileKey(scopeType, divisionId, playerId) {
  return [scopeType, divisionId || "all", playerId].join(":");
}

function makeDismissalKey(scopeType, divisionId, playerId, bowlerStyleBucket, dismissalType) {
  return [scopeType, divisionId || "all", playerId, bowlerStyleBucket, dismissalType].join(":");
}

function getOrCreateMatchupBucket(map, metadata) {
  const key = makeMatchupKey(metadata);
  if (!map.has(key)) {
    map.set(
      key,
      createMatchupBucket(
        metadata.scopeType,
        metadata.divisionId,
        metadata.playerId,
        metadata.perspective,
        metadata.splitGroup,
        metadata.splitValue,
        metadata.splitLabel,
        metadata.phaseBucket
      )
    );
  }
  return map.get(key);
}

function getOrCreateProfileBucket(map, scopeType, divisionId, playerId) {
  const key = makeProfileKey(scopeType, divisionId, playerId);
  if (!map.has(key)) {
    map.set(key, createProfileBucket(scopeType, divisionId, playerId));
  }
  return map.get(key);
}

function updateBattingMatchup(bucket, event) {
  bucket.matchIds.add(event.matchId);

  if (event.isLegalBall) {
    bucket.deliveryEvents += 1;
    bucket.legalBalls += 1;
    if (toInteger(event.totalRuns) === 0) {
      bucket.dotBalls += 1;
    }
  }

  bucket.runsScored += toInteger(event.batterRuns) || 0;
  if ([4, 6].includes(toInteger(event.batterRuns))) {
    bucket.boundaries += 1;
  }
  if (event.wicketFlag && toInteger(event.playerOutId) === toInteger(event.strikerPlayerId)) {
    bucket.dismissals += 1;
  }
}

function updateBowlingMatchup(bucket, event) {
  bucket.matchIds.add(event.matchId);
  bucket.deliveryEvents += 1;

  if (event.isLegalBall) {
    bucket.legalBalls += 1;
    if (toInteger(event.totalRuns) === 0) {
      bucket.dotBalls += 1;
    }
  }

  bucket.runsConceded += toInteger(event.totalRuns) || 0;
  if ([4, 6].includes(toInteger(event.batterRuns))) {
    bucket.boundaries += 1;
  }
  if (normalizeText(event.extraType) === "wide") {
    bucket.wides += 1;
  }
  if (normalizeText(event.extraType) === "no_ball") {
    bucket.noBalls += 1;
  }
  if (event.wicketFlag && event.wicketCreditedToBowler) {
    bucket.wickets += 1;
  }
}

function finalizeMatchupBuckets(matchupMap) {
  return [...matchupMap.values()].map((bucket) => ({
    scopeType: bucket.scopeType,
    divisionId: bucket.divisionId,
    playerId: bucket.playerId,
    perspective: bucket.perspective,
    splitGroup: bucket.splitGroup,
    splitValue: bucket.splitValue,
    splitLabel: bucket.splitLabel,
    phaseBucket: bucket.phaseBucket,
    matchCount: bucket.matchIds.size,
    deliveryEvents: bucket.deliveryEvents,
    legalBalls: bucket.legalBalls,
    runsScored: bucket.runsScored,
    runsConceded: bucket.runsConceded,
    dismissals: bucket.dismissals,
    wickets: bucket.wickets,
    dotBalls: bucket.dotBalls,
    boundaries: bucket.boundaries,
    wides: bucket.wides,
    noBalls: bucket.noBalls,
    strikeRate:
      bucket.perspective === "batting"
        ? rateOrNull(bucket.runsScored, bucket.legalBalls, 100, 2)
        : null,
    economy:
      bucket.perspective === "bowling"
        ? rateOrNull(bucket.runsConceded, bucket.legalBalls, 6, 2)
        : null,
    battingAverage:
      bucket.perspective === "batting"
        ? rateOrNull(bucket.runsScored, bucket.dismissals, 1, 2)
        : null,
    ballsPerDismissal:
      bucket.perspective === "batting"
        ? rateOrNull(bucket.legalBalls, bucket.dismissals, 1, 2)
        : null,
    ballsPerWicket:
      bucket.perspective === "bowling"
        ? rateOrNull(bucket.legalBalls, bucket.wickets, 1, 2)
        : null,
    dotBallPct: rateOrNull(bucket.dotBalls, bucket.legalBalls, 100, 2),
    boundaryBallPct: rateOrNull(bucket.boundaries, bucket.legalBalls, 100, 2),
    controlErrorPct:
      bucket.perspective === "bowling"
        ? rateOrNull(bucket.wides + bucket.noBalls, bucket.deliveryEvents, 100, 2)
        : null,
  }));
}

function finalizeDismissalBuckets(dismissalMap) {
  return [...dismissalMap.values()].map((bucket) => ({
    scopeType: bucket.scopeType,
    divisionId: bucket.divisionId,
    playerId: bucket.playerId,
    bowlerStyleBucket: bucket.bowlerStyleBucket,
    bowlerStyleLabel: bucket.bowlerStyleLabel,
    dismissalType: bucket.dismissalType,
    dismissalCount: bucket.dismissalCount,
    matchCount: bucket.matchIds.size,
    averageRunsAtDismissal: roundMetric(average(bucket.runsAtDismissal), 2),
    averageBallsFacedAtDismissal: roundMetric(average(bucket.ballsAtDismissal), 2),
  }));
}

function finalizeProfileBuckets(profileMap) {
  return [...profileMap.values()].map((bucket) => ({
    scopeType: bucket.scopeType,
    divisionId: bucket.divisionId,
    playerId: bucket.playerId,
    battingMatchCount: bucket.battingMatchIds.size,
    bowlingMatchCount: bucket.bowlingMatchIds.size,
    battingLegalBalls: bucket.battingLegalBalls,
    bowlingLegalBalls: bucket.bowlingLegalBalls,
    battingRotationRatio: rateOrNull(
      bucket.battingRotationEvents,
      bucket.battingBoundaryEvents,
      1,
      2
    ),
    battingHighLeverageStrikeRate: rateOrNull(
      bucket.battingHighLeverageRuns,
      bucket.battingHighLeverageBalls,
      100,
      2
    ),
    bowlingHighLeverageEconomy: rateOrNull(
      bucket.bowlingHighLeverageRuns,
      bucket.bowlingHighLeverageBalls,
      6,
      2
    ),
    bowlingPressureControlErrorPct: rateOrNull(
      bucket.bowlingPressureControlErrors,
      bucket.bowlingPressureEvents,
      100,
      2
    ),
    boundaryDotThreshold: roundMetric(average(bucket.boundaryDotSamples), 2),
    dismissalDotThreshold: roundMetric(average(bucket.dismissalDotSamples), 2),
    boundaryAfterThreeDotsPct: rateOrNull(
      bucket.boundaryAfterThreeDotsSuccesses,
      bucket.boundaryAfterThreeDotsOpportunities,
      100,
      2
    ),
    dismissalAfterThreeDotsPct: rateOrNull(
      bucket.dismissalAfterThreeDotsSuccesses,
      bucket.dismissalAfterThreeDotsOpportunities,
      100,
      2
    ),
  }));
}

function buildPlayerIntelligenceRows(eventRows, dismissalRows) {
  const matchupMap = new Map();
  const dismissalMap = new Map();
  const profileMap = new Map();
  const battingStreams = new Map();

  for (const event of Array.isArray(eventRows) ? eventRows : []) {
    const matchId = toInteger(event.matchId);
    const divisionId = toInteger(event.divisionId);
    const strikerPlayerId = toInteger(event.strikerPlayerId);
    const bowlerPlayerId = toInteger(event.bowlerPlayerId);
    const phaseBucket = normalizePhase(event.phase);
    const highLeverage = isHighLeverageEvent(event);
    const scopes = buildScopeEntries(divisionId);

    if (strikerPlayerId) {
      const streamKey = [
        matchId,
        toInteger(event.inningsId) || `${matchId}:${toInteger(event.inningsNo) || 0}`,
        strikerPlayerId,
      ].join(":");
      const stream = battingStreams.get(streamKey) || [];
      stream.push(event);
      battingStreams.set(streamKey, stream);

      for (const scope of scopes) {
        const profile = getOrCreateProfileBucket(
          profileMap,
          scope.scopeType,
          scope.divisionId,
          strikerPlayerId
        );
        profile.battingMatchIds.add(matchId);
        if (event.isLegalBall) {
          profile.battingLegalBalls += 1;
          if ([1, 2, 3].includes(toInteger(event.batterRuns))) {
            profile.battingRotationEvents += 1;
          }
          if ([4, 6].includes(toInteger(event.batterRuns))) {
            profile.battingBoundaryEvents += 1;
          }
          if (highLeverage) {
            profile.battingHighLeverageBalls += 1;
            profile.battingHighLeverageRuns += toInteger(event.batterRuns) || 0;
          }
        }

        const battingOverall = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: strikerPlayerId,
          perspective: "batting",
          splitGroup: "overall",
          splitValue: "overall",
          splitLabel: "Overall",
          phaseBucket: "overall",
        });
        updateBattingMatchup(battingOverall, event);

        const battingPhase = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: strikerPlayerId,
          perspective: "batting",
          splitGroup: "overall",
          splitValue: "overall",
          splitLabel: "Overall",
          phaseBucket,
        });
        updateBattingMatchup(battingPhase, event);

        const splitValue = normalizeText(event.bowlerStyleBucket) || "unknown";
        const splitLabel = humanizeBucket(
          "bowler_style_bucket",
          splitValue,
          event.bowlerStyle || event.bowlerStyleDetail
        );

        const battingMatchupOverall = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: strikerPlayerId,
          perspective: "batting",
          splitGroup: "bowler_style_bucket",
          splitValue,
          splitLabel,
          phaseBucket: "overall",
        });
        updateBattingMatchup(battingMatchupOverall, event);

        const battingMatchupPhase = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: strikerPlayerId,
          perspective: "batting",
          splitGroup: "bowler_style_bucket",
          splitValue,
          splitLabel,
          phaseBucket,
        });
        updateBattingMatchup(battingMatchupPhase, event);
      }
    }

    if (bowlerPlayerId) {
      for (const scope of scopes) {
        const profile = getOrCreateProfileBucket(
          profileMap,
          scope.scopeType,
          scope.divisionId,
          bowlerPlayerId
        );
        profile.bowlingMatchIds.add(matchId);
        if (event.isLegalBall) {
          profile.bowlingLegalBalls += 1;
          if (highLeverage) {
            profile.bowlingHighLeverageBalls += 1;
            profile.bowlingHighLeverageRuns += toInteger(event.totalRuns) || 0;
          }
        }
        if (highLeverage) {
          profile.bowlingPressureEvents += 1;
          if (["wide", "no_ball"].includes(normalizeText(event.extraType))) {
            profile.bowlingPressureControlErrors += 1;
          }
        }

        const bowlingOverall = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: bowlerPlayerId,
          perspective: "bowling",
          splitGroup: "overall",
          splitValue: "overall",
          splitLabel: "Overall",
          phaseBucket: "overall",
        });
        updateBowlingMatchup(bowlingOverall, event);

        const bowlingPhase = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: bowlerPlayerId,
          perspective: "bowling",
          splitGroup: "overall",
          splitValue: "overall",
          splitLabel: "Overall",
          phaseBucket,
        });
        updateBowlingMatchup(bowlingPhase, event);

        const splitValue = normalizeText(event.strikerBattingHand) || "unknown";
        const splitLabel = humanizeBucket(
          "batter_hand",
          splitValue,
          event.strikerBattingStyle || event.strikerBattingStyleBucket
        );

        const bowlingMatchupOverall = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: bowlerPlayerId,
          perspective: "bowling",
          splitGroup: "batter_hand",
          splitValue,
          splitLabel,
          phaseBucket: "overall",
        });
        updateBowlingMatchup(bowlingMatchupOverall, event);

        const bowlingMatchupPhase = getOrCreateMatchupBucket(matchupMap, {
          scopeType: scope.scopeType,
          divisionId: scope.divisionId,
          playerId: bowlerPlayerId,
          perspective: "bowling",
          splitGroup: "batter_hand",
          splitValue,
          splitLabel,
          phaseBucket,
        });
        updateBowlingMatchup(bowlingMatchupPhase, event);
      }
    }
  }

  for (const stream of battingStreams.values()) {
    const ordered = [...stream].sort(
      (left, right) =>
        (toInteger(left.eventIndex) || 0) - (toInteger(right.eventIndex) || 0) ||
        (toInteger(left.overNo) || 0) - (toInteger(right.overNo) || 0) ||
        (toInteger(left.ballInOver) || 0) - (toInteger(right.ballInOver) || 0)
    );

    let dotStreak = 0;
    for (const event of ordered) {
      if (!event.isLegalBall || !toInteger(event.strikerPlayerId)) {
        continue;
      }

      const scopes = buildScopeEntries(event.divisionId);
      const isBoundary = [4, 6].includes(toInteger(event.batterRuns));
      const isDismissal =
        event.wicketFlag && toInteger(event.playerOutId) === toInteger(event.strikerPlayerId);

      for (const scope of scopes) {
        const profile = getOrCreateProfileBucket(
          profileMap,
          scope.scopeType,
          scope.divisionId,
          event.strikerPlayerId
        );

        if (dotStreak >= 3) {
          profile.boundaryAfterThreeDotsOpportunities += 1;
          profile.dismissalAfterThreeDotsOpportunities += 1;
          if (isBoundary) {
            profile.boundaryAfterThreeDotsSuccesses += 1;
          }
          if (isDismissal) {
            profile.dismissalAfterThreeDotsSuccesses += 1;
          }
        }

        if (isBoundary && dotStreak > 0) {
          profile.boundaryDotSamples.push(dotStreak);
        }
        if (isDismissal && dotStreak > 0) {
          profile.dismissalDotSamples.push(dotStreak);
        }
      }

      if (!isBoundary && !isDismissal && toInteger(event.totalRuns) === 0) {
        dotStreak += 1;
      } else {
        dotStreak = 0;
      }
    }
  }

  for (const row of Array.isArray(dismissalRows) ? dismissalRows : []) {
    const playerId = toInteger(row.playerId);
    if (!playerId || !normalizeText(row.dismissalType) || normalizeText(row.dismissalType) === "not_out") {
      continue;
    }

    const scopes = buildScopeEntries(row.divisionId);
    const bowlerStyleBucket = normalizeText(row.bowlerStyleBucket) || "unknown";
    const bowlerStyleLabel = humanizeBucket(
      "bowler_style_bucket",
      bowlerStyleBucket,
      row.bowlerStyle || row.bowlerStyleDetail
    );
    const dismissalType = normalizeText(row.dismissalType);

    for (const scope of scopes) {
      const key = makeDismissalKey(
        scope.scopeType,
        scope.divisionId,
        playerId,
        bowlerStyleBucket,
        dismissalType
      );

      if (!dismissalMap.has(key)) {
        dismissalMap.set(key, {
          scopeType: scope.scopeType,
          divisionId: toInteger(scope.divisionId),
          playerId,
          bowlerStyleBucket,
          bowlerStyleLabel,
          dismissalType,
          matchIds: new Set(),
          dismissalCount: 0,
          runsAtDismissal: [],
          ballsAtDismissal: [],
        });
      }

      const bucket = dismissalMap.get(key);
      bucket.matchIds.add(toInteger(row.matchId));
      bucket.dismissalCount += 1;
      bucket.runsAtDismissal.push(toInteger(row.runs) || 0);
      bucket.ballsAtDismissal.push(toInteger(row.ballsFaced) || 0);
    }
  }

  const matchupRows = finalizeMatchupBuckets(matchupMap);
  const dismissalRowsFinal = finalizeDismissalBuckets(dismissalMap);
  const profileRows = finalizeProfileBuckets(profileMap);

  return {
    matchupRows,
    dismissalRows: dismissalRowsFinal,
    profileRows,
    summary: {
      matchupRowCount: matchupRows.length,
      dismissalRowCount: dismissalRowsFinal.length,
      profileRowCount: profileRows.length,
      battingPlayerCount: new Set(
        matchupRows
          .filter((row) => row.perspective === "batting" && row.splitGroup === "overall" && row.phaseBucket === "overall")
          .map((row) => row.playerId)
      ).size,
      bowlingPlayerCount: new Set(
        matchupRows
          .filter((row) => row.perspective === "bowling" && row.splitGroup === "overall" && row.phaseBucket === "overall")
          .map((row) => row.playerId)
      ).size,
    },
  };
}

module.exports = {
  buildPlayerIntelligenceRows,
};

const { normalizeText, toNumber } = require("../lib/cricket");

function clampNumber(value, minimum = 0, maximum = 999999) {
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

function keyForInningsPlayer(inningsNo, sourcePlayerId) {
  return `${inningsNo}:${normalizeText(sourcePlayerId)}`;
}

function buildBattingLookup(scorecard) {
  const lookup = new Map();
  for (const innings of scorecard?.battingInnings || []) {
    const sourcePlayerId = normalizeText(innings?.playerSourceId);
    if (!sourcePlayerId) {
      continue;
    }
    lookup.set(keyForInningsPlayer(innings.inningsNo, sourcePlayerId), innings);
  }
  return lookup;
}

function buildPlayerRegistry(scorecard) {
  const registry = new Map();
  for (const player of scorecard?.playerRegistry || []) {
    const sourcePlayerId = normalizeText(player?.sourcePlayerId);
    if (sourcePlayerId) {
      registry.set(sourcePlayerId, player);
    }
  }
  return registry;
}

function buildInningsLookup(scorecard) {
  const lookup = new Map();
  for (const innings of scorecard?.innings || []) {
    lookup.set(innings.inningsNo, innings);
  }
  return lookup;
}

function getWeight(weightsConfig, path, fallback = 1) {
  let cursor = weightsConfig;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
      return fallback;
    }
    cursor = cursor[key];
  }
  return toNumber(cursor, fallback);
}

function getPhaseWeight(weightsConfig, discipline, phase) {
  return getWeight(weightsConfig, ["phase_weighting", discipline, normalizeText(phase) || "middle"], 1);
}

function getDefaultParseConfidence(weightsConfig) {
  return getWeight(weightsConfig, ["parsing", "default_parse_confidence"], 0.9);
}

function buildAnnotatedBallEvents(matchFacts, weightsConfig) {
  const battingLookup = buildBattingLookup(matchFacts?.scorecard);
  const inningsLookup = buildInningsLookup(matchFacts?.scorecard);
  const baseLeverage = getWeight(weightsConfig, ["leverage_weighting", "base"], 1);
  const topOrderWicket = getWeight(weightsConfig, ["leverage_weighting", "top_order_wicket"], 1.1);
  const collapseContext = getWeight(weightsConfig, ["leverage_weighting", "collapse_context"], 1.07);
  const highRateChase = getWeight(weightsConfig, ["leverage_weighting", "chasing_high_required_rate"], 1.1);
  const newBatterWindow = getWeight(weightsConfig, ["leverage_weighting", "new_batter_window"], 1.03);
  const teamWeight = getWeight(weightsConfig, ["team_strength", "base_score"], 1);
  const playerWeight = 1;
  const defaultParseConfidence = getDefaultParseConfidence(weightsConfig);

  return (matchFacts?.commentary?.ballEvents || []).map((event) => {
    const sourcePlayerId = normalizeText(event?.strikerSourcePlayerId);
    const batterContext = battingLookup.get(keyForInningsPlayer(event.inningsNo, sourcePlayerId));
    const inningsContext = inningsLookup.get(event.inningsNo);
    const battingPosition = Number(batterContext?.battingPosition);

    let leverageScore = baseLeverage;

    if (event.wicketFlag && battingPosition >= 1 && battingPosition <= 3) {
      leverageScore *= topOrderWicket;
    }

    if (event.wicketFlag && Number(event.wicketsAfter) >= 4) {
      leverageScore *= collapseContext;
    }

    if (Number(event.eventIndex) <= 12 && battingPosition >= 4) {
      leverageScore *= newBatterWindow;
    }

    const targetRuns = Number(inningsContext?.targetRuns);
    if (Number.isFinite(targetRuns) && targetRuns > 0) {
      const scoreBefore = Math.max(Number(event.scoreAfterRuns || 0) - Number(event.totalRuns || 0), 0);
      const runsRequired = Math.max(targetRuns - scoreBefore, 0);
      const ballsUsedBefore = Number(event.overNo || 0) * 6 + Math.max(Number(event.ballInOver || 1) - 1, 0);
      const ballsRemaining = Math.max(120 - ballsUsedBefore, 1);
      const requiredRate = safeDivide(runsRequired * 6, ballsRemaining, 0);
      if (requiredRate >= 8) {
        leverageScore *= highRateChase;
      }
    }

    const phaseWeight = Math.max(
      getPhaseWeight(weightsConfig, "batting", event.phase),
      getPhaseWeight(weightsConfig, "bowling", event.phase)
    );
    const leverageWeight = leverageScore;
    const totalEventWeight = phaseWeight * leverageWeight * teamWeight * playerWeight;

    return {
      ...event,
      leverageScore: roundMetric(leverageScore),
      opponentTeamWeight: roundMetric(teamWeight),
      opponentPlayerWeight: roundMetric(playerWeight),
      phaseWeight: roundMetric(phaseWeight),
      leverageWeight: roundMetric(leverageWeight),
      totalEventWeight: roundMetric(totalEventWeight),
      parseConfidence: roundMetric(
        toNumber(event.parseConfidence, defaultParseConfidence),
        4
      ),
    };
  });
}

function buildPlayerMatchups(annotatedBallEvents) {
  const matchupMap = new Map();

  for (const event of annotatedBallEvents) {
    const batterId = normalizeText(event?.strikerSourcePlayerId);
    const bowlerId = normalizeText(event?.bowlerSourcePlayerId);
    if (!batterId || !bowlerId) {
      continue;
    }

    const key = `${batterId}:${bowlerId}`;
    const entry = matchupMap.get(key) || {
      batterSourcePlayerId: batterId,
      bowlerSourcePlayerId: bowlerId,
      balls: 0,
      batterRuns: 0,
      totalRuns: 0,
      dismissals: 0,
      dots: 0,
      fours: 0,
      sixes: 0,
      byes: 0,
      legByes: 0,
      wides: 0,
      noBalls: 0,
      weightedRuns: 0,
      weightedDismissals: 0,
    };

    entry.balls += event.isLegalBall ? 1 : 0;
    entry.batterRuns += Number(event.batterRuns || 0);
    entry.totalRuns += Number(event.totalRuns || 0);
    entry.dismissals +=
      event.wicketFlag && event.wicketCreditedToBowler && batterId === normalizeText(event.playerOutSourcePlayerId)
        ? 1
        : 0;
    entry.dots += event.isLegalBall && Number(event.totalRuns || 0) === 0 ? 1 : 0;
    entry.fours += Number(event.batterRuns || 0) === 4 ? 1 : 0;
    entry.sixes += Number(event.batterRuns || 0) === 6 ? 1 : 0;
    entry.byes += normalizeText(event.extraType) === "bye" ? Number(event.extras || 0) : 0;
    entry.legByes += normalizeText(event.extraType) === "leg_bye" ? Number(event.extras || 0) : 0;
    entry.wides += normalizeText(event.extraType) === "wide" ? Number(event.extras || 0) : 0;
    entry.noBalls += normalizeText(event.extraType) === "no_ball" ? Number(event.extras || 0) : 0;
    entry.weightedRuns += Number(event.totalEventWeight || 1) * Number(event.totalRuns || 0);
    entry.weightedDismissals +=
      event.wicketFlag && event.wicketCreditedToBowler && batterId === normalizeText(event.playerOutSourcePlayerId)
        ? Number(event.totalEventWeight || 1)
        : 0;

    matchupMap.set(key, entry);
  }

  return [...matchupMap.values()].map((entry) => ({
    ...entry,
    weightedRuns: roundMetric(entry.weightedRuns),
    weightedDismissals: roundMetric(entry.weightedDismissals),
  }));
}

function battingImpact(entry) {
  const balls = Math.max(Number(entry.ballsFaced || 0), 1);
  return (
    Number(entry.batterRuns || 0) +
    Number(entry.boundaries || 0) * 0.75 +
    Number(entry.singles || 0) * 0.2 -
    Number(entry.dismissals || 0) * 8
  ) / balls;
}

function bowlingImpact(entry) {
  const balls = Math.max(Number(entry.legalBallsBowled || 0), 1);
  return (
    Number(entry.wickets || 0) * 18 +
    Number(entry.dotBalls || 0) * 1.2 -
    Number(entry.totalRunsConceded || 0) * 0.45
  ) / balls;
}

function fieldingImpact(entry) {
  return (
    Number(entry.catches || 0) * 8 +
    Number(entry.stumpings || 0) * 10 +
    Number(entry.directRunOuts || 0) * 7 +
    Number(entry.indirectRunOuts || 0) * 5
  );
}

function buildPlayerMatchAdvanced(matchFacts, annotatedBallEvents) {
  const battingRows = (matchFacts?.scorecard?.battingInnings || []).filter(
    (entry) => entry.didNotBat !== true && normalizeText(entry.playerSourceId)
  );
  const bowlingRows = (matchFacts?.scorecard?.bowlingSpells || []).filter(
    (entry) => normalizeText(entry.playerSourceId)
  );
  const fieldingRows = matchFacts?.commentary?.fieldingEvents || [];
  const battingAgg = new Map();
  const bowlingAgg = new Map();
  const fieldingAgg = new Map();

  for (const event of annotatedBallEvents) {
    const strikerId = normalizeText(event?.strikerSourcePlayerId);
    if (strikerId) {
      const battingEntry = battingAgg.get(strikerId) || {
        sourcePlayerId: strikerId,
        ballsFaced: 0,
        batterRuns: 0,
        dots: 0,
        boundaries: 0,
        singles: 0,
        dismissals: 0,
        weightedRuns: 0,
      };
      battingEntry.ballsFaced += event.isLegalBall ? 1 : 0;
      battingEntry.batterRuns += Number(event.batterRuns || 0);
      battingEntry.dots += event.isLegalBall && Number(event.totalRuns || 0) === 0 ? 1 : 0;
      battingEntry.boundaries += [4, 6].includes(Number(event.batterRuns || 0)) ? 1 : 0;
      battingEntry.singles += Number(event.batterRuns || 0) === 1 ? 1 : 0;
      battingEntry.dismissals += normalizeText(event.playerOutSourcePlayerId) === strikerId ? 1 : 0;
      battingEntry.weightedRuns += Number(event.totalEventWeight || 1) * Number(event.batterRuns || 0);
      battingAgg.set(strikerId, battingEntry);
    }

    const bowlerId = normalizeText(event?.bowlerSourcePlayerId);
    if (bowlerId) {
      const bowlingEntry = bowlingAgg.get(bowlerId) || {
        sourcePlayerId: bowlerId,
        legalBallsBowled: 0,
        bowlerRunsConceded: 0,
        totalRunsConceded: 0,
        dotBalls: 0,
        boundariesConceded: 0,
        wickets: 0,
        pressureOvers: new Set(),
        weightedImpact: 0,
      };
      bowlingEntry.legalBallsBowled += event.isLegalBall ? 1 : 0;
      bowlingEntry.bowlerRunsConceded +=
        Number(event.batterRuns || 0) +
        (["wide", "no_ball"].includes(normalizeText(event.extraType)) ? Number(event.extras || 0) : 0);
      bowlingEntry.totalRunsConceded += Number(event.totalRuns || 0);
      bowlingEntry.dotBalls += event.isLegalBall && Number(event.totalRuns || 0) === 0 ? 1 : 0;
      bowlingEntry.boundariesConceded += [4, 6].includes(Number(event.batterRuns || 0)) ? 1 : 0;
      bowlingEntry.wickets += event.wicketFlag && event.wicketCreditedToBowler ? 1 : 0;
      if (normalizeText(event.phase) === "death" || Number(event.leverageScore || 1) > 1.05) {
        bowlingEntry.pressureOvers.add(Number(event.overNo));
      }
      bowlingEntry.weightedImpact +=
        Number(event.totalEventWeight || 1) *
        (event.wicketFlag && event.wicketCreditedToBowler ? 14 : 0) -
        Number(event.totalEventWeight || 1) * Number(event.totalRuns || 0) * 0.35;
      bowlingAgg.set(bowlerId, bowlingEntry);
    }
  }

  for (const event of fieldingRows) {
    const fielderId = normalizeText(event?.fielderSourcePlayerId);
    if (!fielderId) {
      continue;
    }

    const fieldingEntry = fieldingAgg.get(fielderId) || {
      sourcePlayerId: fielderId,
      catches: 0,
      stumpings: 0,
      directRunOuts: 0,
      indirectRunOuts: 0,
      wicketkeepingEvents: 0,
    };

    const dismissalType = normalizeText(event.dismissalType);
    fieldingEntry.catches += dismissalType === "caught" ? 1 : 0;
    fieldingEntry.stumpings += dismissalType === "stumped" ? 1 : 0;
    fieldingEntry.directRunOuts += dismissalType === "run_out" && event.isDirectRunOut ? 1 : 0;
    fieldingEntry.indirectRunOuts += dismissalType === "run_out" && !event.isDirectRunOut ? 1 : 0;
    fieldingEntry.wicketkeepingEvents += event.isWicketkeeperEvent ? 1 : 0;
    fieldingAgg.set(fielderId, fieldingEntry);
  }

  const advancedRows = [];

  for (const row of battingRows) {
    const sourcePlayerId = normalizeText(row.playerSourceId);
    const agg = battingAgg.get(sourcePlayerId) || {
      ballsFaced: Number(row.ballsFaced || 0),
      batterRuns: Number(row.runs || 0),
      dots: 0,
      boundaries: Number(row.fours || 0) + Number(row.sixes || 0),
      singles: 0,
      dismissals: row.isNotOut ? 0 : 1,
      weightedRuns: Number(row.runs || 0),
    };
    const balls = Math.max(Number(row.ballsFaced || agg.ballsFaced || 0), 1);
    const impact = battingImpact(agg);
    advancedRows.push({
      sourcePlayerId,
      playerName: row.playerName,
      teamName: row.teamName,
      roleType: "batting",
      ballsFaced: Number(row.ballsFaced || agg.ballsFaced || 0),
      batterRuns: Number(row.runs || agg.batterRuns || 0),
      dotBallPct: roundMetric(safeDivide(agg.dots, balls)),
      boundaryBallPct: roundMetric(safeDivide(agg.boundaries, balls)),
      singlesRotationPct: roundMetric(safeDivide(agg.singles, balls)),
      dismissalRate: roundMetric(safeDivide(row.isNotOut ? 0 : 1, balls)),
      legalBallsBowled: 0,
      bowlerRunsConceded: 0,
      totalRunsConceded: 0,
      wicketBallPct: 0,
      boundaryConcededPct: 0,
      pressureOvers: 0,
      fieldingImpactScore: 0,
      teamStrengthAdjustedScore: roundMetric(impact),
      playerStrengthAdjustedScore: roundMetric(impact),
      leverageAdjustedScore: roundMetric(safeDivide(agg.weightedRuns, balls)),
      matchImpactScore: roundMetric(impact + safeDivide(agg.weightedRuns, balls, 0) * 0.2),
    });
  }

  for (const row of bowlingRows) {
    const sourcePlayerId = normalizeText(row.playerSourceId);
    const agg = bowlingAgg.get(sourcePlayerId) || {
      legalBallsBowled: Number(row.legalBalls || 0),
      bowlerRunsConceded: Number(row.runsConceded || 0),
      totalRunsConceded: Number(row.runsConceded || 0),
      dotBalls: Number(row.dotBalls || 0),
      boundariesConceded: 0,
      wickets: Number(row.wickets || 0),
      pressureOvers: new Set(),
      weightedImpact: Number(row.wickets || 0) * 12 - Number(row.runsConceded || 0) * 0.3,
    };
    const balls = Math.max(Number(row.legalBalls || agg.legalBallsBowled || 0), 1);
    const impact = bowlingImpact(agg);
    advancedRows.push({
      sourcePlayerId,
      playerName: row.playerName,
      teamName: row.teamName,
      roleType: "bowling",
      ballsFaced: 0,
      batterRuns: 0,
      dotBallPct: 0,
      boundaryBallPct: 0,
      singlesRotationPct: 0,
      dismissalRate: 0,
      legalBallsBowled: Number(row.legalBalls || agg.legalBallsBowled || 0),
      bowlerRunsConceded: Number(agg.bowlerRunsConceded || row.runsConceded || 0),
      totalRunsConceded: Number(agg.totalRunsConceded || row.runsConceded || 0),
      wicketBallPct: roundMetric(safeDivide(Number(row.wickets || agg.wickets || 0), balls)),
      boundaryConcededPct: roundMetric(safeDivide(agg.boundariesConceded, balls)),
      pressureOvers: agg.pressureOvers instanceof Set ? agg.pressureOvers.size : 0,
      fieldingImpactScore: 0,
      teamStrengthAdjustedScore: roundMetric(impact),
      playerStrengthAdjustedScore: roundMetric(impact),
      leverageAdjustedScore: roundMetric(safeDivide(agg.weightedImpact, balls)),
      matchImpactScore: roundMetric(impact + safeDivide(agg.weightedImpact, balls, 0) * 0.2),
    });
  }

  for (const [sourcePlayerId, agg] of fieldingAgg.entries()) {
    const impact = fieldingImpact(agg);
    advancedRows.push({
      sourcePlayerId,
      playerName: null,
      teamName: null,
      roleType: agg.wicketkeepingEvents > 0 ? "wicketkeeping" : "fielding",
      ballsFaced: 0,
      batterRuns: 0,
      dotBallPct: 0,
      boundaryBallPct: 0,
      singlesRotationPct: 0,
      dismissalRate: 0,
      legalBallsBowled: 0,
      bowlerRunsConceded: 0,
      totalRunsConceded: 0,
      wicketBallPct: 0,
      boundaryConcededPct: 0,
      pressureOvers: 0,
      fieldingImpactScore: roundMetric(impact),
      teamStrengthAdjustedScore: roundMetric(impact),
      playerStrengthAdjustedScore: roundMetric(impact),
      leverageAdjustedScore: roundMetric(impact),
      matchImpactScore: roundMetric(impact),
    });
  }

  return advancedRows;
}

function computeAdvancedMetrics(matchFacts, weightsConfig) {
  const annotatedBallEvents = buildAnnotatedBallEvents(matchFacts, weightsConfig);
  const playerMatchups = buildPlayerMatchups(annotatedBallEvents);
  const playerMatchAdvanced = buildPlayerMatchAdvanced(matchFacts, annotatedBallEvents);

  return {
    status: "computed_match_primitives",
    weightsVersion: weightsConfig.version,
    outputs: {
      annotatedBallEvents,
      playerMatchAdvanced,
      playerMatchups,
      playerSeasonAdvanced: [],
      compositeScores: [],
    },
  };
}

module.exports = {
  computeAdvancedMetrics,
};

"use strict";

const {
  confidenceLabel,
  formatDate,
  humanizeRole,
  normalizeText,
  recommendationLabel,
  roundNumeric,
  toInteger,
  toNumber,
} = require("../lib/utils");
const {
  resolveSeriesContext,
  withClient,
} = require("./seriesService");

const MIN_SPLIT_SAMPLE_BALLS = 12;
const MAX_MATCHUP_ROWS = 8;
const MAX_DISMISSAL_ROWS = 6;
const MAX_SIGNAL_ROWS = 3;
const MAX_EVIDENCE_ROWS = 4;
const COMMENTARY_FETCH_LIMIT = 180;

function roundMetric(value, digits = 2) {
  const numeric = toNumber(value, null);
  if (numeric === null) {
    return null;
  }
  return roundNumeric(numeric, digits);
}

function normalizeBucketLabel(value, fallback = "") {
  const normalized = normalizeText(value).toLowerCase();
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
    overall: "Overall",
  };

  if (map[normalized]) {
    return map[normalized];
  }

  const fallbackText = normalizeText(fallback);
  if (fallbackText) {
    return fallbackText;
  }

  return normalized
    ? normalized
        .split("_")
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(" ")
    : "Unknown";
}

function formatBowlingStyle(row) {
  return normalizeText(row?.bowling_style_detail)
    || normalizeBucketLabel(row?.bowling_style_bucket, row?.bowling_style)
    || "";
}

function formatBattingStyle(row) {
  const hand = normalizeText(row?.batting_hand);
  const bucket = normalizeText(row?.batting_style_bucket);
  const raw = normalizeText(row?.batting_style);

  if (hand && raw) {
    return `${hand} ${raw}`;
  }
  if (hand && bucket) {
    return `${hand} ${bucket}`;
  }
  return hand || raw || bucket || "";
}

function buildDivisionLabelMap(rows) {
  return rows.reduce((acc, row) => {
    const divisionId = toInteger(row.division_id);
    const divisionLabel = normalizeText(row.division_label);
    if (divisionId && divisionLabel && !acc.has(divisionId)) {
      acc.set(divisionId, divisionLabel);
    }
    return acc;
  }, new Map());
}

function pickSelectedSeasonRow(rows, requestedDivisionId) {
  if (requestedDivisionId) {
    const exact = rows.find((row) => toInteger(row.division_id) === requestedDivisionId);
    if (exact) {
      return exact;
    }
  }
  return rows[0] || null;
}

function hasDivisionScopeRows(rows, divisionId) {
  return rows.some(
    (row) =>
      normalizeText(row.scopeType || row.scope_type) === "division"
      && toInteger(row.divisionId ?? row.division_id) === divisionId
  );
}

function resolveFocusedScope(input) {
  if (input.requestedDivisionId) {
    const hasDivisionRows = hasDivisionScopeRows(input.matchupRows, input.requestedDivisionId)
      || hasDivisionScopeRows(input.dismissalRows, input.requestedDivisionId)
      || hasDivisionScopeRows(input.profileRows, input.requestedDivisionId);

    if (hasDivisionRows) {
      return {
        requestedDivisionId: input.requestedDivisionId,
        scopeType: "division",
        divisionId: input.requestedDivisionId,
        divisionLabel:
          input.divisionLabelMap.get(input.requestedDivisionId)
          || `Division ${input.requestedDivisionId}`,
        scopeLabel:
          input.divisionLabelMap.get(input.requestedDivisionId)
          || `Division ${input.requestedDivisionId}`,
        fallbackApplied: false,
        fallbackReason: "",
      };
    }
  }

  return {
    requestedDivisionId: input.requestedDivisionId,
    scopeType: "series",
    divisionId: null,
    divisionLabel: "",
    scopeLabel: "All tracked phases and divisions",
    fallbackApplied: Boolean(input.requestedDivisionId),
    fallbackReason: input.requestedDivisionId
      ? "No division-scope player intelligence rows were found for this player. Falling back to series scope."
      : "",
  };
}

function mapMatchupRow(row) {
  return {
    scopeType: normalizeText(row.scope_type),
    divisionId: toInteger(row.division_id),
    playerId: toInteger(row.player_id),
    perspective: normalizeText(row.perspective),
    splitGroup: normalizeText(row.split_group),
    splitValue: normalizeText(row.split_value),
    splitLabel: normalizeBucketLabel(row.split_value, row.split_label),
    phaseBucket: normalizeText(row.phase_bucket) || "overall",
    matchCount: toInteger(row.match_count) || 0,
    deliveryEvents: toInteger(row.delivery_events) || 0,
    legalBalls: toInteger(row.legal_balls) || 0,
    runsScored: toInteger(row.runs_scored) || 0,
    runsConceded: toInteger(row.runs_conceded) || 0,
    dismissals: toInteger(row.dismissals) || 0,
    wickets: toInteger(row.wickets) || 0,
    dotBalls: toInteger(row.dot_balls) || 0,
    boundaries: toInteger(row.boundaries) || 0,
    wides: toInteger(row.wides) || 0,
    noBalls: toInteger(row.no_balls) || 0,
    strikeRate: roundMetric(row.strike_rate, 2),
    economy: roundMetric(row.economy, 2),
    battingAverage: roundMetric(row.batting_average, 2),
    ballsPerDismissal: roundMetric(row.balls_per_dismissal, 2),
    ballsPerWicket: roundMetric(row.balls_per_wicket, 2),
    dotBallPct: roundMetric(row.dot_ball_pct, 2),
    boundaryBallPct: roundMetric(row.boundary_ball_pct, 2),
    controlErrorPct: roundMetric(row.control_error_pct, 2),
  };
}

function mapDismissalRow(row) {
  return {
    scopeType: normalizeText(row.scope_type),
    divisionId: toInteger(row.division_id),
    playerId: toInteger(row.player_id),
    bowlerStyleBucket: normalizeText(row.bowler_style_bucket),
    bowlerStyleLabel: normalizeBucketLabel(row.bowler_style_bucket, row.bowler_style_label),
    dismissalType: normalizeText(row.dismissal_type),
    dismissalCount: toInteger(row.dismissal_count) || 0,
    matchCount: toInteger(row.match_count) || 0,
    averageRunsAtDismissal: roundMetric(row.average_runs_at_dismissal, 2),
    averageBallsFacedAtDismissal: roundMetric(row.average_balls_faced_at_dismissal, 2),
  };
}

function mapProfileRow(row) {
  return {
    scopeType: normalizeText(row.scope_type),
    divisionId: toInteger(row.division_id),
    playerId: toInteger(row.player_id),
    battingMatchCount: toInteger(row.batting_match_count) || 0,
    bowlingMatchCount: toInteger(row.bowling_match_count) || 0,
    battingLegalBalls: toInteger(row.batting_legal_balls) || 0,
    bowlingLegalBalls: toInteger(row.bowling_legal_balls) || 0,
    battingRotationRatio: roundMetric(row.batting_rotation_ratio, 2),
    battingHighLeverageStrikeRate: roundMetric(row.batting_high_leverage_strike_rate, 2),
    bowlingHighLeverageEconomy: roundMetric(row.bowling_high_leverage_economy, 2),
    bowlingPressureControlErrorPct: roundMetric(row.bowling_pressure_control_error_pct, 2),
    boundaryDotThreshold: roundMetric(row.boundary_dot_threshold, 2),
    dismissalDotThreshold: roundMetric(row.dismissal_dot_threshold, 2),
    boundaryAfterThreeDotsPct: roundMetric(row.boundary_after_three_dots_pct, 2),
    dismissalAfterThreeDotsPct: roundMetric(row.dismissal_after_three_dots_pct, 2),
  };
}

function filterScopeRows(rows, scopeType, divisionId) {
  return rows.filter((row) => {
    if (normalizeText(row.scopeType || row.scope_type) !== scopeType) {
      return false;
    }
    if (scopeType === "division") {
      return toInteger(row.divisionId ?? row.division_id) === divisionId;
    }
    return true;
  });
}

function sortSplitRows(rows, perspective) {
  return [...rows].sort((left, right) => {
    if (perspective === "bowling") {
      const wicketDiff = (right.wickets || 0) - (left.wickets || 0);
      if (wicketDiff !== 0) {
        return wicketDiff;
      }

      const economyLeft = toNumber(left.economy, Number.POSITIVE_INFINITY);
      const economyRight = toNumber(right.economy, Number.POSITIVE_INFINITY);
      if (economyLeft !== economyRight) {
        return economyLeft - economyRight;
      }
    } else {
      const strikeRateDiff = toNumber(right.strikeRate, -1) - toNumber(left.strikeRate, -1);
      if (strikeRateDiff !== 0) {
        return strikeRateDiff;
      }
    }

    const ballDiff = (right.legalBalls || 0) - (left.legalBalls || 0);
    if (ballDiff !== 0) {
      return ballDiff;
    }

    return (right.matchCount || 0) - (left.matchCount || 0);
  });
}

function buildPhaseSummary(rows, perspective) {
  const phases = ["powerplay", "middle", "death"];
  return phases.reduce((acc, phaseBucket) => {
    const row = rows.find(
      (item) =>
        item.perspective === perspective
        && item.splitGroup === "overall"
        && item.phaseBucket === phaseBucket
    );
    acc[phaseBucket] = row || null;
    return acc;
  }, {});
}

function buildSplitRows(rows, perspective, splitGroup) {
  return sortSplitRows(
    rows.filter(
      (row) =>
        row.perspective === perspective
        && row.splitGroup === splitGroup
        && row.phaseBucket === "overall"
        && row.splitValue !== "overall"
    ),
    perspective
  ).slice(0, MAX_MATCHUP_ROWS);
}

function buildSplitRowsByPhase(rows, perspective, splitGroup) {
  return ["powerplay", "middle", "death"].reduce((acc, phaseBucket) => {
    acc[phaseBucket] = sortSplitRows(
      rows.filter(
        (row) =>
          row.perspective === perspective
          && row.splitGroup === splitGroup
          && row.phaseBucket === phaseBucket
          && row.splitValue !== "overall"
      ),
      perspective
    ).slice(0, MAX_MATCHUP_ROWS);
    return acc;
  }, {});
}

function buildPressureProfile(profileRow) {
  if (!profileRow) {
    return null;
  }

  return {
    battingRotationRatio: profileRow.battingRotationRatio,
    battingHighLeverageStrikeRate: profileRow.battingHighLeverageStrikeRate,
    bowlingHighLeverageEconomy: profileRow.bowlingHighLeverageEconomy,
    bowlingPressureControlErrorPct: profileRow.bowlingPressureControlErrorPct,
    boundaryDotThreshold: profileRow.boundaryDotThreshold,
    dismissalDotThreshold: profileRow.dismissalDotThreshold,
    boundaryAfterThreeDotsPct: profileRow.boundaryAfterThreeDotsPct,
    dismissalAfterThreeDotsPct: profileRow.dismissalAfterThreeDotsPct,
  };
}

function buildLens(input) {
  const scopeMatchups = filterScopeRows(input.matchupRows, input.scopeType, input.divisionId);
  const scopeDismissals = filterScopeRows(input.dismissalRows, input.scopeType, input.divisionId);
  const profileRow =
    filterScopeRows(input.profileRows, input.scopeType, input.divisionId)[0]
    || null;

  return {
    scopeType: input.scopeType,
    divisionId: input.divisionId,
    divisionLabel: input.divisionLabel,
    sample: {
      battingMatchCount: profileRow?.battingMatchCount || 0,
      bowlingMatchCount: profileRow?.bowlingMatchCount || 0,
      battingLegalBalls: profileRow?.battingLegalBalls || 0,
      bowlingLegalBalls: profileRow?.bowlingLegalBalls || 0,
    },
    batting: {
      overall:
        scopeMatchups.find(
          (row) =>
            row.perspective === "batting"
            && row.splitGroup === "overall"
            && row.phaseBucket === "overall"
        ) || null,
      byPhase: buildPhaseSummary(scopeMatchups, "batting"),
      byBowlerType: buildSplitRows(scopeMatchups, "batting", "bowler_style_bucket"),
      byBowlerTypePhase: buildSplitRowsByPhase(scopeMatchups, "batting", "bowler_style_bucket"),
    },
    bowling: {
      overall:
        scopeMatchups.find(
          (row) =>
            row.perspective === "bowling"
            && row.splitGroup === "overall"
            && row.phaseBucket === "overall"
        ) || null,
      byPhase: buildPhaseSummary(scopeMatchups, "bowling"),
      byBatterHand: buildSplitRows(scopeMatchups, "bowling", "batter_hand"),
      byBatterHandPhase: buildSplitRowsByPhase(scopeMatchups, "bowling", "batter_hand"),
    },
    dismissals: [...scopeDismissals]
      .sort((left, right) => {
        const dismissalDiff = (right.dismissalCount || 0) - (left.dismissalCount || 0);
        if (dismissalDiff !== 0) {
          return dismissalDiff;
        }
        return (right.matchCount || 0) - (left.matchCount || 0);
      })
      .slice(0, MAX_DISMISSAL_ROWS),
    pressureProfile: buildPressureProfile(profileRow),
  };
}

function pickBestBattingSplit(rows) {
  return sortSplitRows(
    rows.filter((row) => (row.legalBalls || 0) >= MIN_SPLIT_SAMPLE_BALLS),
    "batting"
  )[0] || null;
}

function pickRiskBattingSplit(rows) {
  return [...rows]
    .filter((row) => (row.legalBalls || 0) >= MIN_SPLIT_SAMPLE_BALLS)
    .sort((left, right) => {
      const dismissalDiff = (right.dismissals || 0) - (left.dismissals || 0);
      if (dismissalDiff !== 0) {
        return dismissalDiff;
      }

      const ballsPerDismissalLeft = toNumber(left.ballsPerDismissal, Number.POSITIVE_INFINITY);
      const ballsPerDismissalRight = toNumber(right.ballsPerDismissal, Number.POSITIVE_INFINITY);
      if (ballsPerDismissalLeft !== ballsPerDismissalRight) {
        return ballsPerDismissalLeft - ballsPerDismissalRight;
      }

      const strikeRateLeft = toNumber(left.strikeRate, Number.POSITIVE_INFINITY);
      const strikeRateRight = toNumber(right.strikeRate, Number.POSITIVE_INFINITY);
      return strikeRateLeft - strikeRateRight;
    })[0] || null;
}

function pickBestBowlingSplit(rows) {
  return [...rows]
    .filter((row) => (row.legalBalls || 0) >= MIN_SPLIT_SAMPLE_BALLS)
    .sort((left, right) => {
      const wicketDiff = (right.wickets || 0) - (left.wickets || 0);
      if (wicketDiff !== 0) {
        return wicketDiff;
      }

      const economyLeft = toNumber(left.economy, Number.POSITIVE_INFINITY);
      const economyRight = toNumber(right.economy, Number.POSITIVE_INFINITY);
      if (economyLeft !== economyRight) {
        return economyLeft - economyRight;
      }

      return (right.legalBalls || 0) - (left.legalBalls || 0);
    })[0] || null;
}

function buildSignalCards(input) {
  const strengths = [];
  const watchouts = [];
  const pressureSignals = [];

  const battingStrength = pickBestBattingSplit(input.lens.batting.byBowlerType);
  if (battingStrength) {
    strengths.push({
      label: `Batting vs ${battingStrength.splitLabel}`,
      tone: "good",
      metricLabel: "Strike Rate",
      metricValue: battingStrength.strikeRate,
      note: `${battingStrength.runsScored} runs from ${battingStrength.legalBalls} balls across ${battingStrength.matchCount} matches.`,
    });
  }

  const bowlingStrength = pickBestBowlingSplit(input.lens.bowling.byBatterHand);
  if (bowlingStrength) {
    strengths.push({
      label: `Bowling vs ${bowlingStrength.splitLabel}`,
      tone: "good",
      metricLabel: "Economy",
      metricValue: bowlingStrength.economy,
      note: `${bowlingStrength.wickets} wickets from ${bowlingStrength.legalBalls} balls with ${bowlingStrength.dotBallPct || 0}% dot balls.`,
    });
  }

  const dismissalRisk = input.lens.dismissals[0] || null;
  if (dismissalRisk) {
    watchouts.push({
      label: `Dismissal pattern vs ${dismissalRisk.bowlerStyleLabel}`,
      tone: "watch",
      metricLabel: "Dismissals",
      metricValue: dismissalRisk.dismissalCount,
      note: `${dismissalRisk.dismissalType || "wicket"} is the leading mode with ${dismissalRisk.averageRunsAtDismissal || 0} average runs at dismissal.`,
    });
  }

  const battingRisk = pickRiskBattingSplit(input.lens.batting.byBowlerType);
  if (battingRisk && (!dismissalRisk || battingRisk.splitLabel !== dismissalRisk.bowlerStyleLabel)) {
    watchouts.push({
      label: `Batting pressure vs ${battingRisk.splitLabel}`,
      tone: "watch",
      metricLabel: "Balls per dismissal",
      metricValue: battingRisk.ballsPerDismissal,
      note: `${battingRisk.dismissals} dismissals from ${battingRisk.legalBalls} balls in this split.`,
    });
  }

  const pressure = input.lens.pressureProfile;
  if (pressure?.boundaryAfterThreeDotsPct !== null && pressure?.boundaryAfterThreeDotsPct !== undefined) {
    pressureSignals.push({
      label: "Boundary release after 3 dots",
      tone: pressure.boundaryAfterThreeDotsPct >= 15 ? "good" : "watch",
      metricLabel: "Percent",
      metricValue: pressure.boundaryAfterThreeDotsPct,
      note: "Tracks whether dot-ball pressure still leaks a release boundary.",
    });
  }
  if (pressure?.dismissalAfterThreeDotsPct !== null && pressure?.dismissalAfterThreeDotsPct !== undefined) {
    pressureSignals.push({
      label: "Dismissal after 3 dots",
      tone: pressure.dismissalAfterThreeDotsPct >= 12 ? "watch" : "good",
      metricLabel: "Percent",
      metricValue: pressure.dismissalAfterThreeDotsPct,
      note: "Signals how often sustained dot-ball pressure produces a wicket.",
    });
  }
  if (pressure?.battingHighLeverageStrikeRate !== null && pressure?.battingHighLeverageStrikeRate !== undefined) {
    pressureSignals.push({
      label: "High-leverage batting",
      tone: pressure.battingHighLeverageStrikeRate >= 110 ? "good" : "watch",
      metricLabel: "Strike Rate",
      metricValue: pressure.battingHighLeverageStrikeRate,
      note: "Series response when the leverage state rises late or under squeeze.",
    });
  } else if (
    pressure?.bowlingHighLeverageEconomy !== null
    && pressure?.bowlingHighLeverageEconomy !== undefined
  ) {
    pressureSignals.push({
      label: "High-leverage bowling",
      tone: pressure.bowlingHighLeverageEconomy <= 8 ? "good" : "watch",
      metricLabel: "Economy",
      metricValue: pressure.bowlingHighLeverageEconomy,
      note: "Series control when the over context is high leverage.",
    });
  }

  return {
    strengths: strengths.slice(0, MAX_SIGNAL_ROWS),
    watchouts: watchouts.slice(0, MAX_SIGNAL_ROWS),
    pressureSignals: pressureSignals.slice(0, MAX_SIGNAL_ROWS),
  };
}

function buildTacticalPlan(lens) {
  const battingPlan = [];
  const bowlingPlan = [];

  const battingRisk = pickRiskBattingSplit(lens.batting.byBowlerType);
  if (battingRisk) {
    battingPlan.push(
      `Sustain ${battingRisk.splitLabel} exposure where possible. This is the lowest-stability batting split in the current intelligence sample.`
    );
  }

  const dismissalRisk = lens.dismissals[0] || null;
  if (dismissalRisk) {
    battingPlan.push(
      `${dismissalRisk.bowlerStyleLabel} has produced the leading dismissal pattern so far, especially via ${dismissalRisk.dismissalType || "wickets"}.`
    );
  }

  if (lens.pressureProfile?.dismissalDotThreshold !== null && lens.pressureProfile?.dismissalDotThreshold !== undefined) {
    battingPlan.push(
      `Dot-ball squeeze matters here. Dismissals have tended to arrive after ${lens.pressureProfile.dismissalDotThreshold} consecutive dots on average.`
    );
  }

  const bowlingStrength = pickBestBowlingSplit(lens.bowling.byBatterHand);
  if (bowlingStrength) {
    bowlingPlan.push(
      `Use this bowler against ${bowlingStrength.splitLabel} where possible. That split is the cleanest current wicket-and-control profile.`
    );
  }

  if (lens.pressureProfile?.bowlingPressureControlErrorPct !== null && lens.pressureProfile?.bowlingPressureControlErrorPct !== undefined) {
    bowlingPlan.push(
      `Pressure overs carry a ${lens.pressureProfile.bowlingPressureControlErrorPct}% control-error rate through wides and no-balls.`
    );
  }

  if (lens.pressureProfile?.bowlingHighLeverageEconomy !== null && lens.pressureProfile?.bowlingHighLeverageEconomy !== undefined) {
    bowlingPlan.push(
      `High-leverage economy is ${lens.pressureProfile.bowlingHighLeverageEconomy}. Use that as the late-innings control marker.`
    );
  }

  return {
    battingPlan: battingPlan.slice(0, MAX_SIGNAL_ROWS),
    bowlingPlan: bowlingPlan.slice(0, MAX_SIGNAL_ROWS),
  };
}

function formatEvidenceHeadline(row, playerId) {
  if ((row.playerOutId || 0) === playerId && row.wicketFlag) {
    return `Dismissal at ${row.ballLabel || "ball event"}`;
  }
  if ((row.bowlerPlayerId || 0) === playerId && row.wicketCreditedToBowler) {
    return `Bowling wicket at ${row.ballLabel || "ball event"}`;
  }
  if ((row.strikerPlayerId || 0) === playerId) {
    if ([4, 6].includes(row.batterRuns || 0)) {
      return `${row.batterRuns} runs at ${row.ballLabel || "ball event"}`;
    }
    return `Batting involvement at ${row.ballLabel || "ball event"}`;
  }
  if ((row.bowlerPlayerId || 0) === playerId) {
    return `Bowling involvement at ${row.ballLabel || "ball event"}`;
  }
  return `Context event at ${row.ballLabel || "ball event"}`;
}

function mapEvidenceRow(row, playerId) {
  return {
    matchId: toInteger(row.match_id),
    matchDate: row.match_date,
    matchDateLabel: formatDate(row.match_date),
    matchTitle: normalizeText(row.match_title),
    divisionLabel: normalizeText(row.division_label),
    inningsNo: toInteger(row.innings_no),
    ballLabel: normalizeText(row.ball_label),
    phase: normalizeText(row.phase),
    strikerName: normalizeText(row.striker_name),
    bowlerName: normalizeText(row.bowler_name),
    playerOutName: normalizeText(row.player_out_name),
    batterRuns: toInteger(row.batter_runs) || 0,
    totalRuns: toInteger(row.total_runs) || 0,
    wicketFlag: row.wicket_flag === true,
    wicketCreditedToBowler: row.wicket_credited_to_bowler === true,
    dismissalType: normalizeText(row.dismissal_type),
    leverageScore: roundMetric(row.leverage_score, 2),
    totalEventWeight: roundMetric(row.total_event_weight, 4),
    commentaryText: normalizeText(row.commentary_text),
    headline: formatEvidenceHeadline({
      ballLabel: normalizeText(row.ball_label),
      batterRuns: toInteger(row.batter_runs),
      wicketFlag: row.wicket_flag === true,
      wicketCreditedToBowler: row.wicket_credited_to_bowler === true,
      strikerPlayerId: toInteger(row.striker_player_id),
      bowlerPlayerId: toInteger(row.bowler_player_id),
      playerOutId: toInteger(row.player_out_id),
    }, playerId),
  };
}

function buildCommentaryEvidence(rows, playerId) {
  const batting = [];
  const bowling = [];
  const dismissals = [];

  for (const row of rows) {
    const evidence = mapEvidenceRow(row, playerId);
    const strikerPlayerId = toInteger(row.striker_player_id);
    const bowlerPlayerId = toInteger(row.bowler_player_id);
    const playerOutId = toInteger(row.player_out_id);
    const wicketFlag = row.wicket_flag === true;
    const batterRuns = toInteger(row.batter_runs) || 0;
    const leverageScore = toNumber(row.leverage_score, 0);

    if (
      dismissals.length < MAX_EVIDENCE_ROWS
      && wicketFlag
      && playerOutId === playerId
    ) {
      dismissals.push(evidence);
      continue;
    }

    if (
      batting.length < MAX_EVIDENCE_ROWS
      && strikerPlayerId === playerId
      && (batterRuns >= 4 || leverageScore >= 1.05)
    ) {
      batting.push(evidence);
      continue;
    }

    if (
      bowling.length < MAX_EVIDENCE_ROWS
      && bowlerPlayerId === playerId
      && (row.wicket_credited_to_bowler === true || leverageScore >= 1.05 || (toInteger(row.total_runs) || 0) === 0)
    ) {
      bowling.push(evidence);
    }
  }

  return {
    batting,
    bowling,
    dismissals,
  };
}

async function loadCommentaryRows(client, input) {
  const result = await client.query(
    `
      select
        be.match_id,
        m.match_date,
        d.source_label as division_label,
        t1.display_name || ' v ' || t2.display_name as match_title,
        be.innings_no,
        be.ball_label,
        be.phase,
        be.striker_player_id,
        sp.display_name as striker_name,
        be.bowler_player_id,
        bw.display_name as bowler_name,
        be.player_out_id,
        po.display_name as player_out_name,
        be.batter_runs,
        be.total_runs,
        be.wicket_flag,
        be.wicket_credited_to_bowler,
        be.dismissal_type,
        be.leverage_score,
        be.total_event_weight,
        be.commentary_text
      from ball_event be
      join match m on m.id = be.match_id
      join team t1 on t1.id = m.team1_id
      join team t2 on t2.id = m.team2_id
      left join division d on d.id = m.division_id
      left join player sp on sp.id = be.striker_player_id
      left join player bw on bw.id = be.bowler_player_id
      left join player po on po.id = be.player_out_id
      where m.series_id = $1
        and ($2::bigint is null or m.division_id is not distinct from $2)
        and (
          be.striker_player_id = $3
          or be.bowler_player_id = $3
          or be.player_out_id = $3
        )
        and be.commentary_text is not null
        and btrim(be.commentary_text) <> ''
      order by
        m.match_date desc nulls last,
        coalesce(be.leverage_score, 0) desc,
        be.match_id desc,
        be.id desc
      limit $4
    `,
    [
      input.seriesId,
      input.divisionId,
      input.playerId,
      COMMENTARY_FETCH_LIMIT,
    ]
  );

  return result.rows;
}

async function getPlayerIntelligenceReport(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    const playerId = toInteger(input.playerId);
    const requestedDivisionId = toInteger(input.divisionId);

    if (!playerId) {
      const error = new Error("playerId must be a valid integer.");
      error.statusCode = 400;
      throw error;
    }

    const seasonRows = (
      await client.query(
        `
          select
            psa.*,
            p.display_name as player_name,
            p.canonical_name,
            p.primary_role,
            p.primary_role_bucket,
            p.batting_hand,
            p.batting_style,
            p.batting_style_bucket,
            p.bowling_arm,
            p.bowling_style,
            p.bowling_style_bucket,
            p.bowling_style_detail,
            p.is_wicketkeeper,
            t.display_name as team_name,
            d.source_label as division_label,
            pcs.composite_score,
            pcs.percentile_rank
          from player_season_advanced psa
          join player p on p.id = psa.player_id
          left join team t on t.id = psa.team_id
          left join division d on d.id = psa.division_id
          left join player_composite_score pcs
            on pcs.series_id = psa.series_id
           and pcs.division_id is not distinct from psa.division_id
           and pcs.player_id = psa.player_id
          where psa.series_id = $1
            and psa.player_id = $2
          order by
            case when psa.division_id is not distinct from $3 then 0 else 1 end,
            pcs.composite_score desc nulls last,
            psa.id
        `,
        [context.seriesId, playerId, requestedDivisionId]
      )
    ).rows;

    if (!seasonRows.length) {
      const error = new Error(`No season analytics found for player ${playerId}.`);
      error.statusCode = 404;
      throw error;
    }

    const selectedSeason = pickSelectedSeasonRow(seasonRows, requestedDivisionId);
    const divisionLabelMap = buildDivisionLabelMap(seasonRows);

    const matchupRows = (
      await client.query(
        `
          select *
          from player_intelligence_matchup
          where series_id = $1
            and player_id = $2
          order by scope_type, division_id nulls first, perspective, split_group, phase_bucket, legal_balls desc, id
        `,
        [context.seriesId, playerId]
      )
    ).rows.map(mapMatchupRow);

    const dismissalRows = (
      await client.query(
        `
          select *
          from player_intelligence_dismissal
          where series_id = $1
            and player_id = $2
          order by scope_type, division_id nulls first, dismissal_count desc, id
        `,
        [context.seriesId, playerId]
      )
    ).rows.map(mapDismissalRow);

    const profileRows = (
      await client.query(
        `
          select *
          from player_intelligence_profile
          where series_id = $1
            and player_id = $2
          order by scope_type, division_id nulls first, id
        `,
        [context.seriesId, playerId]
      )
    ).rows.map(mapProfileRow);

    if (!matchupRows.length && !dismissalRows.length && !profileRows.length) {
      const error = new Error(
        `Player intelligence has not been computed yet for player ${playerId} in ${context.configKey}.`
      );
      error.statusCode = 404;
      throw error;
    }

    const focusedScope = resolveFocusedScope({
      requestedDivisionId,
      matchupRows,
      dismissalRows,
      profileRows,
      divisionLabelMap,
    });

    const focusedLens = buildLens({
      scopeType: focusedScope.scopeType,
      divisionId: focusedScope.divisionId,
      divisionLabel: focusedScope.divisionLabel,
      matchupRows,
      dismissalRows,
      profileRows,
    });
    const seriesLens = buildLens({
      scopeType: "series",
      divisionId: null,
      divisionLabel: "",
      matchupRows,
      dismissalRows,
      profileRows,
    });

    const commentaryRows = await loadCommentaryRows(client, {
      seriesId: context.seriesId,
      divisionId: focusedScope.scopeType === "division" ? focusedScope.divisionId : null,
      playerId,
    });

    const header = {
      playerName: normalizeText(selectedSeason.player_name),
      canonicalName: normalizeText(selectedSeason.canonical_name),
      teamName: normalizeText(selectedSeason.team_name),
      roleType: normalizeText(selectedSeason.role_type),
      roleLabel: humanizeRole(selectedSeason.role_type || selectedSeason.primary_role_bucket || selectedSeason.primary_role),
      primaryRoleBucket: normalizeText(selectedSeason.primary_role_bucket),
      battingStyle: formatBattingStyle(selectedSeason),
      bowlingStyle: formatBowlingStyle(selectedSeason),
      isWicketkeeper: selectedSeason.is_wicketkeeper === true,
      recommendationLabel: recommendationLabel({
        compositeScore: selectedSeason.composite_score,
        confidenceScore: selectedSeason.confidence_score,
      }),
      compositeScore: roundMetric(selectedSeason.composite_score, 2),
      percentileRank: roundMetric(selectedSeason.percentile_rank, 2),
      confidenceScore: roundMetric(selectedSeason.confidence_score, 2),
      confidenceLabel: confidenceLabel(selectedSeason.confidence_score),
    };

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        reportType: "player-intelligence",
        series: {
          configKey: context.configKey,
          name: context.seriesName,
          targetAgeGroup: context.targetAgeGroup,
        },
        scope: {
          requestedDivisionId,
          resolvedScopeType: focusedScope.scopeType,
          divisionId: focusedScope.divisionId,
          divisionLabel: focusedScope.divisionLabel,
          scopeLabel: focusedScope.scopeLabel,
          fallbackApplied: focusedScope.fallbackApplied,
          fallbackReason: focusedScope.fallbackReason,
        },
        player: {
          playerId,
          primaryDivisionId: toInteger(selectedSeason.division_id),
          primaryDivisionLabel: normalizeText(selectedSeason.division_label),
          divisionOptions: seasonRows.map((row) => ({
            divisionId: toInteger(row.division_id),
            divisionLabel: normalizeText(row.division_label),
            roleType: normalizeText(row.role_type),
            roleLabel: humanizeRole(row.role_type),
            compositeScore: roundMetric(row.composite_score, 2),
            confidenceScore: roundMetric(row.confidence_score, 2),
          })),
        },
        sources: [
          "player_season_advanced",
          "player_composite_score",
          "player_intelligence_matchup",
          "player_intelligence_dismissal",
          "player_intelligence_profile",
          "ball_event",
        ],
      },
      header,
      tacticalSummary: buildSignalCards({
        lens: focusedLens,
      }),
      focusedLens,
      seriesLens: focusedScope.scopeType === "division" ? seriesLens : null,
      tacticalPlan: buildTacticalPlan(focusedLens),
      commentaryEvidence: buildCommentaryEvidence(commentaryRows, playerId),
    };
  });
}

module.exports = {
  getPlayerIntelligenceReport,
};

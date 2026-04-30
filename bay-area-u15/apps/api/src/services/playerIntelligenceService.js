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

function safeDivide(numerator, denominator) {
  const left = toNumber(numerator, null);
  const right = toNumber(denominator, null);

  if (left === null || right === null || right === 0) {
    return null;
  }

  return left / right;
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

function formatPhaseBucketLabel(value) {
  const normalized = normalizeText(value).toLowerCase();
  switch (normalized) {
    case "powerplay":
      return "Powerplay";
    case "middle":
      return "Middle overs";
    case "death":
      return "Death overs";
    case "overall":
      return "Overall";
    default:
      return normalizeBucketLabel(value, value);
  }
}

function formatRoleBucketLabel(value) {
  const normalized = normalizeText(value).toLowerCase();
  switch (normalized) {
    case "opener":
      return "opener";
    case "top_order":
      return "top-order batter";
    case "middle_order":
      return "middle-order batter";
    case "lower_order":
      return "lower-order batter";
    default:
      return "flex role";
  }
}

function averageNumbers(values, digits = 0) {
  const numeric = values
    .map((value) => toNumber(value, null))
    .filter((value) => value !== null);

  if (!numeric.length) {
    return null;
  }

  return roundMetric(
    numeric.reduce((sum, value) => sum + value, 0) / numeric.length,
    digits
  );
}

function mostCommonValue(values) {
  const counts = new Map();

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  let bestValue = "";
  let bestCount = -1;

  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }

  return bestValue || "";
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

async function loadSummaryStats(client, input) {
  const scopeDivisionId = input.scopeType === "division" ? input.divisionId : null;
  const scopeParams = [input.seriesId, scopeDivisionId, input.playerId];

  const battingRow = (
    await client.query(
      `
        select
          count(distinct bi.match_id)::int as matches,
          count(*)::int as innings,
          count(*) filter (
            where bi.is_not_out = true
               or replace(lower(btrim(coalesce(bi.dismissal_type, ''))), ' ', '_') = 'not_out'
          )::int as not_outs,
          sum(coalesce(bi.runs, 0))::int as runs,
          sum(coalesce(bi.balls_faced, 0))::int as balls_faced,
          sum(coalesce(bi.fours, 0))::int as fours,
          sum(coalesce(bi.sixes, 0))::int as sixes,
          count(*) filter (where coalesce(bi.runs, 0) between 50 and 99)::int as fifties,
          count(*) filter (where coalesce(bi.runs, 0) >= 100)::int as hundreds
        from public.batting_innings bi
        join public.match m on m.id = bi.match_id
        where m.series_id = $1
          and ($2::bigint is null or m.division_id is not distinct from $2)
          and bi.player_id = $3
          and bi.did_not_bat = false
      `,
      scopeParams
    )
  ).rows[0] || {};

  const bowlingRow = (
    await client.query(
      `
        select
          count(distinct bs.match_id)::int as matches,
          sum(coalesce(bs.legal_balls, 0))::int as legal_balls,
          sum(coalesce(bs.runs_conceded, 0))::int as runs_conceded,
          sum(coalesce(bs.wickets, 0))::int as wickets,
          sum(coalesce(bs.wides, 0))::int as wides,
          sum(coalesce(bs.no_balls, 0))::int as no_balls,
          count(*) filter (where coalesce(bs.wickets, 0) = 4)::int as four_wicket_hauls,
          count(*) filter (where coalesce(bs.wickets, 0) >= 5)::int as five_wicket_hauls
        from public.bowling_spell bs
        join public.match m on m.id = bs.match_id
        where m.series_id = $1
          and ($2::bigint is null or m.division_id is not distinct from $2)
          and bs.player_id = $3
      `,
      scopeParams
    )
  ).rows[0] || {};

  const bowlingBoundaryRow = (
    await client.query(
      `
        select
          count(*) filter (where be.batter_runs = 4)::int as fours_given,
          count(*) filter (where be.batter_runs = 6)::int as sixes_given
        from public.ball_event be
        join public.match m on m.id = be.match_id
        where m.series_id = $1
          and ($2::bigint is null or m.division_id is not distinct from $2)
          and be.bowler_player_id = $3
      `,
      scopeParams
    )
  ).rows[0] || {};

  const fieldingRow = (
    await client.query(
      `
        select
          count(distinct fe.match_id)::int as matches,
          count(*) filter (where lower(coalesce(fe.dismissal_type, '')) = 'caught')::int as catches,
          count(*) filter (
            where coalesce(fe.is_direct_run_out, false) = true
               or coalesce(fe.is_indirect_run_out, false) = true
               or lower(coalesce(fe.dismissal_type, '')) = 'run_out'
          )::int as run_outs,
          count(*) filter (where lower(coalesce(fe.dismissal_type, '')) = 'stumped')::int as stumpings
        from public.fielding_event fe
        join public.match m on m.id = fe.match_id
        where m.series_id = $1
          and ($2::bigint is null or m.division_id is not distinct from $2)
          and fe.fielder_player_id = $3
      `,
      scopeParams
    )
  ).rows[0] || {};

  const battingInnings = toInteger(battingRow.innings) || 0;
  const battingNotOuts = toInteger(battingRow.not_outs) || 0;
  const battingRuns = toInteger(battingRow.runs) || 0;
  const battingBallsFaced = toInteger(battingRow.balls_faced) || 0;
  const battingOuts = Math.max(battingInnings - battingNotOuts, 0);
  const bowlingLegalBalls = toInteger(bowlingRow.legal_balls) || 0;
  const bowlingRunsConceded = toInteger(bowlingRow.runs_conceded) || 0;

  return {
    batting: {
      matches: toInteger(battingRow.matches) || 0,
      innings: battingInnings,
      runs: battingRuns,
      ballsFaced: battingBallsFaced,
      strikeRate: roundMetric(safeDivide(battingRuns * 100, battingBallsFaced)),
      average: roundMetric(safeDivide(battingRuns, battingOuts)),
      fifties: toInteger(battingRow.fifties) || 0,
      hundreds: toInteger(battingRow.hundreds) || 0,
      fours: toInteger(battingRow.fours) || 0,
      sixes: toInteger(battingRow.sixes) || 0,
      notOuts: battingNotOuts,
    },
    bowling: {
      matches: toInteger(bowlingRow.matches) || 0,
      wickets: toInteger(bowlingRow.wickets) || 0,
      legalBalls: bowlingLegalBalls,
      economy: roundMetric(safeDivide(bowlingRunsConceded * 6, bowlingLegalBalls)),
      fourWicketHauls: toInteger(bowlingRow.four_wicket_hauls) || 0,
      fiveWicketHauls: toInteger(bowlingRow.five_wicket_hauls) || 0,
      wides: toInteger(bowlingRow.wides) || 0,
      noBalls: toInteger(bowlingRow.no_balls) || 0,
      foursGiven: toInteger(bowlingBoundaryRow.fours_given) || 0,
      sixesGiven: toInteger(bowlingBoundaryRow.sixes_given) || 0,
    },
    fielding: {
      matches: toInteger(fieldingRow.matches) || 0,
      catches: toInteger(fieldingRow.catches) || 0,
      runOuts: toInteger(fieldingRow.run_outs) || 0,
      stumpings: toInteger(fieldingRow.stumpings) || 0,
    },
  };
}

async function loadAdditionalInsightContext(client, input) {
  const scopeDivisionId = input.scopeType === "division" ? input.divisionId : null;
  const params = [input.seriesId, scopeDivisionId, input.playerId];

  const [
    battingHeadToHeadResult,
    bowlingHeadToHeadResult,
    battingEntryResult,
    bowlingEntryResult,
    battingRoleResult,
    bowlingRoleResult,
  ] = await Promise.all([
    client.query(
      `
        select
          bw.display_name as opponent_name,
          count(distinct pm.match_id)::int as match_count,
          sum(pm.balls)::int as balls,
          sum(pm.batter_runs)::int as runs,
          sum(pm.dismissals)::int as dismissals
        from public.player_matchup pm
        join public.player bw on bw.id = pm.bowler_player_id
        where pm.series_id = $1
          and ($2::bigint is null or pm.division_id is not distinct from $2)
          and pm.batter_player_id = $3
        group by bw.display_name
        order by sum(pm.balls) desc, sum(pm.batter_runs) desc, sum(pm.dismissals) asc, bw.display_name asc
        limit 1
      `,
      params
    ),
    client.query(
      `
        select
          bt.display_name as opponent_name,
          count(distinct pm.match_id)::int as match_count,
          sum(pm.balls)::int as balls,
          sum(pm.total_runs)::int as runs_conceded,
          sum(pm.dismissals)::int as dismissals
        from public.player_matchup pm
        join public.player bt on bt.id = pm.batter_player_id
        where pm.series_id = $1
          and ($2::bigint is null or pm.division_id is not distinct from $2)
          and pm.bowler_player_id = $3
        group by bt.display_name
        order by sum(pm.balls) desc, sum(pm.dismissals) desc, sum(pm.total_runs) asc, bt.display_name asc
        limit 1
      `,
      params
    ),
    client.query(
      `
        with first_ball as (
          select distinct on (be.match_id, be.innings_id)
            be.phase,
            greatest(coalesce(be.score_after_runs, 0) - coalesce(be.total_runs, 0), 0)::int as score_before,
            greatest(
              coalesce(be.wickets_after, 0) - case when be.wicket_flag = true and be.player_out_id = $3 then 1 else 0 end,
              0
            )::int as wickets_before,
            be.over_no
          from public.ball_event be
          join public.match m on m.id = be.match_id
          where m.series_id = $1
            and ($2::bigint is null or m.division_id is not distinct from $2)
            and be.striker_player_id = $3
          order by
            be.match_id,
            be.innings_id,
            be.over_no,
            be.ball_in_over,
            coalesce(be.event_index, 0),
            be.id
        )
        select *
        from first_ball
      `,
      params
    ),
    client.query(
      `
        with first_ball as (
          select distinct on (be.match_id, be.innings_id)
            be.phase,
            greatest(coalesce(be.score_after_runs, 0) - coalesce(be.total_runs, 0), 0)::int as score_before,
            greatest(
              coalesce(be.wickets_after, 0) - case when be.wicket_flag = true and be.wicket_credited_to_bowler = true then 1 else 0 end,
              0
            )::int as wickets_before,
            be.over_no
          from public.ball_event be
          join public.match m on m.id = be.match_id
          where m.series_id = $1
            and ($2::bigint is null or m.division_id is not distinct from $2)
            and be.bowler_player_id = $3
          order by
            be.match_id,
            be.innings_id,
            be.over_no,
            be.ball_in_over,
            coalesce(be.event_index, 0),
            be.id
        )
        select *
        from first_ball
      `,
      params
    ),
    client.query(
      `
        select
          case
            when bi.batting_position = 1 then 'opener'
            when bi.batting_position between 2 and 3 then 'top_order'
            when bi.batting_position between 4 and 6 then 'middle_order'
            when bi.batting_position >= 7 then 'lower_order'
            else 'unclassified'
          end as role_bucket,
          count(*)::int as innings_count,
          round(avg(bi.batting_position)::numeric, 1) as average_position
        from public.batting_innings bi
        join public.match m on m.id = bi.match_id
        where m.series_id = $1
          and ($2::bigint is null or m.division_id is not distinct from $2)
          and bi.player_id = $3
          and bi.did_not_bat = false
        group by role_bucket
        order by innings_count desc, average_position asc nulls last, role_bucket asc
      `,
      params
    ),
    client.query(
      `
        select
          coalesce(nullif(lower(btrim(be.phase)), ''), 'unknown') as phase_bucket,
          count(*) filter (where be.is_legal_ball = true)::int as legal_balls,
          sum(case when be.wicket_flag = true and be.wicket_credited_to_bowler = true then 1 else 0 end)::int as wickets
        from public.ball_event be
        join public.match m on m.id = be.match_id
        where m.series_id = $1
          and ($2::bigint is null or m.division_id is not distinct from $2)
          and be.bowler_player_id = $3
        group by phase_bucket
        having count(*) filter (where be.is_legal_ball = true) > 0
        order by legal_balls desc, wickets desc, phase_bucket asc
      `,
      params
    ),
  ]);

  const battingHeadToHeadRow = battingHeadToHeadResult.rows[0] || null;
  const bowlingHeadToHeadRow = bowlingHeadToHeadResult.rows[0] || null;

  return {
    headToHead: {
      batting: battingHeadToHeadRow
        ? {
            opponentName: normalizeText(battingHeadToHeadRow.opponent_name),
            matchCount: toInteger(battingHeadToHeadRow.match_count) || 0,
            balls: toInteger(battingHeadToHeadRow.balls) || 0,
            runs: toInteger(battingHeadToHeadRow.runs) || 0,
            dismissals: toInteger(battingHeadToHeadRow.dismissals) || 0,
          }
        : null,
      bowling: bowlingHeadToHeadRow
        ? {
            opponentName: normalizeText(bowlingHeadToHeadRow.opponent_name),
            matchCount: toInteger(bowlingHeadToHeadRow.match_count) || 0,
            balls: toInteger(bowlingHeadToHeadRow.balls) || 0,
            runsConceded: toInteger(bowlingHeadToHeadRow.runs_conceded) || 0,
            dismissals: toInteger(bowlingHeadToHeadRow.dismissals) || 0,
          }
        : null,
    },
    entryContext: {
      batting: battingEntryResult.rows.map((row) => ({
        phase: normalizeText(row.phase),
        scoreBefore: toInteger(row.score_before) || 0,
        wicketsBefore: toInteger(row.wickets_before) || 0,
        overNo: toInteger(row.over_no) || 0,
      })),
      bowling: bowlingEntryResult.rows.map((row) => ({
        phase: normalizeText(row.phase),
        scoreBefore: toInteger(row.score_before) || 0,
        wicketsBefore: toInteger(row.wickets_before) || 0,
        overNo: toInteger(row.over_no) || 0,
      })),
    },
    roleUsage: {
      batting: battingRoleResult.rows.map((row) => ({
        roleBucket: normalizeText(row.role_bucket),
        inningsCount: toInteger(row.innings_count) || 0,
        averagePosition: roundMetric(row.average_position, 1),
      })),
      bowling: bowlingRoleResult.rows.map((row) => ({
        phaseBucket: normalizeText(row.phase_bucket),
        legalBalls: toInteger(row.legal_balls) || 0,
        wickets: toInteger(row.wickets) || 0,
      })),
    },
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
      note: `Scored ${battingStrength.runsScored} runs from ${battingStrength.legalBalls} balls against this bowling type across ${battingStrength.matchCount} matches.`,
    });
  }

  const bowlingStrength = pickBestBowlingSplit(input.lens.bowling.byBatterHand);
  if (bowlingStrength) {
    strengths.push({
      label: `Bowling vs ${bowlingStrength.splitLabel}`,
      tone: "good",
      metricLabel: "Economy",
      metricValue: bowlingStrength.economy,
      note: `Took ${bowlingStrength.wickets} wickets from ${bowlingStrength.legalBalls} balls against this batter type and kept a ${bowlingStrength.dotBallPct || 0}% dot-ball rate.`,
    });
  }

  const dismissalRisk = input.lens.dismissals[0] || null;
  if (dismissalRisk) {
    watchouts.push({
      label: `Dismissal pattern vs ${dismissalRisk.bowlerStyleLabel}`,
      tone: "watch",
      metricLabel: "Dismissals",
      metricValue: dismissalRisk.dismissalCount,
      note: `Most wickets here have come through ${dismissalRisk.dismissalType || "this dismissal type"}, usually around ${dismissalRisk.averageRunsAtDismissal || 0} runs at dismissal.`,
    });
  }

  const battingRisk = pickRiskBattingSplit(input.lens.batting.byBowlerType);
  if (battingRisk && (!dismissalRisk || battingRisk.splitLabel !== dismissalRisk.bowlerStyleLabel)) {
    watchouts.push({
      label: `Batting pressure vs ${battingRisk.splitLabel}`,
      tone: "watch",
      metricLabel: "Balls per dismissal",
      metricValue: battingRisk.ballsPerDismissal,
      note: `Dismissed ${battingRisk.dismissals} times in ${battingRisk.legalBalls} balls against this bowling type.`,
    });
  }

  const pressure = input.lens.pressureProfile;
  if (pressure?.boundaryAfterThreeDotsPct !== null && pressure?.boundaryAfterThreeDotsPct !== undefined) {
    pressureSignals.push({
      label: "Boundary after dot-ball pressure",
      tone: pressure.boundaryAfterThreeDotsPct >= 15 ? "good" : "watch",
      metricLabel: "Percent",
      metricValue: pressure.boundaryAfterThreeDotsPct,
      note: "Shows how often the player still finds a boundary after dot-ball pressure builds.",
    });
  }
  if (pressure?.dismissalAfterThreeDotsPct !== null && pressure?.dismissalAfterThreeDotsPct !== undefined) {
    pressureSignals.push({
      label: "Wicket after dot-ball pressure",
      tone: pressure.dismissalAfterThreeDotsPct >= 12 ? "watch" : "good",
      metricLabel: "Percent",
      metricValue: pressure.dismissalAfterThreeDotsPct,
      note: "Shows how often dot-ball pressure turns into a wicket.",
    });
  }
  if (pressure?.battingHighLeverageStrikeRate !== null && pressure?.battingHighLeverageStrikeRate !== undefined) {
    pressureSignals.push({
      label: "Batting in pressure overs",
      tone: pressure.battingHighLeverageStrikeRate >= 110 ? "good" : "watch",
      metricLabel: "Strike Rate",
      metricValue: pressure.battingHighLeverageStrikeRate,
      note: "Shows how the player scores when the game pressure rises.",
    });
  } else if (
    pressure?.bowlingHighLeverageEconomy !== null
    && pressure?.bowlingHighLeverageEconomy !== undefined
  ) {
    pressureSignals.push({
      label: "Bowling in pressure overs",
      tone: pressure.bowlingHighLeverageEconomy <= 8 ? "good" : "watch",
      metricLabel: "Economy",
      metricValue: pressure.bowlingHighLeverageEconomy,
      note: "Shows how well the player controls the game when pressure rises.",
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
      `Most vulnerable batting setup is against ${battingRisk.splitLabel} in the current live sample.`
    );
  }

  const dismissalRisk = lens.dismissals[0] || null;
  if (dismissalRisk) {
    battingPlan.push(
      `${dismissalRisk.bowlerStyleLabel} has produced the most dismissals so far, especially by ${dismissalRisk.dismissalType || "wickets"}.`
    );
  }

  if (lens.pressureProfile?.dismissalDotThreshold !== null && lens.pressureProfile?.dismissalDotThreshold !== undefined) {
    battingPlan.push(
      `Dot-ball pressure matters here. Dismissals have often come after about ${lens.pressureProfile.dismissalDotThreshold} dots in a row.`
    );
  }

  const bowlingStrength = pickBestBowlingSplit(lens.bowling.byBatterHand);
  if (bowlingStrength) {
    bowlingPlan.push(
      `Best bowling setup is against ${bowlingStrength.splitLabel}. That is the cleanest wicket-and-control matchup right now.`
    );
  }

  if (lens.pressureProfile?.bowlingPressureControlErrorPct !== null && lens.pressureProfile?.bowlingPressureControlErrorPct !== undefined) {
    bowlingPlan.push(
      `Under pressure, bowling control errors sit at ${lens.pressureProfile.bowlingPressureControlErrorPct}% through wides and no-balls.`
    );
  }

  if (lens.pressureProfile?.bowlingHighLeverageEconomy !== null && lens.pressureProfile?.bowlingHighLeverageEconomy !== undefined) {
    bowlingPlan.push(
      `Bowling economy in pressure overs is ${lens.pressureProfile.bowlingHighLeverageEconomy}. Use that as the late-innings control marker.`
    );
  }

  return {
    battingPlan: battingPlan.slice(0, MAX_SIGNAL_ROWS),
    bowlingPlan: bowlingPlan.slice(0, MAX_SIGNAL_ROWS),
  };
}

function pickBestPhaseSplit(rowsByPhase, perspective) {
  const candidates = [];

  for (const phaseBucket of ["powerplay", "middle", "death"]) {
    const phaseRows = rowsByPhase?.[phaseBucket] || [];
    for (const row of phaseRows) {
      if ((row.legalBalls || 0) >= MIN_SPLIT_SAMPLE_BALLS) {
        candidates.push({ phaseBucket, row });
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  return candidates.sort((left, right) => {
    if (perspective === "bowling") {
      const wicketDiff = (right.row.wickets || 0) - (left.row.wickets || 0);
      if (wicketDiff !== 0) {
        return wicketDiff;
      }

      const economyLeft = toNumber(left.row.economy, Number.POSITIVE_INFINITY);
      const economyRight = toNumber(right.row.economy, Number.POSITIVE_INFINITY);
      if (economyLeft !== economyRight) {
        return economyLeft - economyRight;
      }
    } else {
      const strikeRateDiff = toNumber(right.row.strikeRate, -1) - toNumber(left.row.strikeRate, -1);
      if (strikeRateDiff !== 0) {
        return strikeRateDiff;
      }

      const runDiff = (right.row.runsScored || 0) - (left.row.runsScored || 0);
      if (runDiff !== 0) {
        return runDiff;
      }
    }

    return (right.row.legalBalls || 0) - (left.row.legalBalls || 0);
  })[0] || null;
}

function buildHeadToHeadInsight(context) {
  const parts = [];

  if (context?.headToHead?.batting?.opponentName) {
    const batting = context.headToHead.batting;
    parts.push(
      `Most repeated batting duel is against ${batting.opponentName}: ${batting.runs} runs from ${batting.balls} balls across ${batting.matchCount} matches${batting.dismissals ? `, with ${batting.dismissals} dismissals` : ""}.`
    );
  }

  if (context?.headToHead?.bowling?.opponentName) {
    const bowling = context.headToHead.bowling;
    parts.push(
      `Most repeated bowling duel is against ${bowling.opponentName}: ${bowling.balls} balls, ${bowling.runsConceded} runs conceded, and ${bowling.dismissals} wickets across ${bowling.matchCount} matches.`
    );
  }

  return parts.join(" ") || "No repeated named duel has enough tracked sample yet.";
}

function buildPhaseMatchupInsight(lens) {
  const batting = pickBestPhaseSplit(lens?.batting?.byBowlerTypePhase, "batting");
  const bowling = pickBestPhaseSplit(lens?.bowling?.byBatterHandPhase, "bowling");
  const parts = [];

  if (batting?.row) {
    parts.push(
      `Batting impact is strongest against ${batting.row.splitLabel} in the ${formatPhaseBucketLabel(batting.phaseBucket)}: ${batting.row.runsScored} runs from ${batting.row.legalBalls} balls at ${batting.row.strikeRate} strike rate.`
    );
  }

  if (bowling?.row) {
    parts.push(
      `Bowling control is strongest against ${bowling.row.splitLabel} in the ${formatPhaseBucketLabel(bowling.phaseBucket)}: ${bowling.row.wickets} wickets from ${bowling.row.legalBalls} balls at ${bowling.row.economy} economy.`
    );
  }

  return parts.join(" ") || "No phase-plus-matchup read is available yet beyond the core lens tables.";
}

function buildEntryStateInsight(context) {
  const battingRows = context?.entryContext?.batting || [];
  const bowlingRows = context?.entryContext?.bowling || [];
  const parts = [];

  if (battingRows.length) {
    parts.push(
      `Batting entries usually start around ${averageNumbers(battingRows.map((row) => row.scoreBefore), 0)} runs with ${averageNumbers(battingRows.map((row) => row.wicketsBefore), 0)} wickets down, most often in the ${formatPhaseBucketLabel(mostCommonValue(battingRows.map((row) => row.phase)))}.`
    );
  }

  if (bowlingRows.length) {
    parts.push(
      `Bowling usually begins in the ${formatPhaseBucketLabel(mostCommonValue(bowlingRows.map((row) => row.phase)))}, with the opposition around ${averageNumbers(bowlingRows.map((row) => row.scoreBefore), 0)} runs and ${averageNumbers(bowlingRows.map((row) => row.wicketsBefore), 0)} wickets down at first use.`
    );
  }

  return parts.join(" ") || "First-use match context is not available yet from the live event sample.";
}

function buildRoleUsageInsight(context) {
  const battingRole = context?.roleUsage?.batting?.[0] || null;
  const bowlingRole = context?.roleUsage?.bowling?.[0] || null;
  const parts = [];

  if (battingRole) {
    parts.push(
      `Used mostly as a ${formatRoleBucketLabel(battingRole.roleBucket)} across ${battingRole.inningsCount} innings.`
    );
  }

  if (bowlingRole) {
    parts.push(
      `Bowling workload sits mainly in the ${formatPhaseBucketLabel(bowlingRole.phaseBucket)}, with ${bowlingRole.legalBalls} legal balls in that phase.`
    );
  }

  return parts.join(" ") || "Role usage is still building from the current sample.";
}

function buildRhythmInsight(profile) {
  if (!profile) {
    return "Pressure rhythm markers are still building from the live sample.";
  }

  const parts = [];

  if (profile.boundaryDotThreshold !== null && profile.boundaryDotThreshold !== undefined) {
    parts.push(`Boundary release usually comes after about ${profile.boundaryDotThreshold} dots.`);
  }

  if (profile.dismissalDotThreshold !== null && profile.dismissalDotThreshold !== undefined) {
    parts.push(`Dismissal pressure appears after about ${profile.dismissalDotThreshold} dots.`);
  }

  if (
    profile.boundaryAfterThreeDotsPct !== null
    && profile.boundaryAfterThreeDotsPct !== undefined
    && profile.dismissalAfterThreeDotsPct !== null
    && profile.dismissalAfterThreeDotsPct !== undefined
  ) {
    parts.push(
      `After three dots, boundary response is ${profile.boundaryAfterThreeDotsPct}% and wicket risk is ${profile.dismissalAfterThreeDotsPct}%.`
    );
  }

  if (profile.battingHighLeverageStrikeRate !== null && profile.battingHighLeverageStrikeRate !== undefined) {
    parts.push(`High-pressure batting strike rate is ${profile.battingHighLeverageStrikeRate}.`);
  } else if (
    profile.bowlingHighLeverageEconomy !== null
    && profile.bowlingHighLeverageEconomy !== undefined
  ) {
    parts.push(`High-pressure bowling economy is ${profile.bowlingHighLeverageEconomy}.`);
  }

  if (
    profile.bowlingPressureControlErrorPct !== null
    && profile.bowlingPressureControlErrorPct !== undefined
  ) {
    parts.push(`Pressure control errors sit at ${profile.bowlingPressureControlErrorPct}% through wides and no-balls.`);
  }

  return parts.join(" ") || "Pressure rhythm markers are still building from the live sample.";
}

function buildDismissalClusterInsight(dismissals) {
  const leadingDismissal = dismissals?.[0] || null;

  if (!leadingDismissal) {
    return "No dismissal cluster is available yet in the live sample.";
  }

  return `Wickets are clustering most against ${leadingDismissal.bowlerStyleLabel}, mainly through ${leadingDismissal.dismissalType || "dismissal events"}. The current pattern shows dismissals around ${leadingDismissal.averageRunsAtDismissal || 0} runs and ${leadingDismissal.averageBallsFacedAtDismissal || 0} balls into the innings.`;
}

function buildEvidenceRankedMatchInsight(commentaryRows) {
  if (!commentaryRows?.length) {
    return "No evidence-ranked match cluster is available yet from commentary-backed events.";
  }

  const matchMap = new Map();

  for (const row of commentaryRows) {
    const matchId = toInteger(row.match_id);
    if (!matchId) {
      continue;
    }

    const existing = matchMap.get(matchId) || {
      matchId,
      matchDate: row.match_date,
      matchTitle: normalizeText(row.match_title),
      score: 0,
      evidenceCount: 0,
    };

    existing.score += toNumber(row.total_event_weight, 0) + toNumber(row.leverage_score, 0);
    existing.evidenceCount += 1;
    matchMap.set(matchId, existing);
  }

  const topMatches = [...matchMap.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.evidenceCount - left.evidenceCount;
    })
    .slice(0, 3);

  if (!topMatches.length) {
    return "No evidence-ranked match cluster is available yet from commentary-backed events.";
  }

  const labels = topMatches.map((match) => `${formatDate(match.matchDate)} ${match.matchTitle}`.trim());
  return `The first matches to review are ${labels.join(", ")}. These currently carry the strongest commentary-backed evidence for this player.`;
}

function buildAdditionalInsights(input) {
  return {
    matchupAndUsage: [
      {
        title: "Named head-to-heads",
        detail: buildHeadToHeadInsight(input.context),
      },
      {
        title: "Phase and matchup lens",
        detail: buildPhaseMatchupInsight(input.lens),
      },
      {
        title: "Entry-state context",
        detail: buildEntryStateInsight(input.context),
      },
      {
        title: "Role usage patterns",
        detail: buildRoleUsageInsight(input.context),
      },
    ],
    pressureAndEvidence: [
      {
        title: "Rhythm signals",
        detail: buildRhythmInsight(input.lens?.pressureProfile || null),
      },
      {
        title: "Dismissal clustering",
        detail: buildDismissalClusterInsight(input.lens?.dismissals || []),
      },
      {
        title: "Evidence-ranked matches",
        detail: buildEvidenceRankedMatchInsight(input.commentaryRows || []),
      },
    ],
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
    sourceMatchId: normalizeText(row.source_match_id),
    matchDate: row.match_date,
    matchDateLabel: formatDate(row.match_date),
    matchTitle: normalizeText(row.match_title),
    divisionLabel: normalizeText(row.division_label),
    matchPageUrl: normalizeText(row.match_page_url),
    scorecardUrl: normalizeText(row.scorecard_url),
    ballByBallUrl: normalizeText(row.ball_by_ball_url),
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
        m.source_match_id,
        m.match_date,
        m.match_page_url,
        m.scorecard_url,
        m.ball_by_ball_url,
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

    const [commentaryRows, summaryStats, additionalInsightContext] = await Promise.all([
      loadCommentaryRows(client, {
        seriesId: context.seriesId,
        divisionId: focusedScope.scopeType === "division" ? focusedScope.divisionId : null,
        playerId,
      }),
      loadSummaryStats(client, {
        seriesId: context.seriesId,
        scopeType: focusedScope.scopeType,
        divisionId: focusedScope.divisionId,
        playerId,
      }),
      loadAdditionalInsightContext(client, {
        seriesId: context.seriesId,
        scopeType: focusedScope.scopeType,
        divisionId: focusedScope.divisionId,
        playerId,
      }),
    ]);

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
          "batting_innings",
          "bowling_spell",
          "ball_event",
          "fielding_event",
          "player_matchup",
        ],
      },
      header,
      summaryStats,
      tacticalSummary: buildSignalCards({
        lens: focusedLens,
      }),
      focusedLens,
      seriesLens: focusedScope.scopeType === "division" ? seriesLens : null,
      tacticalPlan: buildTacticalPlan(focusedLens),
      additionalInsights: buildAdditionalInsights({
        lens: focusedLens,
        context: additionalInsightContext,
        commentaryRows,
      }),
      commentaryEvidence: buildCommentaryEvidence(commentaryRows, playerId),
    };
  });
}

module.exports = {
  getPlayerIntelligenceReport,
};

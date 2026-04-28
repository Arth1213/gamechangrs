"use strict";

const { getPlayerReport } = require("./reportService");
const { resolveSeriesContext, withClient } = require("./seriesService");
const {
  formatDate,
  normalizeLabel,
  normalizeText,
  roundNumeric,
  safeDivide,
  toInteger,
  toNumber,
} = require("../lib/utils");

function parseMentionedNumber(pattern, value) {
  const match = normalizeLabel(value).match(pattern);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectQuestionFocus(question) {
  const normalized = normalizeLabel(question);

  return {
    mentionsCommentary:
      normalized.includes("commentary")
      || normalized.includes("ball by ball")
      || normalized.includes("ball-by-ball")
      || normalized.includes("delivery"),
    mentionsTopOrder:
      normalized.includes("top order")
      || normalized.includes("top-order")
      || normalized.includes("opening batter")
      || normalized.includes("opener"),
    mentionsMiddleOrder:
      normalized.includes("middle order")
      || normalized.includes("middle-order"),
    mentionsLowerOrder:
      normalized.includes("lower order")
      || normalized.includes("lower-order")
      || normalized.includes("tail"),
    mentionsBowling:
      normalized.includes("bowling")
      || normalized.includes("bowl")
      || normalized.includes("spell")
      || normalized.includes("wicket"),
    mentionsBatting:
      normalized.includes("batting")
      || normalized.includes("batted")
      || normalized.includes("runs")
      || normalized.includes("scored"),
    mentionedPhaseNo: parseMentionedNumber(/phase\s*(\d+)/, normalized),
    mentionedDivisionNo: parseMentionedNumber(/(?:div|division|dev)\s*(\d+)/, normalized),
  };
}

function classifyBattingOrder(position) {
  const battingPosition = toInteger(position);
  if (!battingPosition || battingPosition <= 0) {
    return "unclassified";
  }
  if (battingPosition <= 3) {
    return "top_order";
  }
  if (battingPosition <= 6) {
    return "middle_order";
  }
  return "lower_order";
}

function humanizeBattingOrder(bucket) {
  switch (normalizeLabel(bucket)) {
    case "top_order":
      return "Top Order (1-3)";
    case "middle_order":
      return "Middle Order (4-6)";
    case "lower_order":
      return "Lower Order (7+)";
    default:
      return "Unclassified";
  }
}

function mapDivisionSummaryRow(row) {
  return {
    divisionId: toInteger(row.division_id),
    divisionLabel: normalizeText(row.division_label),
    teamName: normalizeText(row.team_name),
    roleType: normalizeText(row.role_type),
    roleLabel: normalizeText(row.role_label),
    compositeScore: roundNumeric(row.composite_score),
    percentileRank: roundNumeric(row.percentile_rank),
    confidenceScore: roundNumeric(row.confidence_score),
    strongOppositionScore: roundNumeric(row.strong_opposition_score),
    recentFormScore: roundNumeric(row.recent_form_score),
    leverageScore: roundNumeric(row.leverage_score),
    consistencyScore: roundNumeric(row.consistency_score),
    versatilityScore: roundNumeric(row.versatility_score),
    developmentTrendScore: roundNumeric(row.development_trend_score),
  };
}

function mapMatchContextRow(row) {
  return {
    matchId: toInteger(row.match_id),
    matchDate: row.match_date,
    matchDateLabel: formatDate(row.match_date),
    matchTitle: normalizeText(row.match_title),
    divisionId: toInteger(row.division_id),
    divisionLabel: normalizeText(row.division_label),
    roleTypes: normalizeText(row.role_types),
    matchImpactScore: roundNumeric(row.match_impact_score),
    teamStrengthAdjustedScore: roundNumeric(row.team_strength_adjusted_score),
    playerStrengthAdjustedScore: roundNumeric(row.player_strength_adjusted_score),
    leverageAdjustedScore: roundNumeric(row.leverage_adjusted_score),
    battingRuns: toInteger(row.batting_runs) || 0,
    ballsFaced: toInteger(row.balls_faced) || 0,
    legalBallsBowled: toInteger(row.legal_balls_bowled) || 0,
    totalRunsConceded: toInteger(row.total_runs_conceded) || 0,
    fieldingImpactScore: roundNumeric(row.fielding_impact_score),
  };
}

function mapEventContextRow(row) {
  return {
    matchId: toInteger(row.match_id),
    matchDate: row.match_date,
    matchDateLabel: formatDate(row.match_date),
    matchTitle: normalizeText(row.match_title),
    divisionId: toInteger(row.division_id),
    divisionLabel: normalizeText(row.division_label),
    inningsNo: toInteger(row.innings_no),
    ballLabel: normalizeText(row.ball_label),
    phase: normalizeText(row.phase),
    strikerName: normalizeText(row.striker_name),
    strikerBattingPosition: toInteger(row.striker_batting_position),
    strikerOrderBucket: humanizeBattingOrder(row.striker_order_bucket),
    bowlerName: normalizeText(row.bowler_name),
    playerOutName: normalizeText(row.player_out_name),
    fielderName: normalizeText(row.fielder_name),
    batterRuns: toInteger(row.batter_runs) || 0,
    totalRuns: toInteger(row.total_runs) || 0,
    isLegalBall: row.is_legal_ball === true,
    wicketFlag: row.wicket_flag === true,
    wicketCreditedToBowler: row.wicket_credited_to_bowler === true,
    dismissalType: normalizeText(row.dismissal_type),
    leverageScore: roundNumeric(row.leverage_score),
    totalEventWeight: roundNumeric(row.total_event_weight),
    commentaryText: normalizeText(row.commentary_text),
  };
}

function mapBowlingOrderSplitRow(row) {
  const balls = toInteger(row.legal_balls) || 0;
  const runsConceded = toInteger(row.runs_conceded) || 0;
  const wickets = toInteger(row.wickets) || 0;
  const dotBalls = toInteger(row.dot_balls) || 0;
  const boundaries = toInteger(row.boundaries) || 0;

  return {
    divisionId: toInteger(row.division_id),
    divisionLabel: normalizeText(row.division_label),
    battingOrderBucket: humanizeBattingOrder(row.batting_order_bucket),
    battingOrderRule: "Top Order = positions 1-3; Middle Order = 4-6; Lower Order = 7+",
    distinctBatters: toInteger(row.distinct_batters) || 0,
    balls,
    runsConceded,
    wickets,
    dotPct: roundNumeric(safeDivide(dotBalls, balls, 0) * 100),
    boundaryPct: roundNumeric(safeDivide(boundaries, balls, 0) * 100),
    economy: roundNumeric(safeDivide(runsConceded * 6, balls, 0)),
  };
}

async function getPlayerChatContext(input) {
  const playerId = toInteger(input.playerId);
  const requestedDivisionId = toInteger(input.divisionId);

  if (!playerId) {
    const error = new Error("playerId must be a valid integer.");
    error.statusCode = 400;
    throw error;
  }

  const report = await getPlayerReport({
    seriesConfigKey: input.seriesConfigKey,
    playerId,
    divisionId: requestedDivisionId,
  });

  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey, { ensureReportProfile: false });
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    const selectedDivisionId = toInteger(report?.meta?.player?.divisionId) || requestedDivisionId;
    const selectedDivisionLabel = normalizeText(
      report?.header?.divisionLabel
      || report?.meta?.player?.divisionOptions?.find((option) => toInteger(option.divisionId) === selectedDivisionId)?.divisionLabel
    );
    const questionFocus = detectQuestionFocus(input.question);

    const divisionSummaryRows = (
      await client.query(
        `
          select
            psa.division_id,
            d.source_label as division_label,
            t.display_name as team_name,
            psa.role_type,
            case psa.role_type
              when 'batting' then 'Batter'
              when 'bowling' then 'Bowler'
              when 'batting_all_rounder' then 'Batting All-Rounder'
              when 'bowling_all_rounder' then 'Bowling All-Rounder'
              when 'wicketkeeper_batter' then 'Wicketkeeper-Batter'
              when 'fielding' then 'Fielder'
              when 'wicketkeeping' then 'Wicketkeeper'
              else psa.role_type
            end as role_label,
            pcs.composite_score,
            pcs.percentile_rank,
            psa.confidence_score,
            psa.strong_opposition_score,
            psa.recent_form_score,
            psa.leverage_score,
            psa.consistency_score,
            psa.versatility_score,
            psa.development_trend_score
          from player_season_advanced psa
          left join division d on d.id = psa.division_id
          left join team t on t.id = psa.team_id
          left join player_composite_score pcs
            on pcs.series_id = psa.series_id
           and pcs.division_id is not distinct from psa.division_id
           and pcs.player_id = psa.player_id
          where psa.series_id = $1
            and psa.player_id = $2
          order by
            case when psa.division_id is not distinct from $3 then 0 else 1 end,
            d.phase_no nulls last,
            d.division_no nulls last,
            d.source_label,
            psa.id
        `,
        [context.seriesId, playerId, selectedDivisionId]
      )
    ).rows.map(mapDivisionSummaryRow);

    const recentMatches = (
      await client.query(
        `
          select
            pma.match_id,
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title,
            m.division_id,
            d.source_label as division_label,
            string_agg(distinct pma.role_type, ', ' order by pma.role_type) as role_types,
            avg(pma.match_impact_score)::numeric(10,4) as match_impact_score,
            avg(pma.team_strength_adjusted_score)::numeric(10,4) as team_strength_adjusted_score,
            avg(pma.player_strength_adjusted_score)::numeric(10,4) as player_strength_adjusted_score,
            avg(pma.leverage_adjusted_score)::numeric(10,4) as leverage_adjusted_score,
            sum(pma.batter_runs)::int as batting_runs,
            sum(pma.balls_faced)::int as balls_faced,
            sum(pma.legal_balls_bowled)::int as legal_balls_bowled,
            sum(pma.total_runs_conceded)::int as total_runs_conceded,
            avg(pma.fielding_impact_score)::numeric(10,4) as fielding_impact_score
          from player_match_advanced pma
          join match m on m.id = pma.match_id
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          left join division d on d.id = m.division_id
          where m.series_id = $1
            and pma.player_id = $2
          group by
            pma.match_id,
            m.match_date,
            t1.display_name,
            t2.display_name,
            m.division_id,
            d.source_label
          order by m.match_date desc nulls last, pma.match_id desc
          limit 24
        `,
        [context.seriesId, playerId]
      )
    ).rows.map(mapMatchContextRow);

    const highLeverageEvents = (
      await client.query(
        `
          select
            be.match_id,
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title,
            m.division_id,
            d.source_label as division_label,
            be.innings_no,
            be.ball_label,
            be.phase,
            be.striker_player_id,
            sp.display_name as striker_name,
            bi.batting_position as striker_batting_position,
            case
              when bi.batting_position between 1 and 3 then 'top_order'
              when bi.batting_position between 4 and 6 then 'middle_order'
              when bi.batting_position >= 7 then 'lower_order'
              else 'unclassified'
            end as striker_order_bucket,
            bw.display_name as bowler_name,
            po.display_name as player_out_name,
            fp.display_name as fielder_name,
            be.batter_runs,
            be.total_runs,
            be.is_legal_ball,
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
          left join player fp on fp.id = be.primary_fielder_player_id
          left join batting_innings bi
            on bi.innings_id = be.innings_id
           and bi.player_id = be.striker_player_id
          where m.series_id = $1
            and (
              be.striker_player_id = $2
              or be.bowler_player_id = $2
              or be.player_out_id = $2
              or be.primary_fielder_player_id = $2
            )
          order by be.total_event_weight desc nulls last, be.leverage_score desc nulls last, m.match_date desc nulls last, be.id desc
          limit 60
        `,
        [context.seriesId, playerId]
      )
    ).rows.map(mapEventContextRow);

    const bowlingVsBattingOrder = (
      await client.query(
        `
          select
            m.division_id,
            d.source_label as division_label,
            case
              when bi.batting_position between 1 and 3 then 'top_order'
              when bi.batting_position between 4 and 6 then 'middle_order'
              when bi.batting_position >= 7 then 'lower_order'
              else 'unclassified'
            end as batting_order_bucket,
            count(distinct be.striker_player_id)::int as distinct_batters,
            count(*) filter (where be.is_legal_ball = true)::int as legal_balls,
            sum(be.total_runs)::int as runs_conceded,
            sum(case when be.is_legal_ball = true and be.total_runs = 0 then 1 else 0 end)::int as dot_balls,
            sum(case when be.batter_runs in (4, 6) then 1 else 0 end)::int as boundaries,
            sum(case when be.wicket_flag = true and be.wicket_credited_to_bowler = true then 1 else 0 end)::int as wickets
          from ball_event be
          join match m on m.id = be.match_id
          left join division d on d.id = m.division_id
          left join batting_innings bi
            on bi.innings_id = be.innings_id
           and bi.player_id = be.striker_player_id
          where m.series_id = $1
            and be.bowler_player_id = $2
          group by m.division_id, d.source_label, batting_order_bucket
          order by d.source_label nulls last, batting_order_bucket
        `,
        [context.seriesId, playerId]
      )
    ).rows.map(mapBowlingOrderSplitRow);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        series: {
          configKey: context.configKey,
          seriesId: context.seriesId,
          name: context.seriesName,
          targetAgeGroup: context.targetAgeGroup,
        },
        player: {
          playerId,
          playerName: normalizeText(report?.meta?.player?.playerName || report?.header?.playerName),
          teamName: normalizeText(report?.meta?.player?.teamName || report?.header?.teamName),
          selectedDivisionId,
          selectedDivisionLabel,
        },
      },
      questionFocus,
      report,
      divisionSummary: divisionSummaryRows,
      recentMatches,
      highLeverageEvents,
      bowlingVsBattingOrder,
      limitations: [
        "Chat answers are limited to the live cricket dataset already stored for this series.",
        "Batting-order buckets use batting positions 1-3 as top order, 4-6 as middle order, and 7+ as lower order.",
      ],
    };
  });
}

module.exports = {
  getPlayerChatContext,
};

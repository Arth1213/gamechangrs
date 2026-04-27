"use strict";

const {
  average,
  clamp,
  confidenceLabel,
  formatDate,
  humanizeRole,
  normalizeLabel,
  normalizeText,
  recommendationLabel,
  roundNumeric,
  safeDivide,
  toInteger,
  toNumber,
  toneForScore,
} = require("../lib/utils");
const {
  fetchOne,
  resolveSeriesContext,
  withClient,
} = require("./seriesService");

async function getDashboardOverview(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    const leaderboard = (
      await client.query(
        `
          select
            pcs.player_id,
            pcs.division_id,
            p.display_name,
            t.display_name as team_name,
            d.source_label as division_label,
            psa.role_type,
            pcs.composite_score,
            pcs.percentile_rank,
            psa.confidence_score
          from player_composite_score pcs
          join player p on p.id = pcs.player_id
          left join team t on t.id = pcs.team_id
          left join division d on d.id = pcs.division_id
          left join player_season_advanced psa
            on psa.series_id = pcs.series_id
           and psa.division_id is not distinct from pcs.division_id
           and psa.player_id = pcs.player_id
          where pcs.series_id = $1
          order by pcs.composite_score desc, p.display_name
          limit 12
        `,
        [context.seriesId]
      )
    ).rows.map((row) => ({
      playerId: toInteger(row.player_id),
      divisionId: toInteger(row.division_id),
      displayName: normalizeText(row.display_name),
      teamName: normalizeText(row.team_name),
      divisionLabel: normalizeText(row.division_label),
      roleType: normalizeText(row.role_type),
      roleLabel: humanizeRole(row.role_type),
      compositeScore: roundNumeric(row.composite_score),
      percentileRank: roundNumeric(row.percentile_rank),
      confidenceScore: roundNumeric(row.confidence_score),
      confidenceLabel: confidenceLabel(row.confidence_score),
      reportPath: `/series/${context.configKey}/players/${row.player_id}/report?divisionId=${row.division_id}`,
    }));

    const roleLeadersResult = await client.query(
      `
        with ranked as (
          select
            pcs.player_id,
            pcs.division_id,
            p.display_name,
            t.display_name as team_name,
            d.source_label as division_label,
            psa.role_type,
            pcs.composite_score,
            pcs.percentile_rank,
            row_number() over (
              partition by psa.role_type
              order by pcs.composite_score desc, p.display_name
            ) as role_rank
          from player_composite_score pcs
          join player p on p.id = pcs.player_id
          left join team t on t.id = pcs.team_id
          left join division d on d.id = pcs.division_id
          left join player_season_advanced psa
            on psa.series_id = pcs.series_id
           and psa.division_id is not distinct from pcs.division_id
           and psa.player_id = pcs.player_id
          where pcs.series_id = $1
        )
        select *
        from ranked
        where role_rank <= 3
        order by role_type, role_rank
      `,
      [context.seriesId]
    );

    const roleLeaders = roleLeadersResult.rows.reduce((acc, row) => {
      const roleKey = normalizeText(row.role_type) || "unclassified";
      if (!acc[roleKey]) {
        acc[roleKey] = [];
      }
      acc[roleKey].push({
        playerId: toInteger(row.player_id),
        divisionId: toInteger(row.division_id),
        displayName: normalizeText(row.display_name),
        teamName: normalizeText(row.team_name),
        divisionLabel: normalizeText(row.division_label),
        compositeScore: roundNumeric(row.composite_score),
        percentileRank: roundNumeric(row.percentile_rank),
        reportPath: `/series/${context.configKey}/players/${row.player_id}/report?divisionId=${row.division_id}`,
      });
      return acc;
    }, {});

    const qualitySummary = await fetchOne(
      client,
      `
        select
          count(*)::int as total_matches,
          count(*) filter (where analytics_status = 'computed')::int as computed_matches,
          count(*) filter (where reconciliation_status = 'warn')::int as warning_matches,
          count(*) filter (where admin_selection_override <> 'auto')::int as admin_overrides,
          count(*) filter (where needs_recompute = true or needs_reparse = true or needs_rescrape = true)::int as pending_ops
        from match_refresh_state
        where match_id in (
          select id from match where series_id = $1
        )
      `,
      [context.seriesId]
    );

    const recentMatches = (
      await client.query(
        `
          select
            m.id,
            m.source_match_id,
            m.match_date,
            d.source_label as division_label,
            t1.display_name || ' v ' || t2.display_name as match_title,
            m.result_text,
            mrs.reconciliation_status,
            mrs.analytics_status
          from match m
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          left join division d on d.id = m.division_id
          left join match_refresh_state mrs on mrs.match_id = m.id
          where m.series_id = $1
          order by m.match_date desc nulls last, m.id desc
          limit 8
        `,
        [context.seriesId]
      )
    ).rows.map((row) => ({
      matchId: toInteger(row.id),
      sourceMatchId: normalizeText(row.source_match_id),
      matchDate: row.match_date,
      matchDateLabel: formatDate(row.match_date),
      matchTitle: normalizeText(row.match_title),
      divisionLabel: normalizeText(row.division_label),
      resultText: normalizeText(row.result_text),
      reconciliationStatus: normalizeText(row.reconciliation_status) || "pending",
      analyticsStatus: normalizeText(row.analytics_status) || "pending",
    }));

    return {
      series: {
        configKey: context.configKey,
        name: context.seriesName,
        targetAgeGroup: context.targetAgeGroup,
      },
      reportProfile: context.reportProfile,
      leaderboard,
      roleLeaders,
      qualitySummary: {
        totalMatches: toInteger(qualitySummary?.total_matches) || 0,
        computedMatches: toInteger(qualitySummary?.computed_matches) || 0,
        warningMatches: toInteger(qualitySummary?.warning_matches) || 0,
        adminOverrides: toInteger(qualitySummary?.admin_overrides) || 0,
        pendingOps: toInteger(qualitySummary?.pending_ops) || 0,
      },
      recentMatches,
    };
  });
}

async function searchPlayers(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    const query = normalizeText(input.query);
    const limit = Math.min(Math.max(toInteger(input.limit) || 12, 1), 30);
    const like = query ? `%${query}%` : null;

    const rows = (
      await client.query(
        `
          select
            pcs.player_id,
            pcs.division_id,
            p.display_name,
            p.canonical_name,
            t.display_name as team_name,
            d.source_label as division_label,
            psa.role_type,
            pcs.composite_score,
            pcs.percentile_rank,
            psa.confidence_score
          from player_composite_score pcs
          join player p on p.id = pcs.player_id
          left join team t on t.id = pcs.team_id
          left join division d on d.id = pcs.division_id
          left join player_season_advanced psa
            on psa.series_id = pcs.series_id
           and psa.division_id is not distinct from pcs.division_id
           and psa.player_id = pcs.player_id
          where pcs.series_id = $1
            and (
              $2::text is null
              or p.display_name ilike $2
              or p.canonical_name ilike $2
            )
          order by
            case
              when $3::text <> '' and lower(p.display_name) = lower($3) then 0
              when $3::text <> '' and p.display_name ilike ($3 || '%') then 1
              else 2
            end,
            pcs.composite_score desc,
            p.display_name asc
          limit $4
        `,
        [context.seriesId, like, query, limit]
      )
    ).rows;

    return {
      series: {
        configKey: context.configKey,
        name: context.seriesName,
      },
      query,
      resultCount: rows.length,
      results: rows.map((row) => ({
        playerId: toInteger(row.player_id),
        divisionId: toInteger(row.division_id),
        displayName: normalizeText(row.display_name),
        canonicalName: normalizeText(row.canonical_name),
        teamName: normalizeText(row.team_name),
        divisionLabel: normalizeText(row.division_label),
        roleType: normalizeText(row.role_type),
        roleLabel: humanizeRole(row.role_type),
        compositeScore: roundNumeric(row.composite_score),
        percentileRank: roundNumeric(row.percentile_rank),
        confidenceScore: roundNumeric(row.confidence_score),
        confidenceLabel: confidenceLabel(row.confidence_score),
        reportPath: `/series/${context.configKey}/players/${row.player_id}/report?divisionId=${row.division_id}`,
        apiPath: `/api/series/${context.configKey}/players/${row.player_id}/report?divisionId=${row.division_id}`,
      })),
    };
  });
}

async function getPlayerReport(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    const playerId = toInteger(input.playerId);
    const divisionId = toInteger(input.divisionId);
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
        [context.seriesId, playerId, divisionId]
      )
    ).rows;

    if (!seasonRows.length) {
      const error = new Error(`No season analytics found for player ${playerId}.`);
      error.statusCode = 404;
      throw error;
    }

    const selectedSeason = pickSelectedSeasonRow(seasonRows, divisionId);
    const selectedDivisionId = toInteger(selectedSeason.division_id);

    const matchRows = (
      await client.query(
        `
          select
            pma.role_type,
            pma.match_id,
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title,
            pma.match_impact_score,
            pma.team_strength_adjusted_score,
            pma.player_strength_adjusted_score,
            pma.leverage_adjusted_score,
            pma.balls_faced,
            pma.batter_runs,
            pma.legal_balls_bowled,
            pma.bowler_runs_conceded,
            pma.total_runs_conceded,
            pma.wicket_ball_pct,
            pma.boundary_conceded_pct,
            pma.fielding_impact_score
          from player_match_advanced pma
          join match m on m.id = pma.match_id
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          where m.series_id = $1
            and pma.player_id = $2
            and pma.division_id is not distinct from $3
          order by m.match_date desc nulls last, pma.match_id desc, pma.role_type
        `,
        [context.seriesId, playerId, selectedDivisionId]
      )
    ).rows;

    const matchupRows = (
      await client.query(
        `
          select
            pm.batter_player_id,
            pm.bowler_player_id,
            bp.display_name as batter_name,
            bw.display_name as bowler_name,
            sum(pm.balls)::int as balls,
            sum(pm.batter_runs)::int as batter_runs,
            sum(pm.total_runs)::int as total_runs,
            sum(pm.dismissals)::int as dismissals,
            sum(pm.dots)::int as dots,
            sum(pm.fours)::int as fours,
            sum(pm.sixes)::int as sixes
          from player_matchup pm
          join player bp on bp.id = pm.batter_player_id
          join player bw on bw.id = pm.bowler_player_id
          where pm.series_id = $1
            and pm.division_id is not distinct from $2
            and (pm.batter_player_id = $3 or pm.bowler_player_id = $3)
          group by 1,2,3,4
          order by sum(pm.balls) desc, sum(pm.batter_runs) desc
        `,
        [context.seriesId, selectedDivisionId, playerId]
      )
    ).rows;

    const ballEventRows = (
      await client.query(
        `
          select
            be.*,
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title,
            sp.display_name as striker_name,
            bw.display_name as bowler_name,
            po.display_name as player_out_name,
            fp.display_name as fielder_name
          from ball_event be
          join match m on m.id = be.match_id
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          left join player sp on sp.id = be.striker_player_id
          left join player bw on bw.id = be.bowler_player_id
          left join player po on po.id = be.player_out_id
          left join player fp on fp.id = be.primary_fielder_player_id
          where m.series_id = $1
            and m.division_id is not distinct from $2
            and (
              be.striker_player_id = $3
              or be.bowler_player_id = $3
              or be.player_out_id = $3
              or be.primary_fielder_player_id = $3
            )
          order by m.match_date desc nulls last, be.match_id desc, be.innings_no, be.event_index, be.id
        `,
        [context.seriesId, selectedDivisionId, playerId]
      )
    ).rows;

    const overRows = (
      await client.query(
        `
          select
            os.match_id,
            os.over_no,
            os.legal_balls,
            os.runs_in_over,
            os.wickets_in_over,
            os.over_state_text,
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title
          from over_summary os
          join match m on m.id = os.match_id
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          where m.series_id = $1
            and m.division_id is not distinct from $2
            and os.bowler_player_id = $3
          order by m.match_date desc nulls last, os.match_id desc, os.over_no
        `,
        [context.seriesId, selectedDivisionId, playerId]
      )
    ).rows;

    const battingDismissalRows = (
      await client.query(
        `
          select
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title,
            bi.runs,
            bi.balls_faced,
            bi.dismissal_type,
            bi.dismissal_text,
            dp.display_name as dismissed_by_name,
            fp.display_name as fielder_name
          from batting_innings bi
          join match m on m.id = bi.match_id
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          left join player dp on dp.id = bi.dismissed_by_player_id
          left join player fp on fp.id = bi.primary_fielder_player_id
          where m.series_id = $1
            and m.division_id is not distinct from $2
            and bi.player_id = $3
            and bi.did_not_bat = false
          order by m.match_date desc nulls last, bi.match_id desc, bi.id
        `,
        [context.seriesId, selectedDivisionId, playerId]
      )
    ).rows;

    const fieldingLogRows = (
      await client.query(
        `
          select
            m.match_date,
            t1.display_name || ' v ' || t2.display_name as match_title,
            fe.over_no,
            fe.ball_no,
            fe.dismissal_type,
            fe.is_direct_run_out,
            fe.is_indirect_run_out,
            fe.is_wicketkeeper_event,
            fe.notes,
            po.display_name as player_out_name,
            bp.display_name as bowler_name
          from fielding_event fe
          join match m on m.id = fe.match_id
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          left join player po on po.id = fe.player_out_id
          left join player bp on bp.id = fe.bowler_player_id
          where m.series_id = $1
            and m.division_id is not distinct from $2
            and fe.fielder_player_id = $3
          order by m.match_date desc nulls last, fe.match_id desc, fe.innings_id desc, fe.over_no desc nulls last
        `,
        [context.seriesId, selectedDivisionId, playerId]
      )
    ).rows;

    const wicketkeepingSummary = await fetchOne(
      client,
      `
        select
          avg(fielding_impact_score)::numeric(10,4) as wicketkeeping_score,
          count(*)::int as event_count
        from player_match_advanced pma
        join match m on m.id = pma.match_id
        where m.series_id = $1
          and pma.division_id is not distinct from $2
          and pma.player_id = $3
          and pma.role_type = 'wicketkeeping'
      `,
      [context.seriesId, selectedDivisionId, playerId]
    );

    const currentSeriesStats = await loadStatPanels(client, {
      playerId,
      seriesId: context.seriesId,
      scope: "series",
    });
    const overallStats = await loadStatPanels(client, {
      playerId,
      seriesId: context.seriesId,
      scope: "overall",
    });
    const peerRows = await loadPeerRows(client, {
      seriesId: context.seriesId,
      divisionId: selectedDivisionId,
      roleType: selectedSeason.role_type,
      playerId,
      compositeScore: selectedSeason.composite_score,
      peerCount: toInteger(context.reportProfile?.peer_count) || 3,
    });

    const derived = deriveReportMetrics({
      context,
      playerId,
      seasonRows,
      selectedSeason,
      matchRows,
      matchupRows,
      ballEventRows,
      overRows,
      battingDismissalRows,
      fieldingLogRows,
      wicketkeepingSummary,
      currentSeriesStats,
      overallStats,
      peerRows,
    });

    const meta = {
      generatedAt: new Date().toISOString(),
      series: {
        configKey: context.configKey,
        name: context.seriesName,
        targetAgeGroup: context.targetAgeGroup,
      },
      reportProfile: {
        key: normalizeText(context.reportProfile?.profile_key),
        name: normalizeText(context.reportProfile?.name),
        themeName: normalizeText(context.reportProfile?.theme_name),
        peerCount: toInteger(context.reportProfile?.peer_count) || 3,
      },
      scoringModel: {
        modelKey: normalizeText(context.scoringModel?.model_key),
        name: normalizeText(context.scoringModel?.name),
        version: normalizeText(context.scoringModel?.version_label),
      },
      player: {
        playerId,
        divisionId: selectedDivisionId,
        playerName: normalizeText(selectedSeason.player_name),
        canonicalName: normalizeText(selectedSeason.canonical_name),
        teamName: normalizeText(selectedSeason.team_name),
        divisionOptions: seasonRows.map((row) => ({
          divisionId: toInteger(row.division_id),
          divisionLabel: normalizeText(row.division_label),
          roleType: normalizeText(row.role_type),
          compositeScore: roundNumeric(row.composite_score),
        })),
      },
    };

    return {
      meta,
      header: derived.header,
      scores: derived.scores,
      assessmentSnapshot: derived.assessmentSnapshot,
      visualReadout: derived.visualReadout,
      contextPerformance: derived.contextPerformance,
      peerComparison: derived.peerComparison,
      trends: derived.trends,
      matchEvidence: derived.matchEvidence,
      selectorInterpretation: derived.selectorInterpretation,
      selectorTakeaway: derived.selectorTakeaway,
      standardStats: derived.standardStats,
      reportPayload: buildExecutiveReportPayload({
        meta,
        header: derived.header,
        scores: derived.scores,
        assessmentSnapshot: derived.assessmentSnapshot,
        contextPerformance: derived.contextPerformance,
        peerComparison: derived.peerComparison,
        selectorInterpretation: derived.selectorInterpretation,
        selectorTakeaway: derived.selectorTakeaway,
        standardStats: derived.standardStats,
        trends: derived.trends,
        signalMetrics: derived.signalMetrics,
      }),
      drilldowns: derived.drilldowns,
    };
  });
}

async function loadStatPanels(client, input) {
  const params = [input.playerId];
  let whereSql = "where player_id = $1";

  if (input.scope === "series") {
    params.push(input.seriesId);
    whereSql += ` and series_id = $2`;
  }

  const result = await client.query(
    `
      with latest as (
        select distinct on (${input.scope === "series" ? "division_id, stat_type" : "series_id, division_id, stat_type"})
          *
        from player_stats_snapshot
        ${whereSql}
        order by ${input.scope === "series" ? "division_id, stat_type" : "series_id, division_id, stat_type"}, snapshot_date desc, id desc
      )
      select
        stat_type,
        sum(matches)::int as matches,
        sum(innings)::int as innings,
        sum(not_outs)::int as not_outs,
        sum(runs)::int as runs,
        sum(balls_faced)::int as balls_faced,
        sum(fours)::int as fours,
        sum(sixes)::int as sixes,
        max(highest_score) as highest_score,
        avg(batting_average)::numeric(10,2) as batting_average,
        avg(strike_rate)::numeric(10,2) as strike_rate,
        sum(overs_decimal)::numeric(10,2) as overs_decimal,
        sum(legal_balls)::int as legal_balls,
        sum(maidens)::int as maidens,
        sum(runs_conceded)::int as runs_conceded,
        sum(wickets)::int as wickets,
        max(best_bowling) as best_bowling,
        avg(bowling_average)::numeric(10,2) as bowling_average,
        avg(bowling_strike_rate)::numeric(10,2) as bowling_strike_rate,
        avg(economy)::numeric(10,2) as economy,
        sum(catches)::int as catches,
        sum(wk_catches)::int as wk_catches,
        sum(direct_run_outs)::int as direct_run_outs,
        sum(indirect_run_outs)::int as indirect_run_outs,
        sum(stumpings)::int as stumpings,
        sum(total_fielding)::int as total_fielding
      from latest
      group by stat_type
      order by stat_type
    `,
    params
  );

  return result.rows.reduce((acc, row) => {
    acc[normalizeText(row.stat_type)] = row;
    return acc;
  }, {});
}

async function loadPeerRows(client, input) {
  const result = await client.query(
    `
      select
        pcs.player_id,
        pcs.division_id,
        p.display_name,
        t.display_name as team_name,
        psa.role_type,
        pcs.composite_score,
        pcs.percentile_rank,
        psa.confidence_score
      from player_composite_score pcs
      join player p on p.id = pcs.player_id
      left join team t on t.id = pcs.team_id
      left join player_season_advanced psa
        on psa.series_id = pcs.series_id
       and psa.division_id is not distinct from pcs.division_id
       and psa.player_id = pcs.player_id
      where pcs.series_id = $1
        and pcs.division_id is not distinct from $2
        and psa.role_type = $3
        and pcs.player_id <> $4
      order by abs(pcs.composite_score - $5::numeric), pcs.composite_score desc, p.display_name
      limit $6
    `,
    [
      input.seriesId,
      input.divisionId,
      input.roleType,
      input.playerId,
      toNumber(input.compositeScore, 0),
      Math.max((toInteger(input.peerCount) || 3) - 1, 1),
    ]
  );

  return result.rows;
}

function pickSelectedSeasonRow(rows, divisionId) {
  if (divisionId) {
    const exact = rows.find((row) => toInteger(row.division_id) === divisionId);
    if (exact) {
      return exact;
    }
  }
  return rows[0];
}

function deriveReportMetrics(input) {
  const selectedSeason = input.selectedSeason;
  const playerName = normalizeText(selectedSeason.player_name);
  const roleType = normalizeText(selectedSeason.role_type);
  const roleLabel = humanizeRole(roleType);
  const battingScore = toNumber(selectedSeason.batting_weighted_efficiency, 0);
  const bowlingScore = toNumber(selectedSeason.bowling_weighted_efficiency, 0);
  const fieldingScore = toNumber(selectedSeason.fielding_score, 0);
  const wicketkeepingScore = toNumber(input.wicketkeepingSummary?.wicketkeeping_score, 0);
  const compositeScore = toNumber(selectedSeason.composite_score, 0);
  const percentileRank = toNumber(selectedSeason.percentile_rank, 0);
  const confidenceScore = toNumber(selectedSeason.confidence_score, 0);
  const leverageScore = toNumber(selectedSeason.leverage_score, 0);
  const consistencyScore = toNumber(selectedSeason.consistency_score, 0);
  const versatilityScore = toNumber(selectedSeason.versatility_score, 0);
  const strongOppositionScore = toNumber(selectedSeason.strong_opposition_score, 0);
  const recentFormScore = toNumber(selectedSeason.recent_form_score, 0);
  const developmentTrendScore = toNumber(selectedSeason.development_trend_score, 0);
  const div1SplitScore = deriveDiv1SplitScore(input.seasonRows, compositeScore);

  const matchImpactScore = average(
    input.matchRows.map((row) => toNumber(row.match_impact_score, null)).filter(Number.isFinite),
    0
  );
  const eliteOpponentScore = average(
    input.matchRows
      .map((row) => toNumber(row.player_strength_adjusted_score, null))
      .filter(Number.isFinite),
    0
  );

  const phasePerformance = buildPhasePerformance(input.ballEventRows, input.playerId);
  const matchupTables = buildMatchupTables(input.matchupRows, input.playerId);
  const overEvidence = buildOverEvidence(input.overRows, input.ballEventRows, input.playerId);
  const dismissalFieldingLog = buildDismissalFieldingLog(
    input.battingDismissalRows,
    input.fieldingLogRows
  );
  const commentaryEvidence = buildCommentaryEvidence(input.ballEventRows, input.playerId);
  const peerComparison = buildPeerComparison({
    peers: input.peerRows,
    selectedSeason,
    context: input.context,
  });
  const trends = buildTrendCards(input.matchRows);
  const matchEvidence = buildMatchEvidence(input.matchRows);

  const header = {
    playerName,
    teamName: normalizeText(selectedSeason.team_name),
    primaryRole: roleLabel,
    divisionLabel: normalizeText(selectedSeason.division_label),
    strengthSignal: buildStrengthSignal({ roleType, battingScore, bowlingScore, fieldingScore }),
    comparisonPool: buildComparisonPoolLabel(input.context, roleType),
    percentileRank: roundNumeric(percentileRank),
    confidenceScore: roundNumeric(confidenceScore),
    confidenceLabel: confidenceLabel(confidenceScore),
    recommendation: recommendationLabel({
      compositeScore,
      confidenceScore,
    }),
    quickRead: buildQuickRead({
      playerName,
      roleType,
      battingScore,
      bowlingScore,
      fieldingScore,
      wicketkeepingScore,
      strongOppositionScore,
      matchImpactScore,
      recentFormScore,
    }),
  };

  const scores = {
    compositeScore: roundNumeric(compositeScore),
    tierLabel: buildTierLabel(compositeScore, percentileRank),
    breakdown: [
      {
        key: "bowling_efficiency",
        label: "Bowling Efficiency",
        value: roundNumeric(bowlingScore),
      },
      {
        key: "batting_efficiency",
        label: "Batting Efficiency",
        value: roundNumeric(battingScore),
      },
      {
        key: "match_impact",
        label: "Match Impact",
        value: roundNumeric(matchImpactScore),
      },
      {
        key: "consistency",
        label: "Consistency",
        value: roundNumeric(consistencyScore),
      },
      {
        key: "versatility",
        label: "Versatility",
        value: roundNumeric(versatilityScore),
      },
      {
        key: "fielding",
        label: "Fielding",
        value: roundNumeric(Math.max(fieldingScore, wicketkeepingScore)),
      },
    ],
  };

  const assessmentSnapshot = [
    buildAssessmentCard("Bowling Skill", bowlingScore, roleType.includes("bowling")),
    buildAssessmentCard("Batting Skill", battingScore, roleType.includes("batting")),
    buildAssessmentCard("Fielding Skill", fieldingScore, false),
    buildAssessmentCard("Wicketkeeping Skill", wicketkeepingScore, roleType.includes("wicketkeeper")),
  ];

  const visualReadout = [
    {
      label: "Primary Skill",
      value: roundNumeric(Math.max(battingScore, bowlingScore, fieldingScore, wicketkeepingScore)),
      tone: toneForScore(Math.max(battingScore, bowlingScore, fieldingScore, wicketkeepingScore)),
      note: buildPrimarySkillNote(roleType, battingScore, bowlingScore, fieldingScore, wicketkeepingScore),
    },
    {
      label: "Strong-Opposition Read",
      value: roundNumeric(strongOppositionScore),
      tone: toneForScore(strongOppositionScore),
      note: "Opponent-adjusted value against stronger teams and stronger individual opponents.",
    },
    {
      label: "Consistency",
      value: roundNumeric(consistencyScore),
      tone: toneForScore(consistencyScore),
      note: "Match-to-match stability across the current sample of advanced analytics.",
    },
  ];

  const contextPerformance = [
    buildContextCard("Vs Strong Teams", strongOppositionScore, "Opponent-adjusted profile when team quality rises."),
    buildContextCard("Vs Elite Opponents", eliteOpponentScore, "Quality-adjusted performance against stronger players."),
    buildContextCard("Div 1 Split", div1SplitScore, "How the player's stronger-division profile currently grades."),
    buildContextCard("Match Impact", matchImpactScore, "Pressure moments and contribution quality beyond simple volume."),
  ];

  const selectorInterpretation = buildSelectorInterpretation({
    roleType,
    battingScore,
    bowlingScore,
    fieldingScore,
    wicketkeepingScore,
    consistencyScore,
    versatilityScore,
    strongOppositionScore,
    recentFormScore,
    confidenceScore,
    div1SplitScore,
  });
  const selectorTakeaway = buildSelectorTakeaway({
    playerName,
    roleType,
    recommendation: header.recommendation,
    strongOppositionScore,
    consistencyScore,
    recentFormScore,
    confidenceScore,
    div1SplitScore,
  });

  const standardStats = {
    currentSeries: buildStatPanel(input.currentSeriesStats),
    overall: buildStatPanel(input.overallStats),
  };

  return {
    header,
    scores,
    assessmentSnapshot,
    visualReadout,
    contextPerformance,
    peerComparison,
    trends,
    matchEvidence,
    selectorInterpretation,
    selectorTakeaway,
    signalMetrics: {
      roleType,
      roleLabel,
      battingScore,
      bowlingScore,
      fieldingScore,
      wicketkeepingScore,
      compositeScore,
      percentileRank,
      confidenceScore,
      leverageScore,
      consistencyScore,
      versatilityScore,
      strongOppositionScore,
      eliteOpponentScore,
      recentFormScore,
      developmentTrendScore,
      div1SplitScore,
      matchImpactScore,
    },
    standardStats,
    drilldowns: {
      battingVsBowlers: matchupTables.batting,
      bowlingVsBatters: matchupTables.bowling,
      phasePerformance,
      overEvidence,
      dismissalFieldingLog,
      commentaryEvidence,
    },
  };
}

function deriveDiv1SplitScore(seasonRows, fallback) {
  const div1Values = seasonRows
    .filter((row) => normalizeText(row.division_label).includes("Div 1"))
    .map((row) => toNumber(row.composite_score, null))
    .filter(Number.isFinite);
  return average(div1Values, fallback);
}

function buildTierLabel(compositeScore, percentileRank) {
  if (compositeScore >= 85 || percentileRank >= 90) {
    return "High-Value Selector Profile";
  }
  if (compositeScore >= 78 || percentileRank >= 75) {
    return "Strong Current Sample";
  }
  return "Development Watch Profile";
}

function buildStrengthSignal(input) {
  const roleType = normalizeText(input.roleType);
  if (roleType === "bowling_all_rounder") {
    return input.battingScore >= 70
      ? "Bowling Impact + Good Batting Support"
      : "Bowling Impact + Useful Lower-Order Value";
  }
  if (roleType === "batting_all_rounder") {
    return input.bowlingScore >= 65
      ? "Batting Quality + Credible Bowling Support"
      : "Batting-Led All-Round Profile";
  }
  if (roleType === "bowling") {
    return "Bowling Control + Match-Pressure Value";
  }
  if (roleType === "wicketkeeper_batter") {
    return "Batting Value + Meaningful Wicketkeeping Support";
  }
  return "Batting Value + Pressure Context";
}

function buildComparisonPoolLabel(context, roleType) {
  const scope = normalizeText(context.seriesName).includes("Bay Area")
    ? `Bay Area ${normalizeText(context.targetAgeGroup)}`
    : normalizeText(context.seriesName);
  return `${scope} ${humanizeRole(roleType, { plural: true })}`;
}

function buildQuickRead(input) {
  const roleLabel = humanizeRole(input.roleType).toLowerCase();
  const qualities = [];

  if (input.bowlingScore >= 80) {
    qualities.push("strong bowling impact");
  }
  if (input.battingScore >= 75) {
    qualities.push("credible batting support");
  }
  if (input.wicketkeepingScore >= 45) {
    qualities.push("visible wicketkeeping value");
  }
  if (input.strongOppositionScore >= 80) {
    qualities.push("stronger-opposition readiness");
  }
  if (input.matchImpactScore >= 80) {
    qualities.push("good match-impact value");
  }
  if (input.recentFormScore >= 80) {
    qualities.push("positive recent form");
  }

  const topQualities = qualities.slice(0, 3);
  return `${input.playerName} profiles as a ${roleLabel} with ${joinReadable(
    topQualities.length ? topQualities : ["a credible current sample"]
  )}.`;
}

function buildAssessmentCard(label, value, isPrimary) {
  return {
    label,
    value: roundNumeric(value),
    primary: isPrimary,
    note: label.includes("Bowling")
      ? "Primary bowling quality and pressure control."
      : label.includes("Batting")
        ? "Scoring quality, efficiency, and batting support."
        : label.includes("Wicketkeeping")
          ? "Wicketkeeping contribution where present."
          : "Fielding contribution from dismissals and involvement.",
  };
}

function buildPrimarySkillNote(roleType, battingScore, bowlingScore, fieldingScore, wicketkeepingScore) {
  const top = Math.max(battingScore, bowlingScore, fieldingScore, wicketkeepingScore);
  if (top === bowlingScore) {
    return roleType.includes("all_rounder")
      ? "Bowling remains the clearest reason for selection, with support value elsewhere."
      : "Bowling remains the clearest reason for selection.";
  }
  if (top === battingScore) {
    return "Batting is the clearest selection driver in the current sample.";
  }
  if (top === wicketkeepingScore) {
    return "Wicketkeeping materially supports the selection case.";
  }
  return "Fielding adds visible support to the overall profile.";
}

function buildContextCard(label, value, note) {
  return {
    label,
    value: roundNumeric(value),
    tone: toneForScore(value),
    note,
  };
}

function buildSelectorInterpretation(input) {
  return [
    interpretMetric(
      "Vs Strong Teams",
      input.strongOppositionScore,
      "Maintains value when the quality of opposition rises."
    ),
    interpretMetric(
      "Recent Form",
      input.recentFormScore,
      "Recent outputs show whether the current trend is strengthening or flattening."
    ),
    interpretMetric(
      "Consistency",
      input.consistencyScore,
      "Match-to-match stability in the advanced scoring layer."
    ),
    interpretMetric(
      "Versatility",
      input.versatilityScore,
      "Breadth of contribution across batting, bowling, fielding, and wicketkeeping."
    ),
    interpretMetric(
      "Confidence",
      input.confidenceScore,
      `Current evidence quality grades as ${confidenceLabel(input.confidenceScore)}.`
    ),
    interpretMetric(
      "Div 1 Readiness",
      input.div1SplitScore,
      "Stronger-division profile and step-up signal."
    ),
  ];
}

function interpretMetric(label, value, note) {
  const tone = toneForScore(value);
  return {
    label,
    badge: tone === "good" ? "Strong" : tone === "watch" ? "Watch" : "Risk",
    tone,
    note,
    value: roundNumeric(value),
  };
}

function buildExecutiveReportPayload(input) {
  const assessment = mapAssessmentSnapshot(input.assessmentSnapshot);
  const contextMetrics = mapContextCards(input.contextPerformance);
  const interpretation = mapInterpretationFields(input.selectorInterpretation);
  const recentFormTrend = shapeTrendField(findTrendCard(input.trends, "recent match impact"), "Recent Form");
  const strongOppositionTrend = shapeTrendField(
    findTrendCard(input.trends, "strong-opposition value"),
    "Strong-Opposition Performance"
  );
  const pressureTrend = shapeTrendField(findTrendCard(input.trends, "pressure value"), "Pressure Value");

  return {
    schemaVersion: "executive-player-report-v1",
    playerIdentity: {
      playerId: toInteger(input.meta?.player?.playerId),
      playerName: normalizeText(input.meta?.player?.playerName),
      canonicalName: normalizeText(input.meta?.player?.canonicalName),
      teamName: normalizeText(input.meta?.player?.teamName) || normalizeText(input.header?.teamName),
      divisionId: toInteger(input.meta?.player?.divisionId),
      divisionLabel: normalizeText(input.header?.divisionLabel),
      seriesConfigKey: normalizeText(input.meta?.series?.configKey),
      seriesName: normalizeText(input.meta?.series?.name),
      targetAgeGroup: normalizeText(input.meta?.series?.targetAgeGroup),
      generatedAt: input.meta?.generatedAt,
    },
    primaryRole: {
      roleType: normalizeText(input.signalMetrics?.roleType),
      roleLabel: normalizeText(input.header?.primaryRole) || normalizeText(input.signalMetrics?.roleLabel),
      strengthSignal: normalizeText(input.header?.strengthSignal),
      comparisonPool: normalizeText(input.header?.comparisonPool),
    },
    assessmentSnapshot: assessment,
    primaryRoleCompositeScore: {
      score: roundNumeric(input.scores?.compositeScore),
      scaleMin: 0,
      scaleMax: 100,
      roleScoped: true,
      tierLabel: normalizeText(input.scores?.tierLabel),
      percentileRank: roundNumeric(input.header?.percentileRank),
      breakdown: input.scores?.breakdown || [],
    },
    currentSeriesStandardStats: input.standardStats?.currentSeries || {},
    strongOppositionMetrics: {
      vsStrongTeams: contextMetrics.vsStrongTeams,
      vsEliteOpponents: contextMetrics.vsEliteOpponents,
      div1Readiness: interpretation.div1Readiness || shapeMetricField(
        "Div 1 Readiness",
        input.signalMetrics?.div1SplitScore,
        "Stronger-division profile and step-up signal."
      ),
    },
    matchSituationMetrics: {
      matchImpact: contextMetrics.matchImpact || shapeMetricField(
        "Match Impact",
        input.signalMetrics?.matchImpactScore,
        "Pressure moments and contribution quality beyond simple volume."
      ),
      leverageScore: shapeMetricField(
        "Leverage Score",
        input.signalMetrics?.leverageScore,
        "Pressure-adjusted contribution signal across higher-leverage match situations."
      ),
      pressureTrend,
    },
    developmentAndConsistencyMetrics: {
      recentForm: interpretation.recentForm || shapeMetricField(
        "Recent Form",
        input.signalMetrics?.recentFormScore,
        "Current recent-form signal from the advanced analytics layer."
      ),
      developmentTrend: shapeMetricField(
        "Development Trend",
        input.signalMetrics?.developmentTrendScore,
        "Current development and growth signal across the player sample."
      ),
      consistency: interpretation.consistency || shapeMetricField(
        "Consistency",
        input.signalMetrics?.consistencyScore,
        "Match-to-match stability in the advanced scoring layer."
      ),
      versatility: interpretation.versatility || shapeMetricField(
        "Versatility",
        input.signalMetrics?.versatilityScore,
        "Breadth of contribution across batting, bowling, fielding, and wicketkeeping."
      ),
      confidence: {
        label: normalizeText(input.header?.confidenceLabel),
        score: roundNumeric(input.header?.confidenceScore),
        tone: toneForScore(input.header?.confidenceScore),
        note: `Current evidence quality grades as ${normalizeText(input.header?.confidenceLabel) || "Unknown"}.`,
      },
    },
    peerComparisonStrip: (input.peerComparison || []).map((peer, index) => ({
      playerId: toInteger(peer.playerId),
      divisionId: toInteger(peer.divisionId),
      playerName: normalizeText(peer.displayName),
      teamName: normalizeText(peer.teamName),
      roleLabel: normalizeText(peer.roleLabel),
      compositeScore: roundNumeric(peer.compositeScore),
      percentileRank: roundNumeric(peer.percentileRank),
      note: normalizeText(peer.note),
      isSubject: index === 0,
    })),
    selectorInterpretationFields: input.selectorInterpretation || [],
    recommendationBadge: {
      label: normalizeText(input.header?.recommendation),
      tone: recommendationTone(input.header?.recommendation),
      confidenceLabel: normalizeText(input.header?.confidenceLabel),
      confidenceScore: roundNumeric(input.header?.confidenceScore),
      percentileRank: roundNumeric(input.header?.percentileRank),
      quickRead: normalizeText(input.header?.quickRead),
      selectorTakeaway: normalizeText(input.selectorTakeaway),
    },
    trends: {
      recentForm: recentFormTrend,
      strongOppositionPerformance: strongOppositionTrend,
    },
  };
}

function mapAssessmentSnapshot(cards) {
  const mapped = {
    batting: shapeAssessmentCard(findAssessmentCard(cards, "batting")),
    bowling: shapeAssessmentCard(findAssessmentCard(cards, "bowling")),
    fielding: shapeAssessmentCard(findAssessmentCard(cards, "fielding")),
    wicketkeeping: shapeAssessmentCard(findAssessmentCard(cards, "wicketkeeping")),
  };

  return mapped;
}

function findAssessmentCard(cards, key) {
  return (cards || []).find((card) => normalizeLabel(card.label).includes(key));
}

function shapeAssessmentCard(card) {
  if (!card) {
    return null;
  }

  return {
    label: normalizeText(card.label),
    score: roundNumeric(card.value),
    primary: card.primary === true,
    tone: toneForScore(card.value),
    note: normalizeText(card.note),
  };
}

function mapContextCards(cards) {
  const output = {};

  for (const card of cards || []) {
    const normalized = normalizeLabel(card.label);
    if (normalized === "vs strong teams") {
      output.vsStrongTeams = shapeContextField(card);
    } else if (normalized === "vs elite opponents") {
      output.vsEliteOpponents = shapeContextField(card);
    } else if (normalized === "match impact") {
      output.matchImpact = shapeContextField(card);
    }
  }

  return output;
}

function shapeContextField(card) {
  if (!card) {
    return null;
  }

  return {
    label: normalizeText(card.label),
    score: roundNumeric(card.value),
    tone: normalizeText(card.tone) || toneForScore(card.value),
    note: normalizeText(card.note),
  };
}

function mapInterpretationFields(items) {
  const output = {};

  for (const item of items || []) {
    const normalized = normalizeLabel(item.label);
    if (normalized === "recent form") {
      output.recentForm = shapeInterpretationField(item);
    } else if (normalized === "consistency") {
      output.consistency = shapeInterpretationField(item);
    } else if (normalized === "versatility") {
      output.versatility = shapeInterpretationField(item);
    } else if (normalized === "div 1 readiness") {
      output.div1Readiness = shapeInterpretationField(item);
    }
  }

  return output;
}

function shapeInterpretationField(item) {
  if (!item) {
    return null;
  }

  return {
    label: normalizeText(item.label),
    score: roundNumeric(item.value),
    badge: normalizeText(item.badge),
    tone: normalizeText(item.tone) || toneForScore(item.value),
    note: normalizeText(item.note),
  };
}

function shapeMetricField(label, score, note) {
  return {
    label: normalizeText(label),
    score: roundNumeric(score),
    tone: toneForScore(score),
    note: normalizeText(note),
  };
}

function findTrendCard(trends, title) {
  return (trends || []).find((item) => normalizeLabel(item.title) === normalizeLabel(title));
}

function shapeTrendField(trend, overrideTitle = "") {
  if (!trend) {
    return null;
  }

  return {
    title: normalizeText(overrideTitle) || normalizeText(trend.title),
    status: normalizeText(trend.status),
    values: trend.values || [],
    note: normalizeText(trend.note),
  };
}

function recommendationTone(label) {
  const normalized = normalizeLabel(label);
  if (normalized === "strong consideration") {
    return "good";
  }
  if (normalized === "track closely" || normalized === "watch list") {
    return "watch";
  }
  return "risk";
}

function buildStatPanel(statMap) {
  const batting = statMap.batting || {};
  const bowling = statMap.bowling || {};
  const fielding = statMap.fielding || {};

  return {
    batting: {
      value: toInteger(batting.runs) || 0,
      detail: `${toInteger(batting.matches) || 0} matches${batting.highest_score ? ` • HS ${normalizeText(batting.highest_score)}` : ""}${Number.isFinite(toNumber(batting.strike_rate, null)) ? ` • SR ${toNumber(batting.strike_rate).toFixed(1)}` : ""}`,
    },
    bowling: {
      value: toInteger(bowling.wickets) || 0,
      detail: `${formatOvers(bowling.overs_decimal, bowling.legal_balls)}${Number.isFinite(toNumber(bowling.economy, null)) ? ` • Econ ${toNumber(bowling.economy).toFixed(2)}` : ""}${bowling.best_bowling ? ` • BBF ${normalizeText(bowling.best_bowling)}` : ""}`,
    },
    fielding: {
      value: toInteger(fielding.total_fielding) || 0,
      detail: `${toInteger(fielding.catches) || 0} catches • ${toInteger(fielding.direct_run_outs) || 0} direct RO • ${toInteger(fielding.indirect_run_outs) || 0} indirect RO`,
    },
  };
}

function buildPeerComparison(input) {
  const subject = {
    playerId: toInteger(input.selectedSeason.player_id),
    divisionId: toInteger(input.selectedSeason.division_id),
    displayName: normalizeText(input.selectedSeason.player_name),
    teamName: normalizeText(input.selectedSeason.team_name),
    roleLabel: humanizeRole(input.selectedSeason.role_type),
    compositeScore: roundNumeric(input.selectedSeason.composite_score),
    percentileRank: roundNumeric(input.selectedSeason.percentile_rank),
    note: "Current selector profile within this comparison cohort.",
  };

  const peers = [subject];
  for (const row of input.peers) {
    peers.push({
      playerId: toInteger(row.player_id),
      divisionId: toInteger(row.division_id),
      displayName: normalizeText(row.display_name),
      teamName: normalizeText(row.team_name),
      roleLabel: humanizeRole(row.role_type),
      compositeScore: roundNumeric(row.composite_score),
      percentileRank: roundNumeric(row.percentile_rank),
      note: buildPeerNote(row, input.selectedSeason),
    });
  }

  return peers.slice(0, toInteger(input.context.reportProfile?.peer_count) || 3);
}

function buildPeerNote(peerRow, selectedSeason) {
  const difference = toNumber(peerRow.composite_score, 0) - toNumber(selectedSeason.composite_score, 0);
  if (difference >= 2) {
    return "Comparable role profile, currently grading above the selected player.";
  }
  if (difference <= -2) {
    return "Comparable role profile, currently grading below the selected player.";
  }
  return "Close comparison profile in the same role cohort.";
}

function buildSelectorTakeaway(input) {
  const strengths = [];
  const cautions = [];

  if (input.strongOppositionScore >= 80) {
    strengths.push("holds value when opposition quality rises");
  }
  if (input.consistencyScore >= 75) {
    strengths.push("shows a stable current sample");
  }
  if (input.recentFormScore >= 78) {
    strengths.push("is trending positively");
  }
  if (input.div1SplitScore >= 75) {
    strengths.push("carries a credible stronger-division read");
  }

  if (input.confidenceScore < 65) {
    cautions.push("the evidence depth is still limited");
  }
  if (input.consistencyScore < 60) {
    cautions.push("match-to-match stability still needs monitoring");
  }
  if (input.recentFormScore < 60) {
    cautions.push("recent form has softened");
  }

  const strengthText = joinReadable(
    strengths.length ? strengths.slice(0, 2) : ["the primary-role score is carrying the case"]
  );
  const cautionText = cautions.length
    ? ` The main watch point is that ${joinReadable(cautions.slice(0, 2))}.`
    : "";

  return `${input.playerName} merits ${normalizeText(input.recommendation).toLowerCase()} as a ${humanizeRole(
    input.roleType
  ).toLowerCase()} because ${strengthText}.${cautionText}`;
}

function buildTrendCards(matchRows) {
  const summaries = summarizeMatchRows(matchRows);

  return compactTrendCards([
    buildMetricTrendCard(
      "Recent Match Impact",
      summaries,
      "matchImpact",
      "Recent contribution quality across the latest matches in sample."
    ),
    buildMetricTrendCard(
      "Strong-Opposition Value",
      summaries,
      "opposition",
      "Opponent-adjusted value against stronger team and player contexts."
    ),
    buildMetricTrendCard(
      "Pressure Value",
      summaries,
      "leverage",
      "How well the player's contribution is holding up in higher-leverage match states."
    ),
  ]);
}

function compactTrendCards(cards) {
  return cards.filter(Boolean);
}

function summarizeMatchRows(matchRows) {
  const grouped = new Map();

  for (const row of matchRows) {
    const matchId = toInteger(row.match_id);
    if (!matchId) {
      continue;
    }

    if (!grouped.has(matchId)) {
      grouped.set(matchId, {
        matchId,
        matchDate: row.match_date,
        matchImpactValues: [],
        oppositionValues: [],
        leverageValues: [],
      });
    }

    const entry = grouped.get(matchId);
    const matchImpact = toNumber(row.match_impact_score, null);
    if (Number.isFinite(matchImpact)) {
      entry.matchImpactValues.push(matchImpact);
    }

    const oppositionInputs = [
      toNumber(row.team_strength_adjusted_score, null),
      toNumber(row.player_strength_adjusted_score, null),
    ].filter(Number.isFinite);
    if (oppositionInputs.length) {
      entry.oppositionValues.push(average(oppositionInputs, 0));
    }

    const leverage = toNumber(row.leverage_adjusted_score, null);
    if (Number.isFinite(leverage)) {
      entry.leverageValues.push(leverage);
    }
  }

  return [...grouped.values()]
    .map((entry) => ({
      matchId: entry.matchId,
      matchDate: entry.matchDate,
      matchImpact: average(entry.matchImpactValues, 0),
      opposition: average(entry.oppositionValues, 0),
      leverage: average(entry.leverageValues, 0),
    }))
    .sort(
      (left, right) =>
        normalizeText(right.matchDate).localeCompare(normalizeText(left.matchDate)) ||
        right.matchId - left.matchId
    );
}

function buildMetricTrendCard(title, summaries, metricKey, supportingNote) {
  if (!summaries.length) {
    return null;
  }

  const latest = summaries
    .slice(0, 5)
    .reverse()
    .map((row) => ({
      label: formatDate(row.matchDate).split(",")[0],
      value: roundNumeric(row[metricKey]),
    }));

  if (!latest.some((row) => Number.isFinite(toNumber(row.value, null)))) {
    return null;
  }

  const values = latest.map((row) => toNumber(row.value, 0));
  const early = average(values.slice(0, Math.max(values.length - 2, 1)), values[0] || 0);
  const recent = average(values.slice(-2), values[values.length - 1] || 0);
  const status = recent > early + 4 ? "Rising" : recent < early - 4 ? "Watch" : "Steady";

  return {
    title,
    status,
    values: latest,
    note:
      status === "Rising"
        ? `Recent readings are improving. ${supportingNote}`
        : status === "Watch"
          ? `Recent readings have softened. ${supportingNote}`
          : `Recent readings are holding steady. ${supportingNote}`,
  };
}

function buildMatchEvidence(matchRows) {
  const groups = new Map();

  for (const row of matchRows) {
    const key = String(row.match_id);
    if (!groups.has(key)) {
      groups.set(key, {
        matchId: toInteger(row.match_id),
        matchDate: row.match_date,
        matchTitle: normalizeText(row.match_title),
        scores: [],
        battingRuns: 0,
        bowlingBalls: 0,
        wicketsEstimate: 0,
      });
    }
    const entry = groups.get(key);
    entry.scores.push(toNumber(row.match_impact_score, 0));
    entry.battingRuns += toInteger(row.batter_runs) || 0;
    const bowlingBalls = toInteger(row.legal_balls_bowled) || 0;
    entry.bowlingBalls += bowlingBalls;
    entry.wicketsEstimate += Math.round(
      (toNumber(row.wicket_ball_pct, 0) || 0) * bowlingBalls
    );
  }

  return [...groups.values()]
    .map((entry) => ({
      matchId: entry.matchId,
      matchDate: entry.matchDate,
      matchDateLabel: formatDate(entry.matchDate),
      matchTitle: entry.matchTitle,
      score: roundNumeric(average(entry.scores, 0)),
      note: buildEvidenceNote(entry),
    }))
    .sort((left, right) => toNumber(right.score, 0) - toNumber(left.score, 0))
    .slice(0, 4);
}

function buildEvidenceNote(entry) {
  const components = [];
  if (entry.battingRuns > 0) {
    components.push(`${entry.battingRuns} batting runs`);
  }
  if (entry.bowlingBalls > 0) {
    components.push(`${entry.bowlingBalls} balls of bowling workload`);
  }
  if (entry.wicketsEstimate > 0) {
    components.push(`${entry.wicketsEstimate} wicket-equivalent impact`);
  }
  return components.length
    ? `High-value evidence from ${joinReadable(components)} in this match sample.`
    : "High-value evidence from the current advanced sample.";
}

function buildMatchupTables(matchupRows, playerId) {
  const batting = [];
  const bowling = [];

  for (const row of matchupRows) {
    const balls = toInteger(row.balls) || 0;
    if (balls <= 0) {
      continue;
    }

    if (toInteger(row.batter_player_id) === playerId) {
      batting.push({
        opponentPlayerId: toInteger(row.bowler_player_id),
        opponentName: normalizeText(row.bowler_name),
        balls,
        runs: toInteger(row.batter_runs) || 0,
        strikeRate: roundNumeric(safeDivide((toInteger(row.batter_runs) || 0) * 100, balls, 0)),
        dotPct: roundNumeric(safeDivide(toInteger(row.dots) || 0, balls, 0) * 100),
        boundaryPct: roundNumeric(
          safeDivide((toInteger(row.fours) || 0) + (toInteger(row.sixes) || 0), balls, 0) * 100
        ),
        dismissals: toInteger(row.dismissals) || 0,
      });
      continue;
    }

    if (toInteger(row.bowler_player_id) === playerId) {
      bowling.push({
        opponentPlayerId: toInteger(row.batter_player_id),
        opponentName: normalizeText(row.batter_name),
        balls,
        runsConceded: toInteger(row.total_runs) || toInteger(row.batter_runs) || 0,
        wickets: toInteger(row.dismissals) || 0,
        dotPct: roundNumeric(safeDivide(toInteger(row.dots) || 0, balls, 0) * 100),
        boundaryPct: roundNumeric(
          safeDivide((toInteger(row.fours) || 0) + (toInteger(row.sixes) || 0), balls, 0) * 100
        ),
      });
    }
  }

  return {
    batting: batting
      .filter((row) => row.balls >= 10)
      .sort((left, right) => right.balls - left.balls || right.runs - left.runs),
    bowling: bowling
      .filter((row) => row.balls >= 10)
      .sort((left, right) => right.balls - left.balls || left.runsConceded - right.runsConceded),
  };
}

function buildPhasePerformance(ballEvents, playerId) {
  const buckets = {
    batting: { overall: new Map(), powerplay: new Map(), middle: new Map(), death: new Map() },
    bowling: { overall: new Map(), powerplay: new Map(), middle: new Map(), death: new Map() },
  };

  for (const event of ballEvents) {
    const phase = normalizePhase(event.phase);

    if (toInteger(event.striker_player_id) === playerId) {
      accumulatePhaseRow(
        buckets.batting.overall,
        normalizeText(event.bowler_name) || "Unknown Bowler",
        event,
        "batting"
      );
      if (buckets.batting[phase]) {
        accumulatePhaseRow(
          buckets.batting[phase],
          normalizeText(event.bowler_name) || "Unknown Bowler",
          event,
          "batting"
        );
      }
    }

    if (toInteger(event.bowler_player_id) === playerId) {
      accumulatePhaseRow(
        buckets.bowling.overall,
        normalizeText(event.striker_name) || "Unknown Batter",
        event,
        "bowling"
      );
      if (buckets.bowling[phase]) {
        accumulatePhaseRow(
          buckets.bowling[phase],
          normalizeText(event.striker_name) || "Unknown Batter",
          event,
          "bowling"
        );
      }
    }
  }

  return {
    batting: mapPhaseBuckets(buckets.batting, "batting"),
    bowling: mapPhaseBuckets(buckets.bowling, "bowling"),
  };
}

function normalizePhase(value) {
  const normalized = normalizeLabel(value);
  if (normalized.includes("powerplay")) {
    return "powerplay";
  }
  if (normalized.includes("death")) {
    return "death";
  }
  return "middle";
}

function accumulatePhaseRow(map, key, event, perspective) {
  if (!map.has(key)) {
    map.set(key, {
      opponentName: key,
      balls: 0,
      runs: 0,
      dots: 0,
      boundaries: 0,
      dismissals: 0,
    });
  }
  const row = map.get(key);
  const legalBall = event.is_legal_ball === true || normalizeText(event.is_legal_ball) === "true";
  if (legalBall) {
    row.balls += 1;
  }

  if (perspective === "batting") {
    row.runs += toInteger(event.batter_runs) || 0;
    if (legalBall && (toInteger(event.batter_runs) || 0) === 0) {
      row.dots += 1;
    }
    if ([4, 6].includes(toInteger(event.batter_runs))) {
      row.boundaries += 1;
    }
    if (
      event.wicket_flag &&
      toInteger(event.player_out_id) === toInteger(event.striker_player_id)
    ) {
      row.dismissals += 1;
    }
    return;
  }

  row.runs += toInteger(event.total_runs) || 0;
  if (legalBall && (toInteger(event.total_runs) || 0) === 0) {
    row.dots += 1;
  }
  if ([4, 6].includes(toInteger(event.batter_runs))) {
    row.boundaries += 1;
  }
  if (event.wicket_flag && event.wicket_credited_to_bowler) {
    row.dismissals += 1;
  }
}

function mapPhaseBuckets(phaseBuckets, perspective) {
  return Object.entries(phaseBuckets).reduce((acc, [phaseKey, rows]) => {
    const threshold = phaseKey === "overall" ? 10 : 6;
    acc[phaseKey] = [...rows.values()]
      .filter((row) => row.balls >= threshold)
      .map((row) => ({
        opponentName: row.opponentName,
        balls: row.balls,
        runs: row.runs,
        strikeRate:
          perspective === "batting"
            ? roundNumeric(safeDivide(row.runs * 100, row.balls, 0))
            : null,
        economy:
          perspective === "bowling"
            ? roundNumeric(safeDivide(row.runs * 6, row.balls, 0))
            : null,
        dotPct: roundNumeric(safeDivide(row.dots, row.balls, 0) * 100),
        boundaryPct: roundNumeric(safeDivide(row.boundaries, row.balls, 0) * 100),
        dismissals: row.dismissals,
      }))
      .sort((left, right) => right.balls - left.balls || right.runs - left.runs);
    return acc;
  }, {});
}

function buildOverEvidence(overRows, ballEvents, playerId) {
  const battingOvers = new Map();
  for (const event of ballEvents) {
    if (toInteger(event.striker_player_id) !== playerId) {
      continue;
    }
    const key = `${event.match_id}:${event.over_no}`;
    if (!battingOvers.has(key)) {
      battingOvers.set(key, {
        matchId: toInteger(event.match_id),
        matchDate: event.match_date,
        matchTitle: normalizeText(event.match_title),
        overNo: toInteger(event.over_no),
        balls: 0,
        runs: 0,
        boundaries: 0,
      });
    }
    const row = battingOvers.get(key);
    if (event.is_legal_ball === true || normalizeText(event.is_legal_ball) === "true") {
      row.balls += 1;
    }
    row.runs += toInteger(event.batter_runs) || 0;
    if ([4, 6].includes(toInteger(event.batter_runs))) {
      row.boundaries += 1;
    }
  }

  return {
    batting: [...battingOvers.values()]
      .sort((left, right) => right.runs - left.runs || right.boundaries - left.boundaries)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        matchDateLabel: formatDate(row.matchDate),
      })),
    bowlingBest: overRows
      .slice()
      .sort(
        (left, right) =>
          (toInteger(right.wickets_in_over) || 0) - (toInteger(left.wickets_in_over) || 0) ||
          (toInteger(left.runs_in_over) || 0) - (toInteger(right.runs_in_over) || 0)
      )
      .slice(0, 5)
      .map(mapOverEvidenceRow),
    bowlingExpensive: overRows
      .slice()
      .sort((left, right) => (toInteger(right.runs_in_over) || 0) - (toInteger(left.runs_in_over) || 0))
      .slice(0, 5)
      .map(mapOverEvidenceRow),
  };
}

function mapOverEvidenceRow(row) {
  return {
    matchId: toInteger(row.match_id),
    matchDate: row.match_date,
    matchDateLabel: formatDate(row.match_date),
    matchTitle: normalizeText(row.match_title),
    overNo: toInteger(row.over_no),
    balls: toInteger(row.legal_balls) || 0,
    runs: toInteger(row.runs_in_over) || 0,
    wickets: toInteger(row.wickets_in_over) || 0,
    stateText: normalizeText(row.over_state_text),
  };
}

function buildDismissalFieldingLog(battingDismissalRows, fieldingLogRows) {
  return {
    battingDismissals: battingDismissalRows.slice(0, 10).map((row) => ({
      matchDateLabel: formatDate(row.match_date),
      matchTitle: normalizeText(row.match_title),
      runs: toInteger(row.runs) || 0,
      ballsFaced: toInteger(row.balls_faced) || 0,
      dismissalType: normalizeText(row.dismissal_type),
      dismissalText: normalizeText(row.dismissal_text),
      dismissedBy: normalizeText(row.dismissed_by_name),
      fielder: normalizeText(row.fielder_name),
    })),
    fieldingInvolvement: fieldingLogRows.slice(0, 10).map((row) => ({
      matchDateLabel: formatDate(row.match_date),
      matchTitle: normalizeText(row.match_title),
      dismissalType: normalizeText(row.dismissal_type),
      playerOutName: normalizeText(row.player_out_name),
      bowlerName: normalizeText(row.bowler_name),
      directRunOut: row.is_direct_run_out === true,
      indirectRunOut: row.is_indirect_run_out === true,
      wicketkeeperEvent: row.is_wicketkeeper_event === true,
      notes: normalizeText(row.notes),
      overBall: row.over_no !== null ? `${row.over_no}.${String(row.ball_no || "").split(".").pop()}` : "",
    })),
  };
}

function buildCommentaryEvidence(ballEvents, playerId) {
  return ballEvents
    .map((row) => ({
      matchId: toInteger(row.match_id),
      matchDate: row.match_date,
      matchDateLabel: formatDate(row.match_date),
      matchTitle: normalizeText(row.match_title),
      inningsNo: toInteger(row.innings_no),
      ballLabel: normalizeText(row.ball_label),
      phase: normalizeText(row.phase),
      involvementType: deriveInvolvementType(row, playerId),
      strikerName: normalizeText(row.striker_name),
      bowlerName: normalizeText(row.bowler_name),
      playerOutName: normalizeText(row.player_out_name),
      batterRuns: toInteger(row.batter_runs) || 0,
      totalRuns: toInteger(row.total_runs) || 0,
      wicketFlag: row.wicket_flag === true,
      dismissalType: normalizeText(row.dismissal_type),
      leverageScore: roundNumeric(row.leverage_score),
      totalEventWeight: roundNumeric(row.total_event_weight),
      commentaryText: normalizeText(row.commentary_text),
    }))
    .sort(
      (left, right) =>
        toNumber(right.totalEventWeight, 0) - toNumber(left.totalEventWeight, 0) ||
        toNumber(right.leverageScore, 0) - toNumber(left.leverageScore, 0)
    )
    .slice(0, 20);
}

function deriveInvolvementType(row, playerId) {
  if (toInteger(row.striker_player_id) === playerId) {
    return "batting";
  }
  if (toInteger(row.bowler_player_id) === playerId) {
    return "bowling";
  }
  if (toInteger(row.primary_fielder_player_id) === playerId) {
    return "fielding";
  }
  if (toInteger(row.player_out_id) === playerId) {
    return "dismissal";
  }
  return "context";
}

function joinReadable(parts) {
  if (!parts.length) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function formatOvers(oversDecimal, legalBalls) {
  const decimal = toNumber(oversDecimal, null);
  if (decimal !== null) {
    return `${decimal.toFixed(1)} overs`;
  }
  const balls = toInteger(legalBalls);
  if (!balls) {
    return "0 overs";
  }
  return `${Math.floor(balls / 6)}.${balls % 6} overs`;
}

module.exports = {
  getDashboardOverview,
  getPlayerReport,
  searchPlayers,
};

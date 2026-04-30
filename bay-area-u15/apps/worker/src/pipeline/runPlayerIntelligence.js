const path = require("path");

const { withTransaction } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { normalizeText, toInteger, toNumber } = require("../lib/cricket");
const { buildPlayerIntelligenceRows } = require("../analytics/playerIntelligence");

function buildLogger(log) {
  return typeof log === "function" ? log : console.log;
}

function fetchOne(client, query, params = []) {
  return client.query(query, params).then((result) => result.rows[0] || null);
}

async function resolveSeriesContext(client, seriesConfigKey) {
  const row = await fetchOne(
    client,
    `
      select
        c.config_key,
        s.id as series_id,
        s.name as series_name
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );

  if (!row) {
    throw new Error(`Unable to resolve series context for config key: ${seriesConfigKey}`);
  }

  return {
    configKey: normalizeText(row.config_key),
    seriesId: toInteger(row.series_id),
    seriesName: normalizeText(row.series_name),
  };
}

async function loadBallEventRows(client, seriesId) {
  const result = await client.query(
    `
      select
        m.id as match_id,
        m.division_id,
        m.match_date,
        be.innings_id,
        be.innings_no,
        be.event_index,
        be.over_no,
        be.ball_in_over,
        be.phase,
        be.striker_player_id,
        be.bowler_player_id,
        be.batter_runs,
        be.total_runs,
        be.extras,
        be.extra_type,
        be.is_legal_ball,
        be.wicket_flag,
        be.wicket_credited_to_bowler,
        be.player_out_id,
        be.leverage_score,
        striker.batting_hand as striker_batting_hand,
        striker.batting_style as striker_batting_style,
        striker.batting_style_bucket as striker_batting_style_bucket,
        bowler.bowling_style as bowler_bowling_style,
        bowler.bowling_style_detail as bowler_bowling_style_detail,
        bowler.bowling_style_bucket as bowler_bowling_style_bucket
      from public.ball_event be
      join public.match m on m.id = be.match_id
      left join public.player striker on striker.id = be.striker_player_id
      left join public.player bowler on bowler.id = be.bowler_player_id
      where m.series_id = $1
      order by m.match_date nulls last, m.id, be.innings_no, be.event_index
    `,
    [seriesId]
  );

  return result.rows.map((row) => ({
    matchId: toInteger(row.match_id),
    divisionId: toInteger(row.division_id),
    matchDate: row.match_date,
    inningsId: toInteger(row.innings_id),
    inningsNo: toInteger(row.innings_no),
    eventIndex: toInteger(row.event_index),
    overNo: toInteger(row.over_no),
    ballInOver: toInteger(row.ball_in_over),
    phase: normalizeText(row.phase),
    strikerPlayerId: toInteger(row.striker_player_id),
    bowlerPlayerId: toInteger(row.bowler_player_id),
    batterRuns: toInteger(row.batter_runs),
    totalRuns: toInteger(row.total_runs),
    extras: toInteger(row.extras),
    extraType: normalizeText(row.extra_type),
    isLegalBall: row.is_legal_ball === true,
    wicketFlag: row.wicket_flag === true,
    wicketCreditedToBowler: row.wicket_credited_to_bowler === true,
    playerOutId: toInteger(row.player_out_id),
    leverageScore: toNumber(row.leverage_score, 1),
    strikerBattingHand: normalizeText(row.striker_batting_hand),
    strikerBattingStyle: normalizeText(row.striker_batting_style),
    strikerBattingStyleBucket: normalizeText(row.striker_batting_style_bucket),
    bowlerStyle: normalizeText(row.bowler_bowling_style),
    bowlerStyleDetail: normalizeText(row.bowler_bowling_style_detail),
    bowlerStyleBucket: normalizeText(row.bowler_bowling_style_bucket),
  }));
}

async function loadDismissalRows(client, seriesId) {
  const result = await client.query(
    `
      select
        m.id as match_id,
        m.division_id,
        m.match_date,
        bi.player_id,
        bi.runs,
        bi.balls_faced,
        bi.dismissal_type,
        coalesce(primary_bowler.bowling_style, fallback_bowler.bowling_style) as bowler_bowling_style,
        coalesce(primary_bowler.bowling_style_detail, fallback_bowler.bowling_style_detail) as bowler_bowling_style_detail,
        coalesce(primary_bowler.bowling_style_bucket, fallback_bowler.bowling_style_bucket) as bowler_bowling_style_bucket
      from public.batting_innings bi
      join public.match m on m.id = bi.match_id
      left join public.player primary_bowler on primary_bowler.id = bi.dismissed_by_player_id
      left join lateral (
        select
          event_bowler.bowling_style,
          event_bowler.bowling_style_detail,
          event_bowler.bowling_style_bucket
        from public.ball_event be
        left join public.player event_bowler on event_bowler.id = be.bowler_player_id
        where bi.dismissed_by_player_id is null
          and be.match_id = bi.match_id
          and be.player_out_id = bi.player_id
          and be.wicket_flag = true
          and be.bowler_player_id is not null
          and lower(coalesce(bi.dismissal_type, '')) not like 'run out%'
          and lower(coalesce(bi.dismissal_type, '')) not like 'run_out%'
          and lower(coalesce(bi.dismissal_type, '')) not like 'retired%'
          and lower(coalesce(bi.dismissal_type, '')) not like 'obstruct%'
          and lower(coalesce(bi.dismissal_type, '')) not like 'timed out%'
          and lower(coalesce(bi.dismissal_type, '')) not like 'handled%'
        order by be.id desc
        limit 1
      ) fallback_bowler on true
      where m.series_id = $1
        and bi.did_not_bat = false
        and bi.dismissal_type is not null
        and replace(lower(btrim(coalesce(bi.dismissal_type, ''))), ' ', '_') <> 'not_out'
      order by m.match_date nulls last, m.id, bi.player_id
    `,
    [seriesId]
  );

  return result.rows.map((row) => ({
    matchId: toInteger(row.match_id),
    divisionId: toInteger(row.division_id),
    matchDate: row.match_date,
    playerId: toInteger(row.player_id),
    runs: toInteger(row.runs),
    ballsFaced: toInteger(row.balls_faced),
    dismissalType: normalizeText(row.dismissal_type),
    bowlerStyle: normalizeText(row.bowler_bowling_style),
    bowlerStyleDetail: normalizeText(row.bowler_bowling_style_detail),
    bowlerStyleBucket: normalizeText(row.bowler_bowling_style_bucket),
  }));
}

async function deleteExistingRows(client, seriesId) {
  await client.query("delete from public.player_intelligence_matchup where series_id = $1", [seriesId]);
  await client.query("delete from public.player_intelligence_dismissal where series_id = $1", [seriesId]);
  await client.query("delete from public.player_intelligence_profile where series_id = $1", [seriesId]);
}

async function batchInsert(client, tableName, columns, rows, batchSize = 200) {
  if (!rows.length) {
    return 0;
  }

  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const values = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        const payload = columns.map((column) => row[column]);
        const rowPlaceholders = payload.map((entry, columnIndex) => {
          values.push(entry);
          return `$${rowIndex * payload.length + columnIndex + 1}`;
        });
        return `(${rowPlaceholders.join(",")})`;
      })
      .join(",\n");

    await client.query(
      `
        insert into ${tableName} (
          ${columns.join(",\n          ")}
        )
        values
        ${placeholders}
      `,
      values
    );
  }

  return rows.length;
}

async function insertMatchupRows(client, seriesId, rows) {
  const columns = [
    "series_id",
    "scope_type",
    "division_id",
    "player_id",
    "perspective",
    "split_group",
    "split_value",
    "split_label",
    "phase_bucket",
    "match_count",
    "delivery_events",
    "legal_balls",
    "runs_scored",
    "runs_conceded",
    "dismissals",
    "wickets",
    "dot_balls",
    "boundaries",
    "wides",
    "no_balls",
    "strike_rate",
    "economy",
    "batting_average",
    "balls_per_dismissal",
    "balls_per_wicket",
    "dot_ball_pct",
    "boundary_ball_pct",
    "control_error_pct",
  ];

  return batchInsert(
    client,
    "public.player_intelligence_matchup",
    columns,
    rows.map((row) => ({
      series_id: seriesId,
      scope_type: row.scopeType,
      division_id: row.divisionId,
      player_id: row.playerId,
      perspective: row.perspective,
      split_group: row.splitGroup,
      split_value: row.splitValue,
      split_label: row.splitLabel,
      phase_bucket: row.phaseBucket,
      match_count: row.matchCount,
      delivery_events: row.deliveryEvents,
      legal_balls: row.legalBalls,
      runs_scored: row.runsScored,
      runs_conceded: row.runsConceded,
      dismissals: row.dismissals,
      wickets: row.wickets,
      dot_balls: row.dotBalls,
      boundaries: row.boundaries,
      wides: row.wides,
      no_balls: row.noBalls,
      strike_rate: row.strikeRate,
      economy: row.economy,
      batting_average: row.battingAverage,
      balls_per_dismissal: row.ballsPerDismissal,
      balls_per_wicket: row.ballsPerWicket,
      dot_ball_pct: row.dotBallPct,
      boundary_ball_pct: row.boundaryBallPct,
      control_error_pct: row.controlErrorPct,
    }))
  );
}

async function insertDismissalRows(client, seriesId, rows) {
  const columns = [
    "series_id",
    "scope_type",
    "division_id",
    "player_id",
    "bowler_style_bucket",
    "bowler_style_label",
    "dismissal_type",
    "dismissal_count",
    "match_count",
    "average_runs_at_dismissal",
    "average_balls_faced_at_dismissal",
  ];

  return batchInsert(
    client,
    "public.player_intelligence_dismissal",
    columns,
    rows.map((row) => ({
      series_id: seriesId,
      scope_type: row.scopeType,
      division_id: row.divisionId,
      player_id: row.playerId,
      bowler_style_bucket: row.bowlerStyleBucket,
      bowler_style_label: row.bowlerStyleLabel,
      dismissal_type: row.dismissalType,
      dismissal_count: row.dismissalCount,
      match_count: row.matchCount,
      average_runs_at_dismissal: row.averageRunsAtDismissal,
      average_balls_faced_at_dismissal: row.averageBallsFacedAtDismissal,
    }))
  );
}

async function insertProfileRows(client, seriesId, rows) {
  const columns = [
    "series_id",
    "scope_type",
    "division_id",
    "player_id",
    "batting_match_count",
    "bowling_match_count",
    "batting_legal_balls",
    "bowling_legal_balls",
    "batting_rotation_ratio",
    "batting_high_leverage_strike_rate",
    "bowling_high_leverage_economy",
    "bowling_pressure_control_error_pct",
    "boundary_dot_threshold",
    "dismissal_dot_threshold",
    "boundary_after_three_dots_pct",
    "dismissal_after_three_dots_pct",
  ];

  return batchInsert(
    client,
    "public.player_intelligence_profile",
    columns,
    rows.map((row) => ({
      series_id: seriesId,
      scope_type: row.scopeType,
      division_id: row.divisionId,
      player_id: row.playerId,
      batting_match_count: row.battingMatchCount,
      bowling_match_count: row.bowlingMatchCount,
      batting_legal_balls: row.battingLegalBalls,
      bowling_legal_balls: row.bowlingLegalBalls,
      batting_rotation_ratio: row.battingRotationRatio,
      batting_high_leverage_strike_rate: row.battingHighLeverageStrikeRate,
      bowling_high_leverage_economy: row.bowlingHighLeverageEconomy,
      bowling_pressure_control_error_pct: row.bowlingPressureControlErrorPct,
      boundary_dot_threshold: row.boundaryDotThreshold,
      dismissal_dot_threshold: row.dismissalDotThreshold,
      boundary_after_three_dots_pct: row.boundaryAfterThreeDotsPct,
      dismissal_after_three_dots_pct: row.dismissalAfterThreeDotsPct,
    }))
  );
}

async function loadSampleMatchups(client, seriesId, limit = 12) {
  const result = await client.query(
    `
      select
        p.display_name,
        pim.scope_type,
        d.source_label as division_label,
        pim.perspective,
        pim.split_group,
        pim.split_label,
        pim.phase_bucket,
        pim.legal_balls,
        pim.strike_rate,
        pim.economy,
        pim.dismissals,
        pim.wickets,
        pim.dot_ball_pct
      from public.player_intelligence_matchup pim
      join public.player p on p.id = pim.player_id
      left join public.division d on d.id = pim.division_id
      where pim.series_id = $1
        and pim.phase_bucket = 'overall'
        and pim.split_group <> 'overall'
      order by pim.legal_balls desc, p.display_name asc
      limit $2
    `,
    [seriesId, limit]
  );

  return result.rows.map((row) => ({
    playerName: normalizeText(row.display_name),
    scopeType: normalizeText(row.scope_type),
    divisionLabel: normalizeText(row.division_label),
    perspective: normalizeText(row.perspective),
    splitGroup: normalizeText(row.split_group),
    splitLabel: normalizeText(row.split_label),
    phaseBucket: normalizeText(row.phase_bucket),
    legalBalls: toInteger(row.legal_balls),
    strikeRate: toNumber(row.strike_rate, null),
    economy: toNumber(row.economy, null),
    dismissals: toInteger(row.dismissals),
    wickets: toInteger(row.wickets),
    dotBallPct: toNumber(row.dot_ball_pct, null),
  }));
}

async function runPlayerIntelligence({ series, outDir, log }) {
  const logger = buildLogger(log);
  ensureDir(outDir);

  const result = await withTransaction(async (client) => {
    await client.query("set local statement_timeout = '300s'");
    const context = await resolveSeriesContext(client, series.slug);
    logger(`[compute-intelligence] ${context.configKey}: load ball-event and dismissal inputs`);

    const ballEventRows = await loadBallEventRows(client, context.seriesId);
    const dismissalRows = await loadDismissalRows(client, context.seriesId);
    logger(
      `[compute-intelligence] ${context.configKey}: loaded ${ballEventRows.length} ball_event rows and ${dismissalRows.length} dismissal rows`
    );

    const computed = buildPlayerIntelligenceRows(ballEventRows, dismissalRows);
    logger(
      `[compute-intelligence] ${context.configKey}: computed ${computed.summary.matchupRowCount} matchup rows, ${computed.summary.dismissalRowCount} dismissal rows, ${computed.summary.profileRowCount} profile rows`
    );

    await deleteExistingRows(client, context.seriesId);
    const matchupRowCount = await insertMatchupRows(client, context.seriesId, computed.matchupRows);
    const dismissalRowCount = await insertDismissalRows(client, context.seriesId, computed.dismissalRows);
    const profileRowCount = await insertProfileRows(client, context.seriesId, computed.profileRows);
    const sampleMatchups = await loadSampleMatchups(client, context.seriesId, 12);

    return {
      ok: true,
      seriesConfigKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
      ballEventRowCount: ballEventRows.length,
      dismissalInputRowCount: dismissalRows.length,
      matchupRowCount,
      dismissalRowCount,
      profileRowCount,
      battingPlayerCount: computed.summary.battingPlayerCount,
      bowlingPlayerCount: computed.summary.bowlingPlayerCount,
      sampleMatchups,
    };
  });

  writeJsonFile(path.join(outDir, "player_intelligence_summary.json"), result);
  return result;
}

module.exports = {
  runPlayerIntelligence,
};

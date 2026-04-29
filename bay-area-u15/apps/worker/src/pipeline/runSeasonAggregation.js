const path = require("path");
const { withTransaction } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { normalizeText, toInteger, toNumber } = require("../lib/cricket");
const { buildPlayerSeasonAdvancedRows } = require("../analytics/seasonAggregate");

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
        s.name as series_name,
        ssm.scoring_model_id
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      left join public.series_scoring_model ssm
        on ssm.series_id = s.id
       and ssm.is_active = true
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
    scoringModelId: toInteger(row.scoring_model_id),
  };
}

async function loadQualityGates(client, scoringModelId) {
  if (!scoringModelId) {
    return {};
  }

  const result = await client.query(
    `
      select gate_key, numeric_value
      from public.scoring_model_quality_gate
      where scoring_model_id = $1
    `,
    [scoringModelId]
  );

  return result.rows.reduce((accumulator, row) => {
    const key = normalizeText(row.gate_key);
    if (key) {
      accumulator[key] = toNumber(row.numeric_value, null);
    }
    return accumulator;
  }, {});
}

async function loadPlayerMatchAdvancedRows(client, seriesId) {
  const result = await client.query(
    `
      select
        pma.match_id,
        pma.division_id,
        pma.player_id,
        pma.team_id,
        pma.role_type,
        pma.balls_faced,
        pma.batter_runs,
        pma.legal_balls_bowled,
        pma.total_runs_conceded,
        pma.wicket_ball_pct,
        pma.fielding_impact_score,
        pma.team_strength_adjusted_score,
        pma.player_strength_adjusted_score,
        pma.leverage_adjusted_score,
        pma.match_impact_score,
        m.match_date
      from public.player_match_advanced pma
      join public.match m on m.id = pma.match_id
      where m.series_id = $1
      order by pma.division_id, pma.player_id, m.match_date nulls last, pma.match_id, pma.role_type
    `,
    [seriesId]
  );

  return result.rows.map((row) => ({
    matchId: toInteger(row.match_id),
    divisionId: toInteger(row.division_id),
    playerId: toInteger(row.player_id),
    teamId: toInteger(row.team_id),
    roleType: normalizeText(row.role_type),
    ballsFaced: toInteger(row.balls_faced),
    batterRuns: toInteger(row.batter_runs),
    legalBallsBowled: toInteger(row.legal_balls_bowled),
    totalRunsConceded: toInteger(row.total_runs_conceded),
    wicketBallPct: toNumber(row.wicket_ball_pct, 0),
    fieldingImpactScore: toNumber(row.fielding_impact_score, 0),
    teamStrengthAdjustedScore: toNumber(row.team_strength_adjusted_score, 0),
    playerStrengthAdjustedScore: toNumber(row.player_strength_adjusted_score, 0),
    leverageAdjustedScore: toNumber(row.leverage_adjusted_score, 0),
    matchImpactScore: toNumber(row.match_impact_score, 0),
    matchDate: row.match_date,
  }));
}

async function replacePlayerSeasonAdvancedRows(client, seriesId, rows) {
  await client.query("delete from public.player_season_advanced where series_id = $1", [seriesId]);

  if (!rows.length) {
    return 0;
  }

  const columns = [
    "series_id",
    "division_id",
    "player_id",
    "team_id",
    "role_type",
    "matches_played",
    "innings_count",
    "balls_sample",
    "raw_runs",
    "raw_wickets",
    "batting_weighted_efficiency",
    "bowling_weighted_efficiency",
    "leverage_score",
    "consistency_score",
    "versatility_score",
    "fielding_score",
    "strong_opposition_score",
    "recent_form_score",
    "development_trend_score",
    "confidence_score",
  ];

  const batchSize = 150;
  for (let start = 0; start < rows.length; start += batchSize) {
    const chunk = rows.slice(start, start + batchSize);
    const values = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        const payload = [
          seriesId,
          row.divisionId,
          row.playerId,
          row.teamId,
          row.roleType,
          row.matchesPlayed,
          row.inningsCount,
          row.ballsSample,
          row.rawRuns,
          row.rawWickets,
          row.battingWeightedEfficiency,
          row.bowlingWeightedEfficiency,
          row.leverageScore,
          row.consistencyScore,
          row.versatilityScore,
          row.fieldingScore,
          row.strongOppositionScore,
          row.recentFormScore,
          row.developmentTrendScore,
          row.confidenceScore,
        ];
        const rowPlaceholders = payload.map((entry, columnIndex) => {
          values.push(entry);
          return `$${rowIndex * payload.length + columnIndex + 1}`;
        });
        return `(${rowPlaceholders.join(",")})`;
      })
      .join(",\n");

    await client.query(
      `
        insert into public.player_season_advanced (
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

function buildTopRows(rows, limit = 10) {
  return [...rows]
    .sort((left, right) => {
      const confidenceDelta = (toNumber(right.confidenceScore, 0) || 0) - (toNumber(left.confidenceScore, 0) || 0);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      const battingDelta =
        Math.max(toNumber(right.battingWeightedEfficiency, 0), toNumber(right.bowlingWeightedEfficiency, 0)) -
        Math.max(toNumber(left.battingWeightedEfficiency, 0), toNumber(left.bowlingWeightedEfficiency, 0));
      return battingDelta;
    })
    .slice(0, limit);
}

async function loadTopSeasonRows(client, seriesId, limit = 10) {
  const result = await client.query(
    `
      select
        d.source_label as division_label,
        p.display_name,
        psa.role_type,
        psa.matches_played,
        psa.balls_sample,
        psa.raw_runs,
        psa.raw_wickets,
        psa.batting_weighted_efficiency,
        psa.bowling_weighted_efficiency,
        psa.leverage_score,
        psa.consistency_score,
        psa.versatility_score,
        psa.fielding_score,
        psa.strong_opposition_score,
        psa.recent_form_score,
        psa.development_trend_score,
        psa.confidence_score
      from public.player_season_advanced psa
      join public.player p on p.id = psa.player_id
      left join public.division d on d.id = psa.division_id
      where psa.series_id = $1
      order by psa.confidence_score desc nulls last,
               greatest(coalesce(psa.batting_weighted_efficiency, 0), coalesce(psa.bowling_weighted_efficiency, 0)) desc,
               p.display_name asc
      limit $2
    `,
    [seriesId, limit]
  );

  return result.rows.map((row) => ({
    divisionLabel: normalizeText(row.division_label),
    playerName: normalizeText(row.display_name),
    roleType: normalizeText(row.role_type),
    matchesPlayed: toInteger(row.matches_played),
    ballsSample: toInteger(row.balls_sample),
    rawRuns: toInteger(row.raw_runs),
    rawWickets: toInteger(row.raw_wickets),
    battingWeightedEfficiency: toNumber(row.batting_weighted_efficiency, 0),
    bowlingWeightedEfficiency: toNumber(row.bowling_weighted_efficiency, 0),
    leverageScore: toNumber(row.leverage_score, 0),
    consistencyScore: toNumber(row.consistency_score, 0),
    versatilityScore: toNumber(row.versatility_score, 0),
    fieldingScore: toNumber(row.fielding_score, 0),
    strongOppositionScore: toNumber(row.strong_opposition_score, 0),
    recentFormScore: toNumber(row.recent_form_score, 0),
    developmentTrendScore: toNumber(row.development_trend_score, 0),
    confidenceScore: toNumber(row.confidence_score, 0),
  }));
}

async function runSeasonAggregation({ series, outDir, log }) {
  const logger = buildLogger(log);
  ensureDir(outDir);

  const result = await withTransaction(async (client) => {
    await client.query("set local statement_timeout = '300s'");
    const context = await resolveSeriesContext(client, series.slug);
    logger(`[compute-season] ${context.configKey}: load scoring model and player-match inputs`);

    const qualityGates = await loadQualityGates(client, context.scoringModelId);
    const playerMatchAdvancedRows = await loadPlayerMatchAdvancedRows(client, context.seriesId);
    logger(
      `[compute-season] ${context.configKey}: loaded ${playerMatchAdvancedRows.length} player_match_advanced rows`
    );

    const computed = buildPlayerSeasonAdvancedRows(playerMatchAdvancedRows, { qualityGates });
    logger(
      `[compute-season] ${context.configKey}: computed ${computed.rows.length} player_season_advanced rows across ${computed.summary.divisionCount} division bucket(s)`
    );

    const insertedCount = await replacePlayerSeasonAdvancedRows(
      client,
      context.seriesId,
      computed.rows
    );

    const topRows = await loadTopSeasonRows(client, context.seriesId, 10);

    return {
      ok: true,
      seriesConfigKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
      scoringModelId: context.scoringModelId,
      qualityGates,
      playerMatchAdvancedRowCount: playerMatchAdvancedRows.length,
      playerSeasonAdvancedRowCount: insertedCount,
      divisionCount: computed.summary.divisionCount,
      roleCounts: computed.summary.roleCounts,
      topRows,
    };
  });

  writeJsonFile(path.join(outDir, "season_aggregation_summary.json"), result);
  return result;
}

module.exports = {
  runSeasonAggregation,
};

const path = require("path");
const { withTransaction } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { normalizeText, toInteger, toNumber } = require("../lib/cricket");
const { buildPlayerCompositeRows } = require("../analytics/compositeScore");

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
        sm.id as scoring_model_id,
        sm.version_label
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      left join public.series_scoring_model ssm
        on ssm.series_id = s.id
       and ssm.is_active = true
      left join public.scoring_model sm on sm.id = ssm.scoring_model_id
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
    scoreVersion: normalizeText(row.version_label) || "v1",
  };
}

async function loadSeasonRows(client, seriesId) {
  const result = await client.query(
    `
      select
        division_id,
        player_id,
        team_id,
        role_type,
        batting_weighted_efficiency,
        bowling_weighted_efficiency,
        fielding_score,
        leverage_score,
        consistency_score,
        versatility_score,
        strong_opposition_score,
        recent_form_score,
        development_trend_score
      from public.player_season_advanced
      where series_id = $1
      order by division_id, player_id
    `,
    [seriesId]
  );

  return result.rows.map((row) => ({
    divisionId: toInteger(row.division_id),
    playerId: toInteger(row.player_id),
    teamId: toInteger(row.team_id),
    roleType: normalizeText(row.role_type),
    battingWeightedEfficiency: toNumber(row.batting_weighted_efficiency, 0),
    bowlingWeightedEfficiency: toNumber(row.bowling_weighted_efficiency, 0),
    fieldingScore: toNumber(row.fielding_score, 0),
    leverageScore: toNumber(row.leverage_score, 0),
    consistencyScore: toNumber(row.consistency_score, 0),
    versatilityScore: toNumber(row.versatility_score, 0),
    strongOppositionScore: toNumber(row.strong_opposition_score, 0),
    recentFormScore: toNumber(row.recent_form_score, 0),
    developmentTrendScore: toNumber(row.development_trend_score, 0),
  }));
}

async function loadCompositeWeights(client, scoringModelId) {
  const result = await client.query(
    `
      select
        primary_role,
        component_key,
        weight_value,
        display_order
      from public.scoring_model_composite_weight
      where scoring_model_id = $1
      order by primary_role, display_order, component_key
    `,
    [scoringModelId]
  );

  return result.rows.map((row) => ({
    primaryRole: normalizeText(row.primary_role),
    componentKey: normalizeText(row.component_key),
    weightValue: toNumber(row.weight_value, 0),
  }));
}

async function loadWicketkeepingRows(client, seriesId) {
  const result = await client.query(
    `
      select
        m.division_id,
        pma.player_id,
        avg(pma.fielding_impact_score)::numeric(10,4) as wicketkeeping_score
      from public.player_match_advanced pma
      join public.match m on m.id = pma.match_id
      where m.series_id = $1
        and pma.role_type = 'wicketkeeping'
      group by m.division_id, pma.player_id
      order by m.division_id, pma.player_id
    `,
    [seriesId]
  );

  return result.rows.map((row) => ({
    divisionId: toInteger(row.division_id),
    playerId: toInteger(row.player_id),
    wicketkeepingScore: toNumber(row.wicketkeeping_score, 0),
  }));
}

async function replaceCompositeRows(client, seriesId, scoreVersion, rows) {
  await client.query("delete from public.player_composite_score where series_id = $1", [seriesId]);

  if (!rows.length) {
    return 0;
  }

  const columns = [
    "series_id",
    "division_id",
    "player_id",
    "team_id",
    "batting_score",
    "bowling_score",
    "fielding_score",
    "leverage_score",
    "consistency_score",
    "versatility_score",
    "strong_opposition_score",
    "development_score",
    "composite_score",
    "percentile_rank",
    "score_version",
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
          row.battingScore,
          row.bowlingScore,
          row.fieldingScore,
          row.leverageScore,
          row.consistencyScore,
          row.versatilityScore,
          row.strongOppositionScore,
          row.developmentScore,
          row.compositeScore,
          row.percentileRank,
          scoreVersion,
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
        insert into public.player_composite_score (
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

async function loadTopCompositeRows(client, seriesId, limit = 10) {
  const result = await client.query(
    `
      select
        d.source_label as division_label,
        p.display_name,
        pcs.composite_score,
        pcs.percentile_rank,
        pcs.batting_score,
        pcs.bowling_score,
        pcs.fielding_score,
        pcs.leverage_score,
        pcs.consistency_score,
        pcs.versatility_score,
        pcs.strong_opposition_score,
        pcs.development_score
      from public.player_composite_score pcs
      join public.player p on p.id = pcs.player_id
      left join public.division d on d.id = pcs.division_id
      where pcs.series_id = $1
      order by pcs.composite_score desc nulls last, p.display_name asc
      limit $2
    `,
    [seriesId, limit]
  );

  return result.rows.map((row) => ({
    divisionLabel: normalizeText(row.division_label),
    playerName: normalizeText(row.display_name),
    compositeScore: toNumber(row.composite_score, 0),
    percentileRank: toNumber(row.percentile_rank, 0),
    battingScore: toNumber(row.batting_score, 0),
    bowlingScore: toNumber(row.bowling_score, 0),
    fieldingScore: toNumber(row.fielding_score, 0),
    leverageScore: toNumber(row.leverage_score, 0),
    consistencyScore: toNumber(row.consistency_score, 0),
    versatilityScore: toNumber(row.versatility_score, 0),
    strongOppositionScore: toNumber(row.strong_opposition_score, 0),
    developmentScore: toNumber(row.development_score, 0),
  }));
}

async function runCompositeScoring({ series, outDir, log }) {
  const logger = buildLogger(log);
  ensureDir(outDir);

  const result = await withTransaction(async (client) => {
    await client.query("set local statement_timeout = '300s'");
    const context = await resolveSeriesContext(client, series.slug);
    logger(`[compute-composite] ${context.configKey}: load season rows and scoring weights`);

    const seasonRows = await loadSeasonRows(client, context.seriesId);
    const weightRows = await loadCompositeWeights(client, context.scoringModelId);
    const wicketkeepingRows = await loadWicketkeepingRows(client, context.seriesId);

    logger(
      `[compute-composite] ${context.configKey}: loaded ${seasonRows.length} season rows, ${weightRows.length} weight rows, ${wicketkeepingRows.length} wicketkeeping summaries`
    );

    const computed = buildPlayerCompositeRows(seasonRows, weightRows, wicketkeepingRows);
    logger(
      `[compute-composite] ${context.configKey}: computed ${computed.rows.length} player_composite_score rows across ${computed.summary.divisionCount} division bucket(s)`
    );

    const insertedCount = await replaceCompositeRows(
      client,
      context.seriesId,
      context.scoreVersion,
      computed.rows
    );

    const topRows = await loadTopCompositeRows(client, context.seriesId, 10);

    return {
      ok: true,
      seriesConfigKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
      scoringModelId: context.scoringModelId,
      scoreVersion: context.scoreVersion,
      playerSeasonAdvancedRowCount: seasonRows.length,
      playerCompositeScoreRowCount: insertedCount,
      weightRowCount: weightRows.length,
      wicketkeepingSummaryCount: wicketkeepingRows.length,
      divisionCount: computed.summary.divisionCount,
      topRows,
    };
  });

  writeJsonFile(path.join(outDir, "composite_scoring_summary.json"), result);
  return result;
}

module.exports = {
  runCompositeScoring,
};

const path = require("path");
const { withTransaction } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { normalizeText, toInteger, toNumber } = require("../lib/cricket");
const { buildLeagueThreatRows } = require("../analytics/leagueThreatScore");
const { buildMilcPlayoffThreatRows } = require('../analytics/milcPlayoffThreat');
const { MILC_2026_KEY, MILC_THREAT_VERSION } = require('../../../../shared/milcPlayoffThreat');

const SCORE_VERSION = "ncca-league-threat-v1";

function buildLogger(log) {
  return typeof log === "function" ? log : console.log;
}

async function resolveSeriesContext(client, seriesConfigKey) {
  const result = await client.query(
    `
      select c.config_key, s.id as series_id, s.name as series_name, sm.version_label
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      left join public.series_scoring_model ssm on ssm.series_id = s.id and ssm.is_active = true
      left join public.scoring_model sm on sm.id = ssm.scoring_model_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );
  const row = result.rows[0];
  if (!row) throw new Error(`Unable to resolve series context for config key: ${seriesConfigKey}`);
  return {
    configKey: normalizeText(row.config_key),
    seriesId: toInteger(row.series_id),
    seriesName: normalizeText(row.series_name),
    scoreVersion: normalizeText(row.version_label) || "v1",
  };
}

async function loadThreatInputs(client, seriesId) {
  const result = await client.query(
    `
      select
        d.source_label as division_label,
        pcs.player_id,
        pcs.composite_score,
        psa.matches_played
      from public.player_composite_score pcs
      join public.player_season_advanced psa
        on psa.series_id = pcs.series_id
       and psa.division_id = pcs.division_id
       and psa.player_id = pcs.player_id
      join public.division d on d.id = pcs.division_id
      where pcs.series_id = $1
      order by pcs.player_id, pcs.division_id
    `,
    [seriesId]
  );
  return result.rows.map((row) => ({
    divisionLabel: normalizeText(row.division_label),
    playerId: toInteger(row.player_id),
    compositeScore: toNumber(row.composite_score, 0),
    matchesPlayed: toInteger(row.matches_played) || 0,
  }));
}

async function loadMilcThreatInputs(client, context) {
  const result = await client.query(`
    with appearances as (
      select b.player_id, b.team_id from public.batting_innings b
      join public.match m on m.id=b.match_id where m.series_id=$1
      union
      select b.player_id, b.team_id from public.bowling_spell b
      join public.match m on m.id=b.match_id where m.series_id=$1
    ), ambiguous_names as (
      select a.team_id, lower(trim(p.display_name)) player_name
      from appearances a join public.player p on p.id=a.player_id
      group by a.team_id, lower(trim(p.display_name)) having count(distinct p.id)>1
    )
    select pcs.player_id, pcs.composite_score, psa.matches_played,
      p.display_name player_name, p.source_player_id, t.display_name team_name,
      d.source_label division_label,
      exists(select 1 from ambiguous_names n where n.team_id=psa.team_id and n.player_name=lower(trim(p.display_name))) identity_review
    from public.player_composite_score pcs
    join public.player_season_advanced psa on psa.series_id=pcs.series_id
      and psa.division_id is not distinct from pcs.division_id and psa.player_id=pcs.player_id
    join public.player p on p.id=pcs.player_id
    join public.team t on t.id=psa.team_id
    left join public.division d on d.id=pcs.division_id
    where pcs.series_id=$1 and pcs.score_version = $2
    order by pcs.player_id, pcs.division_id
  `, [context.seriesId, context.scoreVersion]);
  return result.rows.map(row => ({
    playerId: toInteger(row.player_id), playerName: row.player_name,
    sourcePlayerId: row.source_player_id, teamName: row.team_name,
    divisionLabel: row.division_label, compositeScore: row.composite_score,
    matchesPlayed: toInteger(row.matches_played), identityReview: row.identity_review,
  }));
}

async function replaceLeagueThreatRows(client, seriesId, rows, scoreVersion) {
  if (scoreVersion === MILC_THREAT_VERSION) {
    await client.query('delete from public.player_series_threat_score where series_id = $1 and score_version = $2', [seriesId, scoreVersion]);
  } else {
    await client.query("delete from public.player_series_threat_score where series_id = $1", [seriesId]);
  }
  if (!rows.length) return 0;

  const columns = [
    "series_id",
    "player_id",
    "league_threat_score",
    "league_percentile_rank",
    "total_matches",
    "division_evidence",
    "score_version",
  ];
  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const payload = [
      seriesId,
      row.playerId,
      row.leagueThreatScore,
      row.leaguePercentileRank,
      row.totalMatches,
      JSON.stringify(row.divisionEvidence),
      scoreVersion,
    ];
    return `(${payload.map((entry, columnIndex) => {
      values.push(entry);
      return `$${rowIndex * payload.length + columnIndex + 1}`;
    }).join(", ")})`;
  });

  await client.query(
    `insert into public.player_series_threat_score (${columns.join(", ")}) values ${placeholders.join(", ")}`,
    values
  );
  return rows.length;
}

async function runLeagueThreatScoring({ series, outDir, log, dryRun = false, withTransactionFn = withTransaction }) {
  const logger = buildLogger(log);
  ensureDir(outDir);

  const result = await withTransactionFn(async (client) => {
    await client.query("set local statement_timeout = '300s'");
    const context = await resolveSeriesContext(client, series.slug);
    const isMilc = context.configKey === MILC_2026_KEY;
    const scoreVersion = isMilc ? MILC_THREAT_VERSION : SCORE_VERSION;
    const inputRows = isMilc ? await loadMilcThreatInputs(client, context) : await loadThreatInputs(client, context.seriesId);
    const computed = isMilc ? buildMilcPlayoffThreatRows(inputRows) : buildLeagueThreatRows(inputRows);
    const insertedCount = dryRun ? 0 : await replaceLeagueThreatRows(client, context.seriesId, computed.rows, scoreVersion);
    const topRows = [...computed.rows]
      .sort((left, right) => right.leagueThreatScore - left.leagueThreatScore)
      .slice(0, 10);

    logger(`[compute-league-threat] ${context.configKey}: computed ${computed.rows.length}, persisted ${insertedCount} player rows`);
    return {
      ok: true,
      seriesConfigKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
      scoreVersion,
      dryRun,
      persistedRowCount: insertedCount,
      inputRowCount: inputRows.length,
      playerSeriesThreatScoreRowCount: computed.rows.length,
      eligiblePlayerCount: computed.summary.playerCount,
      topRows,
    };
  });

  writeJsonFile(path.join(outDir, "league_threat_scoring_summary.json"), result);
  return result;
}

module.exports = { runLeagueThreatScoring };

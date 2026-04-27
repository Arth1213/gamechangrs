"use strict";

const { getPool } = require("../lib/connection");
const { normalizeText, toInteger } = require("../lib/utils");

const DEFAULT_REPORT_PROFILE = {
  profile_key: "executive-selector-default",
  name: "Executive Selector Default",
  description:
    "Selector-focused executive report with current-series and overall stats, peer strip, and trend graphics.",
  theme_name: "game-changrs-executive-dark",
  include_current_series_stats: true,
  include_overall_stats: true,
  include_peer_strip: true,
  peer_count: 3,
  include_trend_graphics: true,
  include_selector_badge: true,
  show_batting: true,
  show_bowling: true,
  show_fielding: true,
  show_wicketkeeping: true,
};

async function withClient(work) {
  const client = await getPool().connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

async function withTransaction(work, options = {}) {
  const client = await getPool().connect();
  const dryRun = options.dryRun === true;

  try {
    await client.query("BEGIN");
    const result = await work(client);
    if (dryRun) {
      await client.query("ROLLBACK");
      return {
        ...result,
        dryRun: true,
      };
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }
    throw error;
  } finally {
    client.release();
  }
}

async function fetchOne(client, query, params = []) {
  const result = await client.query(query, params);
  return result.rows[0] || null;
}

async function resolveSeriesContext(client, seriesConfigKey, options = {}) {
  const row = await fetchOne(
    client,
    `
      select
        c.*,
        s.id as series_id,
        s.name as series_name,
        s.league_name,
        s.source_system as series_source_system,
        s.source_series_id,
        s.year as series_year
      from series_source_config c
      join series s on s.id = c.series_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );

  if (!row) {
    return null;
  }

  const reportProfile = options.ensureReportProfile === false
    ? await loadActiveReportProfile(client, row.series_id)
    : await ensureDefaultReportProfile(client, row.series_id);
  const scoringModel = await loadActiveScoringModel(client, row.series_id);

  return {
    configKey: normalizeText(row.config_key),
    seriesId: toInteger(row.series_id),
    seriesName: normalizeText(row.series_name),
    targetAgeGroup: normalizeText(row.target_age_group),
    leagueName: normalizeText(row.league_name),
    sourceSystem: normalizeText(row.source_system || row.series_source_system),
    sourceSeriesId: normalizeText(row.source_series_id),
    row,
    reportProfile,
    scoringModel,
  };
}

async function resolveDefaultSeriesContext(client, options = {}) {
  const row = await fetchOne(
    client,
    `
      select config_key
      from series_source_config
      order by is_active desc, updated_at desc nulls last, id desc
      limit 1
    `
  );

  if (!row?.config_key) {
    return null;
  }

  return resolveSeriesContext(client, row.config_key, options);
}

async function loadActiveReportProfile(client, seriesId) {
  return fetchOne(
    client,
    `
      select rp.*
      from series_report_profile srp
      join report_profile rp on rp.id = srp.report_profile_id
      where srp.series_id = $1
        and srp.is_active = true
      order by srp.assigned_at desc, srp.id desc
      limit 1
    `,
    [seriesId]
  );
}

async function ensureDefaultReportProfile(client, seriesId) {
  let active = await loadActiveReportProfile(client, seriesId);
  if (active) {
    return active;
  }

  const profile = await fetchOne(
    client,
    `
      insert into report_profile (
        profile_key,
        name,
        description,
        theme_name,
        include_current_series_stats,
        include_overall_stats,
        include_peer_strip,
        peer_count,
        include_trend_graphics,
        include_selector_badge,
        show_batting,
        show_bowling,
        show_fielding,
        show_wicketkeeping
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      )
      on conflict (profile_key)
      do update set
        name = excluded.name,
        description = excluded.description,
        theme_name = excluded.theme_name,
        include_current_series_stats = excluded.include_current_series_stats,
        include_overall_stats = excluded.include_overall_stats,
        include_peer_strip = excluded.include_peer_strip,
        peer_count = excluded.peer_count,
        include_trend_graphics = excluded.include_trend_graphics,
        include_selector_badge = excluded.include_selector_badge,
        show_batting = excluded.show_batting,
        show_bowling = excluded.show_bowling,
        show_fielding = excluded.show_fielding,
        show_wicketkeeping = excluded.show_wicketkeeping,
        updated_at = now()
      returning *
    `,
    [
      DEFAULT_REPORT_PROFILE.profile_key,
      DEFAULT_REPORT_PROFILE.name,
      DEFAULT_REPORT_PROFILE.description,
      DEFAULT_REPORT_PROFILE.theme_name,
      DEFAULT_REPORT_PROFILE.include_current_series_stats,
      DEFAULT_REPORT_PROFILE.include_overall_stats,
      DEFAULT_REPORT_PROFILE.include_peer_strip,
      DEFAULT_REPORT_PROFILE.peer_count,
      DEFAULT_REPORT_PROFILE.include_trend_graphics,
      DEFAULT_REPORT_PROFILE.include_selector_badge,
      DEFAULT_REPORT_PROFILE.show_batting,
      DEFAULT_REPORT_PROFILE.show_bowling,
      DEFAULT_REPORT_PROFILE.show_fielding,
      DEFAULT_REPORT_PROFILE.show_wicketkeeping,
    ]
  );

  await client.query(
    `
      update series_report_profile
      set is_active = false
      where series_id = $1
    `,
    [seriesId]
  );

  const assignment = await fetchOne(
    client,
    `
      select *
      from series_report_profile
      where series_id = $1
        and report_profile_id = $2
      limit 1
    `,
    [seriesId, profile.id]
  );

  if (assignment) {
    await client.query(
      `
        update series_report_profile
        set is_active = true,
            assigned_at = now(),
            assigned_by = 'phase8-api'
        where id = $1
      `,
      [assignment.id]
    );
  } else {
    await client.query(
      `
        insert into series_report_profile (
          series_id,
          report_profile_id,
          assigned_by,
          is_active
        )
        values ($1,$2,$3,$4)
      `,
      [seriesId, profile.id, "phase8-api", true]
    );
  }

  active = await loadActiveReportProfile(client, seriesId);
  return active || profile;
}

async function loadActiveScoringModel(client, seriesId) {
  return fetchOne(
    client,
    `
      select sm.*
      from series_scoring_model ssm
      join scoring_model sm on sm.id = ssm.scoring_model_id
      where ssm.series_id = $1
        and ssm.is_active = true
      order by ssm.assigned_at desc, ssm.id desc
      limit 1
    `,
    [seriesId]
  );
}

module.exports = {
  DEFAULT_REPORT_PROFILE,
  ensureDefaultReportProfile,
  fetchOne,
  loadActiveScoringModel,
  resolveDefaultSeriesContext,
  resolveSeriesContext,
  withClient,
  withTransaction,
};

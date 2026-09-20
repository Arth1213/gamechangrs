"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { withClient, resolveSeriesContext } = require("./seriesService");

const CONFIG_PATH = path.resolve(__dirname, "../../../../../config/grizzlies-2026-portal.yaml");

function loadPortalConfig() {
  return YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function getConfiguredPlayerId(config, name) {
  const mapping = config?.approvedMappings?.[name];
  if (Number.isInteger(mapping)) return mapping;
  if (Number.isInteger(mapping?.playerId)) return mapping.playerId;
  const cluster = (config?.identityClusters || []).find((item) => item?.name === name);
  return Number.isInteger(cluster?.canonicalPlayerId) ? cluster.canonicalPlayerId : null;
}

function getThreatTone(input) {
  const percentile = Number(input?.leaguePercentileRank);
  const totalMatches = Number(input?.totalMatches);
  if (!Number.isFinite(percentile)) return "unknown";
  if (percentile >= 85 && Number.isFinite(totalMatches) && totalMatches >= 3) return "red";
  if (percentile >= 60) return "amber";
  return "green";
}

function normalizePortalText(value) {
  return String(value || "").trim();
}

function isWestDivision(value) {
  return /\bwest\b/i.test(normalizePortalText(value));
}

function isGrizzliesMatchAnalysisAvailable(input) {
  const status = normalizePortalText(input?.status || input?.match_status).toLowerCase();
  const parseStatus = normalizePortalText(input?.parseStatus || input?.parse_status).toLowerCase();
  const analyticsStatus = normalizePortalText(input?.analyticsStatus || input?.analytics_status).toLowerCase();
  const reportStatus = normalizePortalText(input?.report?.status || input?.reportStatus || input?.report_status).toLowerCase();
  const ballEventCount = Number(input?.ballEventCount ?? input?.ball_event_count);

  return status === "completed"
    && parseStatus === "parsed"
    && analyticsStatus === "computed"
    && Number.isFinite(ballEventCount)
    && ballEventCount > 0
    && (reportStatus === "reviewed" || reportStatus === "published");
}

function mapGrizzliesWestFixtures(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => isWestDivision(row?.division_label || row?.divisionLabel))
    .map((row) => {
      const matchId = Number(row.id ?? row.matchId);
      const status = normalizePortalText(row.match_status || row.status).toLowerCase() || "unavailable";
      const reportStatus = normalizePortalText(row.report_status || row.reportStatus).toLowerCase() || "unavailable";
      const fixture = {
        matchId,
        sourceMatchId: normalizePortalText(row.source_match_id || row.sourceMatchId),
        startsAt: row.match_date || row.startsAt || null,
        dateLabel: normalizePortalText(row.match_date || row.dateLabel),
        venue: normalizePortalText(row.venue) || null,
        homeTeam: normalizePortalText(row.team1_name || row.homeTeam),
        awayTeam: normalizePortalText(row.team2_name || row.awayTeam),
        divisionLabel: normalizePortalText(row.division_label || row.divisionLabel),
        status,
        resultText: normalizePortalText(row.result_text || row.resultText) || null,
        scoreline: normalizePortalText(row.scoreline) || null,
        parseStatus: normalizePortalText(row.parse_status || row.parseStatus),
        analyticsStatus: normalizePortalText(row.analytics_status || row.analyticsStatus),
        ballEventCount: Number(row.ball_event_count ?? row.ballEventCount) || 0,
        report: { status: reportStatus, path: null },
      };
      if (isGrizzliesMatchAnalysisAvailable(fixture)) {
        fixture.report.path = `/analytics/grizzlies/2026/matches/${matchId}`;
      }
      return fixture;
    });
}

async function loadGrizzliesWestFixtures(config) {
  const seriesConfigKey = normalizePortalText(config?.portal?.milcSeriesConfigKey);
  if (!seriesConfigKey) return { seriesConfigKey: null, officialScheduleUrl: null, fixtures: [] };

  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, seriesConfigKey, { ensureReportProfile: false });
    if (!context?.seriesId) return { seriesConfigKey, officialScheduleUrl: config?.portal?.milcOfficialScheduleUrl || null, fixtures: [] };
    const result = await client.query(
      `
        select
          m.id,
          m.source_match_id,
          m.match_date,
          m.venue,
          m.status as match_status,
          m.result_text,
          d.source_label as division_label,
          t1.display_name as team1_name,
          t2.display_name as team2_name,
          mrs.parse_status,
          mrs.analytics_status,
          count(distinct be.id)::int as ball_event_count,
          report.status as report_status
        from public.match m
        join public.team t1 on t1.id = m.team1_id
        join public.team t2 on t2.id = m.team2_id
        join public.division d on d.id = m.division_id
        left join public.match_refresh_state mrs on mrs.match_id = m.id
        left join public.ball_event be on be.match_id = m.id
        left join public.grizzlies_match_analysis_report report
          on report.match_id = m.id
          and report.series_id = m.series_id
          and report.report_type = 'grizzlies_match_analysis'
        where m.series_id = $1
          and lower(coalesce(d.source_label, '')) = lower($2)
        group by
          m.id,
          d.source_label,
          t1.display_name,
          t2.display_name,
          mrs.parse_status,
          mrs.analytics_status,
          report.status
        order by m.match_date asc nulls last, m.id asc
      `,
      [context.seriesId, normalizePortalText(config?.portal?.milcWestDivisionLabel) || "West"]
    );
    return {
      seriesConfigKey,
      officialScheduleUrl: config?.portal?.milcOfficialScheduleUrl || null,
      fixtures: mapGrizzliesWestFixtures(result.rows),
    };
  });
}

async function getGrizzliesMatchAnalysis(matchId) {
  const config = loadPortalConfig();
  const seriesConfigKey = normalizePortalText(config?.portal?.milcSeriesConfigKey);
  const numericMatchId = Number(matchId);
  if (!seriesConfigKey || !Number.isInteger(numericMatchId) || numericMatchId <= 0) {
    const error = new Error("Grizzlies match analysis was not found.");
    error.statusCode = 404;
    throw error;
  }

  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, seriesConfigKey, { ensureReportProfile: false });
    if (!context?.seriesId) {
      const error = new Error("Grizzlies match analysis was not found.");
      error.statusCode = 404;
      throw error;
    }
    const result = await client.query(
      `
        select
          m.id as match_id,
          m.source_match_id,
          m.match_date,
          m.venue,
          m.result_text,
          t1.display_name as home_team,
          t2.display_name as away_team,
          report.status as report_status,
          report.evidence_json,
          report.analysis_json,
          report.source_data_checksum,
          report.generated_at,
          report.reviewed_at,
          report.published_at
        from public.match m
        join public.division d on d.id = m.division_id
        join public.team t1 on t1.id = m.team1_id
        join public.team t2 on t2.id = m.team2_id
        join public.match_refresh_state mrs on mrs.match_id = m.id
        join public.grizzlies_match_analysis_report report
          on report.match_id = m.id
          and report.series_id = m.series_id
          and report.report_type = 'grizzlies_match_analysis'
        where m.id = $1
          and m.series_id = $2
          and lower(coalesce(d.source_label, '')) = lower($3)
          and m.status = 'completed'
          and mrs.parse_status = 'parsed'
          and mrs.analytics_status = 'computed'
          and report.status in ('reviewed', 'published')
          and exists (select 1 from public.ball_event be where be.match_id = m.id)
        limit 1
      `,
      [numericMatchId, context.seriesId, normalizePortalText(config?.portal?.milcWestDivisionLabel) || "West"]
    );
    const row = result.rows[0];
    if (!row) {
      const error = new Error("Grizzlies match analysis was not found.");
      error.statusCode = 404;
      throw error;
    }
    return {
      match: {
        matchId: Number(row.match_id),
        sourceMatchId: normalizePortalText(row.source_match_id),
        date: row.match_date || null,
        venue: normalizePortalText(row.venue) || null,
        homeTeam: normalizePortalText(row.home_team),
        awayTeam: normalizePortalText(row.away_team),
        resultText: normalizePortalText(row.result_text) || null,
      },
      reportStatus: normalizePortalText(row.report_status),
      evidence: row.evidence_json || {},
      analysis: row.analysis_json || {},
      sourceDataChecksum: normalizePortalText(row.source_data_checksum),
      generatedAt: row.generated_at || null,
      reviewedAt: row.reviewed_at || null,
      publishedAt: row.published_at || null,
    };
  });
}

async function loadPlayerFacts(config) {
  const playerIds = [...new Set(
    Object.values(config?.roster || {})
      .flat()
      .map(([name]) => getConfiguredPlayerId(config, name))
      .filter(Number.isInteger)
  )];
  if (!playerIds.length) return new Map();

  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, config.portal.nccaSeriesConfigKey, { ensureReportProfile: false });
    if (!context?.seriesId) return new Map();
    const result = await client.query(
      `
        select
          p.id as player_id,
          p.profile_url,
          pts.league_percentile_rank,
          pts.total_matches
        from public.player p
        left join public.player_series_threat_score pts
          on pts.player_id = p.id
          and pts.series_id = $1
          and pts.score_version = 'ncca-league-threat-v1'
        where p.id = any($2::bigint[])
      `,
      [context.seriesId, playerIds]
    );
    return new Map(result.rows.map((row) => [Number(row.player_id), row]));
  });
}

async function getGrizzliesPortalPayload() {
  const config = loadPortalConfig();
  const seriesConfigKey = config.portal.nccaSeriesConfigKey;
  const playerFacts = await loadPlayerFacts(config);
  const [teams, aiMatchAnalysis] = await Promise.all([
    Promise.resolve(Object.entries(config.roster || {}).map(([teamName, roster]) => ({
    name: teamName,
    players: roster.map(([name, rosterCategory]) => {
      const configured = config.approvedMappings?.[name];
      const playerId = getConfiguredPlayerId(config, name);
      const facts = playerId ? playerFacts.get(playerId) : null;
      const profileUrl =
        typeof configured === "object"
          ? configured.profileUrl || null
          : config?.profileOverrides?.[name] || facts?.profile_url || null;
      const query = playerId ? `?series=${encodeURIComponent(seriesConfigKey)}` : "";
      return {
        name,
        rosterCategory,
        nccaStatus: playerId || profileUrl ? "matched" : "not_found",
        cricclubsProfileUrl: profileUrl,
        assessmentPath: playerId ? `/analytics/reports/${playerId}${query}` : null,
        threatPath: playerId ? `/analytics/intelligence/${playerId}${query}` : null,
        threatTone: getThreatTone({
          leaguePercentileRank: facts?.league_percentile_rank,
          totalMatches: facts?.total_matches,
        }),
      };
    }),
    }))),
    loadGrizzliesWestFixtures(config),
  ]);

  return {
    title: "Grizzlies 2026 Analytics - Powered by GameChangrs",
    nccaSeriesConfigKey: seriesConfigKey,
    teams,
    aiMatchAnalysis,
    analysisStatus: "Match Analysis and AI Recommendations Coming Soon",
  };
}

module.exports = {
  getConfiguredPlayerId,
  getGrizzliesPortalPayload,
  getThreatTone,
  getGrizzliesMatchAnalysis,
  loadGrizzliesWestFixtures,
  isGrizzliesMatchAnalysisAvailable,
  mapGrizzliesWestFixtures,
};

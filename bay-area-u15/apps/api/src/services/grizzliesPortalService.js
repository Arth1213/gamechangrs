"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { withClient, resolveSeriesContext } = require("./seriesService");

const CONFIG_PATH = path.resolve(__dirname, "../../../../../config/grizzlies-2026-portal.yaml");
const { PLAYOFF_TEAM_NAMES, isMilcPlayoff, MILC_THREAT_VERSION, getMilcThreatTier } = require('../../../../shared/milcPlayoffThreat');
const DEFAULT_PORTAL_PHASE_TIMEOUT_MS = 12_000;

function getPortalPhaseTimeoutMs() {
  const configured = Number(process.env.GRIZZLIES_PORTAL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : DEFAULT_PORTAL_PHASE_TIMEOUT_MS;
}

function withPortalPhaseTimeout(phase, promise, timeoutMs = getPortalPhaseTimeoutMs()) {
  const startedAt = Date.now();
  let timer = null;
  const operation = Promise.resolve(promise);

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Grizzlies portal ${phase} timed out. Retry shortly.`);
      error.statusCode = 503;
      error.code = "grizzlies_portal_timeout";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([operation, timeout])
    .then((result) => {
      console.info(`[grizzlies-portal] ${phase} completed in ${Date.now() - startedAt}ms`);
      return result;
    })
    .catch((error) => {
      console.error(`[grizzlies-portal] ${phase} failed after ${Date.now() - startedAt}ms:`, error);
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

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

function formatOvers(legalBalls) {
  const balls = Number(legalBalls);
  if (!Number.isFinite(balls) || balls < 0) return null;
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function formatWicketMargin(value) {
  const wickets = Number(value);
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return Number.isInteger(wickets) && wickets >= 0 && wickets < words.length
    ? words[wickets]
    : normalizePortalText(value);
}

function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function findTeamPerformance(items, teamName) {
  const normalizedTeam = normalizePortalText(teamName).toLowerCase();
  return (Array.isArray(items) ? items : []).find(
    (item) => normalizePortalText(item?.teamName).toLowerCase() === normalizedTeam
  );
}

function buildGrizzliesMatchSummary(input) {
  const match = input?.match || {};
  const innings = Array.isArray(input?.evidence?.innings) ? input.evidence.innings : [];
  if (innings.length < 2) {
    return normalizePortalText(match.resultText) || "Verified match facts are available, but the innings summary is incomplete.";
  }

  const [firstInnings, secondInnings] = innings;
  const winner = normalizePortalText(match.resultText).match(/^(.+?) won by (\d+) wickets?$/i);
  const winnerName = winner?.[1] || normalizePortalText(secondInnings.battingTeam);
  const wickets = winner?.[2] || null;
  const chaseScore = `${secondInnings.runs}/${secondInnings.wickets}`;
  const chaseOvers = formatOvers(secondInnings.legalBalls);
  const firstScore = `${firstInnings.runs}/${firstInnings.wickets}`;
  const firstTeam = normalizePortalText(firstInnings.battingTeam) || "the first innings side";
  const secondRate = Number(secondInnings.runRate);
  const firstRate = Number(firstInnings.runRate);
  const firstBatter = findTeamPerformance(input?.scorecard?.topBatting, firstTeam);
  const secondTeam = normalizePortalText(secondInnings.battingTeam) || winnerName;
  const secondBatter = findTeamPerformance(input?.scorecard?.topBatting, secondTeam);
  const firstBowler = findTeamPerformance(input?.scorecard?.topBowling, firstTeam);
  const secondBowler = findTeamPerformance(input?.scorecard?.topBowling, secondTeam);
  const hasPerformanceContext = firstBatter || secondBatter || firstBowler || secondBowler;
  const rateSentence = Number.isFinite(secondRate) && Number.isFinite(firstRate)
    ? ` Their ${secondRate.toFixed(2)} run rate exceeded ${possessive(firstTeam)} ${firstRate.toFixed(2)}, deciding the match.`
    : "";

  if (wickets && chaseOvers) {
    const resultSentence = `${winnerName} completed a ${formatWicketMargin(wickets)}-wicket chase of ${chaseScore} in ${chaseOvers} overs after ${firstTeam} posted ${firstScore}.`;
    if (!hasPerformanceContext) return `${resultSentence}${rateSentence}`;

    const firstPerformance = firstBatter
      ? `${firstBatter.playerName} drove ${firstTeam} to that total with ${firstBatter.runs} off ${firstBatter.ballsFaced}`
      : `${firstTeam} set the target`;
    const firstBowlingClause = firstBowler
      ? `, while ${firstBowler.playerName} led their bowling with ${firstBowler.wickets}/${firstBowler.runsConceded}`
      : "";
    const secondPerformance = secondBatter
      ? `${secondBatter.playerName} then led ${possessive(secondTeam)} reply with ${secondBatter.runs} off ${secondBatter.ballsFaced}`
      : `${secondTeam} controlled the chase`;
    const secondBowlingClause = secondBowler
      ? `, backed by ${possessive(secondBowler.playerName)} ${secondBowler.wickets}/${secondBowler.runsConceded}`
      : "";
    const decidingSubject = secondBatter ? `${possessive(secondBatter.playerName)} innings` : `${possessive(secondTeam)} chase`;
    const decidingSentence = Number.isFinite(secondRate) && Number.isFinite(firstRate)
      ? `${decidingSubject} was decisive: it helped ${secondTeam} sustain ${secondRate.toFixed(2)} runs per over, above ${possessive(firstTeam)} ${firstRate.toFixed(2)}, and finish with ${formatWicketMargin(wickets)} wickets in hand.`
      : `${decidingSubject} was decisive, completing the chase with ${formatWicketMargin(wickets)} wickets in hand.`;
    return `${resultSentence} ${firstPerformance}${firstBowlingClause}. ${secondPerformance}${secondBowlingClause}. ${decidingSentence}`;
  }
  return `${normalizePortalText(match.resultText) || `${winnerName} won`}. ${firstTeam} posted ${firstScore} and the reply reached ${chaseScore}.${rateSentence}`;
}

function isWestDivision(value) {
  return /\bwest\b/i.test(normalizePortalText(value));
}

function reportStatusOf(row) {
  return normalizePortalText(row?.status || row?.report_status || row?.reportStatus).toLowerCase();
}

function reportTime(row) {
  const value = row?.published_at || row?.publishedAt || row?.reviewed_at || row?.reviewedAt || row?.generated_at || row?.generatedAt;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function selectVisibleGrizzliesReportRow(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => reportStatusOf(row) === "published" || reportStatusOf(row) === "reviewed")
    .slice()
    .sort((left, right) => {
      const statusDelta = (reportStatusOf(right) === "published" ? 2 : 1) - (reportStatusOf(left) === "published" ? 2 : 1);
      return statusDelta || reportTime(right) - reportTime(left) || Number(right?.id || 0) - Number(left?.id || 0);
    })[0] || null;
}

function resolveGrizzliesMatchSummary(reportRow, fallbackInput) {
  const modelVersion = normalizePortalText(reportRow?.analysis_model_version || reportRow?.analysisModelVersion);
  const storedSummary = normalizePortalText(reportRow?.analysis_json?.matchSummary || reportRow?.analysis?.matchSummary);
  return /^t20-context-v[234]$/.test(modelVersion) && storedSummary
    ? storedSummary
    : buildGrizzliesMatchSummary(fallbackInput);
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
  const westRows = (Array.isArray(rows) ? rows : []).filter((row) => isWestDivision(row?.division_label || row?.divisionLabel));
  const rowsByMatch = new Map();
  for (const row of westRows) {
    const matchId = Number(row.id ?? row.matchId);
    if (!rowsByMatch.has(matchId)) rowsByMatch.set(matchId, []);
    rowsByMatch.get(matchId).push(row);
  }
  return [...rowsByMatch.values()]
    .map((matchRows) => selectVisibleGrizzliesReportRow(matchRows) || matchRows[0])
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
        report: {
          status: reportStatus,
          path: null,
          analysisModelVersion: normalizePortalText(row.analysis_model_version || row.analysisModelVersion) || null,
        },
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
          (select count(*)::int from public.ball_event be where be.match_id = m.id) as ball_event_count,
          report.status as report_status,
          report.analysis_model_version
        from public.match m
        join public.team t1 on t1.id = m.team1_id
        join public.team t2 on t2.id = m.team2_id
        join public.division d on d.id = m.division_id
        left join public.match_refresh_state mrs on mrs.match_id = m.id
        left join lateral (
          select candidate.status, candidate.analysis_model_version
          from public.grizzlies_match_analysis_report candidate
          where candidate.match_id = m.id
            and candidate.series_id = m.series_id
            and candidate.report_type = 'grizzlies_match_analysis'
            and candidate.status in ('reviewed', 'published')
          order by
            case candidate.status when 'published' then 2 else 1 end desc,
            candidate.published_at desc nulls last,
            candidate.reviewed_at desc nulls last,
            candidate.generated_at desc nulls last,
            candidate.id desc
          limit 1
        ) report on true
        where m.series_id = $1
          and lower(coalesce(d.source_label, '')) = lower($2)
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

  return withPortalPhaseTimeout("match analysis", withClient(async (client) => {
    const context = await resolveSeriesContext(client, seriesConfigKey, { ensureReportProfile: false });
    if (!context?.seriesId) {
      const error = new Error("Grizzlies match analysis was not found.");
      error.statusCode = 404;
      throw error;
    }
    const [result, scorecardResult] = await Promise.all([
      client.query(
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
          report.analysis_model_version,
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
        join lateral (
          select candidate.*
          from public.grizzlies_match_analysis_report candidate
          where candidate.match_id = m.id
            and candidate.series_id = m.series_id
            and candidate.report_type = 'grizzlies_match_analysis'
            and candidate.status in ('reviewed', 'published')
          order by
            case candidate.status when 'published' then 2 else 1 end desc,
            candidate.published_at desc nulls last,
            candidate.reviewed_at desc nulls last,
            candidate.generated_at desc nulls last,
            candidate.id desc
          limit 1
        ) report on true
        where m.id = $1
          and m.series_id = $2
          and lower(coalesce(d.source_label, '')) = lower($3)
          and m.status = 'completed'
          and mrs.parse_status = 'parsed'
          and mrs.analytics_status = 'computed'
          and exists (select 1 from public.ball_event be where be.match_id = m.id)
        limit 1
      `,
      [numericMatchId, context.seriesId, normalizePortalText(config?.portal?.milcWestDivisionLabel) || "West"]
      ),
      client.query(
        `
          with top_batting as (
            select
              'batting' as performance_type,
              p.display_name as player_name,
              t.display_name as team_name,
              bi.runs,
              bi.balls_faced,
              bi.strike_rate,
              bi.fours,
              bi.sixes,
              null::integer as wickets,
              null::integer as runs_conceded,
              null::numeric as economy,
              row_number() over (partition by bi.team_id order by bi.runs desc, bi.strike_rate desc nulls last, bi.balls_faced asc nulls last, bi.id asc) as rank
            from public.batting_innings bi
            join public.player p on p.id = bi.player_id
            join public.team t on t.id = bi.team_id
            where bi.match_id = $1
              and coalesce(bi.did_not_bat, false) = false
          ), top_bowling as (
            select
              'bowling' as performance_type,
              p.display_name as player_name,
              t.display_name as team_name,
              null::integer as runs,
              null::integer as balls_faced,
              null::numeric as strike_rate,
              null::integer as fours,
              null::integer as sixes,
              bs.wickets,
              bs.runs_conceded,
              bs.economy,
              row_number() over (partition by bs.team_id order by bs.wickets desc, bs.runs_conceded asc, bs.economy asc nulls last, bs.id asc) as rank
            from public.bowling_spell bs
            join public.player p on p.id = bs.player_id
            join public.team t on t.id = bs.team_id
            where bs.match_id = $1
          )
          select * from top_batting where rank = 1
          union all
          select * from top_bowling where rank = 1
          order by performance_type, team_name
        `,
        [numericMatchId]
      ),
    ]);
    const row = result.rows[0];
    if (!row) {
      const error = new Error("Grizzlies match analysis was not found.");
      error.statusCode = 404;
      throw error;
    }
    const response = {
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
      analysisModelVersion: normalizePortalText(row.analysis_model_version) || "legacy-v1",
      evidence: row.evidence_json || {},
      analysis: row.analysis_json || {},
      scorecard: {
        topBatting: scorecardResult.rows
          .filter((item) => item.performance_type === "batting")
          .map((item) => ({
            playerName: normalizePortalText(item.player_name),
            teamName: normalizePortalText(item.team_name),
            runs: Number(item.runs) || 0,
            ballsFaced: Number(item.balls_faced) || 0,
            strikeRate: Number(item.strike_rate) || 0,
            fours: Number(item.fours) || 0,
            sixes: Number(item.sixes) || 0,
          })),
        topBowling: scorecardResult.rows
          .filter((item) => item.performance_type === "bowling")
          .map((item) => ({
            playerName: normalizePortalText(item.player_name),
            teamName: normalizePortalText(item.team_name),
            wickets: Number(item.wickets) || 0,
            runsConceded: Number(item.runs_conceded) || 0,
            economy: Number(item.economy) || 0,
          })),
      },
      sourceDataChecksum: normalizePortalText(row.source_data_checksum),
      generatedAt: row.generated_at || null,
      reviewedAt: row.reviewed_at || null,
      publishedAt: row.published_at || null,
    };
    response.matchSummary = resolveGrizzliesMatchSummary(row, response);
    return response;
  }));
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

function mapGrizzliesPlayoffTeams(rows, seriesConfigKey) {
  return PLAYOFF_TEAM_NAMES.map((name) => {
    const teamRows = rows.filter((row) => row.team_name === name);
    const byName = new Map();
    for (const row of teamRows) {
      const key = normalizePortalText(row.player_name).toLowerCase();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, new Map());
      byName.get(key).set(String(row.player_id), row);
    }
    const players = [...byName.values()].map((accounts) => {
      const row = accounts.values().next().value;
      const playerId = Number(row.player_id);
      // Same-name accounts are NOT evidence of a shared identity. Hold links
      // until their source identities are reconciled; never merge statistics.
      const identityReview = accounts.size > 1 || !Number.isSafeInteger(playerId) || playerId <= 0
        || !row.source_player_id || String(row.source_player_id).startsWith("synthetic:");
      const assessmentReady = !identityReview && Boolean(seriesConfigKey && row.has_aggregate && row.has_composite);
      const threatReady = assessmentReady && Boolean(row.has_intelligence);
      const matches = Number(row.matches_played) || 0;
      const dataStatus = identityReview ? "identity_review" : !assessmentReady ? "not_found"
        : !threatReady || matches < 3 ? "limited" : "ready";
      const dataNote = identityReview
        ? accounts.size > 1 ? `${accounts.size} source accounts. Identity review required.` : "Source identity needs verification."
        : !assessmentReady ? "No batting or bowling analytics available."
        : !threatReady ? "Threat intelligence unavailable; assessment available."
        : matches < 3 ? `Limited sample: ${matches} ${matches === 1 ? "match" : "matches"}.` : null;
      let profileUrl = null;
      if (!identityReview && row.profile_url) {
        try {
          const url = new URL(row.profile_url, "https://cricclubs.com");
          if (url.protocol === "https:" && ["cricclubs.com", "www.cricclubs.com", "prod-lm.cricclubs.com"].includes(url.hostname)) profileUrl = url.href;
        } catch (_) { /* Invalid source URLs are not linked. */ }
      }
      const query = `?series=${encodeURIComponent(seriesConfigKey || "")}&from=grizzlies-2026`;
      return {
        playerId: identityReview ? null : playerId,
        name: normalizePortalText(row.player_name),
        rosterCategory: "MiLC 2026",
        dataSource: "MiLC 2026",
        dataStatus,
        dataNote,
        matchesPlayed: identityReview ? null : matches,
        cricclubsProfileUrl: profileUrl,
        assessmentPath: assessmentReady ? `/analytics/reports/${playerId}${query}` : null,
        threatPath: threatReady ? `/analytics/intelligence/${playerId}${query}` : null,
        // Never substitute NCCA tiers or infer a rating from missing evidence.
        threatTone: threatReady && isMilcPlayoff(seriesConfigKey, name) && row.threat_score_version === MILC_THREAT_VERSION
          ? getMilcThreatTier({ leaguePercentileRank: row.league_percentile_rank, totalMatches: row.total_matches }) : 'unknown',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const dates = teamRows.map((row) => row.latest_match).filter(Boolean).map((date) => new Date(date))
      .filter((date) => Number.isFinite(date.getTime())).map((date) => date.toISOString().slice(0, 10)).sort();
    return { name, section: "playoffs", dataStatus: players.length ? "available" : "unavailable",
      latestMatchDate: dates.at(-1) || null, players };
  });
}

async function loadGrizzliesPlayoffTeams(config) {
  const seriesConfigKey = config.portal.milcSeriesConfigKey;
  return withClient(async (client) => {
    await client.query("BEGIN READ ONLY");
    try {
      await client.query("SET LOCAL statement_timeout = '8s'");
      const result = await client.query(`
        with scoped_matches as (
          select m.id, m.match_date, m.series_id
          from public.match m
          join public.series_source_config c on c.series_id = m.series_id
          join public.series s on s.id = m.series_id
          where c.config_key = $1 and s.year = 2026
        ), appearances as (
          select b.team_id, b.player_id, m.series_id, m.match_date
          from public.batting_innings b join scoped_matches m on m.id = b.match_id
          union
          select b.team_id, b.player_id, m.series_id, m.match_date
          from public.bowling_spell b join scoped_matches m on m.id = b.match_id
        ), players as (
          select a.team_id, a.player_id, a.series_id, max(a.match_date) latest_match
          from appearances a join public.team t on t.id = a.team_id
          where t.display_name = any($2::text[])
          group by a.team_id, a.player_id, a.series_id
        )
        select t.display_name team_name, p.id player_id, p.display_name player_name,
          p.source_player_id, p.profile_url, a.latest_match,
          pts.league_percentile_rank, pts.total_matches, pts.score_version threat_score_version,
          exists(select 1 from public.player_season_advanced s where s.series_id=a.series_id and s.player_id=p.id) has_aggregate,
          exists(select 1 from public.player_composite_score s where s.series_id=a.series_id and s.player_id=p.id) has_composite,
          exists(select 1 from public.player_intelligence_profile i where i.series_id=a.series_id and i.player_id=p.id and i.scope_type='series') has_intelligence,
          (select max(s.matches_played) from public.player_season_advanced s where s.series_id=a.series_id and s.player_id=p.id) matches_played
        from players a join public.team t on t.id=a.team_id join public.player p on p.id=a.player_id
        left join public.player_series_threat_score pts on pts.series_id=a.series_id and pts.player_id=p.id and pts.score_version=$3
        order by t.display_name, p.display_name, p.id
      `, [seriesConfigKey, PLAYOFF_TEAM_NAMES, MILC_THREAT_VERSION]);
      await client.query("COMMIT");
      return mapGrizzliesPlayoffTeams(result.rows, seriesConfigKey);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

async function getGrizzliesPortalPayload() {
  const config = loadPortalConfig();
  const seriesConfigKey = config.portal.nccaSeriesConfigKey;
  const [playerFacts, aiMatchAnalysis, playoffTeams] = await Promise.all([
    withPortalPhaseTimeout("roster facts", loadPlayerFacts(config)),
    withPortalPhaseTimeout("West Division fixtures", loadGrizzliesWestFixtures(config)),
    withPortalPhaseTimeout("playoff rosters", loadGrizzliesPlayoffTeams(config))
      .catch(() => mapGrizzliesPlayoffTeams([], config.portal.milcSeriesConfigKey)),
  ]);
  const teams = Object.entries(config.roster || {}).map(([teamName, roster]) => ({
    name: teamName,
    section: teamName === "San Ramon Grizzlies" ? "grizzlies" : "division",
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
    }));

  return {
    title: "Grizzlies 2026 Analytics - Powered by GameChangrs",
    nccaSeriesConfigKey: seriesConfigKey,
    teams: [...playoffTeams, ...teams],
    aiMatchAnalysis,
    analysisStatus: "Match Analysis and AI Recommendations Coming Soon",
  };
}

module.exports = {
  mapGrizzliesPlayoffTeams,
  loadGrizzliesPlayoffTeams,
  getConfiguredPlayerId,
  buildGrizzliesMatchSummary,
  getGrizzliesPortalPayload,
  getThreatTone,
  getGrizzliesMatchAnalysis,
  loadGrizzliesWestFixtures,
  isGrizzliesMatchAnalysisAvailable,
  mapGrizzliesWestFixtures,
  resolveGrizzliesMatchSummary,
  selectVisibleGrizzliesReportRow,
  withPortalPhaseTimeout,
};

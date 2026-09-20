"use strict";

const {
  ANALYSIS_MODEL_VERSION,
  buildGrizzliesMatchAnalysis,
  buildGrizzliesMatchEvidence,
} = require("../analytics/grizzliesMatchEvidence");
const { normalizePersistedBallEvents } = require("../analytics/t20MatchIntelligence");
const { withClient, withTransaction } = require("../lib/db");

const REPORT_TYPE = "grizzlies_match_analysis";

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  }
  return [];
}

function toMatchIdList(matchIds) {
  return (Array.isArray(matchIds) ? matchIds : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function loadMatchEvidenceRows(client, { seriesConfigKey, matchIds }) {
  const ids = toMatchIdList(matchIds);
  const result = await client.query(
    `
      /* grizzlies-match-analysis:load */
      select
        s.id as series_id,
        m.id as match_id,
        m.source_match_id,
        m.status as match_status,
        m.result_text,
        d.source_label as division_label,
        mrs.parse_status,
        mrs.analytics_status,
        home_team.display_name as home_team,
        away_team.display_name as away_team,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'innings', i.innings_no,
            'battingTeam', batting_team.display_name,
            'runs', i.total_runs,
            'wickets', i.wickets,
            'legalBalls', i.legal_balls,
            'targetRuns', i.target_runs
          ) order by i.innings_no)
          from public.innings i
          join public.team batting_team on batting_team.id = i.batting_team_id
          where i.match_id = m.id
        ), '[]'::jsonb) as innings_json,
        coalesce((
          select jsonb_agg(to_jsonb(batting_row) order by batting_row.innings_no, batting_row.batting_position, batting_row.id)
          from (
            select bi.*, batting_innings_row.innings_no, batting_player.display_name as player_name
            from public.batting_innings bi
            join public.innings batting_innings_row on batting_innings_row.id = bi.innings_id
            join public.player batting_player on batting_player.id = bi.player_id
            where bi.match_id = m.id
          ) batting_row
        ), '[]'::jsonb) as batting_json,
        coalesce((
          select jsonb_agg(to_jsonb(bowling_row) order by bowling_row.innings_no, bowling_row.id)
          from (
            select bs.*, bowling_innings_row.innings_no, bowling_player.display_name as player_name
            from public.bowling_spell bs
            join public.innings bowling_innings_row on bowling_innings_row.id = bs.innings_id
            join public.player bowling_player on bowling_player.id = bs.player_id
            where bs.match_id = m.id
          ) bowling_row
        ), '[]'::jsonb) as bowling_json,
        coalesce((
          select jsonb_agg(jsonb_build_object('id', player_rows.id, 'displayName', player_rows.display_name))
          from (
            select distinct p.id, p.display_name
            from public.player p
            join public.ball_event player_event
              on p.id in (
                player_event.striker_player_id,
                player_event.non_striker_player_id,
                player_event.bowler_player_id,
                player_event.player_out_id
              )
            where player_event.match_id = m.id
          ) player_rows
        ), '[]'::jsonb) as players_json,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'innings', be.innings_no,
            'eventIndex', be.event_index,
            'over', be.over_no,
            'ballInOver', be.ball_in_over,
            'phase', be.phase,
            'strikerPlayerId', be.striker_player_id,
            'nonStrikerPlayerId', be.non_striker_player_id,
            'bowlerPlayerId', be.bowler_player_id,
            'playerOutId', be.player_out_id,
            'batterRuns', be.batter_runs,
            'runs', be.total_runs,
            'legal', be.is_legal_ball,
            'wicket', be.wicket_flag,
            'boundary', be.batter_runs in (4, 6),
            'scoreAfterRuns', be.score_after_runs,
            'wicketsAfter', be.wickets_after,
            'commentaryText', be.commentary_text
          ) order by be.innings_no, be.event_index, be.id)
          from public.ball_event be
          where be.match_id = m.id
        ), '[]'::jsonb) as ball_events_json,
        existing_v2.source_data_checksum as existing_v2_checksum,
        existing_v2.status as existing_v2_status
      from public.series_source_config config
      join public.series s on s.id = config.series_id
      join public.match m on m.series_id = s.id
      join public.division d on d.id = m.division_id
      join public.team home_team on home_team.id = m.team1_id
      join public.team away_team on away_team.id = m.team2_id
      left join public.match_refresh_state mrs on mrs.match_id = m.id
      left join lateral (
        select report.source_data_checksum, report.status
        from public.grizzlies_match_analysis_report report
        where report.series_id = s.id
          and report.match_id = m.id
          and report.report_type = $3
          and report.analysis_model_version = $4
        limit 1
      ) existing_v2 on true
      where config.config_key = $1
        and (cardinality($2::bigint[]) = 0 or m.id = any($2::bigint[]))
      order by m.match_date asc nulls last, m.id asc
    `,
    [seriesConfigKey, ids, REPORT_TYPE, ANALYSIS_MODEL_VERSION],
  );
  return result.rows;
}

function eligibilityReason(row, divisionLabel) {
  if (String(row.match_status || "").toLowerCase() !== "completed") return "match_not_completed";
  if (String(row.division_label || "").trim().toLowerCase() !== String(divisionLabel || "West").trim().toLowerCase()) {
    return "division_mismatch";
  }
  if (String(row.parse_status || "").toLowerCase() !== "parsed") return "match_not_parsed";
  if (String(row.analytics_status || "").toLowerCase() !== "computed") return "analytics_not_computed";
  if (!asArray(row.ball_events_json).length) return "ball_events_missing";
  return null;
}

function buildCandidate(row) {
  const innings = asArray(row.innings_json);
  const batting = asArray(row.batting_json);
  const ballEvents = normalizePersistedBallEvents(asArray(row.ball_events_json), batting);
  const bowling = asArray(row.bowling_json);
  const players = asArray(row.players_json);
  const playersById = new Map(players.map((player) => [Number(player.id), String(player.displayName || player.display_name || "")]));
  for (const batter of batting) {
    const id = Number(batter.player_id ?? batter.playerId);
    const name = String(batter.player_name ?? batter.playerName ?? "");
    if (Number.isInteger(id) && id > 0 && name) playersById.set(id, name);
  }
  const match = {
    id: Number(row.match_id),
    sourceMatchId: row.source_match_id || null,
    resultText: row.result_text || null,
    teams: [row.home_team, row.away_team].filter(Boolean),
  };
  const evidence = buildGrizzliesMatchEvidence({ match, innings, batting, bowling, ballEvents, playersById });
  const analysis = buildGrizzliesMatchAnalysis({ evidence, batting, bowling });
  return {
    seriesId: Number(row.series_id),
    matchId: Number(row.match_id),
    sourceMatchId: row.source_match_id || null,
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    checksum: evidence.checksum,
    evidence,
    analysis,
  };
}

async function persistCandidate(client, candidate) {
  const metadata = {
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    generator: "worker/grizzliesMatchAnalysis",
    generatedAt: new Date().toISOString(),
  };
  const result = await client.query(
    `
      /* grizzlies-match-analysis:upsert */
      insert into public.grizzlies_match_analysis_report (
        series_id,
        match_id,
        report_type,
        analysis_model_version,
        status,
        source_data_checksum,
        evidence_json,
        analysis_json,
        generation_metadata,
        generated_at
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, now())
      on conflict (series_id, match_id, report_type, analysis_model_version)
      do update set
        status = 'generated',
        source_data_checksum = excluded.source_data_checksum,
        evidence_json = excluded.evidence_json,
        analysis_json = excluded.analysis_json,
        generation_metadata = excluded.generation_metadata,
        failure_reason = null,
        generated_at = now(),
        reviewed_at = null,
        published_at = null,
        updated_at = now()
      returning id, status
    `,
    [
      candidate.seriesId,
      candidate.matchId,
      REPORT_TYPE,
      ANALYSIS_MODEL_VERSION,
      "generated",
      candidate.checksum,
      JSON.stringify(candidate.evidence),
      JSON.stringify(candidate.analysis),
      JSON.stringify(metadata),
    ],
  );
  return result.rows[0] || { status: "generated" };
}

async function generateWithClient(client, options) {
  const rows = await loadMatchEvidenceRows(client, options);
  const generated = [];
  const rejected = [];
  for (const row of rows) {
    const reason = eligibilityReason(row, options.divisionLabel);
    if (reason) {
      rejected.push({ matchId: Number(row.match_id), sourceMatchId: row.source_match_id || null, reason });
      continue;
    }
    const candidate = buildCandidate(row);
    if (options.dryRun === true) {
      generated.push({ ...candidate, status: "dry_run" });
      continue;
    }
    if (row.existing_v2_checksum === candidate.checksum) {
      generated.push({ ...candidate, status: "unchanged", persistedStatus: row.existing_v2_status || null });
      continue;
    }
    const persisted = await persistCandidate(client, candidate);
    generated.push({ ...candidate, id: Number(persisted.id) || null, status: persisted.status || "generated" });
  }
  return {
    seriesConfigKey: options.seriesConfigKey,
    divisionLabel: options.divisionLabel,
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    dryRun: options.dryRun === true,
    generated,
    rejected,
  };
}

async function generateGrizzliesMatchAnalysis(options = {}) {
  if (!String(options.seriesConfigKey || "").trim()) throw new Error("seriesConfigKey is required.");
  const normalized = {
    seriesConfigKey: String(options.seriesConfigKey).trim(),
    divisionLabel: String(options.divisionLabel || "West").trim(),
    matchIds: toMatchIdList(options.matchIds),
    dryRun: options.dryRun === true,
  };
  if (options.client) return generateWithClient(options.client, normalized);
  return withClient((client) => generateWithClient(client, normalized));
}

async function transitionWithClient(client, options) {
  await client.query("BEGIN");
  try {
    const locked = await client.query(
      `
        /* grizzlies-match-analysis:lock */
        select id, series_id, match_id, report_type, status
        from public.grizzlies_match_analysis_report
        where match_id = $1 and analysis_model_version = $2 and report_type = $3
        for update
      `,
      [options.matchId, options.analysisModelVersion, REPORT_TYPE],
    );
    const target = locked.rows[0];
    if (!target) throw new Error("The requested Grizzlies match report was not found.");
    let result;
    if (options.action === "review") {
      if (target.status !== "generated") throw new Error(`Cannot review report from status ${target.status}.`);
      result = await client.query(
        `
          /* grizzlies-match-analysis:review */
          update public.grizzlies_match_analysis_report
          set status = 'reviewed',
              reviewed_at = now(),
              generation_metadata = generation_metadata || jsonb_build_object('reviewedBy', $2::text),
              updated_at = now()
          where id = $1
          returning id, status
        `,
        [target.id, options.reviewerUserId],
      );
    } else {
      if (target.status !== "reviewed") throw new Error(`Cannot publish report from status ${target.status}.`);
      await client.query(
        `
          /* grizzlies-match-analysis:supersede */
          update public.grizzlies_match_analysis_report
          set status = 'superseded', updated_at = now()
          where series_id = $1 and match_id = $2 and report_type = $3
            and analysis_model_version <> $4
            and status in ('reviewed', 'published')
        `,
        [target.series_id, target.match_id, target.report_type, options.analysisModelVersion],
      );
      result = await client.query(
        `
          /* grizzlies-match-analysis:publish */
          update public.grizzlies_match_analysis_report
          set status = 'published',
              published_at = now(),
              generation_metadata = generation_metadata || jsonb_build_object('publishedBy', $2::text),
              updated_at = now()
          where id = $1
          returning id, status
        `,
        [target.id, options.reviewerUserId],
      );
    }
    await client.query("COMMIT");
    return { id: Number(result.rows[0]?.id) || null, status: result.rows[0]?.status || null };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function reviewGrizzliesMatchAnalysis(options = {}) {
  if (!String(options.reviewerUserId || "").trim()) throw new Error("reviewerUserId is required.");
  const matchId = Number(options.matchId);
  if (!Number.isInteger(matchId) || matchId <= 0) throw new Error("A valid matchId is required.");
  const action = String(options.action || "").toLowerCase();
  if (!new Set(["review", "publish"]).has(action)) throw new Error("action must be review or publish.");
  const normalized = {
    matchId,
    analysisModelVersion: String(options.analysisModelVersion || ANALYSIS_MODEL_VERSION),
    action,
    reviewerUserId: String(options.reviewerUserId).trim(),
  };
  if (options.client) return transitionWithClient(options.client, normalized);
  return withTransaction(async (client) => {
    const locked = await client.query(
      `
        /* grizzlies-match-analysis:lock */
        select id, series_id, match_id, report_type, status
        from public.grizzlies_match_analysis_report
        where match_id = $1 and analysis_model_version = $2 and report_type = $3
        for update
      `,
      [normalized.matchId, normalized.analysisModelVersion, REPORT_TYPE],
    );
    const target = locked.rows[0];
    if (!target) throw new Error("The requested Grizzlies match report was not found.");
    if (action === "review") {
      if (target.status !== "generated") throw new Error(`Cannot review report from status ${target.status}.`);
      const result = await client.query(
        `/* grizzlies-match-analysis:review */ update public.grizzlies_match_analysis_report set status = 'reviewed', reviewed_at = now(), generation_metadata = generation_metadata || jsonb_build_object('reviewedBy', $2::text), updated_at = now() where id = $1 returning id, status`,
        [target.id, normalized.reviewerUserId],
      );
      return { id: Number(result.rows[0]?.id) || null, status: result.rows[0]?.status || null };
    }
    if (target.status !== "reviewed") throw new Error(`Cannot publish report from status ${target.status}.`);
    await client.query(
      `/* grizzlies-match-analysis:supersede */ update public.grizzlies_match_analysis_report set status = 'superseded', updated_at = now() where series_id = $1 and match_id = $2 and report_type = $3 and analysis_model_version <> $4 and status in ('reviewed', 'published')`,
      [target.series_id, target.match_id, target.report_type, normalized.analysisModelVersion],
    );
    const result = await client.query(
      `/* grizzlies-match-analysis:publish */ update public.grizzlies_match_analysis_report set status = 'published', published_at = now(), generation_metadata = generation_metadata || jsonb_build_object('publishedBy', $2::text), updated_at = now() where id = $1 returning id, status`,
      [target.id, normalized.reviewerUserId],
    );
    return { id: Number(result.rows[0]?.id) || null, status: result.rows[0]?.status || null };
  });
}

module.exports = {
  ANALYSIS_MODEL_VERSION,
  REPORT_TYPE,
  generateGrizzliesMatchAnalysis,
  reviewGrizzliesMatchAnalysis,
};

const { withTransaction } = require("../lib/db");

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return normalizeText(value).toLowerCase();
}

function toInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseClubIdFromUrl(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  try {
    return normalizeText(new URL(raw).searchParams.get("clubId"));
  } catch (_) {
    return "";
  }
}

function normalizeDateOnly(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildLeagueUrl(leagueId, clubId) {
  if (!normalizeText(leagueId)) {
    return "";
  }

  const safeClubId = normalizeText(clubId) || "40319";
  return `https://cricclubs.com/USACricketJunior/viewLeague.do?league=${leagueId}&clubId=${safeClubId}`;
}

function buildResultsUrl(leagueId, clubId) {
  if (!normalizeText(leagueId)) {
    return "";
  }

  const safeClubId = normalizeText(clubId) || "40319";
  return `https://cricclubs.com/USACricketJunior/viewLeagueResults.do?league=${leagueId}&clubId=${safeClubId}`;
}

function getSeriesConfigKey(options, fallback) {
  return normalizeText(options?.seriesConfigKey) || normalizeText(fallback);
}

async function fetchOne(client, query, params = []) {
  const result = await client.query(query, params);
  return result.rows[0] || null;
}

async function resolveSeriesWriteContext(client, seriesConfigKey) {
  const row = await fetchOne(
    client,
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.source_system,
        c.series_url,
        c.expected_league_name,
        c.target_age_group,
        s.id as series_id,
        s.league_name
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );

  if (!row) {
    throw new Error(`Unable to resolve worker series context for config key: ${seriesConfigKey}`);
  }

  return {
    seriesSourceConfigId: toInteger(row.series_source_config_id),
    configKey: normalizeText(row.config_key),
    sourceSystem: normalizeText(row.source_system) || "cricclubs",
    seriesId: toInteger(row.series_id),
    leagueName: normalizeText(row.expected_league_name) || normalizeText(row.league_name),
    targetAgeGroup: normalizeText(row.target_age_group),
    seriesUrl: normalizeText(row.series_url),
  };
}

async function loadTargetDivisionConfigRows(client, seriesSourceConfigId) {
  const result = await client.query(
    `
      select
        tdc.id,
        tdc.target_label,
        tdc.normalized_label,
        tdc.phase_no,
        tdc.division_no,
        tdc.strength_tier,
        d.id as division_id,
        d.source_division_id
      from public.series_target_division_config tdc
      left join public.division d on d.id = tdc.division_id
      where tdc.series_source_config_id = $1
      order by tdc.phase_no nulls last, tdc.division_no nulls last, tdc.id
    `,
    [seriesSourceConfigId]
  );

  return result.rows;
}

async function loadDivisionLookup(client, seriesId) {
  const result = await client.query(
    `
      select
        id,
        source_division_id,
        source_label,
        normalized_label
      from public.division
      where series_id = $1
    `,
    [seriesId]
  );

  const byLabel = new Map();
  const bySourceDivisionId = new Map();

  for (const row of result.rows) {
    const labelKey = normalizeLabel(row.normalized_label || row.source_label);
    if (labelKey) {
      byLabel.set(labelKey, row);
    }

    const sourceDivisionId = normalizeText(row.source_division_id);
    if (sourceDivisionId) {
      bySourceDivisionId.set(sourceDivisionId, row);
    }
  }

  return {
    byLabel,
    bySourceDivisionId,
  };
}

async function upsertDiscovery(discoveryResult, options = {}) {
  const seriesConfigKey = getSeriesConfigKey(options, discoveryResult?.series?.slug);

  return withTransaction(async (client) => {
    const context = await resolveSeriesWriteContext(client, seriesConfigKey);
    const targetConfigs = await loadTargetDivisionConfigRows(client, context.seriesSourceConfigId);
    const targetConfigByLabel = new Map(
      targetConfigs.map((row) => [normalizeLabel(row.normalized_label || row.target_label), row])
    );
    const discoveredDivisions = Array.isArray(discoveryResult?.divisions) ? discoveryResult.divisions : [];
    const clubId =
      parseClubIdFromUrl(discoveryResult?.routes?.resultsUrl) ||
      parseClubIdFromUrl(discoveryResult?.series?.url) ||
      parseClubIdFromUrl(context.seriesUrl) ||
      "40319";

    const divisions = [];

    for (const discoveredDivision of discoveredDivisions) {
      const normalizedLabel = normalizeLabel(discoveredDivision.label);
      if (!normalizedLabel) {
        continue;
      }

      const config = targetConfigByLabel.get(normalizedLabel) || null;
      const sourceDivisionId =
        normalizeText(discoveredDivision.leagueId) ||
        normalizeText(config?.source_division_id);

      const divisionRow = await fetchOne(
        client,
        `
          insert into public.division (
            series_id,
            source_division_id,
            source_label,
            normalized_label,
            age_group,
            phase_no,
            division_no,
            strength_tier,
            stats_url,
            results_url,
            is_target
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          on conflict (series_id, normalized_label)
          do update set
            source_division_id = coalesce(excluded.source_division_id, division.source_division_id),
            source_label = excluded.source_label,
            age_group = coalesce(excluded.age_group, division.age_group),
            phase_no = coalesce(excluded.phase_no, division.phase_no),
            division_no = coalesce(excluded.division_no, division.division_no),
            strength_tier = coalesce(excluded.strength_tier, division.strength_tier),
            stats_url = coalesce(excluded.stats_url, division.stats_url),
            results_url = coalesce(excluded.results_url, division.results_url),
            is_target = excluded.is_target
          returning id, source_division_id, source_label
        `,
        [
          context.seriesId,
          sourceDivisionId || null,
          normalizeText(discoveredDivision.label),
          normalizedLabel,
          context.targetAgeGroup || null,
          toInteger(config?.phase_no),
          toInteger(config?.division_no),
          normalizeText(config?.strength_tier) || null,
          normalizeText(discoveredDivision.statsUrl) || buildLeagueUrl(sourceDivisionId, clubId) || null,
          normalizeText(discoveredDivision.resultsUrl) || buildResultsUrl(sourceDivisionId, clubId) || null,
          true,
        ]
      );

      if (config?.id && divisionRow?.id) {
        await client.query(
          `
            update public.series_target_division_config
            set division_id = $2
            where id = $1
              and (division_id is distinct from $2)
          `,
          [config.id, divisionRow.id]
        );
      }

      divisions.push({
        divisionId: toInteger(divisionRow?.id),
        sourceDivisionId: normalizeText(divisionRow?.source_division_id),
        sourceLabel: normalizeText(divisionRow?.source_label),
      });
    }

    return {
      ok: true,
      message: `Discovery persisted for ${divisions.length} target divisions.`,
      seriesConfigKey: context.configKey,
      discoveredDivisionCount: divisions.length,
      divisions,
    };
  });
}

async function upsertTeam(client, input) {
  const displayName = normalizeText(input.displayName);
  if (!displayName) {
    throw new Error("Cannot upsert team without a display name.");
  }

  const row = await fetchOne(
    client,
    `
      insert into public.team (
        source_system,
        canonical_name,
        display_name
      )
      values ($1,$2,$3)
      on conflict (source_system, canonical_name)
      do update set
        display_name = excluded.display_name,
        last_seen_at = now()
      returning id, display_name
    `,
    [
      normalizeText(input.sourceSystem) || "cricclubs",
      displayName,
      displayName,
    ]
  );

  return {
    teamId: toInteger(row?.id),
    displayName: normalizeText(row?.display_name),
  };
}

async function ensureTeamDivisionEntry(client, input) {
  if (!toInteger(input.divisionId) || !toInteger(input.teamId)) {
    return;
  }

  await client.query(
    `
      insert into public.team_division_entry (
        series_id,
        division_id,
        team_id,
        division_label
      )
      values ($1,$2,$3,$4)
      on conflict (division_id, team_id) do nothing
    `,
    [input.seriesId, input.divisionId, input.teamId, normalizeText(input.divisionLabel) || null]
  );
}

async function loadExistingMatch(client, context, sourceMatchId) {
  return fetchOne(
    client,
    `
      select
        m.id,
        m.division_id,
        m.team1_id,
        m.team2_id,
        m.match_date,
        m.result_text,
        m.scorecard_url,
        m.ball_by_ball_url,
        m.match_page_url
      from public.match m
      where m.series_id = $1
        and m.source_system = $2
        and m.league_name = $3
        and m.source_match_id = $4
      limit 1
    `,
    [context.seriesId, context.sourceSystem, context.leagueName, sourceMatchId]
  );
}

function hasMaterialMatchChange(existingMatch, nextMatch) {
  if (!existingMatch) {
    return true;
  }

  return (
    toInteger(existingMatch.division_id) !== toInteger(nextMatch.divisionId) ||
    toInteger(existingMatch.team1_id) !== toInteger(nextMatch.team1Id) ||
    toInteger(existingMatch.team2_id) !== toInteger(nextMatch.team2Id) ||
    normalizeDateOnly(existingMatch.match_date) !== normalizeDateOnly(nextMatch.matchDate) ||
    normalizeText(existingMatch.result_text) !== normalizeText(nextMatch.resultText) ||
    normalizeText(existingMatch.scorecard_url) !== normalizeText(nextMatch.scorecardUrl) ||
    normalizeText(existingMatch.ball_by_ball_url) !== normalizeText(nextMatch.ballByBallUrl) ||
    normalizeText(existingMatch.match_page_url) !== normalizeText(nextMatch.matchPageUrl)
  );
}

async function updateMatchRefreshState(client, input) {
  const updated = await client.query(
    `
      update public.match_refresh_state
      set
        last_seen_at = now(),
        source_status = $2,
        needs_rescrape = $3,
        needs_reparse = $4,
        needs_recompute = $5,
        parse_status = $6,
        analytics_status = $7,
        last_change_reason = $8,
        last_error_message = null
      where match_id = $1
    `,
    [
      input.matchId,
      input.sourceStatus,
      input.needsRescrape,
      input.needsReparse,
      input.needsRecompute,
      input.parseStatus,
      input.analyticsStatus,
      input.lastChangeReason,
    ]
  );

  if (updated.rowCount > 0) {
    return;
  }

  await client.query(
    `
      insert into public.match_refresh_state (
        match_id,
        first_discovered_at,
        last_seen_at,
        source_status,
        needs_rescrape,
        needs_reparse,
        needs_recompute,
        admin_selection_override,
        parse_status,
        reconciliation_status,
        analytics_status,
        last_change_reason
      )
      values ($1, now(), now(), $2, $3, $4, $5, 'auto', $6, 'pending', $7, $8)
    `,
    [
      input.matchId,
      input.sourceStatus,
      input.needsRescrape,
      input.needsReparse,
      input.needsRecompute,
      input.parseStatus,
      input.analyticsStatus,
      input.lastChangeReason,
    ]
  );
}

async function touchMatchRefreshState(client, input) {
  const updated = await client.query(
    `
      update public.match_refresh_state
      set
        last_seen_at = now(),
        source_status = $2
      where match_id = $1
    `,
    [input.matchId, input.sourceStatus]
  );

  if (updated.rowCount > 0) {
    return;
  }

  await client.query(
    `
      insert into public.match_refresh_state (
        match_id,
        first_discovered_at,
        last_seen_at,
        source_status,
        needs_rescrape,
        needs_reparse,
        needs_recompute,
        admin_selection_override,
        parse_status,
        reconciliation_status,
        analytics_status,
        last_change_reason
      )
      values ($1, now(), now(), $2, false, false, false, 'auto', 'pending', 'pending', 'pending', $3)
    `,
    [
      input.matchId,
      input.sourceStatus,
      input.lastChangeReason || "series_operation_discover_inventory_seen",
    ]
  );
}

async function upsertMatchInventory(inventoryResult, options = {}) {
  const seriesConfigKey = getSeriesConfigKey(options, inventoryResult?.series);

  return withTransaction(async (client) => {
    const context = await resolveSeriesWriteContext(client, seriesConfigKey);
    const divisionLookup = await loadDivisionLookup(client, context.seriesId);
    const matches = Array.isArray(inventoryResult?.matches) ? inventoryResult.matches : [];

    let newMatchCount = 0;
    let updatedMatchCount = 0;
    let unchangedMatchCount = 0;

    for (const match of matches) {
      const sourceMatchId = normalizeText(match.source_match_id);
      if (!sourceMatchId) {
        continue;
      }

      const divisionRow =
        divisionLookup.bySourceDivisionId.get(normalizeText(match.division_league_id)) ||
        divisionLookup.byLabel.get(normalizeLabel(match.division_label)) ||
        null;

      const team1 = await upsertTeam(client, {
        sourceSystem: context.sourceSystem,
        displayName: match.team_1_name,
      });
      const team2 = await upsertTeam(client, {
        sourceSystem: context.sourceSystem,
        displayName: match.team_2_name,
      });

      await ensureTeamDivisionEntry(client, {
        seriesId: context.seriesId,
        divisionId: toInteger(divisionRow?.id),
        teamId: team1.teamId,
        divisionLabel: match.division_label,
      });
      await ensureTeamDivisionEntry(client, {
        seriesId: context.seriesId,
        divisionId: toInteger(divisionRow?.id),
        teamId: team2.teamId,
        divisionLabel: match.division_label,
      });

      const existingMatch = await loadExistingMatch(client, context, sourceMatchId);

      const persistedMatch = await fetchOne(
        client,
        `
          insert into public.match (
            source_system,
            league_name,
            source_match_id,
            series_id,
            division_id,
            match_type,
            status,
            match_date,
            result_text,
            team1_id,
            team2_id,
            scorecard_url,
            ball_by_ball_url,
            match_page_url
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          on conflict (source_system, league_name, source_match_id)
          do update set
            series_id = excluded.series_id,
            division_id = excluded.division_id,
            match_type = excluded.match_type,
            status = excluded.status,
            match_date = excluded.match_date,
            result_text = excluded.result_text,
            team1_id = excluded.team1_id,
            team2_id = excluded.team2_id,
            scorecard_url = excluded.scorecard_url,
            ball_by_ball_url = excluded.ball_by_ball_url,
            match_page_url = excluded.match_page_url
          returning id
        `,
        [
          context.sourceSystem,
          context.leagueName,
          sourceMatchId,
          context.seriesId,
          toInteger(divisionRow?.id),
          normalizeText(match.heading) || null,
          normalizeText(match.result_text) ? "completed" : "scheduled",
          normalizeText(match.match_date) || null,
          normalizeText(match.result_text) || null,
          team1.teamId,
          team2.teamId,
          normalizeText(match.scorecard_url) || null,
          normalizeText(match.ball_by_ball_url) || null,
          normalizeText(match.match_page_url) || null,
        ]
      );

      const changed = hasMaterialMatchChange(existingMatch, {
        divisionId: toInteger(divisionRow?.id),
        team1Id: team1.teamId,
        team2Id: team2.teamId,
        matchDate: match.match_date,
        resultText: match.result_text,
        scorecardUrl: match.scorecard_url,
        ballByBallUrl: match.ball_by_ball_url,
        matchPageUrl: match.match_page_url,
      });

      if (!existingMatch) {
        newMatchCount += 1;
        await updateMatchRefreshState(client, {
          matchId: toInteger(persistedMatch?.id),
          sourceStatus: "inventory_discovered",
          needsRescrape: true,
          needsReparse: true,
          needsRecompute: true,
          parseStatus: "pending",
          analyticsStatus: "pending",
          lastChangeReason: "series_operation_discover_new_matches",
        });
        continue;
      }

      if (changed) {
        updatedMatchCount += 1;
        await updateMatchRefreshState(client, {
          matchId: toInteger(persistedMatch?.id),
          sourceStatus: "inventory_updated",
          needsRescrape: true,
          needsReparse: true,
          needsRecompute: true,
          parseStatus: "pending",
          analyticsStatus: "pending",
          lastChangeReason: "series_operation_discover_match_update",
        });
        continue;
      }

      unchangedMatchCount += 1;
      await touchMatchRefreshState(client, {
        matchId: toInteger(persistedMatch?.id),
        sourceStatus: "inventory_seen",
        lastChangeReason: "series_operation_discover_inventory_seen",
      });
    }

    return {
      ok: true,
      message: `Match inventory persisted for ${matches.length} matches.`,
      seriesConfigKey: context.configKey,
      inventoriedMatchCount: matches.length,
      newMatchCount,
      updatedMatchCount,
      unchangedMatchCount,
    };
  });
}

async function upsertMatchFacts(matchFacts) {
  return {
    ok: true,
    message: "TODO: wire scorecard and commentary facts into schema tables.",
    matchFacts,
  };
}

module.exports = {
  upsertDiscovery,
  upsertMatchFacts,
  upsertMatchInventory,
};

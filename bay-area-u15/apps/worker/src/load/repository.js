const { withClient, withTransaction } = require("../lib/db");

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

function parseTextList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }

  return normalizeText(value)
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
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

function buildLeagueUrl(namespace, leagueId, clubId) {
  if (!normalizeText(leagueId)) {
    return "";
  }

  const safeClubId = normalizeText(clubId) || "40319";
  const safeNamespace = normalizeText(namespace) || "USACricketJunior";
  return `https://cricclubs.com/${safeNamespace}/viewLeague.do?league=${leagueId}&clubId=${safeClubId}`;
}

function buildResultsUrl(namespace, leagueId, clubId) {
  if (!normalizeText(leagueId)) {
    return "";
  }

  const safeClubId = normalizeText(clubId) || "40319";
  const safeNamespace = normalizeText(namespace) || "USACricketJunior";
  return `https://cricclubs.com/${safeNamespace}/viewLeagueResults.do?league=${leagueId}&clubId=${safeClubId}`;
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
          normalizeText(discoveredDivision.statsUrl) || buildLeagueUrl(context.leagueName, sourceDivisionId, clubId) || null,
          normalizeText(discoveredDivision.resultsUrl) || buildResultsUrl(context.leagueName, sourceDivisionId, clubId) || null,
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
        t1.display_name as team1_name,
        t2.display_name as team2_name,
        m.match_date,
        m.result_text,
        m.scorecard_url,
        m.ball_by_ball_url,
        m.match_page_url
      from public.match m
      join public.team t1 on t1.id = m.team1_id
      join public.team t2 on t2.id = m.team2_id
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

function buildTeamLookup(existingMatch, matchFacts) {
  const lookup = new Map();

  const register = (name, teamId) => {
    const key = normalizeLabel(name);
    if (key && toInteger(teamId)) {
      lookup.set(key, toInteger(teamId));
    }
  };

  register(existingMatch?.team1_name, existingMatch?.team1_id);
  register(existingMatch?.team2_name, existingMatch?.team2_id);
  register(matchFacts?.match?.team_1_name, existingMatch?.team1_id);
  register(matchFacts?.match?.team_2_name, existingMatch?.team2_id);

  return lookup;
}

async function upsertPlayerRow(client, context, player) {
  const displayName = normalizeText(player?.displayName || player?.canonicalName);
  const sourcePlayerId = normalizeText(player?.sourcePlayerId);
  if (!displayName) {
    return null;
  }

  if (sourcePlayerId) {
    return fetchOne(
      client,
      `
        insert into public.player (
          source_system,
          league_name,
          source_player_id,
          canonical_name,
          display_name,
          is_wicketkeeper,
          is_captain,
          profile_url
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (source_system, league_name, source_player_id)
        do update set
          canonical_name = excluded.canonical_name,
          display_name = excluded.display_name,
          is_wicketkeeper = coalesce(excluded.is_wicketkeeper, player.is_wicketkeeper),
          is_captain = coalesce(excluded.is_captain, player.is_captain),
          profile_url = coalesce(excluded.profile_url, player.profile_url),
          last_seen_at = now()
        returning id, source_player_id, display_name
      `,
      [
        context.sourceSystem,
        context.leagueName,
        sourcePlayerId,
        displayName,
        displayName,
        player?.isWicketkeeper === true ? true : null,
        player?.isCaptain === true ? true : null,
        normalizeText(player?.profileUrl) || null,
      ]
    );
  }

  const existing = await fetchOne(
    client,
    `
      select id, source_player_id, display_name
      from public.player
      where source_system = $1
        and league_name = $2
        and canonical_name = $3
      limit 1
    `,
    [context.sourceSystem, context.leagueName, displayName]
  );

  if (existing) {
    await client.query(
      `
        update public.player
        set
          display_name = $2,
          is_wicketkeeper = coalesce($3, is_wicketkeeper),
          is_captain = coalesce($4, is_captain),
          profile_url = coalesce($5, profile_url),
          last_seen_at = now()
        where id = $1
      `,
      [
        existing.id,
        displayName,
        player?.isWicketkeeper === true ? true : null,
        player?.isCaptain === true ? true : null,
        normalizeText(player?.profileUrl) || null,
      ]
    );

    return existing;
  }

  return fetchOne(
    client,
    `
      insert into public.player (
        source_system,
        league_name,
        canonical_name,
        display_name,
        is_wicketkeeper,
        is_captain,
        profile_url
      )
      values ($1,$2,$3,$4,$5,$6,$7)
      returning id, source_player_id, display_name
    `,
    [
      context.sourceSystem,
      context.leagueName,
      displayName,
      displayName,
      player?.isWicketkeeper === true ? true : null,
      player?.isCaptain === true ? true : null,
      normalizeText(player?.profileUrl) || null,
    ]
  );
}

async function upsertPlayerAliases(client, playerId, aliases = []) {
  const uniqueAliases = [...new Set(aliases.map((alias) => normalizeText(alias)).filter(Boolean))];
  const rows = uniqueAliases.map((alias, index) => [
    playerId,
    alias,
    "scorecard",
    "worker_match_fact_ingest",
    index === 0 ? 1 : 0.95,
    index === 0,
  ]);

  await batchInsertRows(
    client,
    "public.player_alias",
    ["player_id", "alias", "alias_type", "source_context", "confidence_score", "is_preferred"],
    rows,
    {
      suffix: `
        on conflict (player_id, alias, alias_type)
        do update set
          source_context = excluded.source_context,
          confidence_score = excluded.confidence_score,
          is_preferred = excluded.is_preferred
      `,
      batchSize: 100,
    }
  );
}

async function listSeriesPlayersForProfileEnrichment(seriesConfigKey, options = {}) {
  return withClient(async (client) => {
    const context = await resolveSeriesWriteContext(client, seriesConfigKey);
    const scopedPlayerIds = parseTextList(options.playerIds || []);
    const limit = toInteger(options.limit);

    const result = await client.query(
      `
        with series_players as (
          select distinct bi.player_id
          from public.match m
          join public.batting_innings bi on bi.match_id = m.id
          where m.series_id = $1
            and bi.player_id is not null
          union
          select distinct bs.player_id
          from public.match m
          join public.bowling_spell bs on bs.match_id = m.id
          where m.series_id = $1
            and bs.player_id is not null
          union
          select distinct fe.fielder_player_id as player_id
          from public.match m
          join public.fielding_event fe on fe.match_id = m.id
          where m.series_id = $1
            and fe.fielder_player_id is not null
          union
          select distinct fe.player_out_id as player_id
          from public.match m
          join public.fielding_event fe on fe.match_id = m.id
          where m.series_id = $1
            and fe.player_out_id is not null
        )
        select
          p.id,
          p.source_player_id,
          p.display_name,
          p.profile_url,
          p.is_wicketkeeper,
          p.profile_last_enriched_at
        from series_players sp
        join public.player p on p.id = sp.player_id
        where p.profile_url is not null
          and p.profile_url <> ''
          and (
            $2::text[] is null
            or p.id::text = any($2::text[])
            or coalesce(p.source_player_id, '') = any($2::text[])
          )
          and (
            $3::boolean = true
            or p.profile_last_enriched_at is null
            or p.primary_role is null
            or p.batting_style is null
            or p.bowling_style is null
            or p.primary_role_bucket is null
            or p.batting_style_bucket is null
            or p.bowling_style_bucket is null
          )
        order by p.id asc
        ${limit ? `limit ${limit}` : ""}
      `,
      [context.seriesId, scopedPlayerIds.length ? scopedPlayerIds : null, options.force === true]
    );

    return {
      seriesId: context.seriesId,
      configKey: context.configKey,
      players: result.rows.map((row) => ({
        playerId: toInteger(row.id),
        sourcePlayerId: normalizeText(row.source_player_id),
        displayName: normalizeText(row.display_name),
        profileUrl: normalizeText(row.profile_url),
        isWicketkeeper: row.is_wicketkeeper === true,
        profileLastEnrichedAt: row.profile_last_enriched_at || null,
      })),
    };
  });
}

async function persistPlayerProfileEnrichment(input = {}) {
  const playerId = toInteger(input.playerId || input.profile?.playerId);
  const profile = input.profile || {};
  if (!playerId) {
    throw new Error("persistPlayerProfileEnrichment requires a player id.");
  }

  return withClient(async (client) => {
    const result = await client.query(
      `
        update public.player
        set
          primary_role = coalesce($2, primary_role),
          batting_style = coalesce($3, batting_style),
          bowling_style = coalesce($4, bowling_style),
          primary_role_bucket = coalesce($5, primary_role_bucket),
          batting_hand = coalesce($6, batting_hand),
          batting_style_bucket = coalesce($7, batting_style_bucket),
          bowling_arm = coalesce($8, bowling_arm),
          bowling_style_bucket = coalesce($9, bowling_style_bucket),
          bowling_style_detail = coalesce($10, bowling_style_detail),
          profile_last_enriched_at = now(),
          last_seen_at = now()
        where id = $1
        returning id
      `,
      [
        playerId,
        normalizeText(profile.normalized?.primaryRole) || null,
        normalizeText(profile.normalized?.battingStyle) || null,
        normalizeText(profile.normalized?.bowlingStyle) || null,
        normalizeText(profile.normalized?.primaryRoleBucket) || null,
        normalizeText(profile.normalized?.battingHand) || null,
        normalizeText(profile.normalized?.battingStyleBucket) || null,
        normalizeText(profile.normalized?.bowlingArm) || null,
        normalizeText(profile.normalized?.bowlingStyleBucket) || null,
        normalizeText(profile.normalized?.bowlingStyleDetail) || null,
      ]
    );

    return result.rows[0] || null;
  });
}

function buildPlayerLookup(persistedPlayers, parsedPlayers) {
  const bySourcePlayerId = new Map();
  const byName = new Map();

  persistedPlayers.forEach((row) => {
    const sourcePlayerId = normalizeText(row.sourcePlayerId);
    const displayName = normalizeText(row.displayName);

    if (sourcePlayerId) {
      bySourcePlayerId.set(sourcePlayerId, row.playerId);
    }

    if (displayName) {
      byName.set(normalizeLabel(displayName), row.playerId);
    }
  });

  parsedPlayers.forEach((player) => {
    const playerId =
      bySourcePlayerId.get(normalizeText(player.sourcePlayerId)) ||
      byName.get(normalizeLabel(player.displayName));
    if (!playerId) {
      return;
    }

    for (const alias of player.aliases || []) {
      byName.set(normalizeLabel(alias), playerId);
    }
  });

  return {
    bySourcePlayerId,
    byName,
  };
}

function resolvePlayerId(playerLookup, sourcePlayerId, displayName) {
  return (
    playerLookup.bySourcePlayerId.get(normalizeText(sourcePlayerId)) ||
    playerLookup.byName.get(normalizeLabel(displayName)) ||
    null
  );
}

function chunkRows(rows, size) {
  const out = [];
  for (let index = 0; index < rows.length; index += size) {
    out.push(rows.slice(index, index + size));
  }
  return out;
}

async function batchInsertRows(client, tableName, columns, rows, options = {}) {
  if (!Array.isArray(rows) || !rows.length) {
    return 0;
  }

  const batchSize = toInteger(options.batchSize) || 200;
  const suffix = options.suffix ? ` ${String(options.suffix).trim()}` : "";

  for (const chunk of chunkRows(rows, batchSize)) {
    const values = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== columns.length) {
          throw new Error(`Invalid batch insert row for ${tableName}.`);
        }

        const rowPlaceholders = row.map((value, columnIndex) => {
          values.push(value);
          return `$${rowIndex * columns.length + columnIndex + 1}`;
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
        ${placeholders}${suffix}
      `,
      values
    );
  }

  return rows.length;
}

async function clearMatchFactTables(client, matchId) {
  await client.query("delete from public.player_matchup where match_id = $1", [matchId]);
  await client.query("delete from public.player_match_advanced where match_id = $1", [matchId]);
  await client.query("delete from public.over_summary where match_id = $1", [matchId]);
  await client.query("delete from public.ball_event where match_id = $1", [matchId]);
  await client.query("delete from public.fielding_event where match_id = $1", [matchId]);
  await client.query("delete from public.bowling_spell where match_id = $1", [matchId]);
  await client.query("delete from public.batting_innings where match_id = $1", [matchId]);
  await client.query("delete from public.innings where match_id = $1", [matchId]);
}

async function insertInningsRows(client, matchId, inningsRows, teamLookup) {
  const inningsIdByNo = new Map();

  for (const innings of inningsRows) {
    const battingTeamId = teamLookup.get(normalizeLabel(innings.battingTeamName));
    const bowlingTeamId = teamLookup.get(normalizeLabel(innings.bowlingTeamName));
    if (!battingTeamId || !bowlingTeamId) {
      throw new Error(
        `Unable to resolve team ids for innings ${innings.inningsNo}: ${innings.battingTeamName} vs ${innings.bowlingTeamName}`
      );
    }

    const row = await fetchOne(
      client,
      `
        insert into public.innings (
          match_id,
          innings_no,
          batting_team_id,
          bowling_team_id,
          total_runs,
          wickets,
          overs_decimal,
          legal_balls,
          extras_total,
          byes,
          leg_byes,
          wides,
          no_balls,
          penalty_runs,
          target_runs
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        returning id
      `,
      [
        matchId,
        innings.inningsNo,
        battingTeamId,
        bowlingTeamId,
        toInteger(innings.totalRuns),
        toInteger(innings.wickets),
        innings.oversDecimal,
        toInteger(innings.legalBalls),
        toInteger(innings.extrasTotal),
        toInteger(innings.byes),
        toInteger(innings.legByes),
        toInteger(innings.wides),
        toInteger(innings.noBalls),
        toInteger(innings.penaltyRuns),
        toInteger(innings.targetRuns),
      ]
    );

    inningsIdByNo.set(innings.inningsNo, {
      inningsId: toInteger(row?.id),
      battingTeamId,
      bowlingTeamId,
    });
  }

  return inningsIdByNo;
}

async function insertBattingRows(client, matchId, battingRows, inningsIdByNo, teamLookup, playerLookup) {
  const rows = [];

  for (const batting of battingRows) {
    const inningsEntry = inningsIdByNo.get(batting.inningsNo);
    if (!inningsEntry) {
      continue;
    }

    const playerId = resolvePlayerId(playerLookup, batting.playerSourceId, batting.playerName);
    if (!playerId) {
      continue;
    }

    rows.push([
      inningsEntry.inningsId,
      matchId,
      playerId,
      teamLookup.get(normalizeLabel(batting.teamName)) || inningsEntry.battingTeamId,
      toInteger(batting.battingPosition),
      batting.isNotOut,
      normalizeText(batting.dismissalType) || null,
      normalizeText(batting.dismissalText) || null,
      resolvePlayerId(playerLookup, batting.dismissedBySourcePlayerId, null),
      resolvePlayerId(playerLookup, batting.primaryFielderSourcePlayerId, null),
      batting.runs === null ? null : toInteger(batting.runs),
      batting.ballsFaced === null ? null : toInteger(batting.ballsFaced),
      batting.fours === null ? null : toInteger(batting.fours),
      batting.sixes === null ? null : toInteger(batting.sixes),
      batting.strikeRate,
      null,
      null,
      batting.retiredHurt === true,
      batting.didNotBat === true,
    ]);
  }

  return batchInsertRows(
    client,
    "public.batting_innings",
    [
      "innings_id",
      "match_id",
      "player_id",
      "team_id",
      "batting_position",
      "is_not_out",
      "dismissal_type",
      "dismissal_text",
      "dismissed_by_player_id",
      "primary_fielder_player_id",
      "runs",
      "balls_faced",
      "fours",
      "sixes",
      "strike_rate",
      "entered_score",
      "entered_wickets",
      "retired_hurt",
      "did_not_bat",
    ],
    rows,
    { batchSize: 80 }
  );
}

async function insertBowlingRows(client, matchId, bowlingRows, inningsIdByNo, teamLookup, playerLookup) {
  const rows = [];

  for (const bowling of bowlingRows) {
    const inningsEntry = inningsIdByNo.get(bowling.inningsNo);
    if (!inningsEntry) {
      continue;
    }

    const playerId = resolvePlayerId(playerLookup, bowling.playerSourceId, bowling.playerName);
    if (!playerId) {
      continue;
    }

    rows.push([
      inningsEntry.inningsId,
      matchId,
      playerId,
      teamLookup.get(normalizeLabel(bowling.teamName)) || inningsEntry.bowlingTeamId,
      bowling.oversDecimal,
      toInteger(bowling.legalBalls),
      toInteger(bowling.maidens),
      toInteger(bowling.runsConceded),
      toInteger(bowling.wickets),
      toInteger(bowling.wides),
      toInteger(bowling.noBalls),
      toInteger(bowling.dotBalls),
      bowling.economy,
      normalizeText(bowling.bestFigures) || null,
      toInteger(bowling.spellSequence) || 1,
    ]);
  }

  return batchInsertRows(
    client,
    "public.bowling_spell",
    [
      "innings_id",
      "match_id",
      "player_id",
      "team_id",
      "overs_decimal",
      "legal_balls",
      "maidens",
      "runs_conceded",
      "wickets",
      "wides",
      "no_balls",
      "dot_balls",
      "economy",
      "best_figures",
      "spell_sequence",
    ],
    rows,
    { batchSize: 80 }
  );
}

async function insertBallEventRows(client, matchId, ballEvents, inningsIdByNo, playerLookup) {
  const rows = [];

  for (const event of ballEvents) {
    const inningsEntry = inningsIdByNo.get(event.inningsNo);
    if (!inningsEntry) {
      continue;
    }

    rows.push([
      matchId,
      inningsEntry.inningsId,
      event.inningsNo,
      toInteger(event.eventIndex),
      toInteger(event.overNo),
      toInteger(event.ballInOver),
      normalizeText(event.ballLabel),
      normalizeText(event.phase) || null,
      resolvePlayerId(playerLookup, event.strikerSourcePlayerId, event.strikerName),
      resolvePlayerId(playerLookup, event.nonStrikerSourcePlayerId, null),
      resolvePlayerId(playerLookup, event.bowlerSourcePlayerId, event.bowlerName),
      inningsEntry.battingTeamId,
      inningsEntry.bowlingTeamId,
      toInteger(event.batterRuns) || 0,
      toInteger(event.extras) || 0,
      normalizeText(event.extraType) || null,
      toInteger(event.totalRuns) || 0,
      event.isLegalBall !== false,
      event.wicketFlag === true,
      normalizeText(event.dismissalType) || null,
      resolvePlayerId(playerLookup, event.playerOutSourcePlayerId, null),
      resolvePlayerId(playerLookup, event.primaryFielderSourcePlayerId, null),
      event.wicketCreditedToBowler === true,
      normalizeText(event.commentaryText) || null,
      toInteger(event.scoreAfterRuns),
      toInteger(event.wicketsAfter),
      event.leverageScore || null,
      event.opponentTeamWeight || null,
      event.opponentPlayerWeight || null,
      event.phaseWeight || null,
      event.leverageWeight || null,
      event.totalEventWeight || null,
      event.parseConfidence || null,
      "parsed",
    ]);
  }

  return batchInsertRows(
    client,
    "public.ball_event",
    [
      "match_id",
      "innings_id",
      "innings_no",
      "event_index",
      "over_no",
      "ball_in_over",
      "ball_label",
      "phase",
      "striker_player_id",
      "non_striker_player_id",
      "bowler_player_id",
      "batting_team_id",
      "bowling_team_id",
      "batter_runs",
      "extras",
      "extra_type",
      "total_runs",
      "is_legal_ball",
      "wicket_flag",
      "dismissal_type",
      "player_out_id",
      "primary_fielder_player_id",
      "wicket_credited_to_bowler",
      "commentary_text",
      "score_after_runs",
      "wickets_after",
      "leverage_score",
      "opponent_team_weight",
      "opponent_player_weight",
      "phase_weight",
      "leverage_weight",
      "total_event_weight",
      "parse_confidence",
      "reconciliation_status",
    ],
    rows,
    { batchSize: 120 }
  );
}

async function insertPlayerMatchAdvancedRows(
  client,
  matchId,
  divisionId,
  advancedRows,
  teamLookup,
  playerLookup
) {
  const rows = [];

  for (const entry of advancedRows) {
    const playerId = resolvePlayerId(playerLookup, entry.sourcePlayerId, entry.playerName);
    if (!playerId) {
      continue;
    }

    rows.push([
      matchId,
      divisionId,
      playerId,
      teamLookup.get(normalizeLabel(entry.teamName)) || null,
      normalizeText(entry.roleType) || "unclassified",
      toInteger(entry.ballsFaced),
      toInteger(entry.batterRuns),
      entry.dotBallPct ?? null,
      entry.boundaryBallPct ?? null,
      entry.singlesRotationPct ?? null,
      entry.dismissalRate ?? null,
      toInteger(entry.legalBallsBowled),
      toInteger(entry.bowlerRunsConceded),
      toInteger(entry.totalRunsConceded),
      entry.wicketBallPct ?? null,
      entry.boundaryConcededPct ?? null,
      toInteger(entry.pressureOvers),
      entry.fieldingImpactScore ?? null,
      entry.teamStrengthAdjustedScore ?? null,
      entry.playerStrengthAdjustedScore ?? null,
      entry.leverageAdjustedScore ?? null,
      entry.matchImpactScore ?? null,
    ]);
  }

  return batchInsertRows(
    client,
    "public.player_match_advanced",
    [
      "match_id",
      "division_id",
      "player_id",
      "team_id",
      "role_type",
      "balls_faced",
      "batter_runs",
      "dot_ball_pct",
      "boundary_ball_pct",
      "singles_rotation_pct",
      "dismissal_rate",
      "legal_balls_bowled",
      "bowler_runs_conceded",
      "total_runs_conceded",
      "wicket_ball_pct",
      "boundary_conceded_pct",
      "pressure_overs",
      "fielding_impact_score",
      "team_strength_adjusted_score",
      "player_strength_adjusted_score",
      "leverage_adjusted_score",
      "match_impact_score",
    ],
    rows,
    { batchSize: 120 }
  );
}

async function insertPlayerMatchupRows(
  client,
  seriesId,
  divisionId,
  matchId,
  matchupRows,
  playerLookup
) {
  const rows = [];

  for (const entry of matchupRows) {
    const batterPlayerId = resolvePlayerId(playerLookup, entry.batterSourcePlayerId, null);
    const bowlerPlayerId = resolvePlayerId(playerLookup, entry.bowlerSourcePlayerId, null);

    if (!batterPlayerId || !bowlerPlayerId) {
      continue;
    }

    rows.push([
      seriesId,
      divisionId,
      batterPlayerId,
      bowlerPlayerId,
      matchId,
      toInteger(entry.balls) || 0,
      toInteger(entry.batterRuns) || 0,
      toInteger(entry.totalRuns) || 0,
      toInteger(entry.dismissals) || 0,
      toInteger(entry.dots) || 0,
      toInteger(entry.fours) || 0,
      toInteger(entry.sixes) || 0,
      toInteger(entry.byes) || 0,
      toInteger(entry.legByes) || 0,
      toInteger(entry.wides) || 0,
      toInteger(entry.noBalls) || 0,
      entry.weightedRuns ?? null,
      entry.weightedDismissals ?? null,
    ]);
  }

  return batchInsertRows(
    client,
    "public.player_matchup",
    [
      "series_id",
      "division_id",
      "batter_player_id",
      "bowler_player_id",
      "match_id",
      "balls",
      "batter_runs",
      "total_runs",
      "dismissals",
      "dots",
      "fours",
      "sixes",
      "byes",
      "leg_byes",
      "wides",
      "no_balls",
      "weighted_runs",
      "weighted_dismissals",
    ],
    rows,
    { batchSize: 120 }
  );
}

async function insertOverSummaryRows(client, matchId, overSummaries, inningsIdByNo, playerLookup) {
  const rows = [];

  for (const over of overSummaries) {
    const inningsEntry = inningsIdByNo.get(over.inningsNo);
    if (!inningsEntry) {
      continue;
    }

    rows.push([
      matchId,
      inningsEntry.inningsId,
      over.inningsNo,
      toInteger(over.overNo),
      resolvePlayerId(playerLookup, over.bowlerSourcePlayerId, null),
      toInteger(over.legalBalls),
      toInteger(over.runsInOver),
      toInteger(over.wicketsInOver),
      toInteger(over.dotsInOver),
      toInteger(over.boundariesInOver),
      normalizeText(over.overStateText) || null,
    ]);
  }

  return batchInsertRows(
    client,
    "public.over_summary",
    [
      "match_id",
      "innings_id",
      "innings_no",
      "over_no",
      "bowler_player_id",
      "legal_balls",
      "runs_in_over",
      "wickets_in_over",
      "dots_in_over",
      "boundaries_in_over",
      "over_state_text",
    ],
    rows,
    { batchSize: 80 }
  );
}

async function insertFieldingEvents(client, matchId, fieldingEvents, inningsIdByNo, playerLookup) {
  const rows = [];

  for (const fielding of fieldingEvents) {
    const inningsEntry = inningsIdByNo.get(fielding.inningsNo);
    if (!inningsEntry) {
      continue;
    }

    rows.push([
      matchId,
      inningsEntry.inningsId,
      toInteger(fielding.overNo),
      fielding.ballNo,
      resolvePlayerId(playerLookup, fielding.playerOutSourcePlayerId, null),
      resolvePlayerId(playerLookup, fielding.bowlerSourcePlayerId, null),
      resolvePlayerId(playerLookup, fielding.fielderSourcePlayerId, null),
      normalizeText(fielding.dismissalType) || "other",
      fielding.isDirectRunOut,
      fielding.isIndirectRunOut,
      fielding.isWicketkeeperEvent,
      normalizeText(fielding.notes) || null,
    ]);
  }

  return batchInsertRows(
    client,
    "public.fielding_event",
    [
      "match_id",
      "innings_id",
      "over_no",
      "ball_no",
      "player_out_id",
      "bowler_player_id",
      "fielder_player_id",
      "dismissal_type",
      "is_direct_run_out",
      "is_indirect_run_out",
      "is_wicketkeeper_event",
      "notes",
    ],
    rows,
    { batchSize: 80 }
  );
}

async function markMatchFactIngested(client, matchId, input) {
  await client.query(
    `
      update public.match
      set
        ball_by_ball_url = coalesce($2, ball_by_ball_url),
        scorecard_url = coalesce($3, scorecard_url),
        match_page_url = coalesce($4, match_page_url)
      where id = $1
    `,
    [matchId, input.ballByBallUrl || null, input.scorecardUrl || null, input.matchPageUrl || null]
  );

  await updateMatchRefreshState(client, {
    matchId,
    sourceStatus: input.sourceStatus || "match_facts_ingested",
    needsRescrape: false,
    needsReparse: false,
    needsRecompute: input.needsRecompute === true,
    parseStatus: input.parseStatus || "parsed",
    analyticsStatus: input.analyticsStatus || "pending",
    lastChangeReason: input.lastChangeReason || "worker_match_fact_ingest_complete",
  });
}

async function upsertMatchFacts(matchFacts, options = {}) {
  const seriesConfigKey = getSeriesConfigKey(options, matchFacts?.match?.series || matchFacts?.match?.seriesConfigKey);

  return withTransaction(async (client) => {
    await client.query("set local statement_timeout = '300s'");
    const context = await resolveSeriesWriteContext(client, seriesConfigKey);
    const sourceMatchId = normalizeText(matchFacts?.match?.source_match_id);
    const existingMatch = await loadExistingMatch(client, context, sourceMatchId);
    if (!existingMatch?.id) {
      throw new Error(`Match row not found for source match id ${sourceMatchId}. Run stage before run.`);
    }

    const parsedPlayers = Array.isArray(matchFacts?.scorecard?.playerRegistry)
      ? matchFacts.scorecard.playerRegistry
      : [];
    const persistedPlayers = [];

    for (const player of parsedPlayers) {
      const row = await upsertPlayerRow(client, context, player);
      if (!row?.id) {
        continue;
      }

      await upsertPlayerAliases(client, toInteger(row.id), player.aliases || []);
      persistedPlayers.push({
        playerId: toInteger(row.id),
        sourcePlayerId: normalizeText(player.sourcePlayerId || row.source_player_id),
        displayName: normalizeText(player.displayName || row.display_name),
      });
    }

    const playerLookup = buildPlayerLookup(persistedPlayers, parsedPlayers);
    const teamLookup = buildTeamLookup(existingMatch, matchFacts);
    const matchId = toInteger(existingMatch.id);
    const divisionId = toInteger(existingMatch.division_id);
    const annotatedBallEvents =
      matchFacts?.advanced?.outputs?.annotatedBallEvents || matchFacts?.commentary?.ballEvents || [];
    const playerMatchAdvanced = matchFacts?.advanced?.outputs?.playerMatchAdvanced || [];
    const playerMatchups = matchFacts?.advanced?.outputs?.playerMatchups || [];
    const commentaryUnavailable = matchFacts?.raw?.rawCommentary?.commentaryUnavailable === true;
    const noLiveCommentary = commentaryUnavailable && annotatedBallEvents.length === 0;

    await clearMatchFactTables(client, matchId);

    const inningsIdByNo = await insertInningsRows(
      client,
      matchId,
      matchFacts?.scorecard?.innings || [],
      teamLookup
    );

    await insertBattingRows(
      client,
      matchId,
      matchFacts?.scorecard?.battingInnings || [],
      inningsIdByNo,
      teamLookup,
      playerLookup
    );

    await insertBowlingRows(
      client,
      matchId,
      matchFacts?.scorecard?.bowlingSpells || [],
      inningsIdByNo,
      teamLookup,
      playerLookup
    );

    await insertBallEventRows(
      client,
      matchId,
      annotatedBallEvents,
      inningsIdByNo,
      playerLookup
    );

    await insertOverSummaryRows(
      client,
      matchId,
      matchFacts?.commentary?.overSummaries || [],
      inningsIdByNo,
      playerLookup
    );

    await insertFieldingEvents(
      client,
      matchId,
      matchFacts?.commentary?.fieldingEvents || [],
      inningsIdByNo,
      playerLookup
    );

    const playerMatchAdvancedCount = await insertPlayerMatchAdvancedRows(
      client,
      matchId,
      divisionId,
      playerMatchAdvanced,
      teamLookup,
      playerLookup
    );

    const playerMatchupCount = await insertPlayerMatchupRows(
      client,
      context.seriesId,
      divisionId,
      matchId,
      playerMatchups,
      playerLookup
    );

    await markMatchFactIngested(client, matchId, {
      ballByBallUrl: normalizeText(matchFacts?.raw?.rawCommentary?.sourceUrl),
      scorecardUrl: normalizeText(matchFacts?.raw?.rawScorecard?.sourceUrl),
      matchPageUrl: normalizeText(matchFacts?.match?.match_page_url),
      sourceStatus: noLiveCommentary
        ? "match_facts_ingested_no_live_commentary"
        : "match_facts_ingested",
      needsRecompute: noLiveCommentary ? false : true,
      parseStatus: noLiveCommentary ? "skipped" : "parsed",
      analyticsStatus: noLiveCommentary ? "computed" : "pending",
      lastChangeReason: noLiveCommentary
        ? "worker_match_fact_ingest_no_live_commentary"
        : "worker_match_fact_ingest_complete",
    });

    return {
      ok: true,
      message: `Match facts persisted for source match ${sourceMatchId}.`,
      seriesConfigKey: context.configKey,
      matchId,
      sourceMatchId,
      inningsCount: (matchFacts?.scorecard?.innings || []).length,
      battingRowCount: (matchFacts?.scorecard?.battingInnings || []).length,
      bowlingRowCount: (matchFacts?.scorecard?.bowlingSpells || []).length,
      ballEventCount: annotatedBallEvents.length,
      overSummaryCount: (matchFacts?.commentary?.overSummaries || []).length,
      fieldingEventCount: (matchFacts?.commentary?.fieldingEvents || []).length,
      playerMatchAdvancedCount,
      playerMatchupCount,
    };
  });
}

module.exports = {
  listSeriesPlayersForProfileEnrichment,
  persistPlayerProfileEnrichment,
  upsertDiscovery,
  upsertMatchFacts,
  upsertMatchInventory,
};

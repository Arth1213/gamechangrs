const path = require("path");

const { discoverSeries } = require("../discovery/seriesDiscovery");
const { enumerateMatches } = require("../extract/matchInventory");
const { withClient, withTransaction } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { upsertDiscovery, upsertMatchInventory } = require("../load/repository");

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

function truncateText(value, maxLength = 500) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
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

function buildWorkerRef() {
  return `series-ops-worker:${process.pid}:${Date.now()}`;
}

async function fetchOne(client, query, params = []) {
  const result = await client.query(query, params);
  return result.rows[0] || null;
}

async function claimNextSeriesOperationRequest(options = {}) {
  const requestedId = normalizeText(options.requestId);
  const requestedSeriesConfigKey = normalizeText(options.seriesConfigKey);
  const workerRef = buildWorkerRef();

  return withTransaction(async (client) => {
    const row = await fetchOne(
      client,
      `
        select
          sor.id,
          sor.operation_key,
          sor.request_note,
          sor.series_source_config_id,
          c.config_key,
          c.name as config_name,
          c.source_system,
          c.series_url,
          c.expected_league_name,
          c.expected_series_name,
          c.season_year,
          c.target_age_group,
          c.include_ball_by_ball,
          c.include_player_profiles,
          c.enable_auto_discovery,
          c.scrape_completed_only,
          s.id as series_id,
          s.name as series_name,
          s.league_name,
          s.source_series_id
        from public.series_operation_request sor
        join public.series_source_config c on c.id = sor.series_source_config_id
        join public.series s on s.id = c.series_id
        where sor.request_status = 'pending'
          and ($1::uuid is null or sor.id = $1::uuid)
          and ($2::text is null or c.config_key = $2::text)
        order by sor.created_at asc, sor.id asc
        limit 1
        for update skip locked
      `,
      [requestedId || null, requestedSeriesConfigKey || null]
    );

    if (!row) {
      return null;
    }

    await client.query(
      `
        update public.series_operation_request
        set
          request_status = 'processing',
          runner_mode = 'worker',
          worker_ref = $2,
          started_at = now(),
          last_worker_note = $3
        where id = $1
      `,
      [
        row.id,
        workerRef,
        row.operation_key === "discover_new_matches"
          ? "Worker claimed request and started live discovery/inventory."
          : "Worker claimed request.",
      ]
    );

    return {
      requestId: normalizeText(row.id),
      operationKey: normalizeLabel(row.operation_key),
      requestNote: normalizeText(row.request_note),
      workerRef,
      series: {
        seriesSourceConfigId: toInteger(row.series_source_config_id),
        seriesId: toInteger(row.series_id),
        configKey: normalizeText(row.config_key),
        label: normalizeText(row.config_name) || normalizeText(row.expected_series_name) || normalizeText(row.series_name),
        sourceSystem: normalizeText(row.source_system),
        seriesUrl: normalizeText(row.series_url),
        expectedLeagueName: normalizeText(row.expected_league_name) || normalizeText(row.league_name),
        expectedSeriesName: normalizeText(row.expected_series_name) || normalizeText(row.series_name),
        seasonYear: toInteger(row.season_year),
        targetAgeGroup: normalizeText(row.target_age_group),
        includeBallByBall: row.include_ball_by_ball === true,
        includePlayerProfiles: row.include_player_profiles === true,
        enableAutoDiscovery: row.enable_auto_discovery === true,
        scrapeCompletedOnly: row.scrape_completed_only === true,
        sourceSeriesId: normalizeText(row.source_series_id),
      },
    };
  });
}

async function claimNextManualRefreshRequest(options = {}) {
  const requestedId = toInteger(options.requestId);
  const requestedSeriesConfigKey = normalizeText(options.seriesConfigKey);
  const workerRef = buildWorkerRef();

  return withTransaction(async (client) => {
    const row = await fetchOne(
      client,
      `
        select
          mmrr.id,
          mmrr.match_id,
          mmrr.request_match_url,
          mmrr.normalized_match_url,
          mmrr.request_source_match_id,
          mmrr.request_reason,
          mmrr.requested_by,
          mmrr.requested_at,
          mmrr.status,
          c.id as series_source_config_id,
          c.config_key,
          c.name as config_name,
          c.source_system,
          c.series_url,
          c.expected_league_name,
          c.expected_series_name,
          c.season_year,
          c.target_age_group,
          c.include_ball_by_ball,
          c.include_player_profiles,
          c.enable_auto_discovery,
          c.scrape_completed_only,
          s.id as series_id,
          s.name as series_name,
          s.league_name,
          s.source_series_id
        from public.manual_match_refresh_request mmrr
        join public.series_source_config c on c.id = mmrr.series_source_config_id
        join public.series s on s.id = c.series_id
        where mmrr.status = 'pending'
          and ($1::bigint is null or mmrr.id = $1::bigint)
          and ($2::text is null or c.config_key = $2::text)
        order by mmrr.requested_at asc, mmrr.id asc
        limit 1
        for update skip locked
      `,
      [requestedId || null, requestedSeriesConfigKey || null]
    );

    if (!row) {
      return null;
    }

    await client.query(
      `
        update public.manual_match_refresh_request
        set
          status = 'processing',
          resolution_note = $2
        where id = $1
      `,
      [
        row.id,
        "Worker claimed request and started live inventory refresh.",
      ]
    );

    return {
      requestId: toInteger(row.id),
      linkedMatchId: toInteger(row.match_id),
      requestMatchUrl: normalizeText(row.request_match_url),
      normalizedMatchUrl: normalizeText(row.normalized_match_url),
      requestSourceMatchId: normalizeText(row.request_source_match_id),
      requestReason: normalizeText(row.request_reason),
      requestedBy: normalizeText(row.requested_by),
      requestedAt: row.requested_at || null,
      workerRef,
      series: {
        seriesSourceConfigId: toInteger(row.series_source_config_id),
        seriesId: toInteger(row.series_id),
        configKey: normalizeText(row.config_key),
        label: normalizeText(row.config_name) || normalizeText(row.expected_series_name) || normalizeText(row.series_name),
        sourceSystem: normalizeText(row.source_system),
        seriesUrl: normalizeText(row.series_url),
        expectedLeagueName: normalizeText(row.expected_league_name) || normalizeText(row.league_name),
        expectedSeriesName: normalizeText(row.expected_series_name) || normalizeText(row.series_name),
        seasonYear: toInteger(row.season_year),
        targetAgeGroup: normalizeText(row.target_age_group),
        includeBallByBall: row.include_ball_by_ball === true,
        includePlayerProfiles: row.include_player_profiles === true,
        enableAutoDiscovery: row.enable_auto_discovery === true,
        scrapeCompletedOnly: row.scrape_completed_only === true,
        sourceSeriesId: normalizeText(row.source_series_id),
      },
    };
  });
}

async function loadSeriesTargeting(seriesSourceConfigId) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        select
          tdc.target_label,
          tdc.phase_no,
          tdc.division_no,
          tdc.strength_tier,
          tdc.include_flag,
          d.source_division_id,
          d.results_url,
          d.stats_url
        from public.series_target_division_config tdc
        left join public.division d on d.id = tdc.division_id
        where tdc.series_source_config_id = $1
        order by tdc.phase_no nulls last, tdc.division_no nulls last, tdc.id
      `,
      [seriesSourceConfigId]
    );

    return result.rows.map((row) => ({
      label: normalizeText(row.target_label),
      enabled: row.include_flag === true,
      phase: toInteger(row.phase_no),
      division_no: toInteger(row.division_no),
      strength_tier: normalizeText(row.strength_tier),
      source_division_id: normalizeText(row.source_division_id),
      results_url: normalizeText(row.results_url),
      stats_url: normalizeText(row.stats_url),
    }));
  });
}

async function buildWorkerSeriesConfig(claimedRequest) {
  const divisions = await loadSeriesTargeting(claimedRequest.series.seriesSourceConfigId);
  const clubIdFromDivisions =
    divisions.map((division) => parseClubIdFromUrl(division.results_url) || parseClubIdFromUrl(division.stats_url)).find(Boolean) ||
    "";

  return {
    slug: claimedRequest.series.configKey,
    label: claimedRequest.series.label,
    enabled: true,
    league_name: claimedRequest.series.expectedLeagueName,
    season_year: claimedRequest.series.seasonYear,
    series_url: claimedRequest.series.seriesUrl,
    source_hints: {
      club_id: clubIdFromDivisions || undefined,
      series_id: claimedRequest.series.sourceSeriesId || undefined,
    },
    targeting: {
      age_group: claimedRequest.series.targetAgeGroup,
      divisions: divisions.map((division) => ({
        label: division.label,
        enabled: division.enabled,
        phase: division.phase,
        division_no: division.division_no,
        strength_tier: division.strength_tier,
      })),
    },
    outputs: {
      enable_raw_snapshots: true,
      enable_json_exports: true,
      enable_pdf_reports: false,
      enable_dashboard_views: true,
    },
  };
}

async function markSeriesOperationRequestComplete(input) {
  await withClient(async (client) => {
    await client.query(
      `
        update public.series_operation_request
        set
          request_status = 'completed',
          runner_mode = 'worker',
          worker_ref = $2,
          last_worker_note = $3,
          result_summary = $4,
          finished_at = now()
        where id = $1
      `,
      [
        input.requestId,
        input.workerRef,
        truncateText(input.lastWorkerNote, 500),
        truncateText(input.resultSummary, 1000),
      ]
    );
  });
}

async function markSeriesOperationRequestFailed(input) {
  await withClient(async (client) => {
    await client.query(
      `
        update public.series_operation_request
        set
          request_status = 'failed',
          runner_mode = 'worker',
          worker_ref = $2,
          last_worker_note = $3,
          result_summary = $4,
          finished_at = now()
        where id = $1
      `,
      [
        input.requestId,
        input.workerRef,
        truncateText(input.lastWorkerNote, 500),
        truncateText(input.resultSummary, 1000),
      ]
    );
  });
}

async function markManualRefreshRequestComplete(input) {
  await withClient(async (client) => {
    await client.query(
      `
        update public.manual_match_refresh_request
        set
          match_id = coalesce($2, match_id),
          status = 'completed',
          resolution_note = $3,
          processed_at = now()
        where id = $1
      `,
      [
        input.requestId,
        input.matchId || null,
        truncateText(input.resolutionNote, 1000),
      ]
    );
  });
}

async function markManualRefreshRequestFailed(input) {
  await withClient(async (client) => {
    await client.query(
      `
        update public.manual_match_refresh_request
        set
          match_id = coalesce($2, match_id),
          status = 'failed',
          resolution_note = $3,
          processed_at = now()
        where id = $1
      `,
      [
        input.requestId,
        input.matchId || null,
        truncateText(input.resolutionNote, 1000),
      ]
    );
  });
}

async function loadMatchForManualRefresh(seriesId, sourceMatchId) {
  return withClient(async (client) => {
    return fetchOne(
      client,
      `
        select
          m.id,
          m.source_match_id,
          d.source_label as division_label,
          t1.display_name || ' v ' || t2.display_name as match_title
        from public.match m
        join public.team t1 on t1.id = m.team1_id
        join public.team t2 on t2.id = m.team2_id
        left join public.division d on d.id = m.division_id
        where m.series_id = $1
          and m.source_match_id = $2
        limit 1
      `,
      [seriesId, sourceMatchId]
    );
  });
}

async function processDiscoverNewMatches(claimedRequest, options = {}) {
  const series = await buildWorkerSeriesConfig(claimedRequest);
  const outDir =
    options.outDir ||
    path.resolve(
      process.cwd(),
      "storage/exports/series-operations",
      `${series.slug}-${claimedRequest.requestId}`
    );
  ensureDir(outDir);

  const discovery = await discoverSeries(series, { outDir });
  const discoveryWrite = await upsertDiscovery(discovery, {
    seriesConfigKey: claimedRequest.series.configKey,
  });

  const inventory = await enumerateMatches(series, discovery, { outDir });
  const inventoryWrite = await upsertMatchInventory(inventory, {
    seriesConfigKey: claimedRequest.series.configKey,
  });

  const summary = {
    requestId: claimedRequest.requestId,
    operationKey: claimedRequest.operationKey,
    seriesConfigKey: claimedRequest.series.configKey,
    discovery: discoveryWrite,
    inventory: inventoryWrite,
  };

  writeJsonFile(path.join(outDir, "series_operation_summary.json"), summary);

  const resultSummary = [
    `Discovered ${discoveryWrite.discoveredDivisionCount} target divisions.`,
    `Inventoried ${inventoryWrite.inventoriedMatchCount} matches.`,
    `${inventoryWrite.newMatchCount} new matches added.`,
    `${inventoryWrite.updatedMatchCount} existing matches refreshed.`,
    `${inventoryWrite.unchangedMatchCount} matches unchanged.`,
  ].join(" ");

  await markSeriesOperationRequestComplete({
    requestId: claimedRequest.requestId,
    workerRef: claimedRequest.workerRef,
    lastWorkerNote: "Live discovery and inventory completed successfully.",
    resultSummary,
  });

  return {
    requestId: claimedRequest.requestId,
    operationKey: claimedRequest.operationKey,
    requestStatus: "completed",
    workerRef: claimedRequest.workerRef,
    resultSummary,
    summary,
  };
}

async function processDeferredRecompute(claimedRequest) {
  const resultSummary =
    "Recompute remains deferred. The worker can now inventory new matches, but full scorecard/commentary persistence and recompute are not implemented yet.";

  await markSeriesOperationRequestFailed({
    requestId: claimedRequest.requestId,
    workerRef: claimedRequest.workerRef,
    lastWorkerNote: "Request marked failed intentionally because recompute support is not implemented in the current worker slice.",
    resultSummary,
  });

  return {
    requestId: claimedRequest.requestId,
    operationKey: claimedRequest.operationKey,
    requestStatus: "failed",
    workerRef: claimedRequest.workerRef,
    resultSummary,
  };
}

async function processManualRefreshRequest(claimedRequest, options = {}) {
  const series = await buildWorkerSeriesConfig(claimedRequest);
  const outDir =
    options.outDir ||
    path.resolve(
      process.cwd(),
      "storage/exports/manual-refresh",
      `${series.slug}-${claimedRequest.requestId}`
    );
  ensureDir(outDir);

  const discovery = await discoverSeries(series, { outDir });
  const discoveryWrite = await upsertDiscovery(discovery, {
    seriesConfigKey: claimedRequest.series.configKey,
  });

  const inventory = await enumerateMatches(series, discovery, { outDir });
  const inventoryWrite = await upsertMatchInventory(inventory, {
    seriesConfigKey: claimedRequest.series.configKey,
  });

  const linkedMatch = claimedRequest.requestSourceMatchId
    ? await loadMatchForManualRefresh(claimedRequest.series.seriesId, claimedRequest.requestSourceMatchId)
    : null;

  const summary = {
    requestId: claimedRequest.requestId,
    requestSourceMatchId: claimedRequest.requestSourceMatchId,
    seriesConfigKey: claimedRequest.series.configKey,
    discovery: discoveryWrite,
    inventory: inventoryWrite,
    linkedMatch: linkedMatch
      ? {
          matchId: toInteger(linkedMatch.id),
          sourceMatchId: normalizeText(linkedMatch.source_match_id),
          divisionLabel: normalizeText(linkedMatch.division_label),
          matchTitle: normalizeText(linkedMatch.match_title),
        }
      : null,
  };

  writeJsonFile(path.join(outDir, "manual_refresh_summary.json"), summary);

  const inventorySummary = [
    `Refreshed live discovery across ${discoveryWrite.discoveredDivisionCount} target divisions.`,
    `Checked ${inventoryWrite.inventoriedMatchCount} matches in the current results inventory.`,
    `${inventoryWrite.newMatchCount} new matches added.`,
    `${inventoryWrite.updatedMatchCount} existing matches refreshed.`,
  ].join(" ");

  if (!linkedMatch) {
    const resolutionNote = `${inventorySummary} Requested source match ${claimedRequest.requestSourceMatchId || "-"} was not found in the current target-series inventory.`;
    await markManualRefreshRequestFailed({
      requestId: claimedRequest.requestId,
      matchId: claimedRequest.linkedMatchId,
      resolutionNote,
    });

    return {
      requestId: claimedRequest.requestId,
      requestStatus: "failed",
      workerRef: claimedRequest.workerRef,
      requestSourceMatchId: claimedRequest.requestSourceMatchId,
      resultSummary: resolutionNote,
      linkedMatch: null,
      summary,
    };
  }

  const resolutionNote = `${inventorySummary} Linked source match ${normalizeText(linkedMatch.source_match_id)}${normalizeText(linkedMatch.division_label) ? ` in ${normalizeText(linkedMatch.division_label)}` : ""}.`;
  await markManualRefreshRequestComplete({
    requestId: claimedRequest.requestId,
    matchId: toInteger(linkedMatch.id),
    resolutionNote,
  });

  return {
    requestId: claimedRequest.requestId,
    requestStatus: "completed",
    workerRef: claimedRequest.workerRef,
    requestSourceMatchId: claimedRequest.requestSourceMatchId,
    resultSummary: resolutionNote,
    linkedMatch: {
      matchId: toInteger(linkedMatch.id),
      sourceMatchId: normalizeText(linkedMatch.source_match_id),
      divisionLabel: normalizeText(linkedMatch.division_label),
      matchTitle: normalizeText(linkedMatch.match_title),
    },
    summary,
  };
}

async function processSeriesOperationQueue(options = {}) {
  const limit = Math.min(Math.max(toInteger(options.limit) || 1, 1), 25);
  const results = [];

  for (let index = 0; index < limit; index += 1) {
    const claimedRequest = await claimNextSeriesOperationRequest({
      requestId: options.requestId,
      seriesConfigKey: options.seriesConfigKey,
    });

    if (!claimedRequest) {
      break;
    }

    try {
      if (claimedRequest.operationKey === "discover_new_matches") {
        results.push(await processDiscoverNewMatches(claimedRequest, options));
        continue;
      }

      results.push(await processDeferredRecompute(claimedRequest));
    } catch (error) {
      const message = truncateText(error && error.message ? error.message : String(error), 1000);
      await markSeriesOperationRequestFailed({
        requestId: claimedRequest.requestId,
        workerRef: claimedRequest.workerRef,
        lastWorkerNote: message,
        resultSummary: `Worker processing failed: ${message}`,
      });

      results.push({
        requestId: claimedRequest.requestId,
        operationKey: claimedRequest.operationKey,
        requestStatus: "failed",
        workerRef: claimedRequest.workerRef,
        resultSummary: `Worker processing failed: ${message}`,
      });
    }
  }

  return {
    processedCount: results.length,
    requestResults: results,
  };
}

async function processManualRefreshQueue(options = {}) {
  const limit = Math.min(Math.max(toInteger(options.limit) || 1, 1), 25);
  const results = [];

  for (let index = 0; index < limit; index += 1) {
    const claimedRequest = await claimNextManualRefreshRequest({
      requestId: options.requestId,
      seriesConfigKey: options.seriesConfigKey,
    });

    if (!claimedRequest) {
      break;
    }

    try {
      results.push(await processManualRefreshRequest(claimedRequest, options));
    } catch (error) {
      const message = truncateText(error && error.message ? error.message : String(error), 1000);
      const resolutionNote = `Worker processing failed: ${message}`;
      await markManualRefreshRequestFailed({
        requestId: claimedRequest.requestId,
        matchId: claimedRequest.linkedMatchId,
        resolutionNote,
      });

      results.push({
        requestId: claimedRequest.requestId,
        requestStatus: "failed",
        workerRef: claimedRequest.workerRef,
        requestSourceMatchId: claimedRequest.requestSourceMatchId,
        resultSummary: resolutionNote,
      });
    }
  }

  return {
    processedCount: results.length,
    requestResults: results,
  };
}

module.exports = {
  processManualRefreshQueue,
  processSeriesOperationQueue,
};

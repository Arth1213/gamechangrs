const path = require("path");
const { discoverSeries } = require("../discovery/seriesDiscovery");
const { enumerateMatches } = require("../extract/matchInventory");
const { withClient } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { upsertDiscovery, upsertMatchInventory } = require("../load/repository");
const { runMatchPipeline } = require("../pipeline/runMatchPipeline");

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

function buildLogger(log) {
  return typeof log === "function" ? log : console.log;
}

function dedupeStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean))];
}

async function loadRefreshCandidates(options = {}) {
  const requestedSourceMatchIds = dedupeStrings(options.sourceMatchIds);
  const requestedDbMatchId = toInteger(options.dbMatchId);

  return withClient(async (client) => {
    const params = [normalizeText(options.seriesConfigKey)];
    const filters = ["c.config_key = $1"];

    if (requestedSourceMatchIds.length) {
      params.push(requestedSourceMatchIds);
      filters.push(`m.source_match_id = any($${params.length}::text[])`);
    }

    if (requestedDbMatchId) {
      params.push(requestedDbMatchId);
      filters.push(`m.id = $${params.length}::bigint`);
    }

    if (!requestedSourceMatchIds.length && !requestedDbMatchId) {
      filters.push(`
        (
          coalesce(mrs.needs_rescrape, false) = true
          or coalesce(mrs.needs_reparse, false) = true
          or coalesce(mrs.needs_recompute, false) = true
        )
      `);
    }

    const result = await client.query(
      `
        select
          m.id as match_id,
          m.source_match_id,
          m.match_date,
          d.source_label as division_label,
          t1.display_name || ' v ' || t2.display_name as match_title,
          coalesce(mrs.needs_rescrape, false) as needs_rescrape,
          coalesce(mrs.needs_reparse, false) as needs_reparse,
          coalesce(mrs.needs_recompute, false) as needs_recompute,
          mrs.last_change_reason
        from public.series_source_config c
        join public.series s on s.id = c.series_id
        join public.match m on m.series_id = s.id
        join public.team t1 on t1.id = m.team1_id
        join public.team t2 on t2.id = m.team2_id
        left join public.division d on d.id = m.division_id
        left join public.match_refresh_state mrs on mrs.match_id = m.id
        where ${filters.join("\n          and ")}
        order by m.match_date desc nulls last, m.id desc
      `,
      params
    );

    return result.rows.map((row) => ({
      matchId: toInteger(row.match_id),
      sourceMatchId: normalizeText(row.source_match_id),
      matchDate: row.match_date || null,
      divisionLabel: normalizeText(row.division_label),
      matchTitle: normalizeText(row.match_title),
      needsRescrape: row.needs_rescrape === true,
      needsReparse: row.needs_reparse === true,
      needsRecompute: row.needs_recompute === true,
      lastChangeReason: normalizeText(row.last_change_reason),
    }));
  });
}

function buildCandidateSummary(candidates, limit) {
  const capped = Number.isFinite(limit) && limit > 0 ? candidates.slice(0, limit) : candidates;

  return capped.map((candidate) => ({
    matchId: candidate.matchId,
    sourceMatchId: candidate.sourceMatchId,
    matchDate: candidate.matchDate,
    divisionLabel: candidate.divisionLabel,
    matchTitle: candidate.matchTitle,
    refreshFlags: {
      needsRescrape: candidate.needsRescrape,
      needsReparse: candidate.needsReparse,
      needsRecompute: candidate.needsRecompute,
    },
    lastChangeReason: candidate.lastChangeReason,
  }));
}

async function refreshSeries(options = {}) {
  const logger = buildLogger(options.log);
  const outDir = options.outDir || path.resolve(process.cwd(), "storage/exports", options.series.slug || "series");
  ensureDir(outDir);

  logger(`[refresh-series] ${options.series.slug}: discovery start`);
  const discovery = await discoverSeries(options.series, { outDir });
  writeJsonFile(path.join(outDir, "discovery.json"), discovery);
  const discoveryWrite = await upsertDiscovery(discovery, {
    seriesConfigKey: options.series.slug,
  });
  logger(`[refresh-series] ${options.series.slug}: discovery persisted (${discoveryWrite.discoveredDivisionCount} divisions)`);

  logger(`[refresh-series] ${options.series.slug}: inventory start`);
  const inventory = await enumerateMatches(options.series, discovery, { outDir });
  writeJsonFile(path.join(outDir, "match_inventory.json"), inventory);
  const inventoryWrite = await upsertMatchInventory(inventory, {
    seriesConfigKey: options.series.slug,
  });
  logger(
    `[refresh-series] ${options.series.slug}: inventory persisted (${inventoryWrite.inventoriedMatchCount} matches, ${inventoryWrite.newMatchCount} new, ${inventoryWrite.updatedMatchCount} updated)`
  );

  const requestedSourceMatchIds = dedupeStrings(options.sourceMatchIds);
  const requestedDbMatchId = toInteger(options.dbMatchId);
  const requestedLimit = toInteger(options.matchLimit);
  const allCandidates = await loadRefreshCandidates({
    seriesConfigKey: options.series.slug,
    sourceMatchIds: requestedSourceMatchIds,
    dbMatchId: requestedDbMatchId,
  });
  const selectedCandidates =
    requestedLimit && requestedLimit > 0 ? allCandidates.slice(0, requestedLimit) : allCandidates;

  const summary = {
    command: "refresh-series",
    seriesConfigKey: options.series.slug,
    discoveryWrite,
    inventoryWrite,
    candidateMatchCount: allCandidates.length,
    selectedMatchCount: selectedCandidates.length,
    candidates: buildCandidateSummary(selectedCandidates),
    pipeline: null,
    skippedPipeline: options.skipPipeline === true,
  };

  if (options.skipPipeline === true || !selectedCandidates.length) {
    if (options.skipPipeline === true) {
      logger(`[refresh-series] ${options.series.slug}: pipeline skipped by operator flag`);
    } else {
      logger(`[refresh-series] ${options.series.slug}: no matches currently flagged for refresh`);
    }

    return summary;
  }

  logger(
    `[refresh-series] ${options.series.slug}: running pipeline for ${selectedCandidates.length} selected match(es)`
  );
  const pipeline = await runMatchPipeline({
    series: options.series,
    outDir,
    matchIds: selectedCandidates.map((candidate) => candidate.sourceMatchId),
    useStagedInventory: true,
    headless: options.headless,
    log: logger,
  });

  summary.pipeline = pipeline;
  return summary;
}

async function refreshSingleMatch(options = {}) {
  const requestedSourceMatchIds = dedupeStrings(options.sourceMatchIds);
  const requestedDbMatchId = toInteger(options.dbMatchId);

  if (!requestedSourceMatchIds.length && !requestedDbMatchId) {
    throw new Error("refresh-match requires --matchId / --sourceMatchId or --dbMatchId.");
  }

  const summary = await refreshSeries({
    ...options,
    matchLimit: 1,
    sourceMatchIds: requestedSourceMatchIds,
    dbMatchId: requestedDbMatchId,
  });

  if (!summary.candidates.length) {
    throw new Error("The requested match could not be resolved in the current series inventory.");
  }

  return {
    ...summary,
    command: "refresh-match",
  };
}

module.exports = {
  refreshSeries,
  refreshSingleMatch,
};

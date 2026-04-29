"use strict";

const fs = require("fs");
const path = require("path");

const { discoverSeries } = require("../../../worker/src/discovery/seriesDiscovery");
const { enumerateMatches } = require("../../../worker/src/extract/matchInventory");
const { resolveSeriesConfig, loadYamlConfig } = require("../../../worker/src/lib/config");
const { ensureDir, writeJsonFile } = require("../../../worker/src/lib/fs");
const { upsertDiscovery, upsertMatchInventory } = require("../../../worker/src/load/repository");
const { publishSeries } = require("../../../worker/src/ops/localPublish");
const { refreshSeries, refreshSingleMatch } = require("../../../worker/src/ops/localRefresh");
const { registerSeries } = require("../../../worker/src/ops/seriesRegistry");
const { validateSeries } = require("../../../worker/src/ops/localValidate");
const { runCompositeScoring } = require("../../../worker/src/pipeline/runCompositeScoring");
const { runPlayerIntelligence } = require("../../../worker/src/pipeline/runPlayerIntelligence");
const { runPlayerProfileEnrichment } = require("../../../worker/src/pipeline/runPlayerProfileEnrichment");
const { runMatchPipeline } = require("../../../worker/src/pipeline/runMatchPipeline");
const { runSeasonAggregation } = require("../../../worker/src/pipeline/runSeasonAggregation");
const { probeSeries } = require("../../../worker/src/probe/probeSeries");

const { normalizeText, toBoolean, toInteger } = require("../lib/utils");

const CONFIG_PATH = path.resolve(process.cwd(), "config/leagues.yaml");

function parseListInput(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }

  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  return text
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function buildArtifactPath(seriesConfigKey, fileName) {
  return path.resolve(process.cwd(), "storage/exports", seriesConfigKey, fileName);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      readError: true,
      message: error.message,
      filePath,
    };
  }
}

function readArtifactSummary(seriesConfigKey, fileName, mapPayload) {
  const filePath = buildArtifactPath(seriesConfigKey, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  const payload = readJsonIfExists(filePath);
  const summary = typeof mapPayload === "function" ? mapPayload(payload) : payload;

  return {
    filePath,
    updatedAt: stat.mtime.toISOString(),
    summary,
  };
}

function resolveSeriesRuntime(seriesConfigKey) {
  const config = loadYamlConfig(CONFIG_PATH);
  const series = resolveSeriesConfig(config, seriesConfigKey);
  const outDir = path.resolve(process.cwd(), "storage/exports", series.slug || "series");
  ensureDir(outDir);
  return {
    config,
    configPath: CONFIG_PATH,
    outDir,
    series,
  };
}

function summarizeValidation(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    publishReady: payload.publishReady === true,
    generatedAt: payload.generatedAt,
    counts: payload.counts || {},
    coverage: payload.coverage
      ? {
          matchCount: payload.coverage.matchCount,
          parsedMatchCount: payload.coverage.parsedMatchCount,
          parsedCoveragePct: payload.coverage.parsedCoveragePct,
        }
      : null,
    message: payload.message,
  };
}

function summarizePublish(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    ok: payload.ok === true,
    dryRun: payload.dryRun === true,
    message: payload.message,
    dbUpdate: payload.dbUpdate || null,
  };
}

function summarizeStage(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    discoveryWrite: payload.discoveryWrite || null,
    inventoryWrite: payload.inventoryWrite || null,
  };
}

function summarizeRun(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    attemptedMatchCount: payload.attemptedMatchCount,
    processedMatchCount: payload.processedMatchCount,
    failedMatchCount: payload.failedMatchCount,
    selectedMatchIds: payload.selectedMatchIds || [],
  };
}

function summarizeCompute(payload, primaryKey) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    ok: payload.ok === true,
    [primaryKey]: payload[primaryKey],
    seriesName: payload.seriesName,
  };
}

function buildSeriesOverviewEntry(series) {
  const seriesConfigKey = normalizeText(series.slug);
  return {
    slug: seriesConfigKey,
    label: normalizeText(series.label),
    enabled: series.enabled !== false,
    sourceSystem: normalizeText(series.source_system || series.sourceSystem || "cricclubs"),
    seasonYear: toInteger(series.season_year),
    targetAgeGroup: normalizeText(series?.targeting?.age_group),
    seriesUrl: normalizeText(series.series_url),
    artifacts: {
      stage: readArtifactSummary(seriesConfigKey, "stage_summary.json", summarizeStage),
      run: readArtifactSummary(seriesConfigKey, "run_summary.json", summarizeRun),
      validation: readArtifactSummary(seriesConfigKey, "series_validation_summary.json", summarizeValidation),
      publish: readArtifactSummary(seriesConfigKey, "series_publish_summary.json", summarizePublish),
      season: readArtifactSummary(seriesConfigKey, "season_aggregation_summary.json", (payload) =>
        summarizeCompute(payload, "playerSeasonAdvancedRowCount")
      ),
      composite: readArtifactSummary(seriesConfigKey, "composite_scoring_summary.json", (payload) =>
        summarizeCompute(payload, "playerCompositeScoreRowCount")
      ),
      intelligence: readArtifactSummary(seriesConfigKey, "player_intelligence_summary.json", (payload) =>
        summarizeCompute(payload, "profileRowCount")
      ),
    },
  };
}

async function getLocalOpsOverview() {
  const config = loadYamlConfig(CONFIG_PATH);
  const seriesEntries = Array.isArray(config?.series) ? config.series : [];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    configPath: CONFIG_PATH,
    seriesCount: seriesEntries.length,
    series: seriesEntries
      .map(buildSeriesOverviewEntry)
      .sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.label.localeCompare(right.label)),
    runbooks: [
      "ops_runbook_new_series.md",
      "ops_runbook_manual_refresh.md",
      "ops_runbook_compute_publish.md",
    ],
  };
}

async function executeStage(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const discovery = await discoverSeries(runtime.series, { outDir: runtime.outDir });
  writeJsonFile(path.join(runtime.outDir, "discovery.json"), discovery);
  const discoveryWrite = await upsertDiscovery(discovery, {
    seriesConfigKey: runtime.series.slug,
  });

  const inventory = await enumerateMatches(runtime.series, discovery, { outDir: runtime.outDir });
  writeJsonFile(path.join(runtime.outDir, "match_inventory.json"), inventory);
  const inventoryWrite = await upsertMatchInventory(inventory, {
    seriesConfigKey: runtime.series.slug,
  });

  const summary = {
    series: runtime.series.slug,
    discoveryWrite,
    inventoryWrite,
  };
  const artifactPath = path.join(runtime.outDir, "stage_summary.json");
  writeJsonFile(artifactPath, summary);

  return {
    ok: true,
    actionKey: "stage",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result: summary,
  };
}

async function executeRun(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runMatchPipeline({
    series: runtime.series,
    outDir: runtime.outDir,
    matchLimit: input.matchLimit,
    matchIds: parseListInput(input.matchIds),
    useStagedInventory: toBoolean(input.useStagedInventory),
    headless: toBoolean(input.headless),
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "run_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "run",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeComputeSeason(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runSeasonAggregation({
    series: runtime.series,
    outDir: runtime.outDir,
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "season_aggregation_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "compute-season",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeComputeComposite(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runCompositeScoring({
    series: runtime.series,
    outDir: runtime.outDir,
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "composite_scoring_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "compute-composite",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeProfileEnrichment(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runPlayerProfileEnrichment({
    series: runtime.series,
    outDir: runtime.outDir,
    limit: input.limit,
    playerIds: parseListInput(input.playerIds),
    force: toBoolean(input.force),
    pauseMs: input.pauseMs,
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "player_profile_enrichment_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "enrich-profiles",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeComputeIntelligence(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runPlayerIntelligence({
    series: runtime.series,
    outDir: runtime.outDir,
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "player_intelligence_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "compute-intelligence",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeRefreshSeries(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await refreshSeries({
    series: runtime.series,
    outDir: runtime.outDir,
    matchLimit: input.matchLimit,
    sourceMatchIds: parseListInput(input.matchIds),
    dbMatchId: input.dbMatchId,
    skipPipeline: toBoolean(input.skipPipeline),
    headless: toBoolean(input.headless),
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "series_refresh_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "refresh-series",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeRefreshMatch(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await refreshSingleMatch({
    series: runtime.series,
    outDir: runtime.outDir,
    sourceMatchIds: parseListInput(input.matchId || input.matchIds),
    dbMatchId: input.dbMatchId,
    skipPipeline: toBoolean(input.skipPipeline),
    headless: toBoolean(input.headless),
    log: () => {},
  });
  const sourceMatchId = result?.candidates?.[0]?.sourceMatchId;
  const artifactPath = path.join(
    runtime.outDir,
    sourceMatchId ? `match_refresh_summary_${sourceMatchId}.json` : "match_refresh_summary.json"
  );
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "refresh-match",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeValidateSeries(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await validateSeries({
    series: runtime.series,
    configPath: runtime.configPath,
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "series_validation_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: true,
    actionKey: "validate-series",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executePublishSeries(input = {}) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await publishSeries({
    series: runtime.series,
    configPath: runtime.configPath,
    dryRun: toBoolean(input.dryRun),
    log: () => {},
  });
  const artifactPath = path.join(runtime.outDir, "series_publish_summary.json");
  writeJsonFile(artifactPath, result);

  return {
    ok: result.ok === true,
    actionKey: "publish-series",
    seriesConfigKey: runtime.series.slug,
    artifactPath,
    result,
  };
}

async function executeProbe(input = {}) {
  const config = fs.existsSync(CONFIG_PATH) ? loadYamlConfig(CONFIG_PATH) : null;
  const seriesConfig = normalizeText(input.series)
    ? resolveSeriesConfig(config, normalizeText(input.series))
    : null;
  const result = await probeSeries({
    url: normalizeText(input.url) || seriesConfig?.series_url,
    label: normalizeText(input.label) || seriesConfig?.label,
    sourceSystem: normalizeText(input.sourceSystem || input.source || seriesConfig?.source_system || "cricclubs").toLowerCase(),
    seriesConfig,
    configPath: CONFIG_PATH,
  });

  return {
    ok: true,
    actionKey: "probe",
    artifactPath: result?.artifactPath || null,
    result,
  };
}

async function executeRegister(input = {}) {
  const result = await registerSeries({
    configPath: CONFIG_PATH,
    entity: input.entity || input.entitySlug || input.entityId,
    label: input.label,
    sourceSystem: input.sourceSystem || input.source,
    url: input.url,
    expectedLeagueName: input.expectedLeagueName,
    sourceSeriesId: input.sourceSeriesId,
    seasonYear: input.seasonYear,
    targetAgeGroup: input.targetAgeGroup,
    notes: input.notes,
    dryRun: toBoolean(input.dryRun),
    activate: toBoolean(input.activate),
    enabled: toBoolean(input.enabled),
  });

  return {
    ok: true,
    actionKey: "register",
    artifactPath: null,
    result,
  };
}

async function runLocalOpsAction(actionKey, input = {}) {
  const action = normalizeText(actionKey).toLowerCase();

  switch (action) {
    case "probe":
      return executeProbe(input);
    case "register":
      return executeRegister(input);
    case "stage":
      return executeStage(input);
    case "run":
      return executeRun(input);
    case "compute-season":
      return executeComputeSeason(input);
    case "compute-composite":
      return executeComputeComposite(input);
    case "enrich-profiles":
      return executeProfileEnrichment(input);
    case "compute-intelligence":
      return executeComputeIntelligence(input);
    case "refresh-series":
      return executeRefreshSeries(input);
    case "refresh-match":
      return executeRefreshMatch(input);
    case "validate-series":
      return executeValidateSeries(input);
    case "publish-series":
      return executePublishSeries(input);
    default: {
      const error = new Error(`Unsupported local ops action: ${actionKey}`);
      error.statusCode = 400;
      throw error;
    }
  }
}

module.exports = {
  getLocalOpsOverview,
  runLocalOpsAction,
};

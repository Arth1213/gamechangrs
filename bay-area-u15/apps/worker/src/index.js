const path = require("path");
const { loadYamlConfig, resolveSeriesConfig, resolveSourceSystem } = require("./lib/config");
const { closePool } = require("./lib/db");
const { ensureDir, writeJsonFile } = require("./lib/fs");
const { discoverSeries } = require("./discovery/seriesDiscovery");
const { enumerateMatches } = require("./extract/matchInventory");
const { upsertDiscovery, upsertMatchInventory } = require("./load/repository");
const { processManualRefreshQueue, processSeriesOperationQueue } = require("./ops/seriesOperationRunner");
const { refreshSeries, refreshSingleMatch } = require("./ops/localRefresh");
const { publishSeries } = require("./ops/localPublish");
const { registerSeries } = require("./ops/seriesRegistry");
const { validateSeries } = require("./ops/localValidate");
const { runMatchPipeline } = require("./pipeline/runMatchPipeline");
const { runCompositeScoring } = require("./pipeline/runCompositeScoring");
const { runPlayerIntelligence } = require("./pipeline/runPlayerIntelligence");
const { runPlayerProfileEnrichment } = require("./pipeline/runPlayerProfileEnrichment");
const { runSeasonAggregation } = require("./pipeline/runSeasonAggregation");
const { probeSeries } = require("./probe/probeSeries");

function parseListArg(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (value === undefined || value === null || value === true) {
    return [];
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBooleanArg(value, fallback = false) {
  if (value === undefined || value === null || value === true) {
    return value === true ? true : fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  if (command === "help") {
    printHelp();
    return;
  }

  if (command === "probe") {
    const configPath = args.config || path.resolve(process.cwd(), "config/leagues.yaml");
    let config = null;
    let seriesConfig = null;

    if (args.series || (!args.url && args.config)) {
      config = loadYamlConfig(configPath);
      seriesConfig = resolveSeriesConfig(config, args.series);
    } else if (args.config) {
      config = loadYamlConfig(configPath);
    }

    const result = await probeSeries({
      url: args.url || seriesConfig?.series_url,
      label: args.label || seriesConfig?.label,
      sourceSystem: resolveSourceSystem(config, seriesConfig, args.source || args.sourceSystem),
      seriesConfig,
      configPath: configPath,
      outDir: args.outDir ? path.resolve(process.cwd(), args.outDir) : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "register") {
    const configPath = args.config || path.resolve(process.cwd(), "config/leagues.yaml");
    const result = await registerSeries({
      configPath,
      entity: args.entity || args.entitySlug || args.entityId,
      label: args.label,
      sourceSystem: args.source || args.sourceSystem,
      url: args.url,
      expectedLeagueName: args.expectedLeagueName,
      sourceSeriesId: args.sourceSeriesId,
      seasonYear: args.seasonYear,
      targetAgeGroup: args.targetAgeGroup,
      notes: args.notes,
      dryRun: args.dryRun === true || args["dry-run"] === true,
      activate: args.activate === true,
      enabled: args.enabled === true,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "process-queue") {
    const result = await processSeriesOperationQueue({
      requestId: args.request || args.requestId,
      seriesConfigKey: args.series || args.seriesConfigKey,
      limit: args.limit,
      outDir: args.outDir ? path.resolve(process.cwd(), args.outDir) : undefined,
    });
    const summaryPath = path.join(process.cwd(), "storage/exports", "series_operation_queue_summary.json");
    writeJsonFile(summaryPath, result);
    console.log(`Queue processing complete: ${summaryPath}`);
    return;
  }

  if (command === "process-manual-refresh-queue") {
    const result = await processManualRefreshQueue({
      requestId: args.request || args.requestId,
      seriesConfigKey: args.series || args.seriesConfigKey,
      limit: args.limit,
      outDir: args.outDir ? path.resolve(process.cwd(), args.outDir) : undefined,
    });
    const summaryPath = path.join(process.cwd(), "storage/exports", "manual_refresh_queue_summary.json");
    writeJsonFile(summaryPath, result);
    console.log(`Manual refresh queue processing complete: ${summaryPath}`);
    return;
  }

  const configPath = args.config || path.resolve(process.cwd(), "config/leagues.yaml");
  const config = loadYamlConfig(configPath);
  const series = resolveSeriesConfig(config, args.series);
  const outDir = path.resolve(process.cwd(), "storage/exports", series.slug || "series");
  ensureDir(outDir);

  if (command === "refresh-series") {
    const result = await refreshSeries({
      series,
      outDir,
      matchLimit: args.matchLimit || args["match-limit"] || args.limit,
      sourceMatchIds: parseListArg(
        args.matchIds || args["match-ids"] || args.matchId || args["match-id"] || args.sourceMatchId || args["source-match-id"]
      ),
      dbMatchId: args.dbMatchId || args["db-match-id"],
      skipPipeline: parseBooleanArg(args.skipPipeline ?? args["skip-pipeline"], false),
      headless: parseBooleanArg(args.headless, true),
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "series_refresh_summary.json"), result);
    console.log(`Series refresh complete: ${path.join(outDir, "series_refresh_summary.json")}`);
    return;
  }

  if (command === "refresh-match") {
    const result = await refreshSingleMatch({
      series,
      outDir,
      sourceMatchIds: parseListArg(
        args.matchId || args["match-id"] || args.sourceMatchId || args["source-match-id"]
      ),
      dbMatchId: args.dbMatchId || args["db-match-id"],
      skipPipeline: parseBooleanArg(args.skipPipeline ?? args["skip-pipeline"], false),
      headless: parseBooleanArg(args.headless, true),
      log: (message) => console.log(message),
    });
    const summaryFileName = result.candidates?.[0]?.sourceMatchId
      ? `match_refresh_summary_${result.candidates[0].sourceMatchId}.json`
      : "match_refresh_summary.json";
    writeJsonFile(path.join(outDir, summaryFileName), result);
    console.log(`Match refresh complete: ${path.join(outDir, summaryFileName)}`);
    return;
  }

  if (command === "validate-series") {
    const result = await validateSeries({
      series,
      configPath,
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "series_validation_summary.json"), result);
    console.log(`Series validation complete: ${path.join(outDir, "series_validation_summary.json")}`);
    return;
  }

  if (command === "publish-series") {
    const result = await publishSeries({
      series,
      configPath,
      dryRun: parseBooleanArg(args.dryRun ?? args["dry-run"], false),
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "series_publish_summary.json"), result);
    console.log(`Series publish complete: ${path.join(outDir, "series_publish_summary.json")}`);
    if (result.ok !== true) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "discover") {
    const result = await discoverSeries(series, { outDir });
    writeJsonFile(path.join(outDir, "discovery.json"), result);
    console.log(`Discovery complete: ${path.join(outDir, "discovery.json")}`);
    return;
  }

  if (command === "inventory") {
    const discovery = await discoverSeries(series, { outDir });
    const inventory = await enumerateMatches(series, discovery, { outDir });
    writeJsonFile(path.join(outDir, "match_inventory.json"), inventory);
    console.log(`Inventory complete: ${path.join(outDir, "match_inventory.json")}`);
    return;
  }

  if (command === "stage") {
    const discovery = await discoverSeries(series, { outDir });
    writeJsonFile(path.join(outDir, "discovery.json"), discovery);
    const discoveryWrite = await upsertDiscovery(discovery, {
      seriesConfigKey: series.slug,
    });

    const inventory = await enumerateMatches(series, discovery, { outDir });
    writeJsonFile(path.join(outDir, "match_inventory.json"), inventory);
    const inventoryWrite = await upsertMatchInventory(inventory, {
      seriesConfigKey: series.slug,
    });

    const summary = {
      series: series.slug,
      discoveryWrite,
      inventoryWrite,
    };
    writeJsonFile(path.join(outDir, "stage_summary.json"), summary);
    console.log(`Stage complete: ${path.join(outDir, "stage_summary.json")}`);
    return;
  }

  if (command === "run") {
    const result = await runMatchPipeline({
      series,
      outDir,
      matchLimit: args.matchLimit || args["match-limit"],
      matchIds: parseListArg(args.matchIds || args["match-ids"]),
      useStagedInventory:
        args.useStagedInventory === true || args["use-staged-inventory"] === true,
      headless: parseBooleanArg(args.headless, false),
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "run_summary.json"), result);
    console.log(`Pipeline run complete: ${path.join(outDir, "run_summary.json")}`);
    return;
  }

  if (command === "compute-season") {
    const result = await runSeasonAggregation({
      series,
      outDir,
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "season_aggregation_summary.json"), result);
    console.log(
      `Season aggregation complete: ${path.join(outDir, "season_aggregation_summary.json")}`
    );
    return;
  }

  if (command === "compute-composite") {
    const result = await runCompositeScoring({
      series,
      outDir,
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "composite_scoring_summary.json"), result);
    console.log(
      `Composite scoring complete: ${path.join(outDir, "composite_scoring_summary.json")}`
    );
    return;
  }

  if (command === "enrich-profiles") {
    const result = await runPlayerProfileEnrichment({
      series,
      outDir,
      limit: args.limit,
      playerIds: parseListArg(args.playerIds || args["player-ids"]),
      force: args.force === true,
      pauseMs: args.pauseMs || args["pause-ms"],
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "player_profile_enrichment_summary.json"), result);
    console.log(
      `Player profile enrichment complete: ${path.join(outDir, "player_profile_enrichment_summary.json")}`
    );
    return;
  }

  if (command === "compute-intelligence") {
    const result = await runPlayerIntelligence({
      series,
      outDir,
      log: (message) => console.log(message),
    });
    writeJsonFile(path.join(outDir, "player_intelligence_summary.json"), result);
    console.log(
      `Player intelligence compute complete: ${path.join(outDir, "player_intelligence_summary.json")}`
    );
    return;
  }

  printHelp();
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = value;
      continue;
    }
    out._.push(token);
  }
  return out;
}

function printHelp() {
  console.log("Local ops commands:");
  console.log("  node apps/worker/src/index.js help");
  console.log("  node apps/worker/src/index.js probe --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log('  node apps/worker/src/index.js probe --source cricclubs --url "https://cricclubs.com/..."');
  console.log('  node apps/worker/src/index.js register --source cricclubs --url "https://cricclubs.com/..." --label "Series Name" --seasonYear 2025');
  console.log("  node apps/worker/src/index.js discover --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js inventory --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js stage --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js refresh-series --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js refresh-match --config config/leagues.yaml --series bay-area-usac-hub-2026 --matchId 7574");
  console.log("  node apps/worker/src/index.js validate-series --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js publish-series --config config/leagues.yaml --series bay-area-usac-hub-2026 --dryRun");
  console.log("  node apps/worker/src/index.js run --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js run --config config/leagues.yaml --series bay-area-youth-cricket-hub-2025-milc-2025-27 --useStagedInventory --matchIds 853,852 --matchLimit 2");
  console.log("  node apps/worker/src/index.js run --config config/leagues.yaml --series bay-area-youth-cricket-hub-2025-milc-2025-27 --matchIds 853,852 --matchLimit 2");
  console.log("  node apps/worker/src/index.js compute-season --config config/leagues.yaml --series bay-area-youth-cricket-hub-2025-milc-2025-27");
  console.log("  node apps/worker/src/index.js compute-composite --config config/leagues.yaml --series bay-area-youth-cricket-hub-2025-milc-2025-27");
  console.log("  node apps/worker/src/index.js enrich-profiles --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js compute-intelligence --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js process-queue --limit 1");
  console.log("  node apps/worker/src/index.js process-manual-refresh-queue --limit 1");
  console.log("");
  console.log("Runbooks:");
  console.log("  ops_runbook_new_series.md");
  console.log("  ops_runbook_manual_refresh.md");
  console.log("  ops_runbook_compute_publish.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});

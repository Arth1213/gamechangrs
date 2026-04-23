const path = require("path");
const { loadYamlConfig, resolveSeriesConfig } = require("./lib/config");
const { ensureDir, writeJsonFile } = require("./lib/fs");
const { discoverSeries } = require("./discovery/seriesDiscovery");
const { enumerateMatches } = require("./extract/matchInventory");
const { runMatchPipeline } = require("./pipeline/runMatchPipeline");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  const configPath = args.config || path.resolve(process.cwd(), "config/leagues.yaml");
  const config = loadYamlConfig(configPath);
  const series = resolveSeriesConfig(config, args.series);

  const outDir = path.resolve(process.cwd(), "storage/exports", series.slug || "series");
  ensureDir(outDir);

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

  if (command === "run") {
    const result = await runMatchPipeline({ series, outDir });
    writeJsonFile(path.join(outDir, "run_summary.json"), result);
    console.log(`Pipeline run complete: ${path.join(outDir, "run_summary.json")}`);
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
  console.log("Usage:");
  console.log("  node apps/worker/src/index.js discover --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js inventory --config config/leagues.yaml --series bay-area-usac-hub-2026");
  console.log("  node apps/worker/src/index.js run --config config/leagues.yaml --series bay-area-usac-hub-2026");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

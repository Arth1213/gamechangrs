const path = require("path");
const { loadWeightsConfig } = require("../lib/config");
const { discoverSeries } = require("../discovery/seriesDiscovery");
const { enumerateMatches } = require("../extract/matchInventory");
const { fetchMatchDetail } = require("../extract/matchDetail");
const { parseScorecard } = require("../parse/scorecardParser");
const { parseCommentary } = require("../parse/commentaryParser");
const { reconcileMatch } = require("../validate/reconcile");
const { computeAdvancedMetrics } = require("../analytics/compute");
const { upsertDiscovery, upsertMatchInventory, upsertMatchFacts } = require("../load/repository");
const { writeJsonFile } = require("../lib/fs");

async function runMatchPipeline({ series, outDir }) {
  const weights = loadWeightsConfig(path.resolve(process.cwd(), "config/weights.yaml"));

  const discovery = await discoverSeries(series, { outDir });
  await upsertDiscovery(discovery);

  const inventory = await enumerateMatches(series, discovery, { outDir });
  await upsertMatchInventory(inventory);

  const limitedMatches = inventory.matches.slice(0, 3);
  const matchOutputs = [];

  for (const match of limitedMatches) {
    const raw = await fetchMatchDetail(match);
    const scorecard = parseScorecard(raw.rawScorecard);
    const commentary = parseCommentary(raw.rawCommentary);
    const reconciliation = reconcileMatch(scorecard, commentary);
    const advanced = computeAdvancedMetrics({ raw, scorecard, commentary, reconciliation }, weights);

    const matchOutput = {
      match,
      raw,
      scorecard,
      commentary,
      reconciliation,
      advanced,
    };

    await upsertMatchFacts(matchOutput);
    matchOutputs.push(matchOutput);
  }

  const summary = {
    series: series.slug,
    weightsVersion: weights.version,
    discoveredDivisionCount: discovery.divisions.length,
    inventoriedMatchCount: inventory.matches.length,
    processedMatchCount: matchOutputs.length,
  };

  writeJsonFile(path.join(outDir, "match_pipeline_debug.json"), { summary, matchOutputs });
  return summary;
}

module.exports = {
  runMatchPipeline,
};

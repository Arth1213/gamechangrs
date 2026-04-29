const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

function loadYamlConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return YAML.parse(raw);
}

function resolveSeriesConfig(config, slug) {
  const allSeries = config.series || [];
  if (!allSeries.length) {
    throw new Error("No series entries found in config.");
  }

  if (!slug) {
    return allSeries[0];
  }

  const match = allSeries.find((entry) => entry.slug === slug);
  if (!match) {
    throw new Error(`Series slug not found: ${slug}`);
  }
  return match;
}

function loadWeightsConfig(filePath = path.resolve(process.cwd(), "config/weights.yaml")) {
  const raw = fs.readFileSync(filePath, "utf8");
  return YAML.parse(raw);
}

function writeYamlConfig(filePath, payload) {
  const serialized = YAML.stringify(payload, {
    indent: 2,
    lineWidth: 0,
  });
  fs.writeFileSync(filePath, serialized, "utf8");
}

function resolveSourceSystem(config, seriesConfig, explicitValue) {
  const candidate =
    explicitValue ||
    seriesConfig?.source_system ||
    seriesConfig?.sourceSystem ||
    config?.default_source;

  if (!candidate) {
    return null;
  }

  return String(candidate).trim().toLowerCase();
}

module.exports = {
  loadYamlConfig,
  loadWeightsConfig,
  resolveSourceSystem,
  resolveSeriesConfig,
  writeYamlConfig,
};

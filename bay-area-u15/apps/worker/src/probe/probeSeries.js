const path = require("path");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { detectSourceSystemFromUrl, getSourceAdapter, normalizeSourceSystem } = require("./sourceRegistry");

function slugify(value) {
  return String(value || "probe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildProbeKey(options) {
  if (options.seriesConfig?.slug) {
    return options.seriesConfig.slug;
  }

  if (options.label) {
    return slugify(options.label);
  }

  if (options.url) {
    try {
      const parsed = new URL(options.url);
      const host = slugify(parsed.hostname);
      const tail = slugify(parsed.pathname.split("/").filter(Boolean).slice(-2).join("-"));
      return [host, tail || "series"].filter(Boolean).join("-");
    } catch (_) {
      return "series";
    }
  }

  return "series";
}

function buildUnknownSourceResult(sourceSystem, url, label) {
  const sourceLabel = sourceSystem || "unknown";
  return {
    adapter: {
      key: sourceLabel,
      label: sourceLabel,
      supported: false,
      detectionMethod: "explicit-or-hostname",
      variantKey: "unclassified",
    },
    sourceContext: {
      url,
    },
    capabilities: {
      scorecards: {
        status: "unknown",
        notes: ["Source family could not be classified from the supplied URL."],
      },
      ballByBall: {
        status: "unknown",
        notes: ["Source family could not be classified from the supplied URL."],
      },
      playerProfiles: {
        status: "unknown",
        notes: ["Source family could not be classified from the supplied URL."],
      },
      standings: {
        status: "unknown",
        notes: ["Source family could not be classified from the supplied URL."],
      },
      divisions: {
        status: "unknown",
        notes: ["Source family could not be classified from the supplied URL."],
      },
      executiveReport: {
        status: "blocked",
        notes: ["Do not onboard this series until the source family is identified."],
      },
      intelligenceReport: {
        status: "blocked",
        notes: ["Do not onboard this series until the source family is identified."],
      },
    },
    requiredOperatorInputs: [
      "Pass --source explicitly for custom-domain or unsupported source URLs.",
      `Confirm what source family ${label || "this series"} belongs to before extraction.`,
    ],
    warnings: [
      "This first local-ops slice only auto-detects common public hostnames for CricClubs, CricHeroes, ESPNcricinfo, and Cricbuzz.",
    ],
    recommendedNextActions: [
      "Retry the probe with an explicit --source value.",
      "If the series belongs to a new source family, stop before extraction and define a new adapter.",
    ],
  };
}

async function probeSeries(options = {}) {
  if (!options.url) {
    throw new Error("Probe requires --url or a configured --series with a series_url.");
  }

  const explicitSourceSystem = normalizeSourceSystem(options.sourceSystem);
  const detectedSourceSystem = explicitSourceSystem || detectSourceSystemFromUrl(options.url);
  const adapter = getSourceAdapter(detectedSourceSystem);
  const probeKey = buildProbeKey(options);
  const outDir =
    options.outDir ||
    path.resolve(process.cwd(), "storage/exports", "probes", `${probeKey}-${Date.now()}`);

  ensureDir(outDir);

  const result = adapter
    ? await adapter.probe({
        ...options,
        sourceSystem: detectedSourceSystem,
        outDir,
      })
    : buildUnknownSourceResult(detectedSourceSystem, options.url, options.label);

  const finalResult = {
    generatedAt: new Date().toISOString(),
    input: {
      url: options.url,
      label: options.label || options.seriesConfig?.label || null,
      sourceSystem: detectedSourceSystem,
      configPath: options.configPath || null,
      configuredSeriesKey: options.seriesConfig?.slug || null,
    },
    ...result,
    artifacts: {
      ...(result.artifacts || {}),
      outDir,
      probeJsonPath: path.join(outDir, "probe.json"),
    },
  };

  writeJsonFile(finalResult.artifacts.probeJsonPath, finalResult);
  return finalResult;
}

module.exports = {
  probeSeries,
};

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
const EXPORTS_DIR = path.resolve(process.cwd(), "storage/exports");
const REGISTRY_EXPORTS_DIR = path.join(EXPORTS_DIR, "registry");

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
  return path.join(EXPORTS_DIR, seriesConfigKey, fileName);
}

function buildRegistryArtifactPath(seriesConfigKey, fileName) {
  return path.join(REGISTRY_EXPORTS_DIR, seriesConfigKey, fileName);
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

function readGlobalArtifactSummary(fileName, mapPayload) {
  const filePath = path.join(EXPORTS_DIR, fileName);
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

function readRegistryArtifactSummary(seriesConfigKey, fileName, mapPayload) {
  const filePath = buildRegistryArtifactPath(seriesConfigKey, fileName);
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

function readLatestRefreshArtifactSummary(seriesConfigKey) {
  const seriesDir = path.join(EXPORTS_DIR, seriesConfigKey);
  if (!fs.existsSync(seriesDir)) {
    return null;
  }

  const filePaths = fs
    .readdirSync(seriesDir)
    .filter((fileName) => fileName === "series_refresh_summary.json" || /^match_refresh_summary.*\.json$/i.test(fileName))
    .map((fileName) => path.join(seriesDir, fileName));

  if (!filePaths.length) {
    return null;
  }

  const latest = filePaths
    .map((filePath) => ({
      filePath,
      stat: fs.statSync(filePath),
    }))
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0];

  const payload = readJsonIfExists(latest.filePath);

  return {
    filePath: latest.filePath,
    updatedAt: latest.stat.mtime.toISOString(),
    summary: summarizeRefresh(payload),
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
    ok: payload.ok === true,
    publishReady: payload.publishReady === true,
    generatedAt: payload.generatedAt,
    counts: payload.counts || {},
    coverage: payload.coverage
      ? {
          divisionCount: payload.coverage.divisionCount,
          matchCount: payload.coverage.matchCount,
          requiredParsedMatchCount: payload.coverage.requiredParsedMatchCount,
          parsedMatchCount: payload.coverage.parsedMatchCount,
          parsedCoveragePct: payload.coverage.parsedCoveragePct,
          seasonRowCount: payload.coverage.seasonRowCount,
          compositeRowCount: payload.coverage.compositeRowCount,
          intelligenceProfileCount: payload.coverage.intelligenceProfileCount,
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
    ok: payload.discoveryWrite?.ok === true && payload.inventoryWrite?.ok === true,
    discoveryWrite: payload.discoveryWrite || null,
    inventoryWrite: payload.inventoryWrite || null,
  };
}

function summarizeRun(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    ok: (toInteger(payload.failedMatchCount) || 0) === 0,
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

function summarizeProfileEnrichment(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  const failedCount = toInteger(payload.failedCount) || 0;

  return {
    ok: failedCount === 0,
    playerCountQueued: toInteger(payload.playerCountQueued) || 0,
    updatedCount: toInteger(payload.updatedCount) || 0,
    notFoundCount: toInteger(payload.notFoundCount) || 0,
    failedCount,
  };
}

function summarizeRefresh(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    ok: payload.discoveryWrite?.ok === true && payload.inventoryWrite?.ok === true,
    command: normalizeText(payload.command),
    candidateMatchCount: toInteger(payload.candidateMatchCount) || 0,
    selectedMatchCount: toInteger(payload.selectedMatchCount) || 0,
    skippedPipeline: payload.skippedPipeline === true,
    discoveryWrite: payload.discoveryWrite
      ? {
          discoveredDivisionCount: toInteger(payload.discoveryWrite.discoveredDivisionCount) || 0,
        }
      : null,
    inventoryWrite: payload.inventoryWrite
      ? {
          inventoriedMatchCount: toInteger(payload.inventoryWrite.inventoriedMatchCount) || 0,
          newMatchCount: toInteger(payload.inventoryWrite.newMatchCount) || 0,
          updatedMatchCount: toInteger(payload.inventoryWrite.updatedMatchCount) || 0,
          unchangedMatchCount: toInteger(payload.inventoryWrite.unchangedMatchCount) || 0,
        }
      : null,
    linkedMatch: payload.linkedMatch || payload.summary?.linkedMatch || payload.candidates?.[0] || null,
  };
}

function summarizeRegistration(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  const registration = payload.registration || payload;
  const series = registration.series || {};
  const entity = registration.entity || {};

  return {
    message: normalizeText(registration.message || payload.message || "Series registered locally."),
    configKey: normalizeText(series.configKey),
    seriesId: toInteger(series.seriesId),
    seriesName: normalizeText(series.seriesName),
    seasonYear: toInteger(series.seasonYear),
    sourceSystem: normalizeText(series.sourceSystem),
    sourceSeriesId: normalizeText(series.sourceSeriesId),
    entityName: normalizeText(entity.displayName),
    entitySlug: normalizeText(entity.slug),
    isActive: series.isActive === true,
  };
}

function summarizeQueue(payload) {
  if (!payload || payload.readError) {
    return payload;
  }

  return {
    processedCount: toInteger(payload.processedCount) || 0,
    requests: Array.isArray(payload.requestResults)
      ? payload.requestResults.slice(0, 4).map((entry) => ({
          requestId: normalizeText(entry.requestId),
          requestStatus: normalizeText(entry.requestStatus),
          operationKey: normalizeText(entry.operationKey),
          seriesConfigKey: normalizeText(entry.summary?.seriesConfigKey),
          resultSummary: normalizeText(entry.resultSummary),
          workerRef: normalizeText(entry.workerRef),
        }))
      : [],
  };
}

function toTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function artifactTimestamp(artifact) {
  return toTimestamp(artifact?.updatedAt);
}

function isArtifactFresh(artifact, dependency) {
  const artifactTime = artifactTimestamp(artifact);
  const dependencyTime = artifactTimestamp(dependency);
  return artifactTime > 0 && (dependencyTime === 0 || artifactTime >= dependencyTime);
}

function countStatus(steps, status) {
  return steps.filter((step) => step.status === status).length;
}

function createInferredArtifact(updatedAt, summary) {
  if (!updatedAt) {
    return null;
  }

  return {
    updatedAt,
    summary: {
      ...summary,
      inferred: true,
    },
  };
}

function firstTimestamp(...values) {
  return values.find((value) => normalizeText(value)) || "";
}

function buildActionCommand(actionKey, seriesConfigKey, options = {}) {
  const series = normalizeText(seriesConfigKey);
  if (!series) {
    return "";
  }

  switch (actionKey) {
    case "stage":
      return `npm run ops:stage -- --series ${series}`;
    case "run":
      return `npm run worker:run:series -- --series ${series}`;
    case "refresh-series":
      return `npm run ops:refresh:series -- --series ${series}`;
    case "refresh-match":
      return `npm run ops:refresh:match -- --series ${series} --matchId <source-match-id>`;
    case "compute-season":
      return `npm run worker:compute:series -- --series ${series}`;
    case "compute-composite":
      return `npm run worker:score:series -- --series ${series}`;
    case "enrich-profiles":
      return `npm run worker:profiles:series -- --series ${series}`;
    case "compute-intelligence":
      return `npm run worker:intelligence:series -- --series ${series}`;
    case "validate-series":
      return `npm run ops:validate:series -- --series ${series}`;
    case "publish-series":
      return options.dryRun === false
        ? `npm run ops:publish:series -- --series ${series}`
        : `npm run ops:publish:series -- --series ${series} --dryRun`;
    default:
      return "";
  }
}

function buildWorkflowStep({
  key,
  label,
  action,
  artifact,
  dependency,
  optional = false,
  fallbackStatus = "pending",
  pendingSummary = "Not run yet.",
  completeSummary = "Completed.",
  staleSummary,
  blockedReason = "",
  payloadOverrides = null,
}) {
  let status = fallbackStatus;
  let summary = pendingSummary;

  if (blockedReason) {
    status = "blocked";
    summary = blockedReason;
  } else if (artifact) {
    status = "complete";
    summary = completeSummary;

    if (dependency && artifactTimestamp(dependency) > 0 && !isArtifactFresh(artifact, dependency)) {
      status = "stale";
      summary = staleSummary || `Needs rerun after ${normalizeText(dependency?.label || "the previous step").toLowerCase()}.`;
    }
  }

  return {
    key,
    label,
    action,
    optional,
    status,
    summary,
    updatedAt: artifact?.updatedAt || null,
    command: action ? buildActionCommand(action, artifact?.seriesConfigKey || null, payloadOverrides || undefined) : "",
    payloadOverrides: payloadOverrides || null,
  };
}

function summarizeStageStep(artifact) {
  const summary = artifact?.summary;
  const divisionCount = toInteger(summary?.discoveryWrite?.discoveredDivisionCount) || 0;
  const matchCount = toInteger(summary?.inventoryWrite?.inventoriedMatchCount) || 0;
  if (summary?.inferred) {
    return `Validation confirms ${divisionCount} divisions or groups and ${matchCount} tracked matches are already staged.`;
  }
  return `${divisionCount} divisions or groups discovered. ${matchCount} matches inventoried.`;
}

function summarizeRunStep(artifact) {
  const summary = artifact?.summary;
  const attempted = toInteger(summary?.attemptedMatchCount) || 0;
  const processed = toInteger(summary?.processedMatchCount) || 0;
  const failed = toInteger(summary?.failedMatchCount) || 0;
  if (summary?.inferred) {
    return `Validation confirms parsed coverage for ${processed} of ${attempted} tracked matches.`;
  }
  return `${processed} of ${attempted} attempted matches processed. ${failed} failed.`;
}

function summarizeSeasonStep(artifact) {
  const rowCount = toInteger(artifact?.summary?.playerSeasonAdvancedRowCount) || 0;
  if (artifact?.summary?.inferred) {
    return `Validation confirms ${rowCount} season rows are available.`;
  }
  return `${rowCount} season rows generated.`;
}

function summarizeCompositeStep(artifact) {
  const rowCount = toInteger(artifact?.summary?.playerCompositeScoreRowCount) || 0;
  if (artifact?.summary?.inferred) {
    return `Validation confirms ${rowCount} composite rows are available.`;
  }
  return `${rowCount} composite score rows generated.`;
}

function summarizeProfileStep(artifact) {
  const summary = artifact?.summary;
  const updatedCount = toInteger(summary?.updatedCount) || 0;
  const queuedCount = toInteger(summary?.playerCountQueued) || 0;
  return `${updatedCount} of ${queuedCount} queued player profiles enriched.`;
}

function summarizeIntelligenceStep(artifact) {
  const rowCount = toInteger(artifact?.summary?.profileRowCount) || 0;
  if (artifact?.summary?.inferred) {
    return `Validation confirms ${rowCount} player intelligence profiles are available.`;
  }
  return `${rowCount} player intelligence profiles generated.`;
}

function summarizeValidationStep(artifact) {
  const summary = artifact?.summary;
  const failCount = toInteger(summary?.counts?.fail) || 0;
  const warnCount = toInteger(summary?.counts?.warn) || 0;
  if (summary?.publishReady) {
    return `Publish ready. ${warnCount} warning checks remain informational only.`;
  }
  return `Validation has ${failCount} blocking checks and ${warnCount} warnings.`;
}

function summarizePublishStep(artifact) {
  const summary = artifact?.summary;
  if (!summary) {
    return "Not published yet.";
  }
  return summary.dryRun ? "Publish dry run passed." : "Live publish applied.";
}

function summarizeRefreshStep(artifact) {
  const summary = artifact?.summary;
  const inventoryMatchCount = toInteger(summary?.inventoryWrite?.inventoriedMatchCount) || 0;
  const selectedMatchCount = toInteger(summary?.selectedMatchCount) || 0;
  const newMatchCount = toInteger(summary?.inventoryWrite?.newMatchCount) || 0;
  const updatedMatchCount = toInteger(summary?.inventoryWrite?.updatedMatchCount) || 0;
  return `${inventoryMatchCount} matches checked. ${selectedMatchCount} selected. ${newMatchCount} new and ${updatedMatchCount} updated.`;
}

function buildOnboardingWorkflow(entry) {
  const validation = entry?.artifacts?.validation || null;
  const validationCoverage = validation?.summary?.coverage || null;
  const intelligenceActual = entry?.artifacts?.intelligence || null;
  const profiles = entry?.artifacts?.profiles || null;
  const compositeActual = entry?.artifacts?.composite || null;
  const seasonActual = entry?.artifacts?.season || null;
  const runActual = entry?.artifacts?.run || null;
  const stageActual = entry?.artifacts?.stage || null;
  const inferredComputeTimestamp = firstTimestamp(
    intelligenceActual?.updatedAt,
    profiles?.updatedAt,
    compositeActual?.updatedAt,
    seasonActual?.updatedAt,
    validation?.updatedAt
  );
  const inferredRunTimestamp = firstTimestamp(
    runActual?.updatedAt,
    seasonActual?.updatedAt,
    compositeActual?.updatedAt,
    intelligenceActual?.updatedAt,
    validation?.updatedAt
  );
  const stage = stageActual || createInferredArtifact(firstTimestamp(stageActual?.updatedAt, inferredRunTimestamp), {
    discoveryWrite: {
      discoveredDivisionCount: toInteger(validationCoverage?.divisionCount) || 0,
    },
    inventoryWrite: {
      inventoriedMatchCount: toInteger(validationCoverage?.matchCount) || 0,
    },
  });
  const run = runActual || createInferredArtifact(inferredRunTimestamp, {
    attemptedMatchCount: toInteger(validationCoverage?.requiredParsedMatchCount ?? validationCoverage?.matchCount) || 0,
    processedMatchCount: toInteger(validationCoverage?.parsedMatchCount) || 0,
    failedMatchCount: 0,
  });
  const season = seasonActual || createInferredArtifact(firstTimestamp(seasonActual?.updatedAt, inferredComputeTimestamp), {
    playerSeasonAdvancedRowCount: toInteger(validationCoverage?.seasonRowCount) || 0,
  });
  const composite = compositeActual || createInferredArtifact(firstTimestamp(compositeActual?.updatedAt, intelligenceActual?.updatedAt, inferredComputeTimestamp), {
    playerCompositeScoreRowCount: toInteger(validationCoverage?.compositeRowCount) || 0,
  });
  const intelligence = intelligenceActual || createInferredArtifact(validation?.updatedAt, {
    profileRowCount: toInteger(validationCoverage?.intelligenceProfileCount) || 0,
  });
  const publish = entry?.artifacts?.publish || null;
  const publishLiveArtifact = publish?.summary?.dryRun === false ? publish : null;

  const steps = [
    {
      key: "stage",
      label: "Stage discovery + inventory",
      action: "stage",
      status: stage ? "complete" : "pending",
      summary: stage ? summarizeStageStep(stage) : "Discovery and inventory have not been staged yet.",
      updatedAt: stage?.updatedAt || null,
      command: buildActionCommand("stage", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "run",
      label: "Run initial ingest",
      action: "run",
      status: !run ? "pending" : !isArtifactFresh(run, stage) ? "stale" : "complete",
      summary: !run
        ? "Match fact ingest has not been run yet."
        : !isArtifactFresh(run, stage)
          ? "Stage changed after the last ingest run. Re-run ingest."
          : summarizeRunStep(run),
      updatedAt: run?.updatedAt || null,
      command: buildActionCommand("run", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "compute-season",
      label: "Compute season aggregation",
      action: "compute-season",
      status: !season ? "pending" : !isArtifactFresh(season, run) ? "stale" : "complete",
      summary: !season
        ? "Season aggregation has not been built yet."
        : !isArtifactFresh(season, run)
          ? "Ingest is newer than season aggregation. Recompute season rows."
          : summarizeSeasonStep(season),
      updatedAt: season?.updatedAt || null,
      command: buildActionCommand("compute-season", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "compute-composite",
      label: "Compute composite scoring",
      action: "compute-composite",
      status: !composite ? "pending" : !isArtifactFresh(composite, season) ? "stale" : "complete",
      summary: !composite
        ? "Composite scoring has not been built yet."
        : !isArtifactFresh(composite, season)
          ? "Season aggregation is newer than the composite build. Recompute composite scoring."
          : summarizeCompositeStep(composite),
      updatedAt: composite?.updatedAt || null,
      command: buildActionCommand("compute-composite", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "enrich-profiles",
      label: "Enrich player profiles",
      action: "enrich-profiles",
      optional: true,
      status: !profiles ? "pending" : !isArtifactFresh(profiles, season) ? "stale" : "complete",
      summary: !profiles
        ? "Optional profile enrichment has not been run yet."
        : !isArtifactFresh(profiles, season)
          ? "Season aggregation is newer than profile enrichment. Refresh player profile enrichment."
          : summarizeProfileStep(profiles),
      updatedAt: profiles?.updatedAt || null,
      command: buildActionCommand("enrich-profiles", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "compute-intelligence",
      label: "Compute player intelligence",
      action: "compute-intelligence",
      status: !intelligence ? "pending" : !isArtifactFresh(intelligence, composite) ? "stale" : "complete",
      summary: !intelligence
        ? "Player intelligence has not been built yet."
        : !isArtifactFresh(intelligence, composite)
          ? "Composite scoring is newer than player intelligence. Recompute intelligence."
          : summarizeIntelligenceStep(intelligence),
      updatedAt: intelligence?.updatedAt || null,
      command: buildActionCommand("compute-intelligence", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "validate-series",
      label: "Validate publish readiness",
      action: "validate-series",
      status: !validation
        ? "pending"
        : !isArtifactFresh(validation, intelligence)
          ? "stale"
          : validation.summary?.publishReady === true
            ? "complete"
            : "blocked",
      summary: !validation
        ? "Validation has not been run yet."
        : !isArtifactFresh(validation, intelligence)
          ? "Player intelligence changed after validation. Re-run validation."
          : summarizeValidationStep(validation),
      updatedAt: validation?.updatedAt || null,
      command: buildActionCommand("validate-series", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "publish-series",
      label: "Publish live dataset",
      action: "publish-series",
      status: !publishLiveArtifact
        ? entry.enabled && validation?.summary?.publishReady === true
          ? "stale"
          : "pending"
        : !isArtifactFresh(publishLiveArtifact, validation)
          ? "stale"
          : "complete",
      summary: !publishLiveArtifact
        ? entry.enabled
          ? "A newer validation exists than the last live publish. Publish again to apply the latest validated data."
          : "Live publish has not been applied yet."
        : !isArtifactFresh(publishLiveArtifact, validation)
          ? "Validation is newer than the last live publish. Publish again."
          : summarizePublishStep(publishLiveArtifact),
      updatedAt: publishLiveArtifact?.updatedAt || null,
      command: buildActionCommand("publish-series", entry.slug, { dryRun: false }),
      payloadOverrides: { dryRun: false },
    },
  ];

  const requiredSteps = steps.filter((step) => step.optional !== true);

  return {
    label: "New Series Onboarding",
    status:
      countStatus(requiredSteps, "blocked") > 0
        ? "blocked"
        : countStatus(requiredSteps, "stale") > 0 || countStatus(requiredSteps, "pending") > 0
          ? "in_progress"
          : "complete",
    steps,
  };
}

function buildRefreshWorkflow(entry) {
  const refresh = entry?.artifacts?.refresh || null;
  const validation = entry?.artifacts?.validation || null;
  const validationCoverage = validation?.summary?.coverage || null;
  const refreshValidated = refresh && validation && artifactTimestamp(validation) >= artifactTimestamp(refresh);
  const intelligenceActual = entry?.artifacts?.intelligence || null;
  const compositeActual = entry?.artifacts?.composite || null;
  const seasonActual = entry?.artifacts?.season || null;
  const refreshEvidenceTimestamp = firstTimestamp(
    validation?.updatedAt,
    intelligenceActual?.updatedAt,
    compositeActual?.updatedAt,
    seasonActual?.updatedAt,
    refresh?.updatedAt
  );
  const season = seasonActual || (refreshValidated ? createInferredArtifact(refreshEvidenceTimestamp, {
    playerSeasonAdvancedRowCount: toInteger(validationCoverage?.seasonRowCount) || 0,
  }) : null);
  const composite = compositeActual || (refreshValidated ? createInferredArtifact(firstTimestamp(refreshEvidenceTimestamp, compositeActual?.updatedAt, intelligenceActual?.updatedAt), {
    playerCompositeScoreRowCount: toInteger(validationCoverage?.compositeRowCount) || 0,
  }) : null);
  const intelligence = refreshValidated && validation && artifactTimestamp(validation) >= artifactTimestamp(intelligenceActual)
    ? createInferredArtifact(validation?.updatedAt, {
        profileRowCount: toInteger(validationCoverage?.intelligenceProfileCount) || 0,
      })
    : intelligenceActual || (refreshValidated ? createInferredArtifact(validation?.updatedAt, {
        profileRowCount: toInteger(validationCoverage?.intelligenceProfileCount) || 0,
      }) : null);
  const publish = entry?.artifacts?.publish || null;
  const publishLiveArtifact = publish?.summary?.dryRun === false ? publish : null;
  const refreshReference = refresh || publishLiveArtifact || validation || intelligence || composite || season || null;

  const steps = [
    {
      key: "refresh-series",
      label: "Refresh series or match",
      action: "refresh-series",
      status: refresh ? "complete" : entry.enabled ? "standby" : "pending",
      summary: refresh
        ? summarizeRefreshStep(refresh)
        : entry.enabled
          ? "Run refresh only when new matches land or a manual refresh request needs to be processed."
          : "Refresh tracking starts after the series is live.",
      updatedAt: refresh?.updatedAt || null,
      command: buildActionCommand("refresh-series", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "compute-season",
      label: "Recompute season aggregation",
      action: "compute-season",
      status: !refresh
        ? "standby"
        : !season
          ? "pending"
          : !isArtifactFresh(season, refresh)
            ? "stale"
            : "complete",
      summary: !refresh
        ? "No refresh has been run yet."
        : !season
          ? "Recompute season aggregation after refresh."
          : !isArtifactFresh(season, refresh)
            ? "Refresh is newer than season aggregation. Recompute season rows."
            : summarizeSeasonStep(season),
      updatedAt: season?.updatedAt || null,
      command: buildActionCommand("compute-season", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "compute-composite",
      label: "Recompute composite scoring",
      action: "compute-composite",
      status: !refresh
        ? "standby"
        : !composite
          ? "pending"
          : !isArtifactFresh(composite, season)
            ? "stale"
            : "complete",
      summary: !refresh
        ? "Composite recompute waits for a refresh."
        : !composite
          ? "Recompute composite scoring after the season aggregation build."
          : !isArtifactFresh(composite, season)
            ? "Season aggregation is newer than composite scoring. Recompute composite scoring."
            : summarizeCompositeStep(composite),
      updatedAt: composite?.updatedAt || null,
      command: buildActionCommand("compute-composite", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "compute-intelligence",
      label: "Recompute player intelligence",
      action: "compute-intelligence",
      status: !refresh
        ? "standby"
        : !intelligence
          ? "pending"
          : !isArtifactFresh(intelligence, composite)
            ? "stale"
            : "complete",
      summary: !refresh
        ? "Intelligence recompute waits for a refresh."
        : !intelligence
          ? "Recompute player intelligence after composite scoring."
          : !isArtifactFresh(intelligence, composite)
            ? "Composite scoring is newer than intelligence. Recompute intelligence."
            : summarizeIntelligenceStep(intelligence),
      updatedAt: intelligence?.updatedAt || null,
      command: buildActionCommand("compute-intelligence", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "validate-series",
      label: "Validate refreshed state",
      action: "validate-series",
      status: !refresh
        ? "standby"
        : !validation
          ? "pending"
          : !isArtifactFresh(validation, intelligence)
            ? "stale"
            : validation.summary?.publishReady === true
              ? "complete"
              : "blocked",
      summary: !refresh
        ? "Validation runs after refresh recompute."
        : !validation
          ? "Validate the refreshed dataset before publishing."
          : !isArtifactFresh(validation, intelligence)
            ? "Player intelligence is newer than validation. Re-run validation."
            : summarizeValidationStep(validation),
      updatedAt: validation?.updatedAt || null,
      command: buildActionCommand("validate-series", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "publish-series",
      label: "Publish refreshed dataset",
      action: "publish-series",
      status: !refresh
        ? "standby"
        : !publishLiveArtifact
          ? "pending"
          : !isArtifactFresh(publishLiveArtifact, validation)
            ? "stale"
            : "complete",
      summary: !refresh
        ? "Publish runs after refresh and validation."
        : !publishLiveArtifact
          ? "Publish the refreshed dataset after validation passes."
          : !isArtifactFresh(publishLiveArtifact, validation)
            ? "Validation is newer than the last live publish. Publish again."
            : summarizePublishStep(publishLiveArtifact),
      updatedAt: publishLiveArtifact?.updatedAt || null,
      command: buildActionCommand("publish-series", entry.slug, { dryRun: false }),
      payloadOverrides: { dryRun: false },
    },
  ];

  const hasRefreshWork =
    refresh &&
    (countStatus(steps, "stale") > 0 ||
      countStatus(steps, "pending") > 0 ||
      countStatus(steps, "blocked") > 0 ||
      artifactTimestamp(refresh) > Math.max(artifactTimestamp(validation), artifactTimestamp(publishLiveArtifact)));

  return {
    label: "Existing Series Refresh",
    status: !refresh ? "standby" : hasRefreshWork ? "in_progress" : "complete",
    steps,
    refreshReference,
  };
}

function buildPublishWorkflow(entry) {
  const validation = entry?.artifacts?.validation || null;
  const publish = entry?.artifacts?.publish || null;
  const publishDryRunArtifact = publish?.summary?.dryRun === true ? publish : null;
  const publishLiveArtifact = publish?.summary?.dryRun === false ? publish : null;

  const steps = [
    {
      key: "validate-series",
      label: "Validate publish gate",
      action: "validate-series",
      status: !validation
        ? "pending"
        : validation.summary?.publishReady === true
          ? "complete"
          : "blocked",
      summary: !validation ? "Validation has not been run yet." : summarizeValidationStep(validation),
      updatedAt: validation?.updatedAt || null,
      command: buildActionCommand("validate-series", entry.slug),
      payloadOverrides: null,
    },
    {
      key: "publish-series-dry-run",
      label: "Run publish dry run",
      action: "publish-series",
      status: !validation || validation.summary?.publishReady !== true
        ? "blocked"
        : !publishDryRunArtifact && publishLiveArtifact && isArtifactFresh(publishLiveArtifact, validation)
          ? "standby"
        : !publishDryRunArtifact
          ? "pending"
          : !isArtifactFresh(publishDryRunArtifact, validation)
            ? "stale"
            : "complete",
      summary: !validation || validation.summary?.publishReady !== true
        ? "Publish dry run stays blocked until validation passes."
        : !publishDryRunArtifact && publishLiveArtifact && isArtifactFresh(publishLiveArtifact, validation)
          ? "Live publish already reflects the current validation. Run a new dry run only if you want a fresh simulation log."
        : !publishDryRunArtifact
          ? "Run a dry-run publish to confirm the publish transaction."
          : !isArtifactFresh(publishDryRunArtifact, validation)
            ? "Validation is newer than the last publish dry run. Re-run the dry run."
            : summarizePublishStep(publishDryRunArtifact),
      updatedAt: publishDryRunArtifact?.updatedAt || null,
      command: buildActionCommand("publish-series", entry.slug, { dryRun: true }),
      payloadOverrides: { dryRun: true },
    },
    {
      key: "publish-series-live",
      label: "Apply live publish",
      action: "publish-series",
      status: !validation || validation.summary?.publishReady !== true
        ? "blocked"
        : !publishLiveArtifact
          ? "pending"
          : !isArtifactFresh(publishLiveArtifact, validation)
            ? "stale"
            : "complete",
      summary: !validation || validation.summary?.publishReady !== true
        ? "Live publish stays blocked until validation passes."
        : !publishLiveArtifact
          ? "Run the live publish after the dry run looks correct."
          : !isArtifactFresh(publishLiveArtifact, validation)
            ? "Validation is newer than the last live publish. Publish again."
            : summarizePublishStep(publishLiveArtifact),
      updatedAt: publishLiveArtifact?.updatedAt || null,
      command: buildActionCommand("publish-series", entry.slug, { dryRun: false }),
      payloadOverrides: { dryRun: false },
    },
  ];

  const liveIsCurrent = validation?.summary?.publishReady === true && publishLiveArtifact && isArtifactFresh(publishLiveArtifact, validation);

  return {
    label: "Validate And Publish",
    status: liveIsCurrent
      ? "complete"
      :
      countStatus(steps, "blocked") > 0
        ? "blocked"
        : countStatus(steps, "stale") > 0 || countStatus(steps, "pending") > 0
          ? "in_progress"
          : "complete",
    steps,
  };
}

function pickNextRecommendedAction(entry, workflows) {
  const { onboarding, refresh, publish } = workflows;
  const validation = entry?.artifacts?.validation || null;
  const publishArtifact = entry?.artifacts?.publish || null;
  const publishLiveArtifact = publishArtifact?.summary?.dryRun === false ? publishArtifact : null;

  if (!entry.enabled) {
    const onboardingStep = onboarding.steps.find((step) => !step.optional && (step.status === "pending" || step.status === "stale"));
    if (onboardingStep) {
      return {
        action: onboardingStep.action,
        label: onboardingStep.label,
        reason: onboardingStep.summary,
        command: onboardingStep.command,
        payloadOverrides: onboardingStep.payloadOverrides || null,
      };
    }

    if (validation?.summary?.publishReady !== true) {
      return null;
    }

    const publishDryRunStep = publish.steps.find((step) => step.key === "publish-series-dry-run");
    if (publishDryRunStep && (publishDryRunStep.status === "pending" || publishDryRunStep.status === "stale")) {
      return {
        action: publishDryRunStep.action,
        label: publishDryRunStep.label,
        reason: publishDryRunStep.summary,
        command: publishDryRunStep.command,
        payloadOverrides: publishDryRunStep.payloadOverrides || null,
      };
    }

    const publishLiveStep = publish.steps.find((step) => step.key === "publish-series-live");
    if (publishLiveStep && (publishLiveStep.status === "pending" || publishLiveStep.status === "stale")) {
      return {
        action: publishLiveStep.action,
        label: publishLiveStep.label,
        reason: publishLiveStep.summary,
        command: publishLiveStep.command,
        payloadOverrides: publishLiveStep.payloadOverrides || null,
      };
    }

    return null;
  }

  const onboardingFollowUp = onboarding.steps.find(
    (step) => step.optional !== true && (step.status === "stale" || step.status === "pending" || step.status === "blocked")
  );
  if (onboardingFollowUp) {
    return {
      action: onboardingFollowUp.action,
      label: onboardingFollowUp.label,
      reason: onboardingFollowUp.summary,
      command: onboardingFollowUp.command,
      payloadOverrides: onboardingFollowUp.payloadOverrides || null,
    };
  }

  const refreshStep = refresh.steps.find((step) => step.key === "refresh-series");
  const refreshTime = artifactTimestamp(entry?.artifacts?.refresh);
  const validationTime = artifactTimestamp(validation);
  const publishTime = artifactTimestamp(publishLiveArtifact);
  const refreshNeedsFollowUp =
    refreshTime > 0 && refreshTime > Math.max(validationTime, publishTime);

  if (refreshNeedsFollowUp) {
    const followUpStep = refresh.steps.find((step) => step.key !== "refresh-series" && (step.status === "pending" || step.status === "stale" || step.status === "blocked"));
    if (followUpStep) {
      return {
        action: followUpStep.action,
        label: followUpStep.label,
        reason: followUpStep.summary,
        command: followUpStep.command,
        payloadOverrides: followUpStep.payloadOverrides || null,
      };
    }
  }

  if (validation && validation.summary?.publishReady === true && (!publishLiveArtifact || !isArtifactFresh(publishLiveArtifact, validation))) {
    const publishLiveStep = publish.steps.find((step) => step.key === "publish-series-live");
    if (publishLiveStep) {
      return {
        action: publishLiveStep.action,
        label: publishLiveStep.label,
        reason: publishLiveStep.summary,
        command: publishLiveStep.command,
        payloadOverrides: publishLiveStep.payloadOverrides || null,
      };
    }
  }

  if (!validation || validation.summary?.publishReady !== true) {
    const validationStep = publish.steps.find((step) => step.key === "validate-series");
    if (validationStep) {
      return {
        action: validationStep.action,
        label: validationStep.label,
        reason: validationStep.summary,
        command: validationStep.command,
        payloadOverrides: validationStep.payloadOverrides || null,
      };
    }
  }

  if (refreshStep) {
    return {
      action: refreshStep.action,
      label: refreshStep.label,
      reason: "No follow-up work is pending. Run refresh when new matches land.",
      command: refreshStep.command,
      payloadOverrides: refreshStep.payloadOverrides || null,
      standby: true,
    };
  }

  return null;
}

function buildSeriesWorkflow(entry) {
  const onboarding = buildOnboardingWorkflow(entry);
  const refresh = buildRefreshWorkflow(entry);
  const publish = buildPublishWorkflow(entry);
  const nextRecommendedAction = pickNextRecommendedAction(entry, { onboarding, refresh, publish });

  let headline = entry.enabled ? "Live series is current." : "Series is still local-only.";
  let note = entry.enabled
    ? "Use refresh when new matches land, then recompute and publish the updated dataset."
    : "Finish onboarding, validate the dataset, then publish when you are ready to expose it to the hosted app.";

  if (nextRecommendedAction && nextRecommendedAction.standby !== true) {
    headline = `Next: ${nextRecommendedAction.label}`;
    note = nextRecommendedAction.reason;
  } else if (!entry.enabled && onboarding.status === "complete" && publish.status === "complete") {
    headline = "Series is ready to go live.";
    note = "The local onboarding chain is complete and the next step is a live publish.";
  } else if (refresh.status === "in_progress") {
    headline = "Refresh follow-up is pending.";
    note = "A refresh ran after the last publish or validation. Finish recompute and publish before treating the dataset as current.";
  }

  return {
    headline,
    note,
    nextRecommendedAction,
    onboarding,
    refresh,
    publish,
    terminalCommands: {
      onboarding: onboarding.steps.map((step) => step.command).filter(Boolean),
      refresh: refresh.steps.map((step) => step.command).filter(Boolean),
      publish: publish.steps.map((step) => step.command).filter(Boolean),
    },
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
      registration: readRegistryArtifactSummary(seriesConfigKey, "registration.json", summarizeRegistration),
      stage: readArtifactSummary(seriesConfigKey, "stage_summary.json", summarizeStage),
      run: readArtifactSummary(seriesConfigKey, "run_summary.json", summarizeRun),
      refresh: readLatestRefreshArtifactSummary(seriesConfigKey),
      validation: readArtifactSummary(seriesConfigKey, "series_validation_summary.json", summarizeValidation),
      publish: readArtifactSummary(seriesConfigKey, "series_publish_summary.json", summarizePublish),
      season: readArtifactSummary(seriesConfigKey, "season_aggregation_summary.json", (payload) =>
        summarizeCompute(payload, "playerSeasonAdvancedRowCount")
      ),
      composite: readArtifactSummary(seriesConfigKey, "composite_scoring_summary.json", (payload) =>
        summarizeCompute(payload, "playerCompositeScoreRowCount")
      ),
      profiles: readArtifactSummary(seriesConfigKey, "player_profile_enrichment_summary.json", summarizeProfileEnrichment),
      intelligence: readArtifactSummary(seriesConfigKey, "player_intelligence_summary.json", (payload) =>
        summarizeCompute(payload, "profileRowCount")
      ),
    },
  };
}

async function getLocalOpsOverview() {
  const config = loadYamlConfig(CONFIG_PATH);
  const seriesEntries = Array.isArray(config?.series) ? config.series : [];
  const series = seriesEntries
    .map(buildSeriesOverviewEntry)
    .sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.label.localeCompare(right.label))
    .map((entry) => ({
      ...entry,
      workflow: buildSeriesWorkflow(entry),
    }));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    configPath: CONFIG_PATH,
    seriesCount: seriesEntries.length,
    series,
    queues: {
      seriesOperations: readGlobalArtifactSummary("series_operation_queue_summary.json", summarizeQueue),
      manualRefresh: readGlobalArtifactSummary("manual_refresh_queue_summary.json", summarizeQueue),
    },
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

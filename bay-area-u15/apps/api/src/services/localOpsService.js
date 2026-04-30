"use strict";

const { spawn } = require("child_process");
const crypto = require("crypto");
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
const LOCAL_OPS_DIR = path.join(EXPORTS_DIR, "_local_ops");
const LOCAL_OPS_SERIES_DIR = path.join(LOCAL_OPS_DIR, "series");
const LOCAL_OPS_GLOBAL_RUN_PATH = path.join(LOCAL_OPS_DIR, "latest_run.json");
const LOCAL_OPS_ACTIVE_RUN_TTL_MS = 30 * 60 * 1000;
const LOCAL_OPS_LOG_TAIL_LIMIT = 16;
const LOCAL_OPS_RUN_HISTORY_LIMIT = 8;
const LOCAL_OPS_BACKGROUND_CONCURRENCY = 1;
const BACKGROUND_ACTIONS = new Set([
  "stage",
  "run",
  "compute-season",
  "compute-composite",
  "enrich-profiles",
  "compute-intelligence",
  "refresh-series",
  "refresh-match",
  "validate-series",
  "publish-series",
  "workflow-onboarding",
  "workflow-refresh",
  "workflow-publish",
]);
const WORKFLOW_ACTIONS = new Set([
  "workflow-onboarding",
  "workflow-refresh",
  "workflow-publish",
]);

const backgroundRunQueue = [];
const activeBackgroundRuns = new Map();

function buildActionLabel(actionKey) {
  switch (normalizeText(actionKey).toLowerCase()) {
    case "probe":
      return "Probe Source";
    case "register":
      return "Register Series";
    case "stage":
      return "Stage Discovery + Inventory";
    case "run":
      return "Run Initial Ingest";
    case "compute-season":
      return "Compute Season Aggregation";
    case "compute-composite":
      return "Compute Composite Scoring";
    case "enrich-profiles":
      return "Enrich Player Profiles";
    case "compute-intelligence":
      return "Compute Player Intelligence";
    case "refresh-series":
      return "Refresh Series";
    case "refresh-match":
      return "Refresh Match";
    case "validate-series":
      return "Validate Series";
    case "publish-series":
      return "Publish Series";
    case "workflow-onboarding":
      return "Run Onboarding Chain";
    case "workflow-refresh":
      return "Run Refresh Chain";
    case "workflow-publish":
      return "Run Validate + Publish Chain";
    default:
      return normalizeText(actionKey) || "Local Ops Action";
  }
}

function buildRetryInput(input = {}) {
  const payload = {};
  const assignText = (key, value) => {
    const normalized = normalizeText(value);
    if (normalized) {
      payload[key] = normalized;
    }
  };

  assignText("series", input.series);
  assignText("sourceSystem", input.sourceSystem || input.source);
  assignText("url", input.url);
  assignText("label", input.label);
  assignText("entity", input.entity || input.entitySlug || input.entityId);
  assignText("expectedLeagueName", input.expectedLeagueName);
  assignText("sourceSeriesId", input.sourceSeriesId);
  assignText("seasonYear", input.seasonYear);
  assignText("targetAgeGroup", input.targetAgeGroup);
  assignText("notes", input.notes);
  assignText("matchId", input.matchId);
  assignText("matchIds", Array.isArray(input.matchIds) ? input.matchIds.join(",") : input.matchIds);
  assignText("dbMatchId", input.dbMatchId);
  assignText("matchLimit", input.matchLimit);
  assignText("playerIds", Array.isArray(input.playerIds) ? input.playerIds.join(",") : input.playerIds);
  assignText("limit", input.limit);
  assignText("pauseMs", input.pauseMs);

  ["headless", "skipPipeline", "useStagedInventory", "force", "dryRun", "activate", "enabled"].forEach((key) => {
    if (typeof input[key] === "boolean") {
      payload[key] = input[key];
    }
  });

  return payload;
}

function summarizeActionInput(actionKey, input = {}) {
  const summary = {};
  const assign = (key, value) => {
    const normalized = typeof value === "boolean" ? value : normalizeText(value);
    if (normalized === "" || normalized === null || normalized === undefined) {
      return;
    }
    summary[key] = normalized;
  };

  assign("series", input.series);
  assign("sourceSystem", input.sourceSystem || input.source);
  assign("url", input.url);
  assign("label", input.label);
  assign("entity", input.entity || input.entitySlug || input.entityId);
  assign("seasonYear", input.seasonYear);
  assign("targetAgeGroup", input.targetAgeGroup);
  assign("matchId", input.matchId);
  assign("matchIds", Array.isArray(input.matchIds) ? input.matchIds.join(",") : input.matchIds);
  assign("dbMatchId", input.dbMatchId);
  assign("matchLimit", input.matchLimit);
  assign("playerIds", Array.isArray(input.playerIds) ? input.playerIds.join(",") : input.playerIds);
  assign("limit", input.limit);
  assign("pauseMs", input.pauseMs);

  if (input.headless === true) {
    summary.headless = true;
  }
  if (input.skipPipeline === true) {
    summary.skipPipeline = true;
  }
  if (input.useStagedInventory === true) {
    summary.useStagedInventory = true;
  }
  if (input.force === true) {
    summary.force = true;
  }
  if (input.dryRun === true) {
    summary.dryRun = true;
  }

  summary.action = buildActionLabel(actionKey);
  return summary;
}

function buildLocalOpsRunPaths(seriesConfigKey, runId) {
  const seriesSlug = normalizeText(seriesConfigKey);
  const baseDir = seriesSlug
    ? path.join(LOCAL_OPS_SERIES_DIR, seriesSlug)
    : path.join(LOCAL_OPS_DIR, "global");
  const runDir = path.join(baseDir, "runs", runId);

  return {
    runDir,
    statusPath: path.join(runDir, "status.json"),
    logPath: path.join(runDir, "output.log"),
    latestPath: path.join(baseDir, "latest_run.json"),
  };
}

function readTailLines(filePath, limit = LOCAL_OPS_LOG_TAIL_LIMIT) {
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  try {
    const text = fs.readFileSync(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .slice(-Math.max(1, limit));
  } catch (error) {
    return [`Unable to read log output: ${normalizeText(error.message) || "unknown error"}`];
  }
}

function latestEntryArtifactTimestamp(entry) {
  const artifacts = entry && entry.artifacts ? Object.values(entry.artifacts) : [];
  return artifacts.reduce((maxValue, artifact) => Math.max(maxValue, artifactTimestamp(artifact)), 0);
}

function deriveLatestRunStatus(run, entry = null) {
  if (!run || run.readError) {
    return run;
  }

  const referenceTimestamp = latestEntryArtifactTimestamp(entry);
  const createdAtTimestamp = toTimestamp(run.createdAt || run.startedAt);
  const startedAtTimestamp = toTimestamp(run.startedAt);
  let status = normalizeText(run.status).toLowerCase() || "pending";
  let note = normalizeText(run.note || run.message || run.summary || "");
  const workflowRun = isWorkflowAction(run.actionKey);

  if (status === "running") {
    if (!workflowRun && referenceTimestamp > 0 && startedAtTimestamp > 0 && referenceTimestamp >= startedAtTimestamp) {
      status = "stale";
      note = "A newer artifact landed after this run started. The previous active state has been cleared.";
    } else if (startedAtTimestamp > 0 && Date.now() - startedAtTimestamp > LOCAL_OPS_ACTIVE_RUN_TTL_MS) {
      status = "stale";
      note = "This run never reported completion and is past the active window. Treat it as stale unless you rerun it.";
    }
  } else if (status === "queued" && createdAtTimestamp > 0 && Date.now() - createdAtTimestamp > LOCAL_OPS_ACTIVE_RUN_TTL_MS) {
    status = "stale";
    note = "This queued run never started and is past the active window. Retry it if you still need the action.";
  }

  return {
    ...run,
    status,
    note,
    recentLogLines: readTailLines(run.logPath),
  };
}

function readLatestActionRun(seriesConfigKey, entry = null) {
  const latestPath = normalizeText(seriesConfigKey)
    ? path.join(LOCAL_OPS_SERIES_DIR, normalizeText(seriesConfigKey), "latest_run.json")
    : LOCAL_OPS_GLOBAL_RUN_PATH;

  const payload = readJsonIfExists(latestPath);
  if (!payload) {
    return null;
  }

  return deriveLatestRunStatus(payload, entry);
}

function readRecentActionRuns(seriesConfigKey, entry = null, limit = LOCAL_OPS_RUN_HISTORY_LIMIT) {
  const seriesSlug = normalizeText(seriesConfigKey);
  if (!seriesSlug) {
    return [];
  }

  const runsDir = path.join(LOCAL_OPS_SERIES_DIR, seriesSlug, "runs");
  if (!fs.existsSync(runsDir)) {
    return [];
  }

  return fs
    .readdirSync(runsDir)
    .map((runDirName) => path.join(runsDir, runDirName, "status.json"))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => deriveLatestRunStatus(readJsonIfExists(filePath), entry))
    .filter(Boolean)
    .sort((left, right) => toTimestamp(right?.createdAt || right?.startedAt) - toTimestamp(left?.createdAt || left?.startedAt))
    .slice(0, Math.max(1, limit))
    .map((run) => ({
      runId: run.runId,
      actionKey: run.actionKey,
      actionLabel: run.actionLabel,
      seriesConfigKey: run.seriesConfigKey,
      status: run.status,
      createdAt: run.createdAt || null,
      startedAt: run.startedAt || null,
      finishedAt: run.finishedAt || null,
      durationMs: run.durationMs,
      summary: normalizeText(run.summary || run.message),
      note: normalizeText(run.note),
      retryInput: run.retryInput || null,
      commandPreview: normalizeText(run.commandPreview),
      queuePosition: toInteger(run.queuePosition),
      pid: toInteger(run.pid),
    }));
}

function buildBackgroundQueueSummary() {
  const mapSnapshot = (item) => item.runContext.getSnapshot();
  return {
    concurrency: LOCAL_OPS_BACKGROUND_CONCURRENCY,
    activeCount: activeBackgroundRuns.size,
    queuedCount: backgroundRunQueue.length,
    activeRuns: Array.from(activeBackgroundRuns.values()).map(mapSnapshot),
    queuedRuns: backgroundRunQueue.map(mapSnapshot),
  };
}

function isBackgroundAction(actionKey) {
  return BACKGROUND_ACTIONS.has(normalizeText(actionKey).toLowerCase());
}

function isWorkflowAction(actionKey) {
  return WORKFLOW_ACTIONS.has(normalizeText(actionKey).toLowerCase());
}

function quoteCliArg(value) {
  const text = String(value ?? "");
  return /[^A-Za-z0-9_./:=,-]/.test(text) ? JSON.stringify(text) : text;
}

function resolveWorkflowDryRun(input = {}) {
  if (input?.dryRun === undefined) {
    return true;
  }
  return toBoolean(input.dryRun);
}

function buildWorkerCliInvocation(actionKey, input = {}) {
  const action = normalizeText(actionKey).toLowerCase();
  const workerScript = path.resolve(process.cwd(), "apps/worker/src/index.js");
  const args = [workerScript, action, "--config", CONFIG_PATH];

  const pushText = (flag, value) => {
    const normalized = normalizeText(value);
    if (!normalized) {
      return;
    }
    args.push(flag, normalized);
  };

  const pushBoolean = (flag, value, includeFalse = false) => {
    if (typeof value !== "boolean") {
      return;
    }
    if (value === true || includeFalse) {
      args.push(flag, value ? "true" : "false");
    }
  };

  pushText("--series", input.series);

  switch (action) {
    case "run":
      pushText("--matchLimit", input.matchLimit);
      pushText("--matchIds", Array.isArray(input.matchIds) ? input.matchIds.join(",") : input.matchIds);
      pushBoolean("--useStagedInventory", input.useStagedInventory);
      pushBoolean("--headless", input.headless, true);
      break;
    case "compute-season":
    case "compute-composite":
    case "compute-intelligence":
    case "validate-series":
    case "stage":
      break;
    case "enrich-profiles":
      pushText("--limit", input.limit);
      pushText("--playerIds", Array.isArray(input.playerIds) ? input.playerIds.join(",") : input.playerIds);
      pushText("--pauseMs", input.pauseMs);
      pushBoolean("--force", input.force);
      break;
    case "refresh-series":
      pushText("--matchLimit", input.matchLimit);
      pushText("--matchIds", Array.isArray(input.matchIds) ? input.matchIds.join(",") : input.matchIds);
      pushText("--dbMatchId", input.dbMatchId);
      pushBoolean("--skipPipeline", input.skipPipeline);
      pushBoolean("--headless", input.headless, true);
      break;
    case "refresh-match":
      pushText("--matchId", input.matchId || input.matchIds);
      pushText("--dbMatchId", input.dbMatchId);
      pushBoolean("--skipPipeline", input.skipPipeline);
      pushBoolean("--headless", input.headless, true);
      break;
    case "publish-series":
      pushBoolean("--dryRun", input.dryRun);
      break;
    default:
      break;
  }

  const previewArgs = args.map((entry, index) => {
    if (index === 0) {
      return "apps/worker/src/index.js";
    }
    if (entry === CONFIG_PATH) {
      return "config/leagues.yaml";
    }
    return quoteCliArg(entry);
  });

  return {
    command: process.execPath,
    args,
    commandPreview: ["node", ...previewArgs].join(" "),
  };
}

function buildWorkflowCommandPreview(actionKey, input = {}) {
  const action = normalizeText(actionKey).toLowerCase();
  const seriesConfigKey = normalizeText(input.series) || "<series>";
  switch (action) {
    case "workflow-onboarding":
      return `guided-workflow onboarding --series ${seriesConfigKey}`;
    case "workflow-refresh":
      return `guided-workflow refresh --series ${seriesConfigKey}`;
    case "workflow-publish":
      return `guided-workflow publish --series ${seriesConfigKey}`;
    default:
      return `guided-workflow ${action} --series ${seriesConfigKey}`;
  }
}

function readExecutionArtifactForAction(actionKey, input = {}) {
  const action = normalizeText(actionKey).toLowerCase();
  const seriesConfigKey = normalizeText(input.series);
  if (!seriesConfigKey) {
    return null;
  }

  let artifactPath = null;

  switch (action) {
    case "stage":
      artifactPath = buildArtifactPath(seriesConfigKey, "stage_summary.json");
      break;
    case "run":
      artifactPath = buildArtifactPath(seriesConfigKey, "run_summary.json");
      break;
    case "compute-season":
      artifactPath = buildArtifactPath(seriesConfigKey, "season_aggregation_summary.json");
      break;
    case "compute-composite":
      artifactPath = buildArtifactPath(seriesConfigKey, "composite_scoring_summary.json");
      break;
    case "enrich-profiles":
      artifactPath = buildArtifactPath(seriesConfigKey, "player_profile_enrichment_summary.json");
      break;
    case "compute-intelligence":
      artifactPath = buildArtifactPath(seriesConfigKey, "player_intelligence_summary.json");
      break;
    case "refresh-series":
      artifactPath = buildArtifactPath(seriesConfigKey, "series_refresh_summary.json");
      break;
    case "refresh-match": {
      const latestRefresh = readLatestRefreshArtifactSummary(seriesConfigKey);
      artifactPath = latestRefresh?.filePath || null;
      break;
    }
    case "validate-series":
      artifactPath = buildArtifactPath(seriesConfigKey, "series_validation_summary.json");
      break;
    case "publish-series":
      artifactPath = buildArtifactPath(seriesConfigKey, "series_publish_summary.json");
      break;
    default:
      artifactPath = null;
      break;
  }

  if (!artifactPath) {
    return null;
  }

  const result = readJsonIfExists(artifactPath);
  if (!result || result.readError) {
    return null;
  }

  return {
    ok: action === "publish-series" ? result.ok === true : true,
    actionKey: action,
    seriesConfigKey,
    artifactPath,
    result,
    message: normalizeText(result?.message),
  };
}

function refreshQueuedRunPositions() {
  backgroundRunQueue.forEach((item, index) => {
    item.runContext.update({
      status: "queued",
      queuePosition: index + 1,
      message: `${item.runContext.actionLabel} is queued.`,
      note: `Waiting for a worker slot (#${index + 1}).`,
    });
  });
}

function attachChildProcessLogs(child, runContext) {
  const attachStream = (stream, prefix = "") => {
    if (!stream) {
      return;
    }

    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          runContext.log(`${prefix}${line}`);
        }
        newlineIndex = buffer.indexOf("\n");
      }
    });
    stream.on("end", () => {
      const line = buffer.trim();
      if (line) {
        runContext.log(`${prefix}${line}`);
      }
    });
  };

  attachStream(child.stdout);
  attachStream(child.stderr, "[stderr] ");
}

function scheduleNextBackgroundRun() {
  while (activeBackgroundRuns.size < LOCAL_OPS_BACKGROUND_CONCURRENCY && backgroundRunQueue.length > 0) {
    const queueItem = backgroundRunQueue.shift();
    if (!queueItem) {
      break;
    }

    refreshQueuedRunPositions();
    activeBackgroundRuns.set(queueItem.runContext.runId, queueItem);

    let settled = false;
    const settle = (execution, error = null) => {
      if (settled) {
        return;
      }
      settled = true;
      activeBackgroundRuns.delete(queueItem.runContext.runId);
      if (execution) {
        queueItem.runContext.markCompleted(execution);
      } else {
        queueItem.runContext.markFailed(error || new Error(`${queueItem.runContext.actionLabel} failed.`));
      }
      scheduleNextBackgroundRun();
    };

    if (typeof queueItem.executor === "function") {
      queueItem.runContext.markRunning({
        commandPreview: queueItem.commandPreview,
        note: "Background workflow started.",
      });
      queueItem.runContext.log("[queue] local workflow runner started");
      Promise.resolve()
        .then(() => queueItem.executor(queueItem.runContext))
        .then((execution) => settle(execution, null))
        .catch((error) => settle(null, error));
      continue;
    }

    const child = spawn(queueItem.invocation.command, queueItem.invocation.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    queueItem.child = child;
    queueItem.runContext.markRunning({
      pid: child.pid,
      commandPreview: queueItem.invocation.commandPreview,
    });
    queueItem.runContext.log(`[queue] worker pid ${child.pid} started`);
    attachChildProcessLogs(child, queueItem.runContext);

    child.on("error", (error) => {
      settle(null, error);
    });

    child.on("close", (code, signal) => {
      const execution = readExecutionArtifactForAction(queueItem.actionKey, queueItem.input);
      if (execution) {
        execution.ok = code === 0 && execution.ok !== false;
        execution.message = execution.message || (code === 0
          ? `${queueItem.runContext.actionLabel} completed in the background.`
          : `${queueItem.runContext.actionLabel} exited with code ${code}${signal ? ` (${signal})` : ""}.`);
        settle(execution, null);
        return;
      }

      const error = new Error(
        code === 0
          ? `${queueItem.runContext.actionLabel} finished but no result artifact was found.`
          : `${queueItem.runContext.actionLabel} exited with code ${code}${signal ? ` (${signal})` : ""}.`
      );
      settle(null, error);
    });
  }
}

function enqueueBackgroundQueueItem(actionKey, input = {}, options = {}) {
  const runContext = createActionRunContext(actionKey, input, {
    initialStatus: "queued",
    commandPreview: normalizeText(options.commandPreview),
  });

  const queueItem = {
    actionKey,
    input,
    runContext,
    invocation: options.invocation || null,
    executor: typeof options.executor === "function" ? options.executor : null,
    commandPreview: normalizeText(options.commandPreview),
  };

  backgroundRunQueue.push(queueItem);
  refreshQueuedRunPositions();
  scheduleNextBackgroundRun();

  return {
    ok: true,
    queued: true,
    background: true,
    actionKey: normalizeText(actionKey).toLowerCase(),
    seriesConfigKey: normalizeText(input.series) || null,
    runId: runContext.runId,
    message: `${runContext.actionLabel} queued for background execution.`,
    actionRun: runContext.getSnapshot(),
  };
}

function enqueueBackgroundAction(actionKey, input = {}) {
  if (isWorkflowAction(actionKey)) {
    return enqueueBackgroundQueueItem(actionKey, input, {
      commandPreview: buildWorkflowCommandPreview(actionKey, input),
      executor: (runContext) => executeWorkflowAction(actionKey, input, runContext),
    });
  }

  const invocation = buildWorkerCliInvocation(actionKey, input);
  return enqueueBackgroundQueueItem(actionKey, input, {
    invocation,
    commandPreview: invocation.commandPreview,
  });
}

function buildActionCompletionSummary(actionKey, execution) {
  const result = execution && execution.result ? execution.result : null;

  switch (normalizeText(actionKey).toLowerCase()) {
    case "stage":
      return summarizeStageStep({ summary: summarizeStage(result) });
    case "run":
      return summarizeRunStep({ summary: summarizeRun(result) });
    case "compute-season":
      return summarizeSeasonStep({
        summary: summarizeCompute(result, "playerSeasonAdvancedRowCount"),
      });
    case "compute-composite":
      return summarizeCompositeStep({
        summary: summarizeCompute(result, "playerCompositeScoreRowCount"),
      });
    case "enrich-profiles":
      return summarizeProfileStep({ summary: summarizeProfileEnrichment(result) });
    case "compute-intelligence":
      return summarizeIntelligenceStep({
        summary: summarizeCompute(result, "profileRowCount"),
      });
    case "refresh-series":
    case "refresh-match":
      return summarizeRefreshStep({ summary: summarizeRefresh(result) });
    case "validate-series":
      return summarizeValidationStep({ summary: summarizeValidation(result) });
    case "publish-series":
      return normalizeText(result?.message)
        || (toBoolean(result?.dryRun)
          ? "Dry-run publish completed."
          : execution?.ok === true
            ? "Live publish completed."
            : "Publish run finished.");
    case "workflow-onboarding":
    case "workflow-refresh":
    case "workflow-publish":
      return normalizeText(result?.message || execution?.message || `${buildActionLabel(actionKey)} completed.`);
    case "register":
      return normalizeText(summarizeRegistration(result)?.message || result?.message || "Series registration completed.");
    case "probe":
      return normalizeText(result?.message || result?.summary || "Series probe completed.");
    default:
      return normalizeText(result?.message || execution?.message || `${buildActionLabel(actionKey)} completed.`);
  }
}

function createActionRunContext(actionKey, input = {}, options = {}) {
  const seriesConfigKey = normalizeText(input.series);
  const runId = normalizeText(input.runId) || `local-ops-${Date.now()}-${crypto.randomUUID().split("-")[0]}`;
  const createdAt = new Date().toISOString();
  const initialStatus = normalizeText(options.initialStatus).toLowerCase() || "running";
  const paths = buildLocalOpsRunPaths(seriesConfigKey, runId);
  ensureDir(paths.runDir);

  let state = {
    runId,
    actionKey,
    actionLabel: buildActionLabel(actionKey),
    seriesConfigKey: seriesConfigKey || null,
    status: initialStatus,
    ok: null,
    createdAt,
    startedAt: initialStatus === "running" ? createdAt : null,
    updatedAt: createdAt,
    finishedAt: null,
    durationMs: null,
    summary: "",
    message: initialStatus === "queued"
      ? `${buildActionLabel(actionKey)} is queued.`
      : `${buildActionLabel(actionKey)} is running.`,
    note: initialStatus === "queued" ? "Waiting for a worker slot." : "",
    input: summarizeActionInput(actionKey, input),
    retryInput: buildRetryInput(input),
    artifactPath: null,
    logPath: paths.logPath,
    logLineCount: 0,
    lastLogLine: "",
    commandPreview: normalizeText(options.commandPreview),
    queuePosition: null,
    pid: null,
  };

  function persistState(patch = {}) {
    state = {
      ...state,
      ...patch,
    };

    writeJsonFile(paths.statusPath, state);
    writeJsonFile(paths.latestPath, state);
    writeJsonFile(LOCAL_OPS_GLOBAL_RUN_PATH, state);
    return state;
  }

  function update(patch = {}) {
    const updatedAt = new Date().toISOString();
    persistState({
      updatedAt,
      ...patch,
    });
    return getSnapshot();
  }

  function log(message) {
    const text = normalizeText(message);
    if (!text) {
      return;
    }

    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${text}`;
    fs.appendFileSync(paths.logPath, `${line}\n`, "utf8");
    persistState({
      updatedAt: timestamp,
      logLineCount: (toInteger(state.logLineCount) || 0) + 1,
      lastLogLine: line,
    });
  }

  function markQueued(queuePosition = null, extra = {}) {
    return update({
      status: "queued",
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      queuePosition,
      ok: null,
      message: `${buildActionLabel(actionKey)} is queued.`,
      note: `Waiting for a worker slot${queuePosition ? ` (#${queuePosition})` : ""}.`,
      ...extra,
    });
  }

  function markRunning(extra = {}) {
    const startedAt = new Date().toISOString();
    return update({
      status: "running",
      startedAt,
      finishedAt: null,
      durationMs: null,
      queuePosition: null,
      message: `${buildActionLabel(actionKey)} is running in the background.`,
      note: "Background worker started.",
      ...extra,
    });
  }

  function markCompleted(execution) {
    const finishedAt = new Date().toISOString();
    const ok = execution?.ok !== false;
    const summary = buildActionCompletionSummary(actionKey, execution);
    const startedAt = state.startedAt || state.createdAt;
    persistState({
      status: ok ? "completed" : "failed",
      ok,
      finishedAt,
      updatedAt: finishedAt,
      durationMs: Math.max(0, toTimestamp(finishedAt) - toTimestamp(startedAt)),
      artifactPath: normalizeText(execution?.artifactPath) || null,
      summary,
      message: normalizeText(execution?.result?.message || execution?.message || summary || `${buildActionLabel(actionKey)} completed.`),
      note: ok
        ? normalizeText(execution?.message || summary)
        : normalizeText(execution?.result?.message || execution?.message || ""),
    });
    return getSnapshot();
  }

  function markFailed(error) {
    const finishedAt = new Date().toISOString();
    const message = normalizeText(error?.message || error || `${buildActionLabel(actionKey)} failed.`);
    const startedAt = state.startedAt || state.createdAt;
    persistState({
      status: "failed",
      ok: false,
      finishedAt,
      updatedAt: finishedAt,
      durationMs: Math.max(0, toTimestamp(finishedAt) - toTimestamp(startedAt)),
      summary: message,
      message,
      note: normalizeText(error?.stack),
    });
    return getSnapshot();
  }

  function getSnapshot(entry = null) {
    return deriveLatestRunStatus(state, entry);
  }

  persistState();

  return {
    runId,
    actionKey,
    actionLabel: buildActionLabel(actionKey),
    seriesConfigKey,
    update,
    log,
    markQueued,
    markRunning,
    markCompleted,
    markFailed,
    getSnapshot,
  };
}

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

function buildWorkflowPreset(action, label, summary, options = {}) {
  return {
    action,
    label,
    summary,
    form: options.form || "series-ops-form",
    variant: options.variant || "primary",
    visible: options.visible !== false,
  };
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
    preset: buildWorkflowPreset(
      "workflow-onboarding",
      "Run Onboarding Chain",
      "Queues the remaining required onboarding steps for this series. The Dry run publish checkbox controls whether the chain stops at publish simulation or applies a live publish.",
      {
        visible: countStatus(requiredSteps, "pending") > 0 || countStatus(requiredSteps, "stale") > 0 || countStatus(requiredSteps, "blocked") > 0,
      }
    ),
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
    preset: buildWorkflowPreset(
      "workflow-refresh",
      "Run Refresh Chain",
      "Queues refresh, recompute, validation, and publish for the selected series. If Match id or DB match id is filled in below, the chain uses one-match refresh.",
      {
        variant: "secondary",
      }
    ),
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
    preset: buildWorkflowPreset(
      "workflow-publish",
      "Run Validate + Publish Chain",
      "Runs the validation gate first, then executes publish dry run and optionally live publish depending on the Dry run publish checkbox.",
      {
        variant: "warn",
        visible: countStatus(steps, "pending") > 0 || countStatus(steps, "stale") > 0 || countStatus(steps, "blocked") > 0,
      }
    ),
    steps,
  };
}

function isLiveSeriesCurrent(entry, workflows) {
  if (!entry?.enabled) {
    return false;
  }

  const refreshStatus = workflows?.refresh?.status;
  return workflows?.publish?.status === "complete" && (refreshStatus === "complete" || refreshStatus === "standby");
}

function pickNextRecommendedAction(entry, workflows) {
  const { onboarding, refresh, publish } = workflows;
  const validation = entry?.artifacts?.validation || null;
  const publishArtifact = entry?.artifacts?.publish || null;
  const publishLiveArtifact = publishArtifact?.summary?.dryRun === false ? publishArtifact : null;
  const liveSeriesCurrent = isLiveSeriesCurrent(entry, workflows);

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

  if (!liveSeriesCurrent) {
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
  const liveSeriesCurrent = isLiveSeriesCurrent(entry, { onboarding, refresh, publish });

  let headline = entry.enabled ? "Live series is current." : "Series is still local-only.";
  let note = entry.enabled
    ? "Use refresh when new matches land, then recompute and publish the updated dataset."
    : "Finish onboarding, validate the dataset, then publish when you are ready to expose it to the hosted app.";

  if (liveSeriesCurrent) {
    headline = "Live series is current.";
    note = "Use refresh when new matches land, then recompute and publish the updated dataset.";
  } else if (nextRecommendedAction && nextRecommendedAction.standby !== true) {
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

function createLocalOpsActionError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function loadSeriesWorkflowEntry(seriesConfigKey) {
  const seriesSlug = normalizeText(seriesConfigKey);
  if (!seriesSlug) {
    throw createLocalOpsActionError("A series key is required for guided workflow execution.", 400);
  }

  const config = loadYamlConfig(CONFIG_PATH);
  const seriesEntries = Array.isArray(config?.series) ? config.series : [];
  const entry = seriesEntries
    .map(buildSeriesOverviewEntry)
    .find((candidate) => candidate.slug === seriesSlug);

  if (!entry) {
    throw createLocalOpsActionError(`Series was not found in config/leagues.yaml: ${seriesSlug}`, 404);
  }

  return {
    ...entry,
    workflow: buildSeriesWorkflow(entry),
  };
}

function buildWorkflowActionPayload(input = {}, payloadOverrides = {}) {
  return {
    ...input,
    ...payloadOverrides,
  };
}

function buildWorkflowPublishSteps(input = {}) {
  const workflowDryRun = resolveWorkflowDryRun(input);
  const basePayload = buildWorkflowActionPayload(input);
  const steps = [
    {
      actionKey: "publish-series",
      label: "Run publish dry run",
      payload: {
        ...basePayload,
        dryRun: true,
      },
    },
  ];

  if (!workflowDryRun) {
    steps.push({
      actionKey: "publish-series",
      label: "Apply live publish",
      payload: {
        ...basePayload,
        dryRun: false,
      },
    });
  }

  return steps;
}

function buildOnboardingWorkflowExecutionPlan(entry, input = {}) {
  const steps = [];
  const requiredSteps = Array.isArray(entry?.workflow?.onboarding?.steps)
    ? entry.workflow.onboarding.steps.filter((step) => step.optional !== true)
    : [];

  requiredSteps.forEach((step) => {
    if (!step?.action) {
      return;
    }

    if (step.action === "publish-series") {
      if (step.status === "pending" || step.status === "stale") {
        steps.push(...buildWorkflowPublishSteps(buildWorkflowActionPayload(input, step.payloadOverrides || {})));
      }
      return;
    }

    if (step.status === "pending" || step.status === "stale" || (step.action === "validate-series" && step.status === "blocked")) {
      steps.push({
        actionKey: step.action,
        label: step.label,
        payload: buildWorkflowActionPayload(input, step.payloadOverrides || {}),
      });
    }
  });

  return {
    workflowKey: "onboarding",
    label: "New Series Onboarding",
    steps,
    skippedCount: requiredSteps.filter((step) => step.status === "complete").length,
    message: steps.length
      ? `Queued ${steps.length} onboarding step(s) for ${entry.label || entry.slug}.`
      : `No onboarding work is pending for ${entry.label || entry.slug}.`,
  };
}

function buildRefreshWorkflowExecutionPlan(entry, input = {}) {
  const useMatchRefresh = Boolean(
    normalizeText(input.matchId)
    || normalizeText(input.dbMatchId)
    || normalizeText(input.matchIds)
  );

  const refreshPayload = buildWorkflowActionPayload(input, {
    skipPipeline: input.skipPipeline === undefined ? true : toBoolean(input.skipPipeline),
  });

  const steps = [
    {
      actionKey: useMatchRefresh ? "refresh-match" : "refresh-series",
      label: useMatchRefresh ? "Refresh selected match" : "Refresh series",
      payload: refreshPayload,
    },
    {
      actionKey: "compute-season",
      label: "Recompute season aggregation",
      payload: buildWorkflowActionPayload(input),
    },
    {
      actionKey: "compute-composite",
      label: "Recompute composite scoring",
      payload: buildWorkflowActionPayload(input),
    },
    {
      actionKey: "compute-intelligence",
      label: "Recompute player intelligence",
      payload: buildWorkflowActionPayload(input),
    },
    {
      actionKey: "validate-series",
      label: "Validate refreshed state",
      payload: buildWorkflowActionPayload(input),
    },
    ...buildWorkflowPublishSteps(buildWorkflowActionPayload(input)),
  ];

  return {
    workflowKey: "refresh",
    label: "Existing Series Refresh",
    steps,
    skippedCount: 0,
    message: `Queued ${steps.length} refresh step(s) for ${entry.label || entry.slug}.`,
  };
}

function buildPublishWorkflowExecutionPlan(entry, input = {}) {
  const steps = [
    {
      actionKey: "validate-series",
      label: "Validate publish gate",
      payload: buildWorkflowActionPayload(input),
    },
    ...buildWorkflowPublishSteps(buildWorkflowActionPayload(input)),
  ];

  return {
    workflowKey: "publish",
    label: "Validate And Publish",
    steps,
    skippedCount: 0,
    message: `Queued ${steps.length} publish step(s) for ${entry.label || entry.slug}.`,
  };
}

function buildWorkflowExecutionPlan(actionKey, entry, input = {}) {
  const action = normalizeText(actionKey).toLowerCase();
  switch (action) {
    case "workflow-onboarding":
      return buildOnboardingWorkflowExecutionPlan(entry, input);
    case "workflow-refresh":
      return buildRefreshWorkflowExecutionPlan(entry, input);
    case "workflow-publish":
      return buildPublishWorkflowExecutionPlan(entry, input);
    default:
      throw createLocalOpsActionError(`Unsupported guided workflow action: ${actionKey}`, 400);
  }
}

async function executeWorkflowAction(actionKey, input = {}, runContext = null) {
  const logger = typeof runContext?.log === "function" ? runContext.log : () => {};
  const entry = loadSeriesWorkflowEntry(input.series);
  const plan = buildWorkflowExecutionPlan(actionKey, entry, {
    ...input,
    series: entry.slug,
  });

  logger(`[workflow] ${plan.label}: plan build complete`);
  logger(`[workflow] ${plan.message}`);

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    return {
      ok: true,
      actionKey: normalizeText(actionKey).toLowerCase(),
      seriesConfigKey: entry.slug,
      artifactPath: null,
      result: {
        workflowKey: plan.workflowKey,
        workflowLabel: plan.label,
        dryRun: resolveWorkflowDryRun(input),
        stepsRequested: 0,
        stepsCompleted: 0,
        skippedSteps: plan.skippedCount || 0,
        message: plan.message,
      },
      message: plan.message,
    };
  }

  const completedSteps = [];
  let lastExecution = null;

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    logger(`[workflow] ${index + 1}/${plan.steps.length} ${step.label}: start`);
    lastExecution = await executeLocalOpsActionInline(step.actionKey, {
      ...step.payload,
      series: entry.slug,
    }, runContext);
    const stepSummary = buildActionCompletionSummary(step.actionKey, lastExecution);
    logger(`[workflow] ${index + 1}/${plan.steps.length} ${step.label}: ${stepSummary}`);
    completedSteps.push({
      actionKey: step.actionKey,
      label: step.label,
      summary: stepSummary,
      dryRun: step.actionKey === "publish-series" ? toBoolean(step.payload?.dryRun) : undefined,
    });

    if (step.actionKey === "validate-series" && lastExecution?.result?.publishReady !== true) {
      throw createLocalOpsActionError(
        normalizeText(lastExecution?.result?.message)
          || "Validation did not clear the publish gate. The guided workflow stopped before publish.",
        409
      );
    }

    if (step.actionKey === "refresh-series" || step.actionKey === "refresh-match") {
      const selectedMatchCount = toInteger(lastExecution?.result?.selectedMatchCount) || 0;
      const newMatchCount = toInteger(lastExecution?.result?.inventoryWrite?.newMatchCount) || 0;
      const updatedMatchCount = toInteger(lastExecution?.result?.inventoryWrite?.updatedMatchCount) || 0;
      if (selectedMatchCount === 0 && newMatchCount === 0 && updatedMatchCount === 0) {
        const message = "No refreshed match changes were detected. The guided workflow stopped before recompute.";
        logger(`[workflow] ${message}`);
        return {
          ok: true,
          actionKey: normalizeText(actionKey).toLowerCase(),
          seriesConfigKey: entry.slug,
          artifactPath: lastExecution?.artifactPath || null,
          result: {
            workflowKey: plan.workflowKey,
            workflowLabel: plan.label,
            dryRun: resolveWorkflowDryRun(input),
            stepsRequested: plan.steps.length,
            stepsCompleted: completedSteps.length,
            skippedSteps: plan.skippedCount || 0,
            stoppedEarly: true,
            stopReason: message,
            completedSteps,
            message,
          },
          message,
        };
      }
    }
  }

  const message = `${plan.label} completed. ${completedSteps.length} step(s) ran.`;
  logger(`[workflow] ${message}`);

  return {
    ok: true,
    actionKey: normalizeText(actionKey).toLowerCase(),
    seriesConfigKey: entry.slug,
    artifactPath: lastExecution?.artifactPath || null,
    result: {
      workflowKey: plan.workflowKey,
      workflowLabel: plan.label,
      dryRun: resolveWorkflowDryRun(input),
      stepsRequested: plan.steps.length,
      stepsCompleted: completedSteps.length,
      skippedSteps: plan.skippedCount || 0,
      completedSteps,
      message,
    },
    message,
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
    .map((entry) => {
      const workflow = buildSeriesWorkflow(entry);
      return {
        ...entry,
        latestRun: readLatestActionRun(entry.slug, entry),
        recentRuns: readRecentActionRuns(entry.slug, entry),
        workflow,
      };
    });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    configPath: CONFIG_PATH,
    seriesCount: seriesEntries.length,
    series,
    latestRun: readLatestActionRun(null),
    backgroundQueue: buildBackgroundQueueSummary(),
    queues: {
      seriesOperations: readGlobalArtifactSummary("series_operation_queue_summary.json", summarizeQueue),
      manualRefresh: readGlobalArtifactSummary("manual_refresh_queue_summary.json", summarizeQueue),
    },
    runbooks: [
      "ops_runbook_new_series.md",
      "ops_runbook_manual_refresh.md",
      "ops_runbook_compute_publish.md",
      "local_ops_operator_console_start_guide.md",
    ],
  };
}

async function executeStage(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const logger = typeof runContext?.log === "function" ? runContext.log : () => {};
  logger(`[stage] ${runtime.series.slug}: discovery start`);
  const discovery = await discoverSeries(runtime.series, { outDir: runtime.outDir });
  writeJsonFile(path.join(runtime.outDir, "discovery.json"), discovery);
  const discoveryWrite = await upsertDiscovery(discovery, {
    seriesConfigKey: runtime.series.slug,
  });
  logger(`[stage] ${runtime.series.slug}: discovery persisted (${discoveryWrite.discoveredDivisionCount} divisions)`);

  logger(`[stage] ${runtime.series.slug}: inventory start`);
  const inventory = await enumerateMatches(runtime.series, discovery, { outDir: runtime.outDir });
  writeJsonFile(path.join(runtime.outDir, "match_inventory.json"), inventory);
  const inventoryWrite = await upsertMatchInventory(inventory, {
    seriesConfigKey: runtime.series.slug,
  });
  logger(
    `[stage] ${runtime.series.slug}: inventory persisted (${inventoryWrite.inventoriedMatchCount} matches, ${inventoryWrite.newMatchCount} new, ${inventoryWrite.updatedMatchCount} updated)`
  );

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

async function executeRun(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runMatchPipeline({
    series: runtime.series,
    outDir: runtime.outDir,
    matchLimit: input.matchLimit,
    matchIds: parseListInput(input.matchIds),
    useStagedInventory: toBoolean(input.useStagedInventory),
    headless: toBoolean(input.headless),
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeComputeSeason(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runSeasonAggregation({
    series: runtime.series,
    outDir: runtime.outDir,
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeComputeComposite(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runCompositeScoring({
    series: runtime.series,
    outDir: runtime.outDir,
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeProfileEnrichment(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runPlayerProfileEnrichment({
    series: runtime.series,
    outDir: runtime.outDir,
    limit: input.limit,
    playerIds: parseListInput(input.playerIds),
    force: toBoolean(input.force),
    pauseMs: input.pauseMs,
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeComputeIntelligence(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await runPlayerIntelligence({
    series: runtime.series,
    outDir: runtime.outDir,
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeRefreshSeries(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await refreshSeries({
    series: runtime.series,
    outDir: runtime.outDir,
    matchLimit: input.matchLimit,
    sourceMatchIds: parseListInput(input.matchIds),
    dbMatchId: input.dbMatchId,
    skipPipeline: toBoolean(input.skipPipeline),
    headless: toBoolean(input.headless),
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeRefreshMatch(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await refreshSingleMatch({
    series: runtime.series,
    outDir: runtime.outDir,
    sourceMatchIds: parseListInput(input.matchId || input.matchIds),
    dbMatchId: input.dbMatchId,
    skipPipeline: toBoolean(input.skipPipeline),
    headless: toBoolean(input.headless),
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeValidateSeries(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await validateSeries({
    series: runtime.series,
    configPath: runtime.configPath,
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executePublishSeries(input = {}, runContext = null) {
  const runtime = resolveSeriesRuntime(input.series);
  const result = await publishSeries({
    series: runtime.series,
    configPath: runtime.configPath,
    dryRun: toBoolean(input.dryRun),
    log: typeof runContext?.log === "function" ? runContext.log : () => {},
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

async function executeProbe(input = {}, runContext = null) {
  const config = fs.existsSync(CONFIG_PATH) ? loadYamlConfig(CONFIG_PATH) : null;
  const seriesConfig = normalizeText(input.series)
    ? resolveSeriesConfig(config, normalizeText(input.series))
    : null;
  if (typeof runContext?.log === "function") {
    runContext.log(`[probe] ${normalizeText(input.url) || normalizeText(seriesConfig?.series_url) || "source"}: probe start`);
  }
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

async function executeRegister(input = {}, runContext = null) {
  if (typeof runContext?.log === "function") {
    runContext.log(
      `[register] ${normalizeText(input.label) || "series"}: ${toBoolean(input.dryRun) ? "dry-run registration" : "local registration"} start`
    );
  }
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

async function executeLocalOpsActionInline(action, input, runContext) {
  switch (action) {
    case "probe":
      return executeProbe(input, runContext);
    case "register":
      return executeRegister(input, runContext);
    case "stage":
      return executeStage(input, runContext);
    case "run":
      return executeRun(input, runContext);
    case "compute-season":
      return executeComputeSeason(input, runContext);
    case "compute-composite":
      return executeComputeComposite(input, runContext);
    case "enrich-profiles":
      return executeProfileEnrichment(input, runContext);
    case "compute-intelligence":
      return executeComputeIntelligence(input, runContext);
    case "refresh-series":
      return executeRefreshSeries(input, runContext);
    case "refresh-match":
      return executeRefreshMatch(input, runContext);
    case "validate-series":
      return executeValidateSeries(input, runContext);
    case "publish-series":
      return executePublishSeries(input, runContext);
    default: {
      const error = new Error(`Unsupported local ops action: ${action}`);
      error.statusCode = 400;
      throw error;
    }
  }
}

async function runLocalOpsAction(actionKey, input = {}) {
  const action = normalizeText(actionKey).toLowerCase();
  if (isBackgroundAction(action)) {
    return enqueueBackgroundAction(action, input);
  }

  const runContext = createActionRunContext(action, input, {
    initialStatus: "running",
  });

  try {
    const execution = await executeLocalOpsActionInline(action, input, runContext);

    return {
      ...execution,
      runId: runContext.runId,
      actionRun: runContext.markCompleted(execution),
    };
  } catch (error) {
    runContext.log(`[error] ${normalizeText(error?.message || error || "Unexpected local ops failure.")}`);
    runContext.markFailed(error);
    throw error;
  }
}

module.exports = {
  getLocalOpsOverview,
  runLocalOpsAction,
};

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
const LOCAL_OPS_RUN_DETAIL_LOG_LIMIT = 160;
const LOCAL_OPS_RUN_DETAIL_STEP_LOG_LIMIT = 18;
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
const RECOVERABLE_RUN_STATUSES = new Set(["queued", "running"]);
const INTERRUPTED_WORKFLOW_STEP_STATUSES = new Set(["running", "queued", "in_progress", "standby"]);
const RUN_TRIAGE_STATUSES = new Set(["interrupted", "failed", "stale", "canceled", "cancelled"]);

const backgroundRunQueue = [];
const activeBackgroundRuns = new Map();
let localOpsRecoveryInitialized = false;

function buildActionLabel(actionKey) {
  switch (normalizeText(actionKey).toLowerCase()) {
    case "cancel-run":
      return "Cancel Queued Run";
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
  assignText("fromStep", input.fromStep);
  assignText("runId", input.runId);

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
  assign("fromStep", input.fromStep);
  assign("runId", input.runId);

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

function resolvePersistedRunPaths(run = {}, fallbackStatusPath = "") {
  const runId = normalizeText(run?.runId);
  const statusPath = normalizeText(run?.statusPath || fallbackStatusPath);
  const detailPath = normalizeText(run?.detailPath || (statusPath ? path.dirname(statusPath) : ""));
  const logPath = normalizeText(run?.logPath);

  if (!runId) {
    return {
      detailPath,
      statusPath,
      logPath,
    };
  }

  const defaults = buildLocalOpsRunPaths(run?.seriesConfigKey, runId);
  return {
    detailPath: detailPath || defaults.runDir,
    statusPath: statusPath || defaults.statusPath,
    logPath: logPath || defaults.logPath,
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

function readLogLines(filePath, limit = LOCAL_OPS_RUN_DETAIL_LOG_LIMIT) {
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

  const persistedPaths = resolvePersistedRunPaths(run);
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
    ...persistedPaths,
    status,
    note,
    recentLogLines: readTailLines(persistedPaths.logPath),
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
    artifactPath: normalizeText(run.artifactPath),
      detailPath: normalizeText(run.detailPath),
      statusPath: normalizeText(run.statusPath),
      queuePosition: toInteger(run.queuePosition),
      pid: toInteger(run.pid),
      canCancel: run.status === "queued",
      workflowKey: normalizeText(run.workflowKey),
      workflowLabel: normalizeText(run.workflowLabel),
      workflowDryRun: typeof run.workflowDryRun === "boolean" ? run.workflowDryRun : null,
      workflowRequestedSteps: toInteger(run.workflowRequestedSteps),
      workflowSkippedSteps: toInteger(run.workflowSkippedSteps),
      workflowStartStepKey: normalizeText(run.workflowStartStepKey),
      workflowStartStepLabel: normalizeText(run.workflowStartStepLabel),
      workflowSteps: Array.isArray(run.workflowSteps) ? run.workflowSteps : [],
      workflowPlanSteps: Array.isArray(run.workflowPlanSteps) ? run.workflowPlanSteps : [],
      workflowRerunOptions: Array.isArray(run.workflowRerunOptions) ? run.workflowRerunOptions : [],
      workflowResume: run.workflowResume || null,
      workflowStoppedEarly: run.workflowStoppedEarly === true,
      workflowStopReason: normalizeText(run.workflowStopReason),
      seriesStateSnapshot: run.seriesStateSnapshot || null,
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
  const fromStep = normalizeText(input.fromStep);
  const liveFlag = resolveWorkflowDryRun(input) ? "" : " --live-publish";
  const fromStepFlag = fromStep ? ` --from-step ${fromStep}` : "";
  switch (action) {
    case "workflow-onboarding":
      return `guided-workflow onboarding --series ${seriesConfigKey}${fromStepFlag}${liveFlag}`;
    case "workflow-refresh":
      return `guided-workflow refresh --series ${seriesConfigKey}${fromStepFlag}${liveFlag}`;
    case "workflow-publish":
      return `guided-workflow publish --series ${seriesConfigKey}${fromStepFlag}${liveFlag}`;
    default:
      return `guided-workflow ${action} --series ${seriesConfigKey}${fromStepFlag}${liveFlag}`;
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

function cancelQueuedBackgroundRun(input = {}) {
  const runId = normalizeText(input.runId);
  if (!runId) {
    throw createLocalOpsActionError("A queued run id is required to cancel local background work.", 400);
  }

  const queuedIndex = backgroundRunQueue.findIndex((item) => item?.runContext?.runId === runId);
  if (queuedIndex < 0) {
    if (activeBackgroundRuns.has(runId)) {
      throw createLocalOpsActionError("This local background run is already active and cannot be canceled from the queued-run control.", 409);
    }
    throw createLocalOpsActionError(`Queued local background run was not found: ${runId}`, 404);
  }

  const [queueItem] = backgroundRunQueue.splice(queuedIndex, 1);
  if (!queueItem) {
    throw createLocalOpsActionError(`Queued local background run was not found: ${runId}`, 404);
  }

  queueItem.runContext.log("[queue] canceled before execution started");
  const actionRun = queueItem.runContext.markCanceled({
    summary: `${queueItem.runContext.actionLabel} was canceled before execution started.`,
  });

  refreshQueuedRunPositions();

  return {
    ok: true,
    canceled: true,
    actionKey: "cancel-run",
    runId,
    seriesConfigKey: normalizeText(actionRun?.seriesConfigKey),
    message: `${queueItem.runContext.actionLabel} removed from the queue.`,
    actionRun,
  };
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
    detailPath: paths.runDir,
    statusPath: paths.statusPath,
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

  function markCanceled(extra = {}) {
    const finishedAt = new Date().toISOString();
    const seriesStateSnapshot = loadSeriesSnapshotForRun(seriesConfigKey);
    return update({
      status: "canceled",
      ok: null,
      startedAt: null,
      finishedAt,
      durationMs: Math.max(0, toTimestamp(finishedAt) - toTimestamp(state.createdAt)),
      queuePosition: null,
      pid: null,
      message: `${buildActionLabel(actionKey)} was removed from the queue.`,
      note: "Queued background work was canceled before execution started.",
      seriesStateSnapshot: seriesStateSnapshot || state.seriesStateSnapshot || null,
      ...extra,
    });
  }

  function markCompleted(execution) {
    const finishedAt = new Date().toISOString();
    const ok = execution?.ok !== false;
    const summary = buildActionCompletionSummary(actionKey, execution);
    const startedAt = state.startedAt || state.createdAt;
    const resolvedSeriesKey = normalizeText(seriesConfigKey || execution?.seriesConfigKey);
    const seriesStateSnapshot = loadSeriesSnapshotForRun(resolvedSeriesKey);
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
      seriesStateSnapshot: seriesStateSnapshot || state.seriesStateSnapshot || null,
    });
    return getSnapshot();
  }

  function markFailed(error) {
    const finishedAt = new Date().toISOString();
    const message = normalizeText(error?.message || error || `${buildActionLabel(actionKey)} failed.`);
    const startedAt = state.startedAt || state.createdAt;
    const seriesStateSnapshot = loadSeriesSnapshotForRun(seriesConfigKey);
    persistState({
      status: "failed",
      ok: false,
      finishedAt,
      updatedAt: finishedAt,
      durationMs: Math.max(0, toTimestamp(finishedAt) - toTimestamp(startedAt)),
      summary: message,
      message,
      note: normalizeText(error?.stack),
      seriesStateSnapshot: seriesStateSnapshot || state.seriesStateSnapshot || null,
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
    markCanceled,
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

function readTextIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return null;
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

function workflowStatusLabel(status) {
  switch (normalizeText(status).toLowerCase()) {
    case "complete":
    case "completed":
      return "Complete";
    case "blocked":
      return "Blocked";
    case "stale":
      return "Needs rerun";
    case "in_progress":
      return "In progress";
    case "standby":
      return "Standby";
    case "failed":
      return "Failed";
    case "interrupted":
      return "Interrupted";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "canceled":
    case "cancelled":
      return "Canceled";
    case "pending":
    default:
      return "Pending";
  }
}

function formatCoverageValueLabel(coverage = {}) {
  const requiredParsedMatchCount = toInteger(coverage?.requiredParsedMatchCount);
  const parsedMatchCount = toInteger(coverage?.parsedMatchCount);
  const matchCount = toInteger(coverage?.matchCount);

  if (requiredParsedMatchCount > 0) {
    return `${parsedMatchCount || 0}/${requiredParsedMatchCount} playable matches`;
  }

  if (matchCount > 0) {
    return `${parsedMatchCount || 0}/${matchCount} matches`;
  }

  return "Not available";
}

function buildValidationReadinessLabel(status, publishReady, counts = {}) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const blockerCount = toInteger(counts?.fail) || 0;
  const warningCount = toInteger(counts?.warn) || 0;

  if (publishReady === true || normalizedStatus === "complete" || normalizedStatus === "completed") {
    return `Publish ready${warningCount > 0 ? ` (${warningCount} warning${warningCount === 1 ? "" : "s"})` : ""}`;
  }

  if (normalizedStatus === "blocked") {
    return `Blocked${blockerCount > 0 ? ` (${blockerCount} blocker${blockerCount === 1 ? "" : "s"})` : ""}`;
  }

  if (normalizedStatus === "stale") {
    return "Validation stale";
  }

  if (normalizedStatus === "failed") {
    return "Validation failed";
  }

  if (normalizedStatus === "interrupted") {
    return "Validation interrupted";
  }

  if (normalizedStatus === "running") {
    return "Validation running";
  }

  if (normalizedStatus === "queued") {
    return "Validation queued";
  }

  if (normalizedStatus === "standby") {
    return "Validation standby";
  }

  return "Not validated";
}

function buildLivePublishLabel(status, options = {}) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const liveCurrent = options?.liveCurrent === true;
  const dryRunCurrent = options?.dryRunCurrent === true;
  const enabled = options?.enabled === true;

  if (liveCurrent || normalizedStatus === "complete" || normalizedStatus === "completed") {
    return "Live publish current";
  }

  if (normalizedStatus === "stale") {
    return "Live publish stale";
  }

  if (normalizedStatus === "blocked") {
    return "Live publish blocked";
  }

  if (normalizedStatus === "failed") {
    return "Live publish failed";
  }

  if (normalizedStatus === "interrupted") {
    return "Live publish interrupted";
  }

  if (normalizedStatus === "running") {
    return "Live publish running";
  }

  if (normalizedStatus === "queued") {
    return "Live publish queued";
  }

  if (normalizedStatus === "standby") {
    return enabled ? "Refresh when new matches land" : "Local only";
  }

  if (normalizedStatus === "pending") {
    return enabled ? "Live publish pending" : dryRunCurrent ? "Dry run current, live publish pending" : "Live publish pending";
  }

  return enabled ? "Live publish pending" : "Local only";
}

function parseValidationCountsFromSummary(summary = "") {
  const text = normalizeText(summary);
  if (!text) {
    return {
      fail: 0,
      warn: 0,
    };
  }

  const blockingMatch = text.match(/(\d+)\s+blocking\s+checks?/i);
  const warningMatch = text.match(/(\d+)\s+warning(?:\s+checks?)?/i);

  return {
    fail: blockingMatch ? toInteger(blockingMatch[1]) || 0 : 0,
    warn: warningMatch ? toInteger(warningMatch[1]) || 0 : 0,
  };
}

function buildRunSnapshotFromWorkflowInference(run = {}) {
  if (!run || (!Array.isArray(run.workflowSteps) && !normalizeText(run.actionKey))) {
    return null;
  }

  const workflowSteps = Array.isArray(run.workflowSteps) ? run.workflowSteps : [];
  const validationStep = workflowSteps.find((step) => normalizeText(step?.actionKey).toLowerCase() === "validate-series")
    || null;
  const publishDryRunStep = workflowSteps.find((step) => normalizeText(step?.key).toLowerCase() === "publish-series-dry-run")
    || null;
  const publishLiveStep = workflowSteps.find((step) => normalizeText(step?.key).toLowerCase() === "publish-series-live")
    || null;
  const actionKey = normalizeText(run.actionKey).toLowerCase();
  const retryInput = run.retryInput || {};
  const currentStatus = normalizeText(run.status).toLowerCase();
  const publishActionDryRun = actionKey === "publish-series" && toBoolean(retryInput.dryRun);
  const publishActionLive = actionKey === "publish-series" && retryInput.dryRun !== true;
  const inferredCounts = parseValidationCountsFromSummary(validationStep?.summary || run.summary || run.message || "");
  const inferredPublishReady = /publish ready/i.test(validationStep?.summary || run.summary || run.message || "");
  const liveStatus = publishLiveStep?.status
    || (publishActionLive ? currentStatus : "")
    || "";
  const dryRunStatus = publishDryRunStep?.status
    || (publishActionDryRun ? currentStatus : "")
    || "";
  const liveCurrent = normalizeText(liveStatus).toLowerCase() === "completed";
  const dryRunCurrent = normalizeText(dryRunStatus).toLowerCase() === "completed";

  if (!validationStep && !publishDryRunStep && !publishLiveStep && actionKey !== "publish-series" && actionKey !== "validate-series") {
    return null;
  }

  return {
    capturedAt: normalizeText(run.finishedAt || run.updatedAt || run.createdAt) || null,
    source: "workflow-inference",
    limited: true,
    seriesConfigKey: normalizeText(run.seriesConfigKey) || null,
    validation: {
      status: normalizeText(validationStep?.status || (inferredPublishReady ? "completed" : actionKey === "validate-series" ? currentStatus : "")) || "pending",
      label: buildValidationReadinessLabel(
        normalizeText(validationStep?.status || (inferredPublishReady ? "completed" : actionKey === "validate-series" ? currentStatus : "")),
        inferredPublishReady,
        inferredCounts
      ),
      publishReady: inferredPublishReady,
      updatedAt: normalizeText(validationStep?.updatedAt || run.finishedAt || run.updatedAt) || null,
      blockingCount: toInteger(inferredCounts.fail) || 0,
      warningCount: toInteger(inferredCounts.warn) || 0,
      summary: normalizeText(validationStep?.summary || ""),
    },
    publish: {
      status: normalizeText(liveStatus) || normalizeText(dryRunStatus) || "pending",
      label: buildLivePublishLabel(liveStatus, {
        enabled: true,
        liveCurrent,
        dryRunCurrent,
      }),
      updatedAt: normalizeText(publishLiveStep?.updatedAt || run.finishedAt || run.updatedAt) || null,
      liveUpdatedAt: normalizeText(publishLiveStep?.updatedAt || (publishActionLive ? run.finishedAt || run.updatedAt : "")) || null,
      dryRunUpdatedAt: normalizeText(publishDryRunStep?.updatedAt || (publishActionDryRun ? run.finishedAt || run.updatedAt : "")) || null,
      liveCurrent,
      dryRunCurrent,
      summary: normalizeText(publishLiveStep?.summary || publishDryRunStep?.summary || ""),
    },
    coverage: null,
    nextActionLabel: "",
    nextActionCommand: "",
    nextActionReason: "",
    workflowStatuses: {},
    blockers: toInteger(inferredCounts.fail) || 0,
    warnings: toInteger(inferredCounts.warn) || 0,
  };
}

function buildSeriesReadinessSnapshot(entry, workflow = null) {
  if (!entry) {
    return null;
  }

  const hydratedWorkflow = workflow || buildSeriesWorkflow(entry);
  const validationArtifact = entry?.artifacts?.validation || null;
  const publishArtifact = entry?.artifacts?.publish || null;
  const publishDryRunArtifact = publishArtifact?.summary?.dryRun === true ? publishArtifact : null;
  const publishLiveArtifact = publishArtifact?.summary?.dryRun === false ? publishArtifact : null;
  const validationStep = Array.isArray(hydratedWorkflow?.publish?.steps)
    ? hydratedWorkflow.publish.steps.find((step) => step.key === "validate-series")
    : null;
  const livePublishStep = Array.isArray(hydratedWorkflow?.publish?.steps)
    ? hydratedWorkflow.publish.steps.find((step) => step.key === "publish-series-live")
    : null;
  const coverage = validationArtifact?.summary?.coverage || {};
  const counts = validationArtifact?.summary?.counts || {};
  const liveCurrent = Boolean(
    validationArtifact?.summary?.publishReady === true
      && publishLiveArtifact
      && isArtifactFresh(publishLiveArtifact, validationArtifact)
  );
  const dryRunCurrent = Boolean(
    validationArtifact?.summary?.publishReady === true
      && publishDryRunArtifact
      && isArtifactFresh(publishDryRunArtifact, validationArtifact)
  );

  return {
    capturedAt: new Date().toISOString(),
    source: "persisted-series-state",
    limited: false,
    seriesConfigKey: normalizeText(entry.slug) || null,
    seriesLabel: normalizeText(entry.label) || normalizeText(entry.slug) || null,
    enabled: entry.enabled === true,
    liveSeriesCurrent: isLiveSeriesCurrent(entry, hydratedWorkflow),
    headline: normalizeText(hydratedWorkflow?.headline),
    note: normalizeText(hydratedWorkflow?.note),
    validation: {
      status: normalizeText(validationStep?.status || ""),
      label: buildValidationReadinessLabel(validationStep?.status, validationArtifact?.summary?.publishReady === true, counts),
      publishReady: validationArtifact?.summary?.publishReady === true,
      updatedAt: normalizeText(validationArtifact?.updatedAt) || null,
      blockingCount: toInteger(counts?.fail) || 0,
      warningCount: toInteger(counts?.warn) || 0,
      summary: normalizeText(validationStep?.summary || validationArtifact?.summary?.message),
    },
    publish: {
      status: normalizeText(livePublishStep?.status || ""),
      label: buildLivePublishLabel(livePublishStep?.status, {
        enabled: entry.enabled === true,
        liveCurrent,
        dryRunCurrent,
      }),
      updatedAt: normalizeText(publishArtifact?.updatedAt) || null,
      liveUpdatedAt: normalizeText(publishLiveArtifact?.updatedAt) || null,
      dryRunUpdatedAt: normalizeText(publishDryRunArtifact?.updatedAt) || null,
      liveCurrent,
      dryRunCurrent,
      summary: normalizeText(livePublishStep?.summary || publishArtifact?.summary?.message),
    },
    coverage: validationArtifact?.summary?.coverage
      ? {
          divisionCount: toInteger(coverage?.divisionCount) || 0,
          matchCount: toInteger(coverage?.matchCount) || 0,
          requiredParsedMatchCount: toInteger(coverage?.requiredParsedMatchCount) || 0,
          parsedMatchCount: toInteger(coverage?.parsedMatchCount) || 0,
          parsedCoveragePct: Number.isFinite(Number(coverage?.parsedCoveragePct)) ? Number(coverage.parsedCoveragePct) : null,
          seasonRowCount: toInteger(coverage?.seasonRowCount) || 0,
          compositeRowCount: toInteger(coverage?.compositeRowCount) || 0,
          intelligenceProfileCount: toInteger(coverage?.intelligenceProfileCount) || 0,
        }
      : null,
    nextActionLabel: normalizeText(hydratedWorkflow?.nextRecommendedAction?.label),
    nextActionCommand: normalizeText(hydratedWorkflow?.nextRecommendedAction?.command),
    nextActionReason: normalizeText(hydratedWorkflow?.nextRecommendedAction?.reason),
    workflowStatuses: {
      onboarding: normalizeText(hydratedWorkflow?.onboarding?.status),
      refresh: normalizeText(hydratedWorkflow?.refresh?.status),
      publish: normalizeText(hydratedWorkflow?.publish?.status),
    },
    blockers: toInteger(counts?.fail) || 0,
    warnings: toInteger(counts?.warn) || 0,
  };
}

function loadSeriesSnapshotForRun(seriesConfigKey) {
  const seriesSlug = normalizeText(seriesConfigKey);
  if (!seriesSlug) {
    return null;
  }

  try {
    const config = loadYamlConfig(CONFIG_PATH);
    const seriesEntries = Array.isArray(config?.series) ? config.series : [];
    const seriesEntry = seriesEntries.find((entry) => normalizeText(entry?.slug) === seriesSlug) || null;
    if (!seriesEntry) {
      return null;
    }
    const overviewEntry = buildSeriesOverviewEntry(seriesEntry);
    const workflow = buildSeriesWorkflow(overviewEntry);
    return buildSeriesReadinessSnapshot(overviewEntry, workflow);
  } catch (error) {
    return null;
  }
}

function resolveRunReadinessSnapshot(run = {}, options = {}) {
  if (run?.seriesStateSnapshot) {
    return run.seriesStateSnapshot;
  }

  if (options.currentEntry) {
    const currentSnapshot = buildSeriesReadinessSnapshot(options.currentEntry, options.currentWorkflow || buildSeriesWorkflow(options.currentEntry));
    if (currentSnapshot) {
      return currentSnapshot;
    }
  }

  return buildRunSnapshotFromWorkflowInference(run);
}

function buildRunComparisonChange(key, label, before, after, tone = "") {
  if (!before && !after) {
    return null;
  }
  if (String(before || "") === String(after || "")) {
    return null;
  }
  return {
    key,
    label,
    before: before || "Not recorded",
    after: after || "Not recorded",
    tone: normalizeText(tone),
  };
}

function buildRunComparisonSummary(latestRun, previousRun, changes = [], limited = false) {
  const majorChanges = changes.filter((change) =>
    ["run-status", "validation", "live-publish", "parsed-coverage", "next-action"].includes(change.key)
  );

  if (!majorChanges.length) {
    return {
      summary: `No readiness movement was recorded between ${latestRun?.actionLabel || latestRun?.actionKey || "the latest run"} and ${previousRun?.actionLabel || previousRun?.actionKey || "the previous run"}.`,
      note: limited ? "One or both runs use inferred history because they predate persisted readiness snapshots." : "",
    };
  }

  const headline = majorChanges
    .slice(0, 2)
    .map((change) => `${change.label} moved from ${change.before} to ${change.after}.`)
    .join(" ");

  return {
    summary: headline,
    note: limited ? "One or both runs use inferred history because they predate persisted readiness snapshots." : "",
  };
}

function buildRunComparison(latestRun = null, previousRun = null, latestSnapshot = null, previousSnapshot = null) {
  if (!latestRun || !previousRun) {
    return {
      available: false,
      summary: "A previous run is not available for comparison yet.",
      note: "",
      changes: [],
    };
  }

  const latestResolvedSnapshot = latestSnapshot || resolveRunReadinessSnapshot(latestRun);
  const previousResolvedSnapshot = previousSnapshot || resolveRunReadinessSnapshot(previousRun);
  const limited = Boolean(
    !latestResolvedSnapshot
      || !previousResolvedSnapshot
      || latestResolvedSnapshot?.limited
      || previousResolvedSnapshot?.limited
  );
  const changes = [
    buildRunComparisonChange(
      "run-status",
      "Run status",
      workflowStatusLabel(previousRun.status),
      workflowStatusLabel(latestRun.status),
      normalizeText(latestRun.status).toLowerCase() === "completed" ? "good" : ""
    ),
    buildRunComparisonChange(
      "validation",
      "Validation",
      previousResolvedSnapshot?.validation?.label,
      latestResolvedSnapshot?.validation?.label,
      latestResolvedSnapshot?.validation?.publishReady ? "good" : latestResolvedSnapshot?.blockers > 0 ? "bad" : ""
    ),
    buildRunComparisonChange(
      "live-publish",
      "Live publish",
      previousResolvedSnapshot?.publish?.label,
      latestResolvedSnapshot?.publish?.label,
      latestResolvedSnapshot?.publish?.liveCurrent ? "good" : ""
    ),
    buildRunComparisonChange(
      "parsed-coverage",
      "Parsed coverage",
      previousResolvedSnapshot?.coverage ? formatCoverageValueLabel(previousResolvedSnapshot.coverage) : "",
      latestResolvedSnapshot?.coverage ? formatCoverageValueLabel(latestResolvedSnapshot.coverage) : "",
      ""
    ),
    buildRunComparisonChange(
      "next-action",
      "Recommended next step",
      previousResolvedSnapshot?.nextActionLabel,
      latestResolvedSnapshot?.nextActionLabel,
      ""
    ),
  ].filter(Boolean);
  const summary = buildRunComparisonSummary(latestRun, previousRun, changes, limited);

  return {
    available: true,
    limited,
    latestRunId: normalizeText(latestRun.runId),
    previousRunId: normalizeText(previousRun.runId),
    latestRun: {
      runId: normalizeText(latestRun.runId),
      actionLabel: normalizeText(latestRun.actionLabel || latestRun.actionKey),
      status: normalizeText(latestRun.status),
      createdAt: normalizeText(latestRun.createdAt || latestRun.startedAt),
    },
    previousRun: {
      runId: normalizeText(previousRun.runId),
      actionLabel: normalizeText(previousRun.actionLabel || previousRun.actionKey),
      status: normalizeText(previousRun.status),
      createdAt: normalizeText(previousRun.createdAt || previousRun.startedAt),
    },
    latestSnapshot: latestResolvedSnapshot || null,
    previousSnapshot: previousResolvedSnapshot || null,
    changes,
    summary: normalizeText(summary.summary),
    note: normalizeText(summary.note),
  };
}

function buildRunTriage(recentRuns = []) {
  const items = (Array.isArray(recentRuns) ? recentRuns : [])
    .filter((run) => {
      const runStatus = normalizeText(run?.status).toLowerCase();
      return RUN_TRIAGE_STATUSES.has(runStatus) || (run?.workflowStoppedEarly === true && runStatus !== "completed");
    })
    .slice(0, 3)
    .map((run) => ({
      ...run,
      triageReason: normalizeText(run.workflowStopReason || run.note || run.summary || run.message),
      triageActionLabel: normalizeText(run.workflowResume?.label || (run.retryInput ? "Retry Run" : "")),
      triageCommand: normalizeText(run.workflowResume?.command || run.commandPreview),
    }));

  return {
    itemCount: items.length,
    items,
    summary: items.length
      ? `${items.length} recent run${items.length === 1 ? "" : "s"} need attention before you trust the workflow state.`
      : "No interrupted, failed, stale, or canceled runs are waiting for operator follow-up.",
    note: items.length
      ? "Resume from the saved workflow step when possible. Retry the whole run only when the saved step state is no longer trustworthy."
      : "",
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
    payloadOverrides: options.payloadOverrides || null,
    confirmLive: options.confirmLive === true,
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
  const showPreset = countStatus(requiredSteps, "pending") > 0 || countStatus(requiredSteps, "stale") > 0 || countStatus(requiredSteps, "blocked") > 0;
  const presets = [
    buildWorkflowPreset(
      "workflow-onboarding",
      "Run Onboarding Dry Run",
      "Queues the remaining required onboarding steps and stops at publish simulation.",
      {
        visible: showPreset,
        payloadOverrides: { dryRun: true },
      }
    ),
    buildWorkflowPreset(
      "workflow-onboarding",
      "Run Onboarding Live Publish",
      "Queues the remaining required onboarding steps and applies the live publish after validation clears.",
      {
        visible: showPreset,
        variant: "warn",
        payloadOverrides: { dryRun: false },
        confirmLive: true,
      }
    ),
  ];

  return {
    label: "New Series Onboarding",
    status:
      countStatus(requiredSteps, "blocked") > 0
        ? "blocked"
        : countStatus(requiredSteps, "stale") > 0 || countStatus(requiredSteps, "pending") > 0
          ? "in_progress"
          : "complete",
    preset: presets[0],
    presets,
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
  const presets = [
    buildWorkflowPreset(
      "workflow-refresh",
      "Run Refresh Dry Run",
      "Queues refresh, recompute, validation, and publish dry run for the selected series.",
      {
        variant: "secondary",
        payloadOverrides: { dryRun: true },
      }
    ),
    buildWorkflowPreset(
      "workflow-refresh",
      "Run Refresh Live Publish",
      "Queues refresh, recompute, validation, and applies live publish after the validation gate clears.",
      {
        variant: "warn",
        payloadOverrides: { dryRun: false },
        confirmLive: true,
      }
    ),
  ];

  return {
    label: "Existing Series Refresh",
    status: !refresh ? "standby" : hasRefreshWork ? "in_progress" : "complete",
    preset: presets[0],
    presets,
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
  const showPreset = countStatus(steps, "pending") > 0 || countStatus(steps, "stale") > 0 || countStatus(steps, "blocked") > 0;
  const presets = [
    buildWorkflowPreset(
      "workflow-publish",
      "Validate + Dry Run",
      "Runs the validation gate first, then executes the publish dry run only.",
      {
        variant: "secondary",
        visible: showPreset,
        payloadOverrides: { dryRun: true },
      }
    ),
    buildWorkflowPreset(
      "workflow-publish",
      "Validate + Live Publish",
      "Runs validation, publish dry run, and then applies live publish when the gate is clear.",
      {
        variant: "warn",
        visible: showPreset,
        payloadOverrides: { dryRun: false },
        confirmLive: true,
      }
    ),
  ];

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
    preset: presets[0],
    presets,
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

function buildWorkflowPlanStep(stepKey, actionKey, label, payload, seriesConfigKey) {
  return {
    key: normalizeText(stepKey) || normalizeText(actionKey).toLowerCase(),
    actionKey: normalizeText(actionKey).toLowerCase(),
    label: normalizeText(label) || buildActionLabel(actionKey),
    payload: payload || {},
    command: buildActionCommand(actionKey, seriesConfigKey, payload || {}),
  };
}

function sliceWorkflowStepsFrom(steps, input = {}, workflowLabel = "Workflow") {
  const fromStep = normalizeText(input.fromStep).toLowerCase();
  if (!fromStep) {
    return {
      steps,
      startIndex: 0,
      startFromStepKey: null,
      startFromStepLabel: null,
    };
  }

  const startIndex = steps.findIndex((step) => {
    const stepKey = normalizeText(step?.key).toLowerCase();
    const actionKey = normalizeText(step?.actionKey).toLowerCase();
    return stepKey === fromStep || actionKey === fromStep;
  });

  if (startIndex < 0) {
    throw createLocalOpsActionError(`Workflow step was not found for ${workflowLabel}: ${input.fromStep}`, 400);
  }

  return {
    steps: steps.slice(startIndex),
    startIndex,
    startFromStepKey: normalizeText(steps[startIndex]?.key) || null,
    startFromStepLabel: normalizeText(steps[startIndex]?.label) || null,
  };
}

function buildWorkflowPlanSummarySteps(steps = []) {
  return steps.map((step) => ({
    key: normalizeText(step?.key),
    actionKey: normalizeText(step?.actionKey).toLowerCase(),
    label: normalizeText(step?.label),
    dryRun: step?.actionKey === "publish-series" ? toBoolean(step?.payload?.dryRun) : undefined,
    command: normalizeText(step?.command),
  }));
}

function buildWorkflowRerunOption(workflowActionKey, seriesConfigKey, input = {}, step) {
  const stepKey = normalizeText(step?.key);
  if (!stepKey) {
    return null;
  }

  const payload = buildRetryInput({
    ...input,
    series: seriesConfigKey,
    fromStep: stepKey,
  });

  return {
    key: stepKey,
    label: normalizeText(step?.label) || stepKey,
    action: normalizeText(workflowActionKey).toLowerCase(),
    payload,
    command: buildWorkflowCommandPreview(workflowActionKey, payload),
    confirmLive: resolveWorkflowDryRun(payload) === false,
  };
}

function buildWorkflowResumeOption(workflowActionKey, seriesConfigKey, input = {}, step) {
  const option = buildWorkflowRerunOption(workflowActionKey, seriesConfigKey, input, step);
  if (!option) {
    return null;
  }

  return {
    ...option,
    label: `Resume from ${option.label}`,
  };
}

function updateWorkflowRunState(runContext, workflowActionKey, seriesConfigKey, input, plan, stepStates, options = {}) {
  if (typeof runContext?.update !== "function") {
    return;
  }

  const planSteps = Array.isArray(plan?.summarySteps) ? plan.summarySteps : [];
  const resumeOption = options.resumeStep
    ? buildWorkflowResumeOption(workflowActionKey, seriesConfigKey, input, options.resumeStep)
    : null;

  runContext.update({
    workflowKey: normalizeText(plan?.workflowKey),
    workflowLabel: normalizeText(plan?.label),
    workflowDryRun: resolveWorkflowDryRun(input),
    workflowRequestedSteps: Array.isArray(plan?.steps) ? plan.steps.length : 0,
    workflowSkippedSteps: toInteger(plan?.skippedCount) || 0,
    workflowStartStepKey: normalizeText(plan?.startFromStepKey),
    workflowStartStepLabel: normalizeText(plan?.startFromStepLabel),
    workflowPlanSteps: planSteps,
    workflowSteps: Array.isArray(stepStates) ? stepStates.map((step) => ({ ...step })) : [],
    workflowRerunOptions: planSteps
      .map((step) => buildWorkflowRerunOption(workflowActionKey, seriesConfigKey, input, step))
      .filter(Boolean),
    workflowResume: resumeOption,
    workflowStoppedEarly: options.stoppedEarly === true,
    workflowStopReason: normalizeText(options.stopReason),
  });
}

function listPersistedRunStatusPaths() {
  const roots = [];

  if (fs.existsSync(LOCAL_OPS_SERIES_DIR)) {
    fs.readdirSync(LOCAL_OPS_SERIES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        roots.push(path.join(LOCAL_OPS_SERIES_DIR, entry.name));
      });
  }

  const globalRoot = path.join(LOCAL_OPS_DIR, "global");
  if (fs.existsSync(globalRoot)) {
    roots.push(globalRoot);
  }

  return roots.flatMap((rootPath) => {
    const runsDir = path.join(rootPath, "runs");
    if (!fs.existsSync(runsDir)) {
      return [];
    }

    return fs.readdirSync(runsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(runsDir, entry.name, "status.json"))
      .filter((statusPath) => fs.existsSync(statusPath));
  });
}

function buildWorkflowRestartResumeOption(workflowActionKey, seriesConfigKey, input = {}, step = null, label = "Resume workflow") {
  if (step) {
    const resumeOption = buildWorkflowResumeOption(workflowActionKey, seriesConfigKey, input, step);
    if (resumeOption) {
      return resumeOption;
    }
  }

  const payload = buildRetryInput({
    ...input,
    series: seriesConfigKey,
  });

  return {
    key: normalizeText(payload.fromStep),
    label,
    action: normalizeText(workflowActionKey).toLowerCase(),
    payload,
    command: buildWorkflowCommandPreview(workflowActionKey, payload),
    confirmLive: resolveWorkflowDryRun(payload) === false,
  };
}

function findWorkflowPlanStep(planSteps = [], stepKey = "") {
  const normalizedKey = normalizeText(stepKey).toLowerCase();
  if (!normalizedKey) {
    return null;
  }

  return planSteps.find((step) => {
    const candidateKey = normalizeText(step?.key).toLowerCase();
    const actionKey = normalizeText(step?.actionKey).toLowerCase();
    return candidateKey === normalizedKey || actionKey === normalizedKey;
  }) || null;
}

function selectWorkflowResumeStepFromRun(run = {}) {
  const workflowSteps = Array.isArray(run.workflowSteps) ? run.workflowSteps : [];
  const planSteps = Array.isArray(run.workflowPlanSteps) ? run.workflowPlanSteps : [];
  const priorStatus = normalizeText(run.status).toLowerCase();

  if (priorStatus !== "queued") {
    const activeStep = workflowSteps.find((step) => normalizeText(step?.status).toLowerCase() !== "completed");
    if (activeStep) {
      return findWorkflowPlanStep(planSteps, activeStep.key || activeStep.actionKey) || activeStep;
    }
  }

  const completedKeys = new Set(
    workflowSteps
      .filter((step) => normalizeText(step?.status).toLowerCase() === "completed")
      .map((step) => normalizeText(step?.key).toLowerCase())
      .filter(Boolean)
  );
  const nextPlanStep = planSteps.find((step) => !completedKeys.has(normalizeText(step?.key).toLowerCase()));
  if (nextPlanStep) {
    return nextPlanStep;
  }

  const requestedFromStep = normalizeText(run?.retryInput?.fromStep || run?.workflowStartStepKey);
  if (requestedFromStep) {
    return findWorkflowPlanStep(planSteps, requestedFromStep)
      || workflowSteps.find((step) => {
        const stepKey = normalizeText(step?.key).toLowerCase();
        const actionKey = normalizeText(step?.actionKey).toLowerCase();
        return stepKey === requestedFromStep.toLowerCase() || actionKey === requestedFromStep.toLowerCase();
      })
      || {
        key: requestedFromStep,
        label: normalizeText(run?.workflowStartStepLabel) || requestedFromStep,
      };
  }

  return planSteps[0] || workflowSteps[0] || null;
}

function buildInterruptedWorkflowSteps(run = {}, interruptedAt = "") {
  const workflowSteps = Array.isArray(run.workflowSteps) ? run.workflowSteps : [];
  if (!workflowSteps.length) {
    return workflowSteps;
  }

  if (normalizeText(run.status).toLowerCase() !== "running") {
    return workflowSteps.map((step) => ({ ...step }));
  }

  let interruptedMarked = false;
  return workflowSteps.map((step) => {
    const stepStatus = normalizeText(step?.status).toLowerCase();
    if (!interruptedMarked && INTERRUPTED_WORKFLOW_STEP_STATUSES.has(stepStatus)) {
      interruptedMarked = true;
      return {
        ...step,
        status: "interrupted",
        summary: "Interrupted by API restart before the step finished.",
        updatedAt: interruptedAt || new Date().toISOString(),
      };
    }
    return {
      ...step,
    };
  });
}

function rebuildLatestRunPointersFromDisk(statusPaths = []) {
  const seriesLatest = new Map();
  let latestOverall = null;

  statusPaths.forEach((statusPath) => {
    const run = readJsonIfExists(statusPath);
    if (!run || run.readError || !normalizeText(run.runId)) {
      return;
    }

    const hydratedRun = {
      ...run,
      ...resolvePersistedRunPaths(run, statusPath),
    };
    const compareTimestamp = Math.max(
      toTimestamp(hydratedRun.createdAt || hydratedRun.startedAt),
      toTimestamp(hydratedRun.updatedAt),
      toTimestamp(hydratedRun.finishedAt)
    );

    const seriesKey = normalizeText(hydratedRun.seriesConfigKey) || "__global__";
    const existingSeriesRun = seriesLatest.get(seriesKey);
    const existingSeriesTimestamp = existingSeriesRun
      ? Math.max(
          toTimestamp(existingSeriesRun.createdAt || existingSeriesRun.startedAt),
          toTimestamp(existingSeriesRun.updatedAt),
          toTimestamp(existingSeriesRun.finishedAt)
        )
      : 0;

    if (!existingSeriesRun || compareTimestamp >= existingSeriesTimestamp) {
      seriesLatest.set(seriesKey, hydratedRun);
    }

    const latestOverallTimestamp = latestOverall
      ? Math.max(
          toTimestamp(latestOverall.createdAt || latestOverall.startedAt),
          toTimestamp(latestOverall.updatedAt),
          toTimestamp(latestOverall.finishedAt)
        )
      : 0;
    if (!latestOverall || compareTimestamp >= latestOverallTimestamp) {
      latestOverall = hydratedRun;
    }
  });

  seriesLatest.forEach((run, key) => {
    const latestPath = key === "__global__"
      ? path.join(LOCAL_OPS_DIR, "global", "latest_run.json")
      : path.join(LOCAL_OPS_SERIES_DIR, key, "latest_run.json");
    ensureDir(path.dirname(latestPath));
    writeJsonFile(latestPath, run);
  });

  if (latestOverall) {
    ensureDir(path.dirname(LOCAL_OPS_GLOBAL_RUN_PATH));
    writeJsonFile(LOCAL_OPS_GLOBAL_RUN_PATH, latestOverall);
  }
}

function recoverInterruptedActionRuns() {
  const statusPaths = listPersistedRunStatusPaths();
  if (!statusPaths.length) {
    return {
      recoveredCount: 0,
      touchedCount: 0,
    };
  }

  const recoveredAt = new Date().toISOString();
  let recoveredCount = 0;
  let touchedCount = 0;

  statusPaths.forEach((statusPath) => {
    const run = readJsonIfExists(statusPath);
    if (!run || run.readError || !normalizeText(run.runId)) {
      return;
    }

    const persistedPaths = resolvePersistedRunPaths(run, statusPath);
    const nextState = {
      ...run,
      ...persistedPaths,
    };
    let changed = (
      normalizeText(run.detailPath) !== persistedPaths.detailPath
      || normalizeText(run.statusPath) !== persistedPaths.statusPath
      || normalizeText(run.logPath) !== persistedPaths.logPath
    );

    const priorStatus = normalizeText(run.status).toLowerCase();
    if (RECOVERABLE_RUN_STATUSES.has(priorStatus)) {
      const actionLabel = normalizeText(run.actionLabel) || buildActionLabel(run.actionKey);
      const workflowResume = isWorkflowAction(run.actionKey)
        ? buildWorkflowRestartResumeOption(
          run.actionKey,
          normalizeText(run.seriesConfigKey || run?.retryInput?.series),
          run.retryInput || {},
          selectWorkflowResumeStepFromRun(run),
          priorStatus === "queued" ? "Resume queued workflow" : "Resume interrupted workflow"
        )
        : null;

      const summary = priorStatus === "queued"
        ? `${actionLabel} was queued when the API restarted. Resume it manually if the work is still needed.`
        : `${actionLabel} was interrupted when the API restarted. Resume it manually from the next unfinished step.`;

      nextState.status = "interrupted";
      nextState.ok = null;
      nextState.updatedAt = recoveredAt;
      nextState.finishedAt = recoveredAt;
      nextState.durationMs = Math.max(0, toTimestamp(recoveredAt) - toTimestamp(run.startedAt || run.createdAt || recoveredAt));
      nextState.queuePosition = null;
      nextState.pid = null;
      nextState.summary = summary;
      nextState.message = summary;
      nextState.note = priorStatus === "queued"
        ? "Queued local work did not start before the API restarted. Use Resume or Retry when you want to run it again."
        : "Active local work stopped during API restart. Review the saved log and resume manually when ready.";
      nextState.interruptedFromStatus = priorStatus;
      nextState.interruptedAt = recoveredAt;
      if (isWorkflowAction(run.actionKey)) {
        nextState.workflowSteps = buildInterruptedWorkflowSteps(run, recoveredAt);
        nextState.workflowResume = workflowResume;
        nextState.workflowStoppedEarly = true;
        nextState.workflowStopReason = summary;
      }
      recoveredCount += 1;
      changed = true;
    }

    if (changed) {
      writeJsonFile(statusPath, nextState);
      touchedCount += 1;
    }
  });

  rebuildLatestRunPointersFromDisk(statusPaths);

  return {
    recoveredCount,
    touchedCount,
  };
}

function ensureLocalOpsRecoveryState() {
  if (localOpsRecoveryInitialized) {
    return;
  }

  localOpsRecoveryInitialized = true;
  recoverInterruptedActionRuns();
}

function buildWorkflowStepLogSlices(run = {}, logLines = []) {
  const planSteps = Array.isArray(run.workflowPlanSteps) ? run.workflowPlanSteps : [];
  const workflowSteps = Array.isArray(run.workflowSteps) ? run.workflowSteps : [];
  const actualByKey = new Map(
    workflowSteps
      .map((step) => [normalizeText(step?.key).toLowerCase(), step])
      .filter(([key]) => Boolean(key))
  );
  const baseSteps = planSteps.length ? planSteps : workflowSteps;
  if (!baseSteps.length) {
    return [];
  }

  const slices = baseSteps.map((step, index) => {
    const stepKey = normalizeText(step?.key || step?.actionKey);
    const actual = actualByKey.get(stepKey.toLowerCase()) || workflowSteps[index] || null;
    return {
      key: stepKey,
      actionKey: normalizeText((actual || step)?.actionKey).toLowerCase(),
      label: normalizeText((actual || step)?.label) || stepKey || `Step ${index + 1}`,
      status: normalizeText(actual?.status || step?.status).toLowerCase() || "pending",
      summary: normalizeText(actual?.summary || step?.summary),
      updatedAt: actual?.updatedAt || step?.updatedAt || null,
      dryRun: typeof actual?.dryRun === "boolean"
        ? actual.dryRun
        : typeof step?.dryRun === "boolean"
          ? step.dryRun
          : undefined,
      command: normalizeText(actual?.command || step?.command),
      logLines: [],
    };
  });

  const findSliceForStartLine = (label) => {
    const normalizedLabel = normalizeText(label).toLowerCase();
    return slices.find((slice) => {
      const sliceLabel = normalizeText(slice.label).toLowerCase();
      const sliceKey = normalizeText(slice.key).toLowerCase();
      return sliceLabel === normalizedLabel || sliceKey === normalizedLabel;
    }) || null;
  };

  let activeSlice = null;
  logLines.forEach((line) => {
    const startMatch = line.match(/\[workflow\]\s+\d+\/\d+\s+(.*?): start$/);
    if (startMatch) {
      activeSlice = findSliceForStartLine(startMatch[1]);
    }
    if (activeSlice) {
      activeSlice.logLines.push(line);
    }
  });

  return slices.map((slice) => ({
    ...slice,
    logLines: slice.logLines.slice(-LOCAL_OPS_RUN_DETAIL_STEP_LOG_LIMIT),
  }));
}

function findPersistedRunStatusPath(runId) {
  const targetRunId = normalizeText(runId);
  if (!targetRunId) {
    return null;
  }

  const statusPaths = listPersistedRunStatusPaths();
  for (const statusPath of statusPaths) {
    const payload = readJsonIfExists(statusPath);
    if (payload && !payload.readError && normalizeText(payload.runId) === targetRunId) {
      return statusPath;
    }
  }

  return null;
}

function getLocalOpsRunDetail(runId) {
  ensureLocalOpsRecoveryState();
  const targetRunId = normalizeText(runId);
  if (!targetRunId) {
    throw createLocalOpsActionError("A local ops run id is required.", 400);
  }

  const statusPath = findPersistedRunStatusPath(targetRunId);
  if (!statusPath) {
    throw createLocalOpsActionError(`Local ops run was not found: ${targetRunId}`, 404);
  }

  const rawStatus = readJsonIfExists(statusPath);
  if (!rawStatus || rawStatus.readError) {
    throw createLocalOpsActionError(`Local ops run status could not be read: ${targetRunId}`, 500);
  }

  const config = loadYamlConfig(CONFIG_PATH);
  const seriesEntries = Array.isArray(config?.series) ? config.series : [];
  const seriesEntry = seriesEntries.find((entry) => normalizeText(entry?.slug) === normalizeText(rawStatus.seriesConfigKey)) || null;
  const overviewEntry = seriesEntry ? buildSeriesOverviewEntry(seriesEntry) : null;
  const workflow = overviewEntry ? buildSeriesWorkflow(overviewEntry) : null;
  const hydratedRun = deriveLatestRunStatus({
    ...rawStatus,
    ...resolvePersistedRunPaths(rawStatus, statusPath),
  }, overviewEntry);
  const logLines = readLogLines(hydratedRun.logPath, LOCAL_OPS_RUN_DETAIL_LOG_LIMIT);
  const artifactPayload = hydratedRun.artifactPath ? readJsonIfExists(hydratedRun.artifactPath) : null;
  const recentRuns = normalizeText(hydratedRun.seriesConfigKey)
    ? readRecentActionRuns(hydratedRun.seriesConfigKey, overviewEntry, LOCAL_OPS_RUN_HISTORY_LIMIT + 4)
    : [];
  const currentRunIndex = recentRuns.findIndex((candidate) => normalizeText(candidate?.runId) === targetRunId);
  const previousRun = currentRunIndex >= 0 ? recentRuns[currentRunIndex + 1] || null : null;
  const comparison = buildRunComparison(
    hydratedRun,
    previousRun,
    resolveRunReadinessSnapshot(hydratedRun, {
      currentEntry: currentRunIndex === 0 ? overviewEntry : null,
      currentWorkflow: currentRunIndex === 0 ? workflow : null,
    }),
    resolveRunReadinessSnapshot(previousRun)
  );
  const runTriage = buildRunTriage(recentRuns);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    run: hydratedRun,
    series: {
      configKey: normalizeText(hydratedRun.seriesConfigKey),
      label: normalizeText(seriesEntry?.label),
      sourceSystem: normalizeText(seriesEntry?.source_system || seriesEntry?.sourceSystem),
      seasonYear: toInteger(seriesEntry?.season_year),
      targetAgeGroup: normalizeText(seriesEntry?.targeting?.age_group),
    },
    files: {
      detailPath: normalizeText(hydratedRun.detailPath),
      statusPath: normalizeText(hydratedRun.statusPath || statusPath),
      logPath: normalizeText(hydratedRun.logPath),
      artifactPath: normalizeText(hydratedRun.artifactPath),
    },
    rawStatus,
    artifact: artifactPayload,
    logLines,
    workflowStepLogs: buildWorkflowStepLogSlices(hydratedRun, logLines),
    previousRunComparison: comparison,
    runTriage,
    recentRuns,
  };
}

function buildWorkflowPublishSteps(input = {}) {
  const workflowDryRun = resolveWorkflowDryRun(input);
  const basePayload = buildWorkflowActionPayload(input);
  const steps = [
    buildWorkflowPlanStep(
      "publish-series-dry-run",
      "publish-series",
      "Run publish dry run",
      {
        ...basePayload,
        dryRun: true,
      },
      normalizeText(input.series)
    ),
  ];

  if (!workflowDryRun) {
    steps.push(buildWorkflowPlanStep(
      "publish-series-live",
      "publish-series",
      "Apply live publish",
      {
        ...basePayload,
        dryRun: false,
      },
      normalizeText(input.series)
    ));
  }

  return steps;
}

function buildOnboardingWorkflowExecutionPlan(entry, input = {}) {
  const requiredSteps = Array.isArray(entry?.workflow?.onboarding?.steps)
    ? entry.workflow.onboarding.steps.filter((step) => step.optional !== true)
    : [];
  const rerunMode = Boolean(normalizeText(input.fromStep));
  const candidateSteps = [];

  requiredSteps.forEach((step) => {
    if (!step?.action) {
      return;
    }

    if (step.action === "publish-series") {
      if (rerunMode || step.status === "pending" || step.status === "stale") {
        candidateSteps.push(...buildWorkflowPublishSteps(buildWorkflowActionPayload(input, step.payloadOverrides || {})));
      }
      return;
    }

    if (rerunMode || step.status === "pending" || step.status === "stale" || (step.action === "validate-series" && step.status === "blocked")) {
      candidateSteps.push(buildWorkflowPlanStep(
        step.key || step.action,
        step.action,
        step.label,
        buildWorkflowActionPayload(input, step.payloadOverrides || {}),
        entry.slug
      ));
    }
  });

  const selection = sliceWorkflowStepsFrom(candidateSteps, input, "New Series Onboarding");
  const steps = selection.steps;
  const skippedCount = rerunMode
    ? selection.startIndex
    : requiredSteps.filter((step) => step.status === "complete").length;

  return {
    workflowKey: "onboarding",
    label: "New Series Onboarding",
    steps,
    summarySteps: buildWorkflowPlanSummarySteps(steps),
    skippedCount,
    startFromStepKey: selection.startFromStepKey,
    startFromStepLabel: selection.startFromStepLabel,
    message: steps.length
      ? selection.startFromStepLabel
        ? `Queued ${steps.length} onboarding step(s) for ${entry.label || entry.slug} starting from ${selection.startFromStepLabel}.`
        : `Queued ${steps.length} onboarding step(s) for ${entry.label || entry.slug}.`
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

  const candidateSteps = [
    buildWorkflowPlanStep(
      useMatchRefresh ? "refresh-match" : "refresh-series",
      useMatchRefresh ? "refresh-match" : "refresh-series",
      useMatchRefresh ? "Refresh selected match" : "Refresh series",
      refreshPayload,
      entry.slug
    ),
    buildWorkflowPlanStep(
      "compute-season",
      "compute-season",
      "Recompute season aggregation",
      buildWorkflowActionPayload(input),
      entry.slug
    ),
    buildWorkflowPlanStep(
      "compute-composite",
      "compute-composite",
      "Recompute composite scoring",
      buildWorkflowActionPayload(input),
      entry.slug
    ),
    buildWorkflowPlanStep(
      "compute-intelligence",
      "compute-intelligence",
      "Recompute player intelligence",
      buildWorkflowActionPayload(input),
      entry.slug
    ),
    buildWorkflowPlanStep(
      "validate-series",
      "validate-series",
      "Validate refreshed state",
      buildWorkflowActionPayload(input),
      entry.slug
    ),
    ...buildWorkflowPublishSteps(buildWorkflowActionPayload(input)),
  ];
  const selection = sliceWorkflowStepsFrom(candidateSteps, input, "Existing Series Refresh");
  const steps = selection.steps;

  return {
    workflowKey: "refresh",
    label: "Existing Series Refresh",
    steps,
    summarySteps: buildWorkflowPlanSummarySteps(steps),
    skippedCount: selection.startIndex,
    startFromStepKey: selection.startFromStepKey,
    startFromStepLabel: selection.startFromStepLabel,
    message: selection.startFromStepLabel
      ? `Queued ${steps.length} refresh step(s) for ${entry.label || entry.slug} starting from ${selection.startFromStepLabel}.`
      : `Queued ${steps.length} refresh step(s) for ${entry.label || entry.slug}.`,
  };
}

function buildPublishWorkflowExecutionPlan(entry, input = {}) {
  const candidateSteps = [
    buildWorkflowPlanStep(
      "validate-series",
      "validate-series",
      "Validate publish gate",
      buildWorkflowActionPayload(input),
      entry.slug
    ),
    ...buildWorkflowPublishSteps(buildWorkflowActionPayload(input)),
  ];
  const selection = sliceWorkflowStepsFrom(candidateSteps, input, "Validate And Publish");
  const steps = selection.steps;

  return {
    workflowKey: "publish",
    label: "Validate And Publish",
    steps,
    summarySteps: buildWorkflowPlanSummarySteps(steps),
    skippedCount: selection.startIndex,
    startFromStepKey: selection.startFromStepKey,
    startFromStepLabel: selection.startFromStepLabel,
    message: selection.startFromStepLabel
      ? `Queued ${steps.length} publish step(s) for ${entry.label || entry.slug} starting from ${selection.startFromStepLabel}.`
      : `Queued ${steps.length} publish step(s) for ${entry.label || entry.slug}.`,
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
  const workflowActionKey = normalizeText(actionKey).toLowerCase();
  const logger = typeof runContext?.log === "function" ? runContext.log : () => {};
  const entry = loadSeriesWorkflowEntry(input.series);
  const plan = buildWorkflowExecutionPlan(actionKey, entry, {
    ...input,
    series: entry.slug,
  });
  const stepStates = [];

  logger(`[workflow] ${plan.label}: plan build complete`);
  logger(`[workflow] ${plan.message}`);
  updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
    ...input,
    series: entry.slug,
  }, plan, stepStates);

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    return {
      ok: true,
      actionKey: workflowActionKey,
      seriesConfigKey: entry.slug,
      artifactPath: null,
      result: {
        workflowKey: plan.workflowKey,
        workflowLabel: plan.label,
        dryRun: resolveWorkflowDryRun(input),
        stepsRequested: 0,
        stepsCompleted: 0,
        skippedSteps: plan.skippedCount || 0,
        startFromStepKey: plan.startFromStepKey || null,
        startFromStepLabel: plan.startFromStepLabel || null,
        workflowPlanSteps: plan.summarySteps || [],
        message: plan.message,
      },
      message: plan.message,
    };
  }
  let lastExecution = null;

  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const stepState = {
      key: normalizeText(step.key) || normalizeText(step.actionKey),
      actionKey: normalizeText(step.actionKey).toLowerCase(),
      label: normalizeText(step.label),
      status: "running",
      summary: "Running...",
      updatedAt: new Date().toISOString(),
      dryRun: step.actionKey === "publish-series" ? toBoolean(step.payload?.dryRun) : undefined,
      command: normalizeText(step.command),
    };
    stepStates.push(stepState);
    updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
      ...input,
      series: entry.slug,
    }, plan, stepStates);
    logger(`[workflow] ${index + 1}/${plan.steps.length} ${step.label}: start`);
    try {
      lastExecution = await executeLocalOpsActionInline(step.actionKey, {
        ...step.payload,
        series: entry.slug,
      }, runContext);
    } catch (error) {
      const failureMessage = normalizeText(error?.message) || `${step.label} failed.`;
      stepState.status = "failed";
      stepState.summary = failureMessage;
      stepState.updatedAt = new Date().toISOString();
      updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
        ...input,
        series: entry.slug,
      }, plan, stepStates, {
        stoppedEarly: true,
        stopReason: failureMessage,
        resumeStep: stepState,
      });
      logger(`[workflow] ${index + 1}/${plan.steps.length} ${step.label}: ${failureMessage}`);
      throw error;
    }

    if (lastExecution?.ok === false) {
      const failureMessage = normalizeText(lastExecution?.result?.message || lastExecution?.message) || `${step.label} failed.`;
      stepState.status = "failed";
      stepState.summary = failureMessage;
      stepState.updatedAt = new Date().toISOString();
      updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
        ...input,
        series: entry.slug,
      }, plan, stepStates, {
        stoppedEarly: true,
        stopReason: failureMessage,
        resumeStep: stepState,
      });
      logger(`[workflow] ${index + 1}/${plan.steps.length} ${step.label}: ${failureMessage}`);
      throw createLocalOpsActionError(failureMessage, 500);
    }

    const stepSummary = buildActionCompletionSummary(step.actionKey, lastExecution);
    logger(`[workflow] ${index + 1}/${plan.steps.length} ${step.label}: ${stepSummary}`);
    stepState.status = "completed";
    stepState.summary = stepSummary;
    stepState.updatedAt = new Date().toISOString();

    if (step.actionKey === "refresh-series" || step.actionKey === "refresh-match") {
      const selectedMatchCount = toInteger(lastExecution?.result?.selectedMatchCount) || 0;
      const newMatchCount = toInteger(lastExecution?.result?.inventoryWrite?.newMatchCount) || 0;
      const updatedMatchCount = toInteger(lastExecution?.result?.inventoryWrite?.updatedMatchCount) || 0;
      if (selectedMatchCount === 0 && newMatchCount === 0 && updatedMatchCount === 0) {
        const message = "No refreshed match changes were detected. The guided workflow stopped before recompute.";
        logger(`[workflow] ${message}`);
        updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
          ...input,
          series: entry.slug,
        }, plan, stepStates, {
          stoppedEarly: true,
          stopReason: message,
        });
        return {
          ok: true,
          actionKey: workflowActionKey,
          seriesConfigKey: entry.slug,
          artifactPath: lastExecution?.artifactPath || null,
          result: {
            workflowKey: plan.workflowKey,
            workflowLabel: plan.label,
            dryRun: resolveWorkflowDryRun(input),
            stepsRequested: plan.steps.length,
            stepsCompleted: stepStates.filter((candidate) => candidate.status === "completed").length,
            skippedSteps: plan.skippedCount || 0,
            startFromStepKey: plan.startFromStepKey || null,
            startFromStepLabel: plan.startFromStepLabel || null,
            stoppedEarly: true,
            stopReason: message,
            completedSteps: stepStates.map((candidate) => ({ ...candidate })),
            workflowPlanSteps: plan.summarySteps || [],
            message,
          },
          message,
        };
      }
    }

    if (step.actionKey === "validate-series" && lastExecution?.result?.publishReady !== true) {
      const message = normalizeText(lastExecution?.result?.message)
        || "Validation did not clear the publish gate. The guided workflow stopped before publish.";
      stepState.status = "blocked";
      stepState.summary = stepSummary;
      stepState.updatedAt = new Date().toISOString();
      updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
        ...input,
        series: entry.slug,
      }, plan, stepStates, {
        stoppedEarly: true,
        stopReason: message,
        resumeStep: stepState,
      });
      throw createLocalOpsActionError(message, 409);
    }

    updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
      ...input,
      series: entry.slug,
    }, plan, stepStates);
  }

  const message = `${plan.label} completed. ${stepStates.length} step(s) ran.`;
  logger(`[workflow] ${message}`);
  updateWorkflowRunState(runContext, workflowActionKey, entry.slug, {
    ...input,
    series: entry.slug,
  }, plan, stepStates);

  return {
    ok: true,
    actionKey: workflowActionKey,
    seriesConfigKey: entry.slug,
    artifactPath: lastExecution?.artifactPath || null,
    result: {
      workflowKey: plan.workflowKey,
      workflowLabel: plan.label,
      dryRun: resolveWorkflowDryRun(input),
      stepsRequested: plan.steps.length,
      stepsCompleted: stepStates.filter((candidate) => candidate.status === "completed").length,
      skippedSteps: plan.skippedCount || 0,
      startFromStepKey: plan.startFromStepKey || null,
      startFromStepLabel: plan.startFromStepLabel || null,
      completedSteps: stepStates.map((candidate) => ({ ...candidate })),
      workflowPlanSteps: plan.summarySteps || [],
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
  ensureLocalOpsRecoveryState();
  const config = loadYamlConfig(CONFIG_PATH);
  const seriesEntries = Array.isArray(config?.series) ? config.series : [];
  const series = seriesEntries
    .map(buildSeriesOverviewEntry)
    .sort((left, right) => Number(right.enabled) - Number(left.enabled) || left.label.localeCompare(right.label))
    .map((entry) => {
      const workflow = buildSeriesWorkflow(entry);
      const latestRun = readLatestActionRun(entry.slug, entry);
      const recentRuns = readRecentActionRuns(entry.slug, entry);
      const previousRun = recentRuns.find((run) => normalizeText(run?.runId) !== normalizeText(latestRun?.runId)) || null;
      return {
        ...entry,
        latestRun,
        recentRuns,
        latestRunComparison: buildRunComparison(
          latestRun,
          previousRun,
          resolveRunReadinessSnapshot(latestRun, {
            currentEntry: entry,
            currentWorkflow: workflow,
          }),
          resolveRunReadinessSnapshot(previousRun)
        ),
        runTriage: buildRunTriage(recentRuns),
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
      "local_ops_operator_email_reference_2026-04-30.md",
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
  ensureLocalOpsRecoveryState();
  const action = normalizeText(actionKey).toLowerCase();
  if (action === "cancel-run") {
    return cancelQueuedBackgroundRun(input);
  }

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
  getLocalOpsRunDetail,
  runLocalOpsAction,
};

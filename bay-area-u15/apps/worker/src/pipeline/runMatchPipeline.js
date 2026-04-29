const fs = require("fs");
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
const { withBrowser } = require("../lib/browser");
const { closePool } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");

function toInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function parseMatchIds(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }

  const raw = normalizeText(value);
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function formatDurationMs(value) {
  const milliseconds = Math.max(0, toInteger(value) || 0);
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function buildLogger(log) {
  return typeof log === "function" ? log : console.log;
}

function isTransientPersistError(error) {
  const message = normalizeText(error?.message).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("connection terminated unexpectedly") ||
    message.includes("statement timeout") ||
    message.includes("query read timeout") ||
    message.includes("terminating connection") ||
    message.includes("connection reset")
  );
}

function isTransientFetchError(error) {
  const message = normalizeText(error?.message).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("timeout") ||
    message.includes("target page, context or browser has been closed") ||
    message.includes("net::err_") ||
    message.includes("navigation failed")
  );
}

async function fetchMatchDetailWithRetry(match, options = {}) {
  const maxAttempts = toInteger(options.maxAttempts) || 2;
  const logger = buildLogger(options.log);
  const prefix = normalizeText(options.prefix) || "[fetch]";

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchMatchDetail(match, {
        outDir: options.outDir,
        context: options.context,
      });
    } catch (error) {
      lastError = error;
      const isRetryable = isTransientFetchError(error) && attempt < maxAttempts;

      if (!isRetryable) {
        throw error;
      }

      logger(`${prefix} transient fetch error on attempt ${attempt}: ${normalizeText(error.message)}. Retrying once.`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

async function persistMatchFactsWithRetry(payload, options = {}) {
  const maxAttempts = toInteger(options.maxAttempts) || 2;
  const logger = buildLogger(options.log);
  const prefix = normalizeText(options.prefix) || "[persist]";

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await upsertMatchFacts(payload, {
        seriesConfigKey: options.seriesConfigKey,
      });
    } catch (error) {
      lastError = error;
      const isRetryable = isTransientPersistError(error) && attempt < maxAttempts;

      if (!isRetryable) {
        throw error;
      }

      logger(`${prefix} transient persist error on attempt ${attempt}: ${normalizeText(error.message)}. Retrying once.`);
      await closePool();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

function selectMatches(matches, options = {}) {
  const selectedIds = new Set(parseMatchIds(options.matchIds));
  let selected = Array.isArray(matches) ? [...matches] : [];

  if (selectedIds.size) {
    selected = selected.filter((match) => selectedIds.has(normalizeText(match?.source_match_id)));
  }

  const limit = toInteger(options.matchLimit);
  if (limit !== null && limit > 0) {
    selected = selected.slice(0, limit);
  }

  return selected;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadStagedDiscoveryAndInventory(outDir) {
  const discovery =
    readJsonIfExists(path.join(outDir, "discovery.json")) ||
    readJsonIfExists(path.join(outDir, "series_discovery_debug.json"));
  const inventory =
    readJsonIfExists(path.join(outDir, "match_inventory.json")) ||
    readJsonIfExists(path.join(outDir, "match_inventory_debug.json"));

  if (!discovery || !inventory) {
    throw new Error(
      `Staged discovery/inventory not found under ${outDir}. Run stage or inventory first before using --useStagedInventory.`
    );
  }

  return { discovery, inventory };
}

async function runMatchPipeline({
  series,
  outDir,
  matchLimit,
  matchIds,
  log,
  useStagedInventory,
  headless,
}) {
  const logger = buildLogger(log);
  const weights = loadWeightsConfig(path.resolve(process.cwd(), "config/weights.yaml"));

  let discovery = null;
  let inventory = null;

  if (useStagedInventory === true) {
    ({ discovery, inventory } = loadStagedDiscoveryAndInventory(outDir));
    logger(`[run] ${series.slug}: using staged discovery/inventory from ${outDir}`);
  } else {
    logger(`[run] ${series.slug}: discovery start`);
    discovery = await discoverSeries(series, { outDir });
    await upsertDiscovery(discovery);
    logger(`[run] ${series.slug}: discovery complete (${discovery.divisions.length} divisions)`);

    logger(`[run] ${series.slug}: inventory start`);
    inventory = await enumerateMatches(series, discovery, { outDir });
    await upsertMatchInventory(inventory);
    logger(`[run] ${series.slug}: inventory complete (${inventory.matches.length} matches)`);
    await closePool();
    logger(`[run] ${series.slug}: database pool reset before fact ingest`);
  }

  const limitedMatches = selectMatches(inventory.matches, { matchLimit, matchIds });
  if (!limitedMatches.length) {
    throw new Error("No matches selected for the run. Check --matchIds / --matchLimit.");
  }

  logger(
    `[run] ${series.slug}: selected ${limitedMatches.length} match(es) -> ${limitedMatches
      .map((match) => match.source_match_id)
      .join(", ")}`
  );

  const matchOutputs = [];
  const matchRunSummaries = [];
  const failedMatches = [];
  ensureDir(path.join(outDir, "runs"));

  await withBrowser(
    async (context) => {
      for (let index = 0; index < limitedMatches.length; index += 1) {
        const match = limitedMatches[index];
        const startedAt = Date.now();
        const prefix = `[match ${index + 1}/${limitedMatches.length} • ${match.source_match_id}]`;

        try {
          logger(`${prefix} fetch start`);
          const raw = await fetchMatchDetailWithRetry(match, {
            outDir,
            context,
            prefix,
            log: logger,
            maxAttempts: 2,
          });
          logger(`${prefix} fetch complete`);

          const parseStartedAt = Date.now();
          const scorecard = parseScorecard(raw.rawScorecard);
          const commentary = parseCommentary(raw.rawCommentary, scorecard);
          const reconciliation = reconcileMatch(scorecard, commentary);
          const advanced = computeAdvancedMetrics({ raw, scorecard, commentary, reconciliation }, weights);
          logger(
            `${prefix} parse complete (${commentary.ballEvents.length} ball events, ${commentary.overSummaries.length} overs, ${commentary.fieldingEvents.length} fielding events)`
          );

          const persistStartedAt = Date.now();
          const persisted = await persistMatchFactsWithRetry(
            {
              match,
              raw,
              scorecard,
              commentary,
              reconciliation,
              advanced,
            },
            {
              seriesConfigKey: series.slug,
              prefix,
              log: logger,
              maxAttempts: 2,
            }
          );
          logger(`${prefix} persist complete (${formatDurationMs(Date.now() - persistStartedAt)})`);

          const matchOutput = {
            match,
            raw,
            scorecard,
            commentary,
            reconciliation,
            advanced,
            persisted,
          };

          const matchSummary = {
            sourceMatchId: match.source_match_id,
            divisionLabel: match.division_label,
            scorecardUrl: match.scorecard_url,
            ballByBallUrl: raw.rawCommentary?.sourceUrl,
            inningsCount: scorecard.innings.length,
            battingRowCount: scorecard.battingInnings.length,
            bowlingRowCount: scorecard.bowlingSpells.length,
            fieldingEventCount: commentary.fieldingEvents.length,
            ballEventCount: commentary.ballEvents.length,
            overSummaryCount: commentary.overSummaries.length,
            annotatedBallEventCount: advanced.outputs.annotatedBallEvents.length,
            playerMatchAdvancedCount: advanced.outputs.playerMatchAdvanced.length,
            playerMatchupCount: advanced.outputs.playerMatchups.length,
            fetchDurationMs: parseStartedAt - startedAt,
            parseDurationMs: persistStartedAt - parseStartedAt,
            persistDurationMs: Date.now() - persistStartedAt,
            totalDurationMs: Date.now() - startedAt,
            persisted,
          };

          writeJsonFile(path.join(outDir, "runs", `${match.source_match_id}.json`), matchSummary);
          const staleErrorPath = path.join(outDir, "runs", `${match.source_match_id}.error.json`);
          if (fs.existsSync(staleErrorPath)) {
            fs.unlinkSync(staleErrorPath);
          }
          matchOutputs.push(matchOutput);
          matchRunSummaries.push(matchSummary);
          logger(`${prefix} done in ${formatDurationMs(matchSummary.totalDurationMs)}`);
        } catch (error) {
          const failure = {
            sourceMatchId: match.source_match_id,
            scorecardUrl: match.scorecard_url,
            message: normalizeText(error?.message || error),
            stack: normalizeText(error?.stack),
            totalDurationMs: Date.now() - startedAt,
          };
          failedMatches.push(failure);
          writeJsonFile(path.join(outDir, "runs", `${match.source_match_id}.error.json`), failure);
          logger(`${prefix} failed: ${failure.message}`);
        } finally {
          await closePool();
        }
      }
    },
    { headless: headless === true ? true : false }
  );

  const summary = {
    series: series.slug,
    weightsVersion: weights.version,
    discoveredDivisionCount: discovery.divisions.length,
    inventoriedMatchCount: inventory.matches.length,
    selectedMatchIds: limitedMatches.map((match) => match.source_match_id),
    attemptedMatchCount: limitedMatches.length,
    processedMatchCount: matchOutputs.length,
    failedMatchCount: failedMatches.length,
    failedMatches,
    matchRuns: matchRunSummaries,
  };

  writeJsonFile(path.join(outDir, "match_pipeline_debug.json"), { summary, matchOutputs });
  return summary;
}

module.exports = {
  runMatchPipeline,
};

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function isCompletedInventoryMatch(match = {}) {
  return normalizeText(match.sourceStatus).toLowerCase() === "completed";
}

function partitionRefreshCandidates(candidates = [], options = {}) {
  const requestedSourceMatchIds = new Set(
    (Array.isArray(options.requestedSourceMatchIds) ? options.requestedSourceMatchIds : [])
      .map((sourceMatchId) => normalizeText(sourceMatchId))
      .filter(Boolean)
  );
  const selected = [];
  const deferred = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const sourceMatchId = normalizeText(candidate?.sourceMatchId);
    const explicitlyRequested = requestedSourceMatchIds.has(sourceMatchId);
    const needsRefresh =
      candidate?.needsRescrape === true ||
      candidate?.needsReparse === true ||
      candidate?.needsRecompute === true;

    if (!explicitlyRequested && !needsRefresh) {
      continue;
    }

    if (isCompletedInventoryMatch(candidate)) {
      selected.push(candidate);
    } else {
      deferred.push(candidate);
    }
  }

  return {
    selected,
    deferred,
  };
}

function isPipelineSuccessful(summary = {}) {
  const attemptedMatchCount = Number(summary.attemptedMatchCount) || 0;
  const processedMatchCount = Number(summary.processedMatchCount) || 0;
  const failedMatchCount = Number(summary.failedMatchCount) || 0;

  return attemptedMatchCount === processedMatchCount && failedMatchCount === 0;
}

module.exports = {
  isCompletedInventoryMatch,
  partitionRefreshCandidates,
  isPipelineSuccessful,
};

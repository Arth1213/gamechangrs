"use strict";

const {
  getPlayerReport,
  searchPlayers,
} = require("./reportService");
const {
  resolveDefaultSeriesContext,
  withClient,
} = require("./seriesService");

async function loadDefaultSeriesContext() {
  const context = await withClient(async (client) => {
    return resolveDefaultSeriesContext(client);
  });

  if (!context) {
    const error = new Error("No default series configuration is available.");
    error.statusCode = 404;
    throw error;
  }

  return context;
}

async function searchPlayersDefault(input) {
  const context = await loadDefaultSeriesContext();
  return searchPlayers({
    seriesConfigKey: context.configKey,
    query: input.query,
    limit: input.limit,
  });
}

async function getPlayerReportDefault(input) {
  const context = await loadDefaultSeriesContext();
  return getPlayerReport({
    seriesConfigKey: context.configKey,
    playerId: input.playerId,
    divisionId: input.divisionId,
  });
}

async function getPlayerSummaryDefault(input) {
  const report = await getPlayerReportDefault(input);

  return {
    meta: report.meta,
    header: report.header,
    scores: report.scores,
    assessmentSnapshot: report.assessmentSnapshot,
    visualReadout: report.visualReadout,
    contextPerformance: report.contextPerformance,
    peerComparison: report.peerComparison,
    selectorInterpretation: report.selectorInterpretation,
    selectorTakeaway: report.selectorTakeaway,
    standardStats: report.standardStats,
  };
}

module.exports = {
  getPlayerReportDefault,
  getPlayerSummaryDefault,
  searchPlayersDefault,
};

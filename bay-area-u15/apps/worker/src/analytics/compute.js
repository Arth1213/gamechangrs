function computeAdvancedMetrics(matchFacts, weightsConfig) {
  return {
    status: "todo",
    weightsVersion: weightsConfig.version,
    outputs: {
      playerMatchAdvanced: [],
      playerMatchups: [],
      playerSeasonAdvanced: [],
      compositeScores: [],
    },
  };
}

module.exports = {
  computeAdvancedMetrics,
};

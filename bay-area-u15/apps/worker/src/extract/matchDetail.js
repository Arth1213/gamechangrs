async function fetchMatchDetail(matchInventoryRow) {
  return {
    match: matchInventoryRow,
    rawScorecard: null,
    rawCommentary: null,
    notes: [
      "TODO: pull scorecard/header/commentary endpoints discovered via Playwright interception.",
      "TODO: persist raw payloads to object storage or local raw snapshot paths.",
    ],
  };
}

module.exports = {
  fetchMatchDetail,
};

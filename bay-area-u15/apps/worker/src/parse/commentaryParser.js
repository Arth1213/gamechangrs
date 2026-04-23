function parseCommentary(rawCommentary) {
  return {
    ballEvents: [],
    overSummaries: [],
    notes: [
      "TODO: implement ball_event extraction with cricket-aware handling for wides, no-balls, byes, leg-byes, run-outs, and retired hurt.",
    ],
  };
}

module.exports = {
  parseCommentary,
};

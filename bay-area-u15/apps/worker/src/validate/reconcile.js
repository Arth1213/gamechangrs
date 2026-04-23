function reconcileMatch(parsedScorecard, parsedCommentary) {
  return {
    status: "todo",
    checks: [
      "TODO: innings totals vs commentary total runs",
      "TODO: wickets vs dismissal count",
      "TODO: batter innings runs vs scorecard batting rows",
      "TODO: bowler figures vs commentary-derived spell totals",
    ],
    issues: [],
  };
}

module.exports = {
  reconcileMatch,
};

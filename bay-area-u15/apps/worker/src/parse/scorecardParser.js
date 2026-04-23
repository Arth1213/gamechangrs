function parseScorecard(rawScorecard) {
  return {
    match: null,
    innings: [],
    battingInnings: [],
    bowlingSpells: [],
    fieldingEvents: [],
    notes: ["TODO: implement scorecard normalization from CricClubs structured payloads."],
  };
}

module.exports = {
  parseScorecard,
};

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildSignalCards, pickWeightedBattingRisk } = require("../src/services/playerIntelligenceService");

test("weights dismissal risk above strike-rate suppression when selecting a batter's main weakness", () => {
  const risk = pickWeightedBattingRisk(
    [
      { splitLabel: "Right-Arm Pace", legalBalls: 30, dismissals: 2, strikeRate: 110 },
      { splitLabel: "Leg-Spin", legalBalls: 30, dismissals: 1, strikeRate: 40 },
    ],
    { strikeRate: 120 },
  );

  assert.equal(risk.splitLabel, "Right-Arm Pace");
  assert.equal(risk.dismissalWeight, 0.85);
  assert.equal(risk.strikeRateWeight, 0.15);
  assert.ok(Math.abs(risk.dismissalRate - 6.666666666666667) < 0.000001);
  assert.ok(Math.abs(risk.strikeRateSuppression - 8.333333333333332) < 0.000001);
});

test("uses lower strike rate to break an equal dismissal-risk matchup", () => {
  const risk = pickWeightedBattingRisk(
    [
      { splitLabel: "Right-Arm Pace", legalBalls: 24, dismissals: 1, strikeRate: 125 },
      { splitLabel: "Off-Spin", legalBalls: 24, dismissals: 1, strikeRate: 75 },
    ],
    { strikeRate: 125 },
  );

  assert.equal(risk.splitLabel, "Off-Spin");
});

test("excludes bowler-type samples below the twelve-ball minimum", () => {
  const risk = pickWeightedBattingRisk(
    [
      { splitLabel: "Right-Arm Pace", legalBalls: 11, dismissals: 1, strikeRate: 20 },
      { splitLabel: "Left-Arm Pace", legalBalls: 24, dismissals: 1, strikeRate: 90 },
    ],
    { strikeRate: 120 },
  );

  assert.equal(risk.splitLabel, "Left-Arm Pace");
});

test("uses the weighted batting weakness as the report's first watchout", () => {
  const cards = buildSignalCards({
    lens: {
      batting: {
        overall: { strikeRate: 120 },
        byBowlerType: [
          { splitLabel: "Right-Arm Pace", legalBalls: 30, dismissals: 2, strikeRate: 110, runsScored: 33, matchCount: 3 },
          { splitLabel: "Leg-Spin", legalBalls: 30, dismissals: 1, strikeRate: 40, runsScored: 12, matchCount: 3 },
        ],
      },
      bowling: { byBatterHand: [] },
      dismissals: [],
      pressureProfile: null,
    },
  });

  assert.equal(cards.watchouts[0].label, "Batting pressure vs Right-Arm Pace");
  assert.match(cards.watchouts[0].note, /85% dismissal risk \/ 15% strike-rate suppression/);
  assert.match(cards.watchouts[0].note, /SR 110 versus overall SR 120/);
});

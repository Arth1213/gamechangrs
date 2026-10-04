const assert = require('node:assert/strict');
const test = require('node:test');

const intelligence = require('../src/services/playerIntelligenceService');
const { renderPlayerIntelligenceReportPage } = require('../src/render/pages');
const { MILC_2026_KEY } = require('../../../shared/milcPlayoffThreat');

function lens(style = 'Unknown', dismissalCount = 1) {
  const split = { splitLabel: style, legalBalls: 24, dismissals: 1, strikeRate: 75, runsScored: 18, matchCount: 2 };
  return {
    batting: { overall: { strikeRate: 120 }, byBowlerType: [split], byBowlerTypePhase: { middle: [split] }, byPhase: {} },
    bowling: { byBatterHand: [], byBatterHandPhase: {}, byPhase: {} },
    dismissals: [{ bowlerStyleLabel: style, dismissalType: 'caught', dismissalCount, matchCount: dismissalCount, averageRunsAtDismissal: 0, averageBallsFacedAtDismissal: 2 }],
    pressureProfile: null,
  };
}

function report(overrides = {}) {
  return {
    meta: { series: { configKey: MILC_2026_KEY, name: 'MiLC 2026' } },
    header: { playerName: 'Player', teamName: 'Manhattan Yorkers', roleLabel: 'Batter' },
    summaryStats: { batting: { matches: 2, ballsFaced: 24 }, bowling: { matches: 0, legalBalls: 0 } },
    focusedLens: lens(),
    ...overrides,
  };
}

function card(html, title) {
  const result = html.match(new RegExp(`<div class="metric-card">\\s*<div class="metric-label">${title}</div>[\\s\\S]*?<div class="metric-note">[\\s\\S]*?</div>\\s*</div>`));
  assert.ok(result, `${title} card must be rendered`);
  return result[0];
}

// Removing the strict-evidence branch would turn unverified styles into strengths/tactics.
test('playoff signal cards exclude unverified style strengths and watchouts', () => {
  for (const style of ['Unknown', 'Unclassified', '', 'Unknown style']) {
    const result = intelligence.buildSignalCards({ lens: lens(style, 3), strictEvidence: true });
    assert.deepEqual(result.strengths, []);
    assert.deepEqual(result.watchouts, []);
  }
});

test('known playoff styles still produce the existing weighted batting recommendation', () => {
  const input = lens('Right-Arm Pace', 3);
  input.batting.byBowlerType[0].dismissals = 2;
  input.batting.byBowlerType.push({ splitLabel: 'Leg-Spin', legalBalls: 24, dismissals: 0, strikeRate: 130 });
  const result = intelligence.buildSignalCards({ lens: input, strictEvidence: true });
  assert.equal(result.strengths[0].label, 'Batting vs Leg-Spin');
  assert.equal(result.watchouts[0].label, 'Batting pressure vs Right-Arm Pace');
  assert.match(result.watchouts[0].note, /85% dismissal risk \/ 15% strike-rate suppression/);
});

test('non-playoff signal cards preserve their unknown-only fallback', () => {
  const result = intelligence.buildSignalCards({ lens: lens() });
  assert.equal(result.strengths[0].label, 'Batting vs Unknown');
  assert.equal(result.watchouts[0].label, 'Batting pressure');
});

// Treating absent phase data as a positive read or as no bowling despite recorded spells is a bug.
test('playoff bowling absence is neutral and distinguished from missing phase data', () => {
  const absent = card(renderPlayerIntelligenceReportPage(report()), 'Bowling Threat Window');
  assert.match(absent, /metric-value neutral/);
  assert.match(absent, /No recorded bowling/);
  assert.doesNotMatch(absent, /Unknown|phase split is available yet/);
  const missing = card(renderPlayerIntelligenceReportPage(report({ summaryStats: { bowling: { matches: 2, legalBalls: 24 } } })), 'Bowling Threat Window');
  assert.match(missing, /metric-value neutral/);
  assert.match(missing, /Phase data unavailable/);
  assert.doesNotMatch(missing, /No recorded bowling/);
});

test('playoff batting absence is neutral and distinguished from missing phase data', () => {
  const absent = card(renderPlayerIntelligenceReportPage(report({ summaryStats: { batting: { matches: 0, ballsFaced: 0 } } })), 'Batting Threat Window');
  assert.match(absent, /metric-value neutral/);
  assert.match(absent, /No recorded batting/);
  const missing = card(renderPlayerIntelligenceReportPage(report()), 'Batting Threat Window');
  assert.match(missing, /Phase data unavailable/);
});

// A single dismissal must not become a recurring pattern or style-specific vulnerability.
test('playoff single dismissal is descriptive evidence with an unverified style label', () => {
  const html = renderPlayerIntelligenceReportPage(report());
  const evidence = card(html, 'Dismissal Evidence');
  assert.match(evidence, /metric-value neutral/);
  assert.match(evidence, /1 caught dismissal/);
  assert.match(evidence, /caught[\s\S]*2[\s\S]*0/);
  assert.match(evidence, /Style unverified/);
  assert.doesNotMatch(evidence, /most often|cluster|pattern/i);
  assert.match(html, /<td>Style unverified<\/td>/);
  assert.match(html, /<td class="align-right">24<\/td>/);
});

test('playoff repeated unknown-style dismissals retain counts without inferred style patterns', () => {
  const evidence = card(renderPlayerIntelligenceReportPage(report({ focusedLens: lens('Unknown', 3) })), 'Dismissal Evidence');
  assert.match(evidence, /3 caught dismissals/);
  assert.match(evidence, /Style unverified/);
  assert.doesNotMatch(evidence, /most often|cluster|pattern/i);
});

test('non-playoff and Grizzlies phase and dismissal cards retain existing behavior', () => {
  for (const input of [
    report({ meta: { series: { configKey: 'ncca', name: 'NCCA' } } }),
    report({ header: { playerName: 'Player', teamName: 'San Ramon Grizzlies' } }),
  ]) {
    const html = renderPlayerIntelligenceReportPage(input);
    assert.match(card(html, 'Bowling Threat Window'), /metric-value good[\s\S]*Unknown/);
    assert.match(card(html, 'Dismissal Cluster'), /most often/);
  }
});

test('playoff tactical plans exclude unknown-only styles even with repeated dismissals', () => {
  assert.deepEqual(intelligence.buildTacticalPlan(lens('Unknown', 3), { strictEvidence: true }), { battingPlan: [], bowlingPlan: [] });
  assert.match(intelligence.buildTacticalPlan(lens('Unknown', 3)).battingPlan[0], /against Unknown/);
  assert.match(intelligence.buildTacticalPlan(lens('Right-Arm Pace', 3), { strictEvidence: true }).battingPlan[0], /against Right-Arm Pace/);
});

test('one known-style dismissal without a qualified split cannot create a playoff dismissal tactic', () => {
  const single = lens('Leg-Spin');
  single.batting.byBowlerType = [];
  assert.deepEqual(intelligence.buildSignalCards({ lens: single, strictEvidence: true }).watchouts, []);
  assert.deepEqual(intelligence.buildTacticalPlan(single, { strictEvidence: true }).battingPlan, []);
  const multiple = lens('Leg-Spin', 3);
  multiple.batting.byBowlerType = [];
  assert.equal(intelligence.buildSignalCards({ lens: multiple, strictEvidence: true }).watchouts[0].metricValue, 3);
});

test('playoff additional insights keep named evidence but exclude unverified phase-style conclusions', () => {
  const context = { headToHead: { batting: { opponentName: 'Named Bowler', runs: 18, balls: 24, matchCount: 2, dismissals: 1 } } };
  const result = intelligence.buildAdditionalInsights({ lens: lens(), strictEvidence: true, context });
  assert.match(result.matchupAndUsage[0].detail, /Named Bowler: 18 runs from 24 balls/);
  assert.doesNotMatch(result.matchupAndUsage[1].detail, /strongest against Unknown/);
  assert.match(result.pressureAndEvidence[1].detail, /Recorded dismissal group: 1 caught dismissal/);
  assert.match(result.pressureAndEvidence[1].detail, /Style unverified/);
  assert.doesNotMatch(result.pressureAndEvidence[1].detail, /clustering most|current pattern/);
  const repeated = intelligence.buildAdditionalInsights({ lens: lens('Unknown', 3), strictEvidence: true });
  assert.match(repeated.pressureAndEvidence[1].detail, /Recorded dismissal group: 3 caught dismissals/);
  assert.doesNotMatch(repeated.pressureAndEvidence[1].detail, /clustering most|current pattern/);
  const known = intelligence.buildAdditionalInsights({ lens: lens('Right-Arm Pace', 3), strictEvidence: true });
  assert.match(known.matchupAndUsage[1].detail, /Observed batting against Right-Arm Pace in the Middle overs/);
  assert.match(intelligence.buildAdditionalInsights({ lens: lens() }).matchupAndUsage[1].detail, /strongest against Unknown/);
});

test('playoff lenses retain unclassified raw counts alongside classified rows', () => {
  const matchupRows = ['unknown', 'right_arm_pace'].flatMap((splitValue) => ['overall', 'middle'].map((phaseBucket) => ({ scopeType: 'series', perspective: 'batting', splitGroup: 'bowler_style_bucket', splitValue, splitLabel: splitValue === 'unknown' ? 'Unknown' : 'Right-Arm Pace', phaseBucket, legalBalls: 24, runsScored: 18, strikeRate: 75 })));
  const input = { scopeType: 'series', matchupRows, dismissalRows: [], profileRows: [] };
  const result = intelligence.buildLens({ ...input, strictEvidence: true });
  assert.equal(result.batting.byBowlerType.length, 2);
  assert.equal(result.batting.byBowlerTypePhase.middle.length, 2);
  assert.equal(result.batting.byBowlerType.find((row) => row.splitValue === 'unknown').legalBalls, 24);
  assert.equal(intelligence.buildLens(input).batting.byBowlerType.length, 1);
});

test('unverified buckets cannot become playoff tactics through display-label placeholders', () => {
  const input = lens('-', 3);
  input.batting.byBowlerType[0].splitValue = 'unknown';
  input.dismissals[0].bowlerStyleBucket = 'unknown';
  const result = intelligence.buildSignalCards({ lens: input, strictEvidence: true });
  assert.deepEqual(result.strengths, []);
  assert.deepEqual(result.watchouts, []);
  assert.deepEqual(intelligence.buildTacticalPlan(input, { strictEvidence: true }).battingPlan, []);
  const insight = intelligence.buildAdditionalInsights({ lens: input, strictEvidence: true });
  assert.doesNotMatch(insight.matchupAndUsage[1].detail, /strongest against -/);
  assert.match(insight.pressureAndEvidence[1].detail, /Style unverified/);
  assert.match(renderPlayerIntelligenceReportPage(report({ focusedLens: input })), /<td>Style unverified<\/td>/);
});

test('invalid playoff summary stats remain neutral missing evidence rather than absent activity', () => {
  const html = renderPlayerIntelligenceReportPage(report({ summaryStats: { bowling: { matches: NaN, legalBalls: NaN } } }));
  const missing = card(html, 'Bowling Threat Window');
  assert.match(missing, /metric-value neutral/);
  assert.match(missing, /Phase data unavailable/);
  assert.doesNotMatch(missing, /No recorded bowling/);
  const recorded = card(renderPlayerIntelligenceReportPage(report({ summaryStats: { bowling: { matches: 1, legalBalls: 0 } } })), 'Bowling Threat Window');
  assert.match(recorded, /Phase data unavailable/);
  assert.doesNotMatch(recorded, /No recorded bowling/);
});

test('one known-style dismissal card is neutral factual evidence, not a style threat', () => {
  const evidence = card(renderPlayerIntelligenceReportPage(report({ focusedLens: lens('Leg-Spin') })), 'Dismissal Evidence');
  assert.match(evidence, /metric-value neutral/);
  assert.match(evidence, /1 caught dismissal/);
  assert.match(evidence, /Bowler type: Leg-Spin/);
  assert.doesNotMatch(evidence, /most often|cluster|vulnerable/i);
});

test('one classified playoff style cannot imply a comparative weakness or strongest matchup', () => {
  const input = lens('Right-Arm Pace', 2);
  input.batting.byBowlerType.push({ splitLabel: 'Unknown', legalBalls: 48, dismissals: 3, strikeRate: 20 });
  const cards = intelligence.buildSignalCards({ lens: input, strictEvidence: true });
  assert.equal(cards.strengths[0].label, 'Observed batting vs Right-Arm Pace');
  assert.doesNotMatch(JSON.stringify(cards.watchouts), /Batting pressure vs|Dismissal pattern|Most wickets/);
  const plan = intelligence.buildTacticalPlan(input, { strictEvidence: true });
  assert.doesNotMatch(plan.battingPlan.join(' '), /most vulnerable|most dismissals|produced/i);
  assert.match(plan.battingPlan.join(' '), /2[\s\S]*dismissals against Right-Arm Pace/);
  const additional = intelligence.buildAdditionalInsights({ lens: input, strictEvidence: true });
  assert.doesNotMatch(additional.matchupAndUsage[1].detail, /strongest/);
  const html = renderPlayerIntelligenceReportPage(report({ focusedLens: input, tacticalSummary: cards, tacticalPlan: plan, additionalInsights: additional }));
  assert.doesNotMatch(html, /most vulnerable against Right-Arm Pace|mainly a batting threat against Right-Arm Pace/);
});

test('one dismissal across qualified classified playoff types cannot create a weighted weakness', () => {
  const input = lens('Right-Arm Pace');
  input.batting.overall.strikeRate = 100;
  input.batting.byBowlerType = [
    { splitLabel: 'Right-Arm Pace', legalBalls: 12, runsScored: 12, dismissals: 1, strikeRate: 100, matchCount: 1 },
    { splitLabel: 'Leg-Spin', legalBalls: 12, runsScored: 12, dismissals: 0, strikeRate: 100, matchCount: 1 },
  ];
  const cards = intelligence.buildSignalCards({ lens: input, strictEvidence: true });
  assert.deepEqual(cards.watchouts, []);
  const plan = intelligence.buildTacticalPlan(input, { strictEvidence: true });
  assert.deepEqual(plan.battingPlan, []);
  const html = renderPlayerIntelligenceReportPage(report({ focusedLens: input, tacticalSummary: cards, tacticalPlan: plan }));
  assert.doesNotMatch(html, /most vulnerable against Right-Arm Pace|most vulnerable batting setup/i);
  assert.match(card(html, 'Dismissal Evidence'), /metric-value neutral[\s\S]*1 caught dismissal/);
  assert.equal(intelligence.buildSignalCards({ lens: input }).watchouts[0].label, 'Batting pressure vs Right-Arm Pace');
  assert.match(intelligence.buildTacticalPlan(input).battingPlan[0], /Most vulnerable batting setup is against Right-Arm Pace/);
});

test('playoff dismissal card names its displayed group rather than implying a total count', () => {
  const input = lens('Unknown');
  input.dismissals[0].dismissalType = 'run_out';
  input.dismissals.push({ bowlerStyleLabel: 'Leg-Spin', dismissalType: 'caught', dismissalCount: 1, matchCount: 1, averageRunsAtDismissal: 18, averageBallsFacedAtDismissal: 12 });
  const html = renderPlayerIntelligenceReportPage(report({ focusedLens: input }));
  const evidence = card(html, 'Dismissal Evidence');
  assert.match(evidence, /1 run-out/);
  assert.match(evidence, /Recorded dismissal group/);
  assert.match(evidence, /Bowler style not applicable/);
  assert.doesNotMatch(evidence, /1 recorded dismissal|Style unverified|run_out/);
  assert.match(html, /<td>Bowler style not applicable<\/td>/);
});

test('non-bowler playoff dismissals never create bowling-style tactics from source styles', () => {
  for (const dismissalType of ['run_out', 'run out', 'retired', 'retired hurt', 'timed out', 'obstructing', 'obstructing_the_field']) {
    const input = lens('Right-Arm Pace', 3);
    input.batting.byBowlerType = [];
    input.dismissals[0].dismissalType = dismissalType;
    assert.deepEqual(intelligence.buildSignalCards({ lens: input, strictEvidence: true }).watchouts, []);
    assert.deepEqual(intelligence.buildTacticalPlan(input, { strictEvidence: true }).battingPlan, []);
    const evidence = intelligence.buildAdditionalInsights({ lens: input, strictEvidence: true }).pressureAndEvidence[1].detail;
    assert.match(evidence, /Bowler style not applicable/);
    assert.doesNotMatch(evidence, /Bowler type: Right-Arm Pace/);
    assert.match(renderPlayerIntelligenceReportPage(report({ focusedLens: input })), /<td>Bowler style not applicable<\/td>/);
    assert.ok(intelligence.buildSignalCards({ lens: input }).watchouts.length > 0);
  }
});

test('playoff weighted weakness cannot treat two run-outs as repeated bowling-style dismissal evidence', () => {
  const input = lens('Right-Arm Pace', 2);
  input.batting.byBowlerType[0].dismissals = 2;
  input.batting.byBowlerType.push({ splitLabel: 'Leg-Spin', legalBalls: 24, dismissals: 0, strikeRate: 120 });
  input.dismissals[0].dismissalType = 'run_out';
  assert.deepEqual(intelligence.buildSignalCards({ lens: input, strictEvidence: true }).watchouts, []);
  assert.deepEqual(intelligence.buildTacticalPlan(input, { strictEvidence: true }).battingPlan, []);
  input.dismissals = [
    { bowlerStyleLabel: 'Right-Arm Pace', dismissalType: 'bowled', dismissalCount: 1 },
    { bowlerStyleLabel: 'Right-Arm Pace', dismissalType: 'caught', dismissalCount: 1 },
  ];
  assert.equal(intelligence.buildSignalCards({ lens: input, strictEvidence: true }).watchouts[0].label, 'Batting pressure vs Right-Arm Pace');
  assert.match(intelligence.buildTacticalPlan(input, { strictEvidence: true }).battingPlan[0], /Most vulnerable batting setup is against Right-Arm Pace/);
});

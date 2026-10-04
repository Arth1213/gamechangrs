const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPlayerIntelligenceRows } = require('../src/analytics/playerIntelligence');

test('bowling intelligence excludes byes and leg-byes, including on a no-ball', () => {
  const events = [
    { batterRuns: 4, extras: 0, totalRuns: 4, extraType: '', isLegalBall: true },
    { batterRuns: 0, extras: 4, totalRuns: 4, extraType: 'bye', isLegalBall: true },
    { batterRuns: 0, extras: 2, totalRuns: 2, extraType: 'leg_bye', isLegalBall: true },
    { batterRuns: 0, extras: 5, totalRuns: 5, extraType: 'no_ball', isLegalBall: false },
    { batterRuns: 6, extras: 1, totalRuns: 7, extraType: 'no_ball', isLegalBall: false },
    { batterRuns: 0, extras: 2, totalRuns: 2, extraType: 'wide', isLegalBall: false },
  ].map((e, i) => ({ ...e, matchId: 1, divisionId: 1, inningsNo: 1, eventIndex: i+1,
    strikerPlayerId: 10, bowlerPlayerId: 20, phase: 'powerplay', leverageScore: 1 }));
  const rows = buildPlayerIntelligenceRows(events, []).matchupRows;
  const bowling = rows.find(r => r.scopeType === 'series' && r.perspective === 'bowling' && r.splitGroup === 'overall' && r.phaseBucket === 'overall');
  assert.equal(bowling.runsConceded, 14);
  assert.equal(bowling.legalBalls, 3);
});

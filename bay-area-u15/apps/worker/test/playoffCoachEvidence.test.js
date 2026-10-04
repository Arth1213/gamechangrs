const test = require('node:test');
const assert = require('node:assert/strict');
const { collectPlayoffEvidence } = require('../src/analytics/playoffCoachEvidence');

function row(id = 1, overrides = {}) {
  return { series_id: 16, match_id: id, match_date: '2026-09-20', match_status: 'completed', parse_status: 'parsed', analytics_status: 'computed', source_match_id: 'official-id', home_team: 'Dallas Xforia Giants', away_team: 'San Ramon Grizzlies', result_text: 'Dallas won',
    innings_json: [{ innings: 1, battingTeam: 'Dallas Xforia Giants', runs: 120, wickets: 0, legalBalls: 120 }],
    batting_json: [{ innings_no: 1, player_id: 1, player_name: 'Opponent', runs: 120, balls_faced: 120, batting_position: 1, is_not_out: true }],
    bowling_json: [{ innings_no: 1, player_id: 2, player_name: 'Grizzlies Bowler', runs_conceded: 120, legal_balls: 120, wickets: 0 }],
    ball_events_json: Array.from({ length: 120 }, (_, i) => ({ innings: 1, eventIndex: i + 1, over: Math.floor(i / 6), ballInOver: i % 6 + 1, strikerPlayerId: 1, bowlerPlayerId: 2, runs: 1, batterRuns: 1, legal: true, wicket: false })), ...overrides };
}
const opts = { opponent: 'Dallas Xforia Giants', cutoff: '2026-10-04' };
test('scopes to MiLC 2026, completed/reconciled full T20s, cutoff and one copy per match', () => {
  const bad = row(6); bad.innings_json[0].runs = 121;
  const data = collectPlayoffEvidence([row(), row(), row(2, { series_id: 8 }), row(3, { match_date: '2026-10-22' }), row(4, { result_text: 'Won (D/L)' }), row(5, { match_status: 'scheduled' }), bad], opts);
  assert.deepEqual(data.opponent.matches, [1]);
  assert.equal(data.opponent.batters[0].balls, 120);
  assert.equal(data.own.bowlers[0].phases.powerplay.balls, 36);
  assert.equal(data.boundary.phases[1].legalBalls, 54);
  assert.equal(data.exclusions.find(x => x.matchId === 4).reason, 'rain_adjusted');
});
test('legal boundary frequency does not count a no-ball four', () => {
  const r = row(); r.ball_events_json[0].runs = r.ball_events_json[0].batterRuns = 4;
  r.ball_events_json[1].runs = r.ball_events_json[1].batterRuns = 0;
  r.ball_events_json[2].runs = r.ball_events_json[2].batterRuns = 0;
  r.ball_events_json[3].runs = r.ball_events_json[3].batterRuns = 0;
  r.ball_events_json.unshift({ ...r.ball_events_json[0], eventIndex: 0, runs: 5, batterRuns: 4, extras: 1, extraType: 'no_ball', legal: false });
  r.innings_json[0].runs = 125; r.batting_json[0].runs = 124; r.batting_json[0].balls_faced = 121; r.bowling_json[0].runs_conceded = 125;
  const data = collectPlayoffEvidence([r], opts);
  assert.equal(data.boundary.phases[0].boundaries, 1);
  assert.equal(data.boundary.phases[0].legalBalls, 36);
  assert.equal(data.opponent.batters[0].runs, 124);
  assert.equal(data.own.bowlers[0].dots, 3);
});
test('latest observed selection is retained from a rain-adjusted scorecard without pooling its phases', () => {
  const recent = row(9, { match_date: '2026-09-26', result_text: 'Dallas won (D/L)' });
  recent.batting_json = [{ innings_no: 1, player_id: 8, player_name: 'New selection', runs: 0, balls_faced: 0 }];
  const data = collectPlayoffEvidence([row(), recent], opts);
  assert.deepEqual(data.opponent.matches, [1]);
  assert.equal(data.latestSelections.opponent.matchId, 9);
  assert.deepEqual(data.latestSelections.opponent.players, [{ id: 8, name: 'New selection' }]);
  assert.equal(data.latestSelections.own.players[0].name, 'Grizzlies Bowler');
});
test('does not merge ambiguous same-name accounts or other teams into opponent totals', () => {
  const second = row(2); second.batting_json[0].player_id = 8;
  second.ball_events_json.forEach(e => { e.strikerPlayerId = 8; });
  const data = collectPlayoffEvidence([row(), second, row(3, { home_team: 'Unrelated Team', away_team: 'Other Team' })], opts);
  assert.equal(data.opponent.batters.length, 0);
  assert.deepEqual(data.opponent.ambiguousNames, ['Opponent']);
  assert.deepEqual(data.opponent.matches, [1, 2]);
});

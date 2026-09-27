import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boundaryPercentage, isStrongPartnership, validateCoachPlan, coachPlanHref, historicalMatchSummary } from './grizzliesCoachPlan.js';

const sample = () => ({
  schemaVersion: 1, version: 'test-v1', updatedThrough: '2026-09-26',
  opponent: 'Silicon Valley Strikers', headline: 'Win the next contest',
  boundaryMatch: 'Strikers vs East Bay, Sep 25', boundarySourceId: 'official',
  phases: [
    { name: 'Powerplay', overs: '1-6', boundaries: 9, legalBalls: 36, cue: 'Attack early' },
    { name: 'Middle', overs: '7-15', boundaries: 8, legalBalls: 54, cue: 'Break the stand' },
    { name: 'Death', overs: '16-20', boundaries: 0, legalBalls: 25, cue: 'Keep attacking' },
  ],
  sections: [{ title: 'Who bowls to whom', cards: [{ title: 'Ayan', trigger: 'Powerplay', actions: ['Use one over.'], evidence: 'Verified 12-ball sample.', confidence: 'Trial', sourceIds: ['official'] }] }],
  sources: [{ id: 'official', label: 'Official match', detail: 'Verified scorecard', url: 'https://cricclubs.com/MiLC/results/test' }],
  limitations: ['Conditional on selection.'],
});

test('boundary ball percentage uses legal balls, including a partial death phase', () => {
  assert.equal(boundaryPercentage(9, 36), 25);
  assert.equal(boundaryPercentage(8, 54), 14.8);
  assert.equal(boundaryPercentage(0, 25), 0);
  assert.equal(boundaryPercentage(0, 0), null);
  assert.equal(boundaryPercentage(5, 4), null);
});
test('a strong stand needs more than five overs and the stated rate benchmark', () => {
  assert.equal(isStrongPartnership(50, 29, 8), false);
  assert.equal(isStrongPartnership(40, 30, 8), false);
  assert.equal(isStrongPartnership(57, 37, 8.14), true);
  assert.equal(isStrongPartnership(30, 37, 8.14), false);
});
test('validates short source-backed coaching cards', () => assert.deepEqual(validateCoachPlan(sample()), []));
test('rejects missing sources, overlapping phases, em dashes and oversized prose', () => {
  const p = sample(); p.phases[2].overs = '15-20'; p.sections[0].cards[0].sourceIds = ['missing'];
  p.sections[0].cards[0].actions = ['Wait—then bowl.'];
  const errors = validateCoachPlan(p).join(' ');
  assert.match(errors, /phases/); assert.match(errors, /source/); assert.match(errors, /dash/);
  p.sections[0].cards[0].actions = ['a'.repeat(221)];
  assert.match(validateCoachPlan(p).join(' '), /action/);
});
test('missing or malformed payloads fail closed without throwing', () => {
  for (const p of [null, {}, {schemaVersion: 1, phases: [null], sections: [null], sources: [null]}]) assert.ok(validateCoachPlan(p).length);
});
test('JSON objects in text fields cannot crash the report validator', () => {
  for (const change of [p => { p.updatedThrough = {toString: null}; }, p => { p.phases[0].overs = {toString: null}; }, p => { p.sources[0].url = {toString: null}; }]) {
    const p = sample(); change(p); assert.ok(validateCoachPlan(p).length);
  }
});
test('game plan uses the authenticated report route, not a public static file', () => {
  assert.equal(coachPlanHref(2375), '/analytics/grizzlies/2026/matches/2375?view=game-plan');
  assert.equal(coachPlanHref('bad'), null);
});
test('publisher inherits the application TLS policy instead of disabling verification', () => {
  const source = fs.readFileSync(new URL('../../scripts/publish-grizzlies-coach-plan.mjs', import.meta.url), 'utf8');
  assert.match(source, /api\/src\/lib\/connection/);
  assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false/);
});
test('preserves copied v3 narrative only for this coach release, otherwise trusts the API', () => {
  const report = {analysisModelVersion: 'legacy-v1', matchSummary: 'API checked', analysis: {matchSummary: 'Raw summary'}};
  assert.equal(historicalMatchSummary(report), 'API checked');
  report.analysisModelVersion = 'coach-plan-20260926-v1';
  assert.equal(historicalMatchSummary(report), 'Raw summary');
  report.analysisModelVersion = 'unknown-future-model';
  assert.equal(historicalMatchSummary(report), 'API checked');
});

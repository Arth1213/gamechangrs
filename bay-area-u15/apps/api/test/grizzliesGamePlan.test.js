const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createGrizzliesGamePlanRouter, selectPublishedGamePlan, gamePlanFixture } = require('../src/services/grizzliesGamePlanService');
test('only the three supplied playoff fixtures resolve', () => {
  assert.equal(gamePlanFixture('dallas-xforia').opponent, 'Dallas Xforia Giants');
  assert.equal(gamePlanFixture('baltimore-royals').date, '2026-10-22');
  assert.equal(gamePlanFixture('manhattan-yorkers').date, '2026-10-23');
  assert.equal(gamePlanFixture('2375'), null);
  assert.equal(gamePlanFixture('../private'), null);
});
test('database selection is parameterized and only reviewed, published versions can be returned', async () => {
  let query;
  const client = { query: async (sql, args) => { query = {sql, args}; return {rows: []}; } };
  assert.equal(await selectPublishedGamePlan(client, 'dallas-xforia'), null);
  assert.deepEqual(query.args, ['dallas-xforia']);
  assert.match(query.sql, /status = 'published'/);
  assert.match(query.sql, /reviewed_at is not null/);
  assert.match(query.sql, /season_year = 2026/);
});
test('route denies unauthorised access before loading a private report and handles absent reports', async t => {
  let reads = 0;
  const app = express();
  const gate = (req, res, next) => req.headers.authorization === 'Bearer test-session' ? next() : res.status(403).json({error:'Forbidden'});
  app.use('/plans', createGrizzliesGamePlanRouter(gate, {loadPlan: async key => { reads++; return key === 'dallas-xforia' ? {fixture: gamePlanFixture(key), coachPlan: {version:'test'}} : null; }}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/plans/`;
  assert.equal((await fetch(url + 'dallas-xforia')).status, 403);
  assert.equal(reads, 0);
  const headers = {Authorization:'Bearer test-session'};
  const ok = await fetch(url + 'dallas-xforia', {headers});
  assert.equal(ok.status, 200); assert.equal((await ok.json()).fixture.opponent, 'Dallas Xforia Giants');
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  assert.equal((await fetch(url + 'baltimore-royals', {headers})).status, 404);
  assert.equal((await fetch(url + 'not-a-team', {headers})).status, 404);
  assert.equal(reads, 2);
});

'use strict';
const express = require('express');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { withClient } = require('./seriesService');
const fixtures = require('../../../../../config/grizzlies-2026-upcoming.json');
const validatorUrl = pathToFileURL(path.resolve(__dirname, '../../../../../src/lib/grizzliesCoachPlan.js')).href;
const gamePlanFixture = key => fixtures.find(f => f.key === key) || null;

async function selectPublishedGamePlan(client, key) {
  const result = await client.query(`select plan_json, evidence_checksum, version from public.grizzlies_game_plan
    where season_year = 2026 and plan_key = $1 and status = 'published'
      and reviewed_at is not null and published_at is not null
    order by published_at desc, id desc limit 1`, [key]);
  return result.rows[0] || null;
}

async function loadGamePlan(key) {
  const fixture = gamePlanFixture(key);
  if (!fixture) return null;
  const row = await withClient(client => selectPublishedGamePlan(client, key));
  if (!row) return null;
  const { validateCoachPlan } = await import(validatorUrl);
  if (validateCoachPlan(row.plan_json).length || row.plan_json.opponent !== fixture.opponent || row.plan_json.updatedThrough >= fixture.date || row.plan_json.version !== row.version) {
    const error = new Error('The game plan needs evidence review before it can be displayed.');
    error.statusCode = 503; throw error;
  }
  return { fixture, coachPlan: row.plan_json, evidenceChecksum: row.evidence_checksum };
}

function createGrizzliesGamePlanRouter(requireAccess, { loadPlan = loadGamePlan } = {}) {
  if (typeof requireAccess !== 'function') throw new Error('Protected Grizzlies access middleware is required.');
  const router = express.Router();
  router.use(requireAccess);
  router.get('/:planKey', async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!gamePlanFixture(req.params.planKey)) return res.status(404).json({ error: 'Unknown playoff fixture.' });
    try {
      const report = await loadPlan(req.params.planKey);
      if (!report) return res.status(404).json({ error: 'This game plan has not been published yet.' });
      return res.json(report);
    } catch (error) { return next(error); }
  });
  return router;
}
module.exports = { gamePlanFixture, selectPublishedGamePlan, loadGamePlan, createGrizzliesGamePlanRouter };

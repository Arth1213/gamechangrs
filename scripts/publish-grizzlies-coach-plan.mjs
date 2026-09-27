// Publishes a reviewed private payload through the existing protected report.
// Dry-run by default. Never puts the report or credentials in the public bundle.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { validateCoachPlan } from '../src/lib/grizzliesCoachPlan.js';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (['--input', '--env', '--tactical-snapshot', '--supplemental-history'].some(key => !args.includes(key))) throw new Error('Required: --input private-plan.json --env backend.env --tactical-snapshot report.json --supplemental-history history.json [--publish]');
const plan = JSON.parse(fs.readFileSync(option('--input'), 'utf8'));
const errors = validateCoachPlan(plan);
if (errors.length) throw new Error(errors.join('; '));
// This release intentionally targets one report and one opponent only.
if (plan.version !== 'coach-plan-20260926-v1' || plan.opponent !== 'Silicon Valley Strikers') throw new Error('Unexpected release target');
require('../bay-area-u15/apps/api/src/lib/env').loadEnvFile(option('--env'));
const { getPool, closePool } = require('../bay-area-u15/apps/api/src/lib/connection');
const publish = args.includes('--publish');
let client;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceArtifacts = ['--tactical-snapshot', '--supplemental-history'].map(key => ({
  file: path.basename(option(key)), sha256: createHash('sha256').update(fs.readFileSync(option(key))).digest('hex'),
}));
try {
  client = await getPool().connect();
  await client.query(publish ? 'BEGIN' : 'BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  await client.query("SET LOCAL lock_timeout = '5s'");
  const suffix = publish ? ' FOR UPDATE' : '';
  const base = (await client.query(`SELECT * FROM public.grizzlies_match_analysis_report WHERE id = 6 AND series_id = 16 AND match_id = 2375 AND analysis_model_version = 't20-context-v3'${suffix}`)).rows[0];
  if (!base || base.source_data_checksum !== 'db95f4eb34c11b9b93f8f6d0cea313f4fc3222718d5120d5832dbafd6cef3175') throw new Error('Base report changed; review again');
  const analysis = { ...base.analysis_json, coachPlan: plan };
  const checksum = hash({ baseChecksum: base.source_data_checksum, analysis });
  const existing = (await client.query('SELECT id, status, source_data_checksum FROM public.grizzlies_match_analysis_report WHERE series_id=16 AND match_id=2375 AND report_type=$1 AND analysis_model_version=$2', [base.report_type, plan.version])).rows[0];
  if (existing) {
    if (existing.source_data_checksum !== checksum || existing.status !== 'published') throw new Error('Version exists with different content or state; manual review required');
    console.log(JSON.stringify({ status: 'already-published', id: existing.id, checksum }));
  } else if (!publish) {
    console.log(JSON.stringify({ status: 'dry-run', matchId: 2375, baseReportId: base.id, version: plan.version, cards: plan.sections.flatMap(s => s.cards).length, checksum }));
  } else {
    const active = (await client.query("SELECT id FROM public.grizzlies_match_analysis_report WHERE series_id=16 AND match_id=2375 AND report_type=$1 AND status IN ('reviewed','published') FOR UPDATE", [base.report_type])).rows;
    if (base.status !== 'published' || active.length !== 1 || Number(active[0].id) !== 6) throw new Error('Active report changed; refusing to supersede another release');
    const metadata = {
      generator: 'reviewed-coach-plan', baseReportId: 6, baseAnalysisVersion: 't20-context-v3',
      reviewedBy: 'codex-source-audit', publicationAuthorization: 'User requested publication to Grizzlies AI Match Analysis',
      evidenceThrough: plan.updatedThrough, predictiveModel: false,
      sourceArtifacts, sourceHashMethod: 'SHA-256 of raw file bytes',
    };
    const row = (await client.query(`INSERT INTO public.grizzlies_match_analysis_report
      (series_id,match_id,report_type,analysis_model_version,status,source_data_checksum,evidence_json,analysis_json,generation_metadata,generated_at,reviewed_at,published_at)
      VALUES (16,2375,$1,$2,'published',$3,$4::jsonb,$5::jsonb,$6::jsonb,now(),now(),now()) RETURNING id`,
    [base.report_type, plan.version, checksum, JSON.stringify(base.evidence_json), JSON.stringify(analysis), JSON.stringify(metadata)])).rows[0];
    await client.query("UPDATE public.grizzlies_match_analysis_report SET status='superseded', updated_at=now() WHERE id=6 AND status='published'");
    console.log(JSON.stringify({ status: 'published', id: row.id, previousReportId: 6, version: plan.version, checksum }));
  }
  await client.query('COMMIT');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error(error.message); process.exitCode = 1;
} finally { client?.release(); await closePool(); }

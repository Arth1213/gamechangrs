import { createHash } from 'node:crypto';
import fixtures from '../config/grizzlies-2026-upcoming.json' with { type: 'json' };
import { validateCoachPlan } from '../src/lib/grizzliesCoachPlan.js';

export function validatePlayoffRelease(payload) {
  const errors = validateCoachPlan(payload?.plan);
  const fixture = fixtures.find(f => f.key === payload?.fixtureKey);
  if (!fixture || payload?.plan?.opponent !== fixture.opponent) errors.push('Fixture/opponent mismatch');
  if (fixture && payload?.plan?.updatedThrough >= fixture.date) errors.push('Evidence must predate the fixture');
  if (payload?.evidence?.seriesId !== 16 || payload?.evidence?.cutoff !== payload?.plan?.updatedThrough) errors.push('MiLC 2026 evidence scope mismatch');
  if (!Array.isArray(payload?.evidence?.evidence?.opponent?.matches) || !payload.evidence.evidence.opponent.matches.length) errors.push('Missing opponent evidence');
  const evidence = payload?.evidence?.evidence;
  if (!fixture || evidence?.opponentName !== fixture.opponent) errors.push('Fixture/opponent evidence mismatch');
  const sources = Array.isArray(evidence?.sources) ? evidence.sources : [];
  for (const [team, ids] of [[fixture?.opponent, evidence?.opponent?.matches], ['San Ramon Grizzlies', evidence?.own?.matches]]) {
    if (!Array.isArray(ids) || ids.some(id => !sources.some(s => s.id === id && s.teams?.includes(team)))) errors.push('Evidence match membership mismatch');
  }
  const boundary = evidence?.boundary;
  if (!boundary || !evidence?.opponent?.matches?.includes(boundary.matchId) || payload?.plan?.boundarySourceId !== `m${boundary.matchId}` ||
      ['name','overs','boundaries','legalBalls','dots'].some(k => JSON.stringify(payload?.plan?.phases?.map(p => p[k])) !== JSON.stringify(boundary.phases?.map(p => p[k])))) errors.push('Boundary counts/source do not match evidence');
  for (const source of payload?.plan?.sources || []) {
    if (/^m\d+$/.test(source?.id) && !sources.some(s => `m${s.id}` === source.id && s.url === source.url)) errors.push('Report source does not match evidence');
  }
  const checksum = createHash('sha256').update(JSON.stringify(payload?.evidence ?? null)).digest('hex');
  if (payload?.evidenceChecksum !== checksum) errors.push('Evidence checksum mismatch');
  return errors;
}

export async function publishPlayoffRelease(client, payload) {
  const errors = validatePlayoffRelease(payload);
  if (errors.length) throw new Error(errors.join('; '));
  // Serialize replacement for this fixture, including the first publication.
  await client.query('select pg_advisory_xact_lock(hashtext($1))', [`grizzlies-2026:${payload.fixtureKey}`]);
  const existing = await client.query('select id from public.grizzlies_game_plan where season_year=2026 and plan_key=$1 and version=$2', [payload.fixtureKey, payload.plan.version]);
  if (existing.rows.length) throw new Error('This version already exists; do not overwrite a reviewed report.');
  await client.query("update public.grizzlies_game_plan set status='superseded' where season_year=2026 and plan_key=$1 and status='published'", [payload.fixtureKey]);
  return client.query(`insert into public.grizzlies_game_plan
    (season_year,plan_key,version,status,plan_json,evidence_checksum,reviewed_at,published_at)
    values (2026,$1,$2,'published',$3::jsonb,$4,now(),now()) returning id`,
  [payload.fixtureKey,payload.plan.version,JSON.stringify(payload.plan),payload.evidenceChecksum]);
}

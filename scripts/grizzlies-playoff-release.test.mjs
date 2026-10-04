import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validatePlayoffRelease, publishPlayoffRelease } from './grizzlies-playoff-release.mjs';
const sha = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
function payload() {
  const phases = ['1-6','7-15','16-20'].map((overs,i) => ({ name:['Powerplay','Middle','Death'][i], overs, boundaries:1,legalBalls:6,dots:2,cue:'Keep pressure.' }));
  const source = {id:1,teams:['Dallas Xforia Giants','Other Team'],url:'https://cricclubs.com/MiLC/results/test'};
  const evidence = {seriesId:16,cutoff:'2026-10-04',evidence:{opponentName:'Dallas Xforia Giants',opponent:{matches:[1]},own:{matches:[]},sources:[source],boundary:{matchId:1,phases}}};
  const plan = {schemaVersion:1,version:'test',updatedThrough:'2026-10-04',opponent:'Dallas Xforia Giants',headline:'Use new ball',boundaryMatch:'Latest full T20',boundarySourceId:'m1',phases,
    sections:[{title:'Who bowls to whom',cards:[{title:'Trial bowler',trigger:'Powerplay',actions:['Use one over.'],evidence:'Six balls.',confidence:'Limited',sourceIds:['m1']}]}],sources:[{id:'m1',label:'Scorecard',detail:'Reviewed',url:source.url}],limitations:['Confirm selection.']};
  return {fixtureKey:'dallas-xforia',plan,evidence,evidenceChecksum:sha(evidence)};
}
test('release accepts matching evidence but rejects another opponent or foreign match membership', () => {
  const p=payload(); assert.deepEqual(validatePlayoffRelease(p),[]);
  p.evidence.evidence.opponentName='Baltimore Royals'; p.evidenceChecksum=sha(p.evidence);
  assert.match(validatePlayoffRelease(p).join(';'),/opponent evidence/i);
  p.evidence.evidence.opponentName=p.plan.opponent;
  p.evidence.evidence.sources[0].teams=['Baltimore Royals','Other Team']; p.evidenceChecksum=sha(p.evidence);
  assert.match(validatePlayoffRelease(p).join(';'),/match membership/i);
});
test('release binds displayed boundary counts and source URL to the evidence', () => {
  const p=payload(); p.plan=structuredClone(p.plan); p.plan.phases[0].boundaries=2;
  assert.match(validatePlayoffRelease(p).join(';'),/boundary.*evidence/i);
  const q=payload(); q.plan.sources[0].url='https://cricclubs.com/MiLC/results/wrong';
  assert.match(validatePlayoffRelease(q).join(';'),/source.*evidence/i);
});
test('invalid release makes no database calls; existing versions cannot be overwritten', async () => {
  let calls=0; const client={query:async()=>{calls++;return {rows:[{id:1}]};}};
  const p=payload();p.evidenceChecksum='wrong';
  await assert.rejects(publishPlayoffRelease(client,p),/checksum/); assert.equal(calls,0);
  await assert.rejects(publishPlayoffRelease(client,payload()),/already exists/); assert.equal(calls,2);
});
test('publication serializes and scopes replacement to one fixture', async () => {
  const calls=[];const client={query:async(sql,values)=>{calls.push({sql,values});return {rows:sql.startsWith('insert')?[{id:4}]:[]};}};
  const result=await publishPlayoffRelease(client,payload()); assert.equal(result.rows[0].id,4);
  assert.match(calls[0].sql,/pg_advisory_xact_lock/);
  assert.deepEqual(calls[2].values,['dallas-xforia']);
  assert.match(calls[3].sql,/reviewed_at,published_at/);
});

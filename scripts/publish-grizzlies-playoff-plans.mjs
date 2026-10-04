import fs from 'node:fs';
import { createRequire } from 'node:module';
import { validatePlayoffRelease, publishPlayoffRelease } from './grizzlies-playoff-release.mjs';
const args=process.argv.slice(2);
const value=key=>args[args.indexOf(key)+1];
if (!args.includes('--input')) throw new Error('Required: --input private-plan.json. Validation only unless --publish is supplied.');
const payload=JSON.parse(fs.readFileSync(value('--input'),'utf8'));
const errors=validatePlayoffRelease(payload);
if(errors.length) throw new Error(errors.join('; '));
if(!args.includes('--publish')) {
  console.log(JSON.stringify({fixtureKey:payload.fixtureKey,version:payload.plan.version,valid:true,published:false}));
} else {
  if(!args.includes('--env')) throw new Error('--publish requires --env. Apply the private pre-match migration before publication.');
  const require=createRequire(import.meta.url);
  require('../bay-area-u15/apps/api/src/lib/env').loadEnvFile(value('--env'));
  const {getPool,closePool}=require('../bay-area-u15/apps/api/src/lib/connection');
  const client=await getPool().connect();
  try {
    await client.query('BEGIN');
    const result=await publishPlayoffRelease(client,payload);
    await client.query('COMMIT');
    console.log(JSON.stringify({fixtureKey:payload.fixtureKey,id:result.rows[0].id,published:true}));
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally {client.release();await closePool();}
}

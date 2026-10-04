const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = require('../src/lib/db');

async function execute(options = {}) {
  const calls = [];
  const client = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes('from public.series_source_config')) return { rows: [{config_key: 'test-season', series_id: 16, series_name: 'Test'}] };
    if (sql.includes('from public.ball_event be') && sql.includes('striker.batting_hand')) return {rows: [
      {match_id: 1, division_id: 1, innings_no: 1, event_index: 1, over_no: 1, ball_in_over: 1, phase: 'powerplay', striker_player_id: 10, bowler_player_id: 20, batter_runs: 4, total_runs: 4, extras: 0, is_legal_ball: true, bowler_bowling_style_bucket: 'right_arm_pace', striker_batting_style_bucket: 'right_hand_batter'},
      {match_id: 1, division_id: 1, innings_no: 1, event_index: 2, over_no: 1, ball_in_over: 2, phase: 'powerplay', striker_player_id: 11, bowler_player_id: 20, batter_runs: 0, total_runs: 0, extras: 0, is_legal_ball: true, wicket_flag: true, wicket_credited_to_bowler: true, player_out_id: 11, bowler_bowling_style_bucket: 'right_arm_pace'},
    ]};
    if (sql.includes('from public.batting_innings bi')) return {rows: [{match_id: 1,division_id: 1,player_id: 11,runs: 0,balls_faced: 1,dismissal_type:'bowled',bowler_bowling_style_bucket:'right_arm_pace'}]};
    return { rows: [] };
  }};
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intelligence-scope-'));
  const mock = test.mock.method(db, 'withTransaction', async work => work(client));
  const modulePath = require.resolve('../src/pipeline/runPlayerIntelligence');
  delete require.cache[modulePath];
  try {
    const result = await require(modulePath).runPlayerIntelligence({series:{slug:'test-season'},outDir,log:()=>{},...options});
    return {result,calls};
  } finally {mock.mock.restore();delete require.cache[modulePath];}
}

test('targeted intelligence refresh replaces and inserts only the selected players', async()=>{
  const {result,calls}=await execute({playerIds:[11]});
  for(const call of calls.filter(c=>c.sql.includes('delete from'))){
    assert.match(call.sql,/player_id = any\(\$2::bigint\[\]\)/);
    assert.deepEqual(call.params,[16,[11]]);
  }
  const inserts=calls.filter(c=>c.sql.includes('insert into'));
  assert.equal(inserts.length,3);
  for(const call of inserts){
    const columns=call.sql.match(/insert into [^(]+\(([\s\S]+?)\)\s*values/)[1].split(',').map(x=>x.trim());
    const playerOffset=columns.indexOf('player_id');
    for(let i=playerOffset;i<call.params.length;i+=columns.length)assert.equal(call.params[i],11);
  }
  assert.equal(result.battingPlayerCount,1);
  assert.equal(result.bowlingPlayerCount,0);
});

test('targeted intelligence dry run computes without deletes or inserts',async()=>{
  const {result,calls}=await execute({playerIds:[11],dryRun:true});
  assert.equal(result.dismissalRowCount,2);
  assert.equal(calls.filter(c=>/delete from|insert into/.test(c.sql)).length,0);
});

test('omitted player filter preserves whole-series refresh behavior',async()=>{
  const {result,calls}=await execute();
  assert.equal(result.battingPlayerCount,2);
  assert.equal(result.bowlingPlayerCount,1);
  for(const call of calls.filter(c=>c.sql.includes('delete from')))assert.deepEqual(call.params,[16]);
});

test('an empty or invalid explicit player filter cannot become a whole-series write',async()=>{
  for(const playerIds of [[],['bad'],[0],[-1],[1.2],[true],[[8567]],['0x2177'],['1e3'],[{}]])await assert.rejects(execute({playerIds}),/playerIds/);
});

test('decimal string player IDs are normalized and deduplicated', async()=>{
  const {result}=await execute({playerIds:['11',11]});
  assert.deepEqual(result.playerIds,[11]);
});

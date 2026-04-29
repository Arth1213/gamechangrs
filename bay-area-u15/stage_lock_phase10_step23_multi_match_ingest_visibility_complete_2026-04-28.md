# Phase 10 Step 23 Lock

## Goal of the slice
- Harden the local MilC match-fact ingest path so operators can run a controlled multi-match sample with clearer progress visibility, shared browser state, and fast reuse of already-staged inventory.

## Exact files changed
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/lib/db.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/extract/matchDetail.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/load/repository.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/pipeline/runMatchPipeline.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/index.js`

## Exact migration applied
- No new Supabase migration in this slice.
- Worker-only hardening:
  - `fetchMatchDetail` can now reuse an existing browser context instead of launching a new browser per match.
  - `run` now supports targeted operator controls:
    - `--matchIds`
    - `--matchLimit`
    - `--useStagedInventory`
  - `run` now prints explicit progress for each selected match:
    - fetch start / complete
    - parse complete
    - persist complete
    - total duration
  - `run` now writes one per-match summary JSON file under:
    - `storage/exports/<series>/runs/<matchId>.json`
  - `run` now deletes stale `<matchId>.error.json` files after a successful retry.
  - Match-fact persistence now batches heavy insert paths instead of doing every row with its own statement:
    - `player_alias`
    - `batting_innings`
    - `bowling_spell`
    - `ball_event`
    - `over_summary`
    - `fielding_event`
  - Match-fact persistence now sets a transaction-local `statement_timeout` of `300s`.
  - Worker DB pool now:
    - enables keepalive
    - logs pooled-client errors instead of crashing on an unhandled pool error
    - is explicitly reset before the long browser-backed ingest phase and between matches

## Exact local run commands
```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
node --check bay-area-u15/apps/worker/src/lib/db.js
node --check bay-area-u15/apps/worker/src/extract/matchDetail.js
node --check bay-area-u15/apps/worker/src/load/repository.js
node --check bay-area-u15/apps/worker/src/pipeline/runMatchPipeline.js
node --check bay-area-u15/apps/worker/src/index.js
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run worker:run:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --useStagedInventory --matchIds 853,852 --matchLimit 2
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node - <<'NODE'
const path=require('path');
const { loadEnvFile } = require('./apps/api/src/lib/env');
const { Pool } = require('pg');
loadEnvFile(path.resolve(process.cwd(), '.env'));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: String(process.env.DATABASE_SSL_MODE || 'disable').toLowerCase() === 'require'
    ? { rejectUnauthorized: false }
    : undefined,
});
(async()=>{
  const result = await pool.query(`
    select
      m.id as match_id,
      m.source_match_id,
      (select count(*) from innings i where i.match_id = m.id) as innings_count,
      (select count(*) from batting_innings bi where bi.match_id = m.id) as batting_count,
      (select count(*) from bowling_spell bs where bs.match_id = m.id) as bowling_count,
      (select count(*) from fielding_event fe where fe.match_id = m.id) as fielding_count,
      (select count(*) from ball_event be where be.match_id = m.id) as ball_count,
      (select count(*) from over_summary os where os.match_id = m.id) as over_count,
      mrs.source_status,
      mrs.parse_status,
      mrs.analytics_status,
      mrs.needs_recompute,
      mrs.needs_reparse,
      mrs.needs_rescrape
    from match m
    left join match_refresh_state mrs on mrs.match_id = m.id
    join series s on s.id = m.series_id
    where s.source_series_id = '27'
      and m.source_match_id in ('853','852')
    order by m.source_match_id desc
  `);
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
})();
NODE
```

## Exact URLs verified
- `https://cricclubs.com/MiLC/viewScorecard.do?matchId=853&clubId=18036`
- `https://cricclubs.com/MiLC/ballbyball.do?matchId=853&clubId=18036`
- `https://cricclubs.com/MiLC/viewScorecard.do?matchId=852&clubId=18036`
- `https://cricclubs.com/MiLC/ballbyball.do?matchId=852&clubId=18036`

## Exact deploy status
- Local control-plane only.
- No frontend deploy in this slice.
- No Render deploy in this slice.
- Supabase/Postgres analytics database updated for two verified MilC sample matches.

## Blockers or known gaps
- `compute.js` is still placeholder-only, so both matches correctly remain `analytics_status = pending`.
- `reconcile.js` is still placeholder-only.
- Full `run` without `--useStagedInventory` still redoes discovery and inventory each time; that is truthful but slower.
- MilC match rows still use the broad staged series-level division assignment from the current inventory phase.
- One stale interrupted backend from an earlier aborted worker run had to be terminated manually during this slice because it was blocking the first clean retry; the current code now avoids the same idle-pool crash path, but stale interrupted transactions from older runs can still need manual cleanup if the process is killed mid-transaction.

## Good to go
- Yes.

## What the next step will do
- Step 24 should move from raw match-fact ingest to reusable intelligence-building primitives:
  - aggregate matchup tables and split logic needed for Player Intelligence
  - add first derived dimensions such as batting-order buckets, phase buckets, and bowling-vs-order summaries from the ingested `ball_event` rows
  - keep this in the local control plane first before exposing any new frontend report

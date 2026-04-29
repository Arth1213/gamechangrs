# Phase 10 Step 22 Lock

## Goal of the slice
- Prove the first real local-ops match-fact ingest for `MilC 2025` by fetching live scorecard and commentary from CricClubs, parsing them into cricket fact tables, and persisting one verified sample match into Supabase/Postgres.

## Exact files changed
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/lib/browser.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/lib/cricket.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/extract/matchDetail.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/parse/scorecardParser.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/parse/commentaryParser.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/load/repository.js`
- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/apps/worker/src/pipeline/runMatchPipeline.js`

## Exact migration applied
- No new Supabase migration in this slice.
- Worker changes only:
  - added headed Chromium override to the local browser helper
  - replaced placeholder match-detail fetch with real scorecard and commentary extraction plus raw HTML/JSON snapshot capture
  - replaced placeholder scorecard parser with innings, batting, bowling, extras, totals, and player-registry parsing
  - replaced placeholder commentary parser with innings-separated ball-event, over-summary, and fielding-event parsing
  - replaced placeholder match-fact repository write with idempotent player alias, innings, batting, bowling, fielding, ball-event, over-summary, and refresh-state persistence
  - intentionally limited the current `run` pipeline slice to the first match until multi-match fact ingest is hardened

## Exact local run commands
```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
node --check bay-area-u15/apps/worker/src/lib/browser.js
node --check bay-area-u15/apps/worker/src/lib/cricket.js
node --check bay-area-u15/apps/worker/src/extract/matchDetail.js
node --check bay-area-u15/apps/worker/src/parse/scorecardParser.js
node --check bay-area-u15/apps/worker/src/parse/commentaryParser.js
node --check bay-area-u15/apps/worker/src/load/repository.js
node --check bay-area-u15/apps/worker/src/pipeline/runMatchPipeline.js
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node <<'NODE'
const fs = require('fs');
const path = require('path');
const { fetchMatchDetail } = require('./apps/worker/src/extract/matchDetail');
const { parseScorecard } = require('./apps/worker/src/parse/scorecardParser');
const { parseCommentary } = require('./apps/worker/src/parse/commentaryParser');
const { upsertMatchFacts } = require('./apps/worker/src/load/repository');
const { closePool } = require('./apps/worker/src/lib/db');

(async () => {
  const inventoryPath = path.resolve(process.cwd(), 'storage/exports/bay-area-youth-cricket-hub-2025-milc-2025-27/match_inventory_debug.json');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const match = inventory.matches.find((entry) => entry.source_match_id === '853') || inventory.matches[0];
  console.log('fetch:start', match.source_match_id, match.scorecard_url);
  const raw = await fetchMatchDetail(match, {
    outDir: path.resolve(process.cwd(), 'storage/exports/bay-area-youth-cricket-hub-2025-milc-2025-27'),
  });
  console.log('fetch:done');
  const scorecard = parseScorecard(raw.rawScorecard);
  const commentary = parseCommentary(raw.rawCommentary, scorecard);
  console.log('parse:done', JSON.stringify({
    innings: scorecard.innings.length,
    battingRows: scorecard.battingInnings.length,
    bowlingRows: scorecard.bowlingSpells.length,
    ballEvents: commentary.ballEvents.length,
    overSummaries: commentary.overSummaries.length,
    fieldingEvents: commentary.fieldingEvents.length,
  }));
  const persisted = await upsertMatchFacts({ match, raw, scorecard, commentary }, {
    seriesConfigKey: 'bay-area-youth-cricket-hub-2025-milc-2025-27',
  });
  console.log('persist:done');
  console.log(JSON.stringify(persisted, null, 2));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
NODE
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
(async () => {
  const result = await pool.query(`
    select
      m.id as match_id,
      m.source_match_id,
      m.ball_by_ball_url,
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
    where s.source_series_id = '27' and m.source_match_id = '853'
  `);
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
})();
NODE
```

## Exact URLs verified
- `https://cricclubs.com/MiLC/viewScorecard.do?matchId=853&clubId=18036`
- `https://cricclubs.com/MiLC/ballbyball.do?matchId=853&clubId=18036`

## Exact deploy status
- Local control-plane only.
- No frontend deploy in this slice.
- No Render deploy in this slice.
- Supabase/Postgres analytics database updated for one verified MilC sample match.

## Blockers or known gaps
- The current fact-ingest verification is intentionally limited to the first MilC match (`853`) while the parser/write path is hardened.
- `apps/worker/src/analytics/compute.js` is still placeholder-only, so analytics status correctly remains `pending` after fact ingest.
- `apps/worker/src/validate/reconcile.js` is still placeholder-only, so reconciliation is not yet promoted beyond parsed source facts.
- The current repository writer is row-by-row and therefore slow for large ball-event payloads; batch inserts are the next obvious hardening step.
- `worker:run:series` remains a thin wrapper over discovery, inventory, and the limited sample ingest; it does not yet provide granular progress logs.
- MilC match rows still carry the broad series-level division assignment from the current inventory stage; finer conference/group attribution is still deferred.

## Good to go
- Yes.

## What the next step will do
- Step 23 should harden multi-match ingest and operator visibility:
  - batch the fact writes so a full match or small sample set runs faster
  - add clearer per-match progress/status output for local ops
  - move from one verified sample match to a controlled multi-match sample before compute
  - prepare the data path needed for the later `Player Intelligence Report`

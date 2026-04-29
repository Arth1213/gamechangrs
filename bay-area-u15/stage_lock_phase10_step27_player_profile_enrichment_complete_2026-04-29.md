# Stage Lock: Phase 10 Step 27 - Player Profile Enrichment Complete

Date: 2026-04-29

## Goal of the slice

Capture player-profile role and handedness/style attributes from source player pages into Supabase so future Player Intelligence work can answer matchup questions such as:

- batter vs right-arm pace
- batter vs left-arm pace
- batter vs off-spin
- batter vs leg-spin
- batter vs left-arm spin
- wicketkeeper / batter / bowler / all-rounder profile context

This slice stays local-only and does not start a new intelligence compute layer yet.

## Exact files changed

- `bay-area-u15/apps/worker/src/lib/playerProfile.js`
- `bay-area-u15/apps/worker/src/extract/playerProfile.js`
- `bay-area-u15/apps/worker/src/pipeline/runPlayerProfileEnrichment.js`
- `bay-area-u15/apps/worker/src/load/repository.js`
- `bay-area-u15/apps/worker/src/index.js`
- `bay-area-u15/package.json`
- `bay-area-u15/apps/api/src/services/playerChatService.js`
- `supabase/migrations/20260429113000_phase10_player_profile_enrichment_fields.sql`
- `bay-area-u15/stage_lock_phase10_step27_player_profile_enrichment_complete_2026-04-29.md`

## Exact migration applied

Applied Supabase migration:

- `supabase/migrations/20260429113000_phase10_player_profile_enrichment_fields.sql`

Added these `public.player` fields:

- `primary_role_bucket`
- `batting_hand`
- `batting_style_bucket`
- `bowling_arm`
- `bowling_style_bucket`
- `bowling_style_detail`
- `profile_last_enriched_at`

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node --check apps/worker/src/lib/playerProfile.js
node --check apps/worker/src/extract/playerProfile.js
node --check apps/worker/src/pipeline/runPlayerProfileEnrichment.js
node --check apps/worker/src/load/repository.js
node --check apps/worker/src/index.js
node --check apps/api/src/services/playerChatService.js
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
set -a && source .env && set +a
node - <<'NODE'
const fs = require('fs');
const { Client } = require('pg');
(async () => {
  const sql = fs.readFileSync('/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/supabase/migrations/20260429113000_phase10_player_profile_enrichment_fields.sql', 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL_MODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
})();
NODE
```

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run worker:profiles:series -- --series bay-area-usac-hub-2026 --player-ids 176,177 --force
npm run worker:profiles:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --player-ids 349 --force
npm run worker:profiles:series -- --series bay-area-usac-hub-2026
npm run worker:profiles:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run worker:profiles:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --player-ids 355 --force
```

## Exact URLs verified

- `https://cricclubs.com/MiLC/viewPlayer.do?playerId=311235&clubId=18036`
- `https://cricclubs.com/USACricketJunior/viewPlayer.do?playerId=994074&clubId=40319`
- `https://cricclubs.com/USACricketJunior/viewPlayer.do?playerId=1779262&clubId=40319`
- `https://cricclubs.com/MiLC/viewPlayer.do?playerId=5142526&clubId=18036`
- `https://cricclubs.com/MiLC/viewPlayer.do?playerId=4933230&clubId=18036`

## Verification result

Sample persisted results:

- `Shreyak Porecha`:
  - `primary_role_bucket = all_rounder`
  - `batting_style_bucket = left_hand_batter`
  - `bowling_style_bucket = left_arm_spinner`
  - `bowling_style_detail = left_arm_off_spin`
- `Nikhil Natarajan`:
  - `primary_role_bucket = all_rounder`
  - `batting_style_bucket = right_hand_batter`
  - `bowling_style_bucket = right_arm_pace`
  - `bowling_style_detail = right_arm_fast`
- `Rameez Raja`:
  - `primary_role_bucket = wicketkeeper_all_rounder`
  - `batting_style_bucket = right_hand_batter`
  - `bowling_style_bucket = off_spinner`
  - `bowling_style_detail = right_arm_off_spin`
- `A Patel` (MilC):
  - `bowling_style = Left Arm Unorthodox`
  - `bowling_style_bucket = left_arm_spinner`
  - `bowling_style_detail = left_arm_unorthodox`

Coverage after the full series runs:

- `bay-area-usac-hub-2026`
  - series players: `167`
  - players with profile URLs: `161`
  - enriched players: `161`
  - role buckets populated: `112`
  - batting buckets populated: `114`
  - bowling buckets populated: `98`
- `bay-area-youth-cricket-hub-2025-milc-2025-27`
  - series players: `37`
  - players with profile URLs: `37`
  - enriched players: `37`
  - role buckets populated: `36`
  - batting buckets populated: `36`
  - bowling buckets populated: `34`

The lower bucket counts are from source player pages that exist but leave role/style fields blank. The enrichment still marks those profiles as visited through `profile_last_enriched_at`.

## PDF template alignment captured in this slice

Using `/Users/artharun/Downloads/Cricket_Opposition_Intelligence_Strategy.pdf` as the Player Intelligence reference:

- incorporated now:
  - player handedness capture
  - bowling-discipline capture
  - wicketkeeper / batter / bowler / all-rounder profile capture
  - chat SQL schema awareness of the new player profile columns
- already present before this slice:
  - event-level runs, wickets, extras
  - dismissal type
  - over number and match phase
  - batter vs bowler matchup rows
- not yet implemented:
  - venue normalization
  - fatal matchup / vulnerability map aggregates
  - dot-ball pressure before dismissal or boundary
  - clutch/death-over specialist aggregates
  - control-index / extra-under-pressure aggregates
  - run-cluster and dot-string temperament metrics

## Exact deploy status

- No hosted frontend deploy
- No Render deploy
- No Lovable publish
- Local worker/control-plane and Supabase data update only

## Blockers or known gaps

- Some source player pages exist but do not publish role/style fields, so enrichment cannot infer buckets for those records without another source or manual override.
- Venue is not currently captured in the worker extract path, so the PDF’s venue-normalized intelligence guidance cannot be implemented accurately yet.
- This slice does not create a dedicated Player Intelligence compute table yet; it only lays the normalized player-profile foundation required for it.
- API chat schema now knows about the new profile columns, but no new chat prompt/tooling layer was added in this slice.

## Good to go with next step

Yes.

## What the next step will do

The next slice should build the first dedicated Player Intelligence compute layer using the PDF template as the blueprint:

- matchup splits by batter hand and bowler type
- dismissal vulnerability maps by bowler type and dismissal mode
- dot-ball pressure thresholds before boundary/dismissal
- phase-specific clutch metrics
- run-cluster and dot-string temperament signals
- venue-relative normalization once venue capture is added

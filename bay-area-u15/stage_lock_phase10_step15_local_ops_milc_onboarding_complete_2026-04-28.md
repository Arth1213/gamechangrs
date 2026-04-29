# Stage Lock: Phase 10 Step 15 Local Ops MilC Onboarding Complete

## Goal of the slice

Build the first reusable local-only onboarding path for future cricket series, then use it to onboard `MilC 2025` into the local analytics control plane without involving the hosted frontend.

## Exact files changed

- `bay-area-u15/package.json`
- `bay-area-u15/README.md`
- `bay-area-u15/ops_runbook_new_series.md`
- `bay-area-u15/ops_runbook_manual_refresh.md`
- `bay-area-u15/ops_runbook_compute_publish.md`
- `bay-area-u15/config/leagues.yaml`
- `bay-area-u15/apps/worker/src/index.js`
- `bay-area-u15/apps/worker/src/lib/config.js`
- `bay-area-u15/apps/worker/src/lib/db.js`
- `bay-area-u15/apps/worker/src/discovery/seriesDiscovery.js`
- `bay-area-u15/apps/worker/src/extract/matchInventory.js`
- `bay-area-u15/apps/worker/src/load/repository.js`
- `bay-area-u15/apps/worker/src/ops/seriesRegistry.js`
- `bay-area-u15/apps/worker/src/probe/sourceRegistry.js`
- `bay-area-u15/apps/worker/src/probe/probeSeries.js`
- `bay-area-u15/apps/worker/src/probe/adapters/cricclubs.js`
- `bay-area-u15/apps/worker/src/probe/adapters/unsupported.js`
- `bay-area-u15/scripts/opsDoctor.js`

## Exact migration applied

- Added local operator commands: `ops:help`, `ops:doctor`, `ops:probe`, `ops:register`, `ops:stage`.
- Added reusable worker entry support for `probe`, `register`, and `stage`.
- Added first local series registry flow:
  - probe source URL first
  - resolve entity
  - enforce entity series capacity
  - create `series` and `series_source_config`
  - clone template report-profile assignment
  - clone template scoring model
  - append a disabled entry into `config/leagues.yaml`
- Fixed `--dry-run` so registration validates inside a rollback-only transaction.
- Generalized discovery, inventory, and repository helpers for non-`USACricketJunior` CricClubs namespaces.
- Tightened discovery so results/stat links stay series-scoped and division discovery uses the actual division dropdown instead of mixing year/series/team filters.
- Added local runbooks for:
  - new series onboarding
  - manual refresh
  - compute/publish
- Used the new flow to onboard `MilC 2025`:
  - config key: `bay-area-youth-cricket-hub-2025-milc-2025-27`
  - entity: `Grizzlies Cricket`
  - source system: `cricclubs`
  - source series id: `27`
  - target age group: `Open`
- Persisted MilC discovery and inventory into the analytics database:
  - 7 division/group rows
  - 144 match rows
  - 144 match refresh-state rows

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:doctor
npm run ops:probe -- --source cricclubs --url "https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036" --label "MilC 2025"
npm run ops:register -- --source cricclubs --url "https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036" --label "MilC 2025" --seasonYear 2025 --targetAgeGroup Open --dry-run
npm run ops:register -- --source cricclubs --url "https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036" --label "MilC 2025" --seasonYear 2025 --targetAgeGroup Open
npm run worker:discover:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run worker:inventory:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run ops:stage -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
```

## Exact URLs verified

- `https://www.cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036`
- `https://cricclubs.com/MiLC/viewLeague.do?league=27&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=27&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=28&year=null&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=29&year=null&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=30&year=null&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=31&year=null&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=32&year=null&clubId=18036`
- `https://cricclubs.com/MiLC/listMatches.do?league=33&year=null&clubId=18036`

## Exact deploy status

- No hosted frontend deploy in this slice
- No Render deploy in this slice
- Local control-plane only
- Supabase/Postgres analytics database updated locally through the worker repository path

## Blockers or known gaps

- `apps/worker/src/analytics/compute.js` is still placeholder-only.
- `apps/worker/src/pipeline/runMatchPipeline.js` still processes only a limited sample for compute.
- `MilC 2025` is registered and staged, but not yet fully scorecard/commentary-computed into Executive Report or Player Intelligence outputs.
- Probe outcome for intelligence remains `partial` until ball-by-ball/commentary coverage is confirmed on sample matches.
- Current inventory lands match rows under the `All Divisions` series bucket from the main results page. Per-match conference/group attribution such as `East`, `West`, `South`, `Central`, `Super Eights`, and `Final` is not yet inferred into separate match division assignments.
- New series remains disabled/inactive by default until later compute and validation slices are complete.

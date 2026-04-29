# Stage Lock: Phase 10 Step 36 - MilC Full Onboarding Complete

Date: 2026-04-29

## Goal of the slice

Run the locked local onboarding flow end to end for `MilC 2025`, harden the worker where needed, and bring the series to publish-ready state locally without activating it in the hosted app yet.

## Exact files changed

- `bay-area-u15/apps/worker/src/lib/db.js`
- `bay-area-u15/apps/worker/src/pipeline/runMatchPipeline.js`
- `bay-area-u15/apps/worker/src/extract/matchDetail.js`
- `bay-area-u15/apps/worker/src/load/repository.js`
- `bay-area-u15/apps/worker/src/ops/localValidate.js`
- `bay-area-u15/apps/worker/src/ops/localPublish.js`
- `bay-area-u15/stage_lock_phase10_step36_milc_full_onboarding_complete_2026-04-29.md`

## Exact migration applied

- None in this slice

## Exact local run commands

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:validate:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run worker:run:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --useStagedInventory --headless true
npm run worker:run:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --useStagedInventory --headless true --matchIds 784,794,793,787,795,788,792,791,790,785,780,782,783,781,779,778,776,775,772,777,774,773,769,768,764,770,765,762,771,767,766,763,759,758,760,761,753,750,747,755,754,751,748,757,756,752,749,740,737,735,743,741,738,742,739,746,745,744,736,729,725,722,734,732,727,726,733,728,721,731,730,724,723,716,713,710,720,719,714,715,718,717,712,711,709
npm run worker:run:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --useStagedInventory --headless true --matchIds 757,756,749,746,745,744
npm run worker:compute:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run worker:score:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run worker:profiles:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --force true
npm run worker:intelligence:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run ops:validate:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27
npm run ops:publish:series -- --series bay-area-youth-cricket-hub-2025-milc-2025-27 --dryRun
PORT=4014 npm run api:start
curl -sS http://127.0.0.1:4014/health
curl -sS http://127.0.0.1:4014/api/series/bay-area-youth-cricket-hub-2025-milc-2025-27/dashboard/overview
curl -sS http://127.0.0.1:4014/series/bay-area-youth-cricket-hub-2025-milc-2025-27/dashboard
```

## Exact URLs verified

- `http://127.0.0.1:4014/health`
- `http://127.0.0.1:4014/api/series/bay-area-youth-cricket-hub-2025-milc-2025-27/dashboard/overview`
- `http://127.0.0.1:4014/series/bay-area-youth-cricket-hub-2025-milc-2025-27/dashboard`

## Exact deploy status

- No hosted frontend deploy
- No Render deploy
- MilC is publish-ready locally
- Real publish intentionally not run in this slice
- `config/leagues.yaml` remains `enabled: false` for MilC
- `series_source_config.is_active` remains unchanged because only `--dryRun` was used

## Blockers or known gaps

- Real publish is intentionally deferred because the current hosted analytics entry flow is still biased toward a single active series; activating MilC now could change the default series shown in the app.
- `validation_players` for MilC are still empty in `config/leagues.yaml`.
- Reconciliation remains warning-level and is not yet a hard publish blocker.
- Report-route HTTP verification for MilC remains auth-gated; this slice verified dashboard URLs over HTTP and verified executive/intelligence report payloads at the local service layer.

## Good to go with next step

- Yes

## What the next step will do

Step 37 should add the dual-report series viewer flow so a series user can open either the Executive Player Report or the Player Intelligence Report cleanly from the Game-Changrs frontend without relying on single-series assumptions.

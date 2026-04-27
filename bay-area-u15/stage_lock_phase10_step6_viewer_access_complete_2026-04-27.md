# Stage Lock: Phase 10 Step 6 Viewer Access Complete

Date: 2026-04-27  
Slice: entity-scoped viewer access management and first enforcement layer on the root Game-Changrs analytics flow

## 1. Goal Of The Slice

Add the first safe viewer-access layer on top of the working cricket analytics integration so:

- a signed-in series admin can grant or revoke viewer access for a specific series
- the root Game-Changrs analytics routes require signed-in viewer access before showing the series workspace or root report shell
- the verified standalone Express report runtime remains unchanged in this slice

## 2. Exact Files Changed

- `bay-area-u15/apps/api/src/services/accessService.js`
- `bay-area-u15/apps/api/src/server.js`
- `src/App.tsx`
- `src/lib/cricketApi.ts`
- `src/pages/Analytics.tsx`
- `src/pages/AnalyticsReport.tsx`
- `src/pages/AnalyticsAdmin.tsx`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step6_viewer_access_complete_2026-04-27.md`

## 3. Exact Migration Applied

- No new migration was added in this step.
- Applied to Supabase in this step: **no**

This slice depends on the already-applied Phase 10 Step 1 foundation and the completed live owner bootstrap:

- `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- `supabase/migrations/20260427125500_phase10_external_auth_alignment.sql`
- `public.bootstrap_entity_owner('bay-area-youth-cricket-hub', '5ffa7fd5-37b9-4505-b819-8357be68de8f'::uuid, true)`

## 4. Exact Local Run Commands

Syntax checks:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
node --check bay-area-u15/apps/api/src/services/accessService.js
node --check bay-area-u15/apps/api/src/server.js
```

Root build:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
npm run build
```

Local cricket API:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
PORT=4015 node apps/api/src/server.js
```

Local root app with cricket API proxy:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
CRICKET_API_PROXY_TARGET=http://127.0.0.1:4015 npm run dev -- --host 127.0.0.1 --port 8083
```

HTTP verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
curl -sS http://127.0.0.1:4015/health
curl -i -sS http://127.0.0.1:4015/api/viewer/series
curl -i -sS http://127.0.0.1:4015/api/series/bay-area-usac-hub-2026/admin/viewers
curl -i -sS http://127.0.0.1:8083/cricket-api/api/viewer/series
curl -I -sS http://127.0.0.1:8083/analytics
curl -I -sS "http://127.0.0.1:8083/analytics/reports/176?divisionId=3&series=bay-area-usac-hub-2026"
```

Direct service-layer verification against the live analytics DB with dry-run grant validation:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
set -a && source .env && set +a && node - <<'NODE'
const {
  getViewerSeriesCatalog,
  listSeriesViewerGrants,
  upsertSeriesViewerGrant,
} = require('./apps/api/src/services/accessService');

(async () => {
  const ownerUserId = '5ffa7fd5-37b9-4505-b819-8357be68de8f';
  const seriesConfigKey = 'bay-area-usac-hub-2026';

  const viewerCatalog = await getViewerSeriesCatalog({
    userId: ownerUserId,
    email: 'owner@test.local',
  });

  const viewerGrants = await listSeriesViewerGrants({
    userId: ownerUserId,
    seriesConfigKey,
  });

  const dryRunGrant = await upsertSeriesViewerGrant({
    actorUserId: ownerUserId,
    seriesConfigKey,
    body: {
      userId: '11111111-1111-4111-8111-111111111111',
      accessRole: 'viewer',
    },
    dryRun: true,
  });

  console.log(JSON.stringify({
    viewerSeriesCount: viewerCatalog.seriesCount,
    defaultSeriesConfigKey: viewerCatalog.defaultSeriesConfigKey,
    actorIsPlatformAdmin: viewerCatalog.actor?.isPlatformAdmin === true,
    viewerGrantCount: viewerGrants.totals?.totalGrants ?? null,
    dryRunGrantMessage: dryRunGrant.message,
    dryRunGrantRolledBack: dryRunGrant.dryRun === true,
  }, null, 2));
})();
NODE
```

## 5. Exact URLs Verified

Direct API:

- `http://127.0.0.1:4015/health`
- `http://127.0.0.1:4015/api/viewer/series`
- `http://127.0.0.1:4015/api/series/bay-area-usac-hub-2026/admin/viewers`

Root app and proxy:

- `http://127.0.0.1:8083/cricket-api/api/viewer/series`
- `http://127.0.0.1:8083/analytics`
- `http://127.0.0.1:8083/analytics/reports/176?divisionId=3&series=bay-area-usac-hub-2026`

Service-layer live DB verification also confirmed:

- owner user `5ffa7fd5-37b9-4505-b819-8357be68de8f` resolves one accessible series
- default accessible series is `bay-area-usac-hub-2026`
- owner user is treated as platform admin after bootstrap
- dry-run viewer grant path validates cleanly and rolls back

## 6. Exact Deploy Status

- GitHub: not pushed in this step
- Supabase migration: no new migration in this step
- Supabase live state used: yes, existing Step 1 foundation plus owner bootstrap
- Render: not deployed in this step
- Lovable: not published in this step
- Local verification: complete

## 7. Verified Behavior Change

- `/analytics`, `/analytics/workspace`, and `/analytics/reports/:playerId` are now protected root-app routes
- the root app now checks the signed-in user’s accessible cricket series before rendering the analytics workspace or root report shell
- `/analytics/admin` now includes viewer-grant management for the selected series
- admins can grant or revoke `viewer` or `analyst` access by root-auth user UUID
- root analytics and root report routes now show a clear access-denied state with the signed-in user id when no grant exists
- the standalone Express report runtime and public report HTML remain unchanged in this slice

## 8. Blockers Or Known Gaps

- this slice grants access by root-auth user UUID only; invite-by-email and user-directory lookup are still deferred
- terminal verification did not include a live bearer-token success-path HTTP call for the new viewer endpoints because no reusable root-auth access token is available in the terminal
- instead, the owner success path was verified directly against the service layer and live analytics DB, including dry-run viewer-grant validation
- direct standalone Express report URLs and public cricket JSON/report routes are intentionally not hard-locked yet; this slice begins enforcement at the Game-Changrs root-app route layer
- subscription plan limits are displayed but not enforced in this slice

## 9. Exact Next Step

Phase 10 Step 7 should add subscription enforcement:

- entity plan checks
- viewer/admin/series limits
- manual refresh and scheduling entitlement checks
- the first billing-ready contract points for future paid series management

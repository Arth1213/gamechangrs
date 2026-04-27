# Stage Lock: Phase 10 Step 7 Subscription Enforcement Complete

Date: 2026-04-27  
Slice: entity plan summary, billing-ready contract fields, and first hard entitlement enforcement for protected cricket admin actions

## 1. Goal Of The Slice

Add the first safe subscription-enforcement layer so the protected cricket admin runtime can:

- expose the active entity plan and billing contract points
- enforce manual-refresh entitlement
- enforce weight-tuning entitlement
- enforce viewer-allocation caps for new grants
- enforce active-series allocation checks when another series would be activated

This slice intentionally keeps the current standalone Express report runtime unchanged and limits enforcement to the protected admin boundary plus the root admin shell.

## 2. Exact Files Changed

- `supabase/migrations/20260427143000_phase10_subscription_contract_fields.sql`
- `bay-area-u15/apps/api/src/services/subscriptionService.js`
- `bay-area-u15/apps/api/src/services/accessService.js`
- `bay-area-u15/apps/api/src/services/adminService.js`
- `bay-area-u15/apps/api/src/server.js`
- `src/lib/cricketApi.ts`
- `src/pages/AnalyticsAdmin.tsx`
- `bay-area-u15/phase10_entity_series_management_plan_2026-04-27.md`
- `bay-area-u15/stage_lock_phase10_step7_subscription_enforcement_complete_2026-04-27.md`

## 3. Exact Migration Applied

Applied to the live cricket analytics database:

- `supabase/migrations/20260427143000_phase10_subscription_contract_fields.sql`

This migration added additive billing-ready contract fields on `public.entity_subscription`:

- `billing_provider`
- `plan_display_name`
- `billing_customer_ref`
- `billing_subscription_ref`
- `contract_owner_email`
- `enforcement_mode`

Live verification after apply confirmed:

- `billing_provider = internal`
- `plan_display_name = Internal Admin`
- `enforcement_mode = hard`

## 4. Exact Local Run Commands

Syntax checks:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
node --check bay-area-u15/apps/api/src/services/subscriptionService.js
node --check bay-area-u15/apps/api/src/services/accessService.js
node --check bay-area-u15/apps/api/src/services/adminService.js
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

Live migration apply:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
set -a && source .env && set +a && node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const sqlPath = path.resolve('..', 'supabase', 'migrations', '20260427143000_phase10_subscription_contract_fields.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  const verify = await client.query(`
    select billing_provider, plan_display_name, enforcement_mode
    from public.entity_subscription
    limit 5
  `);
  console.log(JSON.stringify({ applied: true, verification: verify.rows }, null, 2));
  await client.end();
})();
NODE
```

HTTP verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo
curl -sS http://127.0.0.1:4015/health
curl -i -sS http://127.0.0.1:4015/api/series/bay-area-usac-hub-2026/admin/subscription
curl -i -sS http://127.0.0.1:8083/cricket-api/api/series/bay-area-usac-hub-2026/admin/subscription
curl -I -sS http://127.0.0.1:8083/analytics
curl -I -sS http://127.0.0.1:8083/analytics/admin
```

Direct service-layer verification against the live analytics DB:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
set -a && source .env && set +a && node - <<'NODE'
const { Client } = require('pg');
const {
  getSeriesSubscriptionSummaryWithClient,
  assertSubscriptionActionAllowed,
} = require('./apps/api/src/services/subscriptionService');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const seriesConfigKey = 'bay-area-usac-hub-2026';
  try {
    const summary = await getSeriesSubscriptionSummaryWithClient(client, seriesConfigKey);

    await client.query('BEGIN');
    await client.query(
      `update public.entity_subscription set allow_manual_refresh = false where entity_id = $1`,
      [summary.series.entityId]
    );
    let manualRefreshBlocked = '';
    try {
      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey,
        action: 'manual_refresh',
      });
    } catch (error) {
      manualRefreshBlocked = error.message;
    }
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    await client.query(
      `update public.entity_subscription set max_viewer_users = 0 where entity_id = $1`,
      [summary.series.entityId]
    );
    let viewerGrantBlocked = '';
    try {
      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey,
        action: 'viewer_grant',
        targetUserId: '11111111-1111-4111-8111-111111111111',
      });
    } catch (error) {
      viewerGrantBlocked = error.message;
    }
    await client.query('ROLLBACK');

    console.log(JSON.stringify({
      planKey: summary.subscription.planKey,
      planDisplayName: summary.subscription.planDisplayName,
      enforcementMode: summary.subscription.enforcementMode,
      seriesCount: summary.usage.seriesCount,
      adminUserCount: summary.usage.adminUserCount,
      viewerUserCount: summary.usage.viewerUserCount,
      manualRefreshEnabled: summary.entitlements.manualRefreshEnabled,
      viewerGrantEnabled: summary.entitlements.viewerGrantEnabled,
      manualRefreshBlocked,
      viewerGrantBlocked,
    }, null, 2));
  } finally {
    await client.end();
  }
})();
NODE
```

Additional entitlement verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-repo/bay-area-u15
set -a && source .env && set +a && node - <<'NODE'
const { Client } = require('pg');
const { assertSubscriptionActionAllowed } = require('./apps/api/src/services/subscriptionService');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const seriesConfigKey = 'bay-area-usac-hub-2026';
  try {
    let weightTuningBlocked = '';
    await client.query('BEGIN');
    await client.query(
      `update public.entity_subscription
         set allow_weight_tuning = false
       where entity_id = (
         select entity_id
         from public.series_source_config
         where config_key = $1
         limit 1
       )`,
      [seriesConfigKey]
    );
    try {
      await assertSubscriptionActionAllowed(client, { seriesConfigKey, action: 'weight_tuning' });
    } catch (error) {
      weightTuningBlocked = error.message;
    }
    await client.query('ROLLBACK');

    let activateSeriesBlocked = '';
    try {
      await assertSubscriptionActionAllowed(client, { seriesConfigKey, action: 'activate_series' });
    } catch (error) {
      activateSeriesBlocked = error.message;
    }

    console.log(JSON.stringify({ weightTuningBlocked, activateSeriesBlocked }, null, 2));
  } finally {
    await client.end();
  }
})();
NODE
```

## 5. Exact URLs Verified

Direct API:

- `http://127.0.0.1:4015/health`
- `http://127.0.0.1:4015/api/series/bay-area-usac-hub-2026/admin/subscription`

Root app and proxy:

- `http://127.0.0.1:8083/cricket-api/api/series/bay-area-usac-hub-2026/admin/subscription`
- `http://127.0.0.1:8083/analytics`
- `http://127.0.0.1:8083/analytics/admin`

Live DB service-layer verification also confirmed:

- current plan key is `internal`
- current plan display name is `Internal Admin`
- enforcement mode is `hard`
- manual refresh is enabled under the current live plan
- viewer grants are enabled under the current live plan
- manual refresh blocks when `allow_manual_refresh = false`
- viewer grants block when `max_viewer_users = 0`
- weight tuning blocks when `allow_weight_tuning = false`
- activating another series would block when the active-series cap is already `1/1`

## 6. Exact Deploy Status

- Supabase migration: applied live
- Local API verification: complete
- Local root build verification: complete
- GitHub: not pushed in this step
- Render: not deployed in this step
- Lovable: not published in this step

## 7. Verified Behavior Change

- the protected cricket API now exposes a live subscription summary endpoint for each manageable series
- `/analytics/admin` now shows live plan, usage, entitlement, and billing-contract summary for the selected series
- viewer grants are now blocked when the entity plan or viewer allocation does not allow another user
- manual refresh requests are now blocked when the entity plan disables manual refresh
- weight tuning writes are now blocked when the entity plan disables tuning
- activating another series now checks the active-series allocation before allowing activation

## 8. Blockers Or Known Gaps

- admin-user limit is surfaced but not actively exercised yet because there is still no admin invite/manage endpoint
- scheduled refresh entitlement is surfaced but not actively exercised yet because the scheduler control plane is still deferred
- terminal verification still does not include a live bearer-token success-path HTTP call for the new protected subscription endpoint because no reusable root-auth token is available in the terminal
- instead, the owner success path and all new entitlement gates were verified directly against the live analytics DB service layer
- email-based user discovery/invites remain deferred; viewer grants still use root-auth user UUID
- direct standalone report/runtime hardening remains intentionally deferred until after protected root-flow verification and deployment

## 9. Exact Next Step

The next step should be a deployment and live-verification slice:

- push the Phase 10 changes to GitHub
- let Render deploy the updated cricket API
- let Lovable sync/publish the updated root admin shell
- verify a real signed-in admin can open `/analytics/admin`, see the live subscription panel, grant a viewer, and exercise the current plan gates in the hosted environment

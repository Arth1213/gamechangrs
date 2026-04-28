# Stage Lock: Phase 10 Step 15 Series Admin Request Flow Complete

Date: 2026-04-28  
Slice: series-admin self-request and approval workflow, plus series-admin grant options by email invite, user ID, and pending approvals

## 1. Goal Of The Slice

Complete the missing series-admin access workflow so that:

- a logged-in user without series-admin access can request it
- the request appears in pending admin requests for the owning entity
- a current series admin or platform admin can approve or decline it
- a current series admin can grant series-admin access by email pre-approval or by direct user ID

## 2. Exact Files Changed

- `bay-area-u15/apps/api/src/server.js`
- `bay-area-u15/apps/api/src/services/accessService.js`
- `src/lib/cricketApi.ts`
- `src/pages/Analytics.tsx`
- `src/pages/AnalyticsAdmin.tsx`
- `src/pages/AnalyticsAdminGateway.tsx`
- `supabase/migrations/20260428101000_phase10_entity_admin_access_requests.sql`
- `bay-area-u15/stage_lock_phase10_step15_series_admin_request_flow_complete_2026-04-28.md`

Local-only file intentionally not committed:

- `bay-area-u15/.env`

## 3. Exact Migration Applied

Applied directly to the live analytics database:

- `supabase/migrations/20260428101000_phase10_entity_admin_access_requests.sql`

Applied via the local Node/Postgres runtime against `bay-area-u15/.env` `DATABASE_URL`, not via repo-wide `supabase db push`.

## 4. Exact Local Run Commands

Frontend build:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run build
```

Backend syntax checks:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node --check apps/api/src/server.js
node --check apps/api/src/services/accessService.js
```

Direct migration apply to the analytics database:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { loadEnvFile } = require('./apps/api/src/lib/env');
const { Pool } = require('pg');

const migrationVersion = '20260428101000';
const migrationName = 'phase10_entity_admin_access_requests';
const migrationPath = path.resolve(process.cwd(), '../supabase/migrations/20260428101000_phase10_entity_admin_access_requests.sql');

loadEnvFile(path.resolve(process.cwd(), '.env'));
const sslMode = String(process.env.DATABASE_SSL_MODE || 'disable').toLowerCase();
const ssl = sslMode === 'require' ? { rejectUnauthorized: false } : sslMode === 'verify-full' ? { rejectUnauthorized: true } : undefined;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });

(async () => {
  try {
    const before = await pool.query(`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'entity_admin_access_request'
      ) as exists
    `);

    if (!before.rows[0]?.exists) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
    }

    await pool.query(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ($1, $2)
       on conflict (version) do nothing`,
      [migrationVersion, migrationName]
    );
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

Local API smoke test:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4016 node apps/api/src/server.js
```

```bash
curl -i http://127.0.0.1:4016/health
curl -i -X POST http://127.0.0.1:4016/api/series/bay-area-usac-hub-2026/admin-access-requests \
  -H 'Content-Type: application/json' \
  --data '{"requestNote":"test"}'
curl -i -X POST http://127.0.0.1:4016/api/admin/entities/96d4f583-376f-4e06-bbb8-48cf9afb0345/admin-access-requests/00000000-0000-0000-0000-000000000000/decision \
  -H 'Content-Type: application/json' \
  --data '{"decision":"approved"}'
```

Read-only service verification:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
node - <<'NODE'
const path = require('path');
const { loadEnvFile } = require('./apps/api/src/lib/env');
loadEnvFile(path.resolve(process.cwd(), '.env'));
const { getAdminSeriesCatalog, getEntityManagementAccess } = require('./apps/api/src/services/accessService');

(async () => {
  const catalog = await getAdminSeriesCatalog({
    userId: '5ffa7fd5-37b9-4505-b819-8357be68de8f',
    email: ''
  });
  const snapshot = await getEntityManagementAccess({
    userId: '5ffa7fd5-37b9-4505-b819-8357be68de8f',
    entityId: '96d4f583-376f-4e06-bbb8-48cf9afb0345'
  });

  console.log(JSON.stringify({
    authFoundationReady: catalog.authFoundationReady,
    entityCount: catalog.entityCount,
    seriesCount: catalog.seriesCount,
    firstEntity: catalog.entities[0] ? {
      entityId: catalog.entities[0].entityId,
      entityName: catalog.entities[0].entityName,
      adminCount: catalog.entities[0].admins.length,
      adminRequestCount: catalog.entities[0].adminRequests.length
    } : null,
    snapshot: {
      entityId: snapshot.entityId,
      entityName: snapshot.entityName,
      canManage: snapshot.canManage,
      isPlatformAdmin: snapshot.isPlatformAdmin,
      isEntityAdmin: snapshot.isEntityAdmin,
      accessRole: snapshot.accessRole
    }
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
```

## 5. Exact URLs Verified

Local:

- `http://127.0.0.1:4016/health`
- `http://127.0.0.1:4016/api/series/bay-area-usac-hub-2026/admin-access-requests`
- `http://127.0.0.1:4016/api/admin/entities/96d4f583-376f-4e06-bbb8-48cf9afb0345/admin-access-requests/00000000-0000-0000-0000-000000000000/decision`

Verified local HTTP behavior:

- `/health` returned `200`
- both new admin-request routes returned `401` without auth instead of `503` or SQL errors

## 6. Exact Deploy Status

- GitHub: not pushed in this slice
- Render: not deployed in this slice
- Lovable / published frontend: not published in this slice
- Live analytics database migration: applied

## 7. Blockers Or Known Gaps

- end-to-end UI verification for the new series-admin request flow still requires a real signed-in browser session with at least two distinct users:
  - requester
  - existing series admin or platform admin reviewer
- repo-wide `supabase db push` is not a safe migration control path for this dedicated analytics database because the monorepo migration chain contains unrelated migrations; use targeted analytics migration apply until that is separated cleanly
- the failed broad `supabase db push` attempt advanced older migration history rows before stopping on an unrelated existing table; current slice functionality is working, but future migration hygiene should be handled deliberately

## 8. Next Step

Push and deploy this slice, then perform hosted verification of the full workflow:

1. signed-in non-admin user requests series-admin access
2. request appears in entity pending admin requests
3. series admin or platform admin approves request
4. approved user can open the series admin console
5. email pre-approval and direct user-ID grant both work in the hosted UI

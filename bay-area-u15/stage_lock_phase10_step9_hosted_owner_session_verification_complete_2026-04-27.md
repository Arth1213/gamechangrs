# Stage Lock: Phase 10 Step 9 Hosted Owner Session Verification Complete

Date: 2026-04-27  
Slice: hosted owner-session verification for the live entity, series admin, subscription, viewer-access, and dry-run job-control endpoints

## 1. Goal Of The Slice

Verify that the live Phase 10 deployment is not only healthy in production, but also usable through a real signed-in owner/admin session against the hosted Render cricket API.

This slice validates:

- owner-scoped entity and series discovery
- live subscription contract visibility
- live viewer-access visibility
- live match-ops visibility
- protected write paths for viewer grants, refresh requests, and tuning updates in `dryRun=true` mode

This slice does not change application behavior.

## 2. Exact Files Changed

Only this checkpoint document was added in this slice:

- `bay-area-u15/stage_lock_phase10_step9_hosted_owner_session_verification_complete_2026-04-27.md`

No application code changed.

## 3. Exact Migration Applied

No additional database migration was applied in this slice.

The live verification used the already-applied Phase 10 schema and contract changes as the source of truth:

- `supabase/migrations/20260427104500_phase10_entity_series_foundation.sql`
- `supabase/migrations/20260427125500_phase10_external_auth_alignment.sql`
- `supabase/migrations/20260427143000_phase10_subscription_contract_fields.sql`

## 4. Exact Local Run Commands

Copy the existing Chrome local-storage LevelDB for the live owner session:

```bash
rm -rf /tmp/chrome-localstorage-copy
mkdir -p /tmp/chrome-localstorage-copy
cp -R "$HOME/Library/Application Support/Google/Chrome/Default/Local Storage/leveldb" /tmp/chrome-localstorage-copy/leveldb
```

Prepare a one-off local reader for the Chrome LevelDB snapshot:

```bash
rm -rf /tmp/classic-level-read
mkdir -p /tmp/classic-level-read
cd /tmp/classic-level-read
npm init -y
npm install classic-level
```

Extract the Supabase auth session for `https://game-changrs.com` into temporary local files without printing the token:

```bash
cd /tmp/classic-level-read
node <<'NODE'
const fs = require('fs');
const { ClassicLevel } = require('classic-level');

(async () => {
  const db = new ClassicLevel('/tmp/chrome-localstorage-copy/leveldb', {
    valueEncoding: 'utf8',
  });
  await db.open();
  const rawValue = await db.get('_https://game-changrs.com\0\1sb-snlutvotzeijzqdwlank-auth-token');
  await db.close();

  const jsonText = rawValue.replace(/^\u0001/, '');
  const session = JSON.parse(jsonText);

  fs.writeFileSync('/tmp/gamechangrs-supabase-session.json', JSON.stringify(session, null, 2));
  fs.writeFileSync('/tmp/gamechangrs-owner-access-token.txt', session.access_token);

  console.log(JSON.stringify({
    extracted: true,
    hasAccessToken: Boolean(session.access_token),
    hasRefreshToken: Boolean(session.refresh_token),
    userIdPresent: Boolean(session.user && session.user.id),
  }, null, 2));
})();
NODE
```

Hosted health and owner-auth verification:

```bash
curl -sS https://gamechangrs-cricket-api.onrender.com/health

curl -sS \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  https://gamechangrs-cricket-api.onrender.com/api/admin/series

curl -sS \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  https://gamechangrs-cricket-api.onrender.com/api/viewer/series

curl -sS \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/subscription

curl -sS \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/viewers

curl -sS \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  "https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/matches?limit=3"
```

Hosted dry-run write-path verification:

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  -H "Content-Type: application/json" \
  "https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/viewers?dryRun=true" \
  --data '{"userId":"11111111-1111-4111-8111-111111111111","accessRole":"viewer"}'

curl -sS \
  -X POST \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  -H "Content-Type: application/json" \
  "https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/matches/refresh-requests?dryRun=true" \
  --data '{"matchUrl":"https://cricclubs.com/USACricketJunior/viewScorecard.do?matchId=7574&clubId=40319","reason":"phase10-hosted-verification","requestedBy":"codex"}'

curl -sS \
  -X PUT \
  -H "Authorization: Bearer $(cat /tmp/gamechangrs-owner-access-token.txt)" \
  -H "Content-Type: application/json" \
  "https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/tuning?dryRun=true" \
  --data '{"divisionWeightPremiums":{"U15 Phase 2 Div 1":1.15},"playerTierWeights":{"elite":1.25,"strong":1.10,"developing":0.85}}'
```

Git checkpoint push:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
git add bay-area-u15/stage_lock_phase10_step9_hosted_owner_session_verification_complete_2026-04-27.md
git commit -m "Document Phase 10 hosted owner-session verification"
git push origin phase10-entity-series-deploy
git push origin phase10-entity-series-deploy:main
```

## 5. Exact URLs Verified

Hosted health:

- `https://gamechangrs-cricket-api.onrender.com/health`

Hosted owner-auth read endpoints:

- `https://gamechangrs-cricket-api.onrender.com/api/admin/series`
- `https://gamechangrs-cricket-api.onrender.com/api/viewer/series`
- `https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/subscription`
- `https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/viewers`
- `https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/matches?limit=3`

Hosted owner-auth dry-run write endpoints:

- `https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/viewers?dryRun=true`
- `https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/matches/refresh-requests?dryRun=true`
- `https://gamechangrs-cricket-api.onrender.com/api/series/bay-area-usac-hub-2026/admin/tuning?dryRun=true`

## 6. Exact Deploy Status

Deployment commit in GitHub:

- `c2a04cd` on `phase10-entity-series-deploy`
- `c2a04cd` on `main`

Hosted backend status:

- Render cricket API is live and healthy
- owner-auth entity and series discovery is working
- owner-auth subscription, viewer-access, and match-ops reads are working
- dry-run protected actions are accepted in production without mutating live data

Hosted verification highlights:

- actor resolved as the signed-in owner/platform admin
- one entity visible
- one active series visible: `bay-area-usac-hub-2026`
- subscription plan visible as `internal`
- enforcement mode visible as `hard`
- active viewer grants currently `0`
- live series coverage remains `42` computed matches with `167` players

## 7. Blockers Or Known Gaps

- This slice verifies hosted owner-session behavior over HTTP, not full browser UI rendering.
- `/analytics/admin` still needs a clean browser-session walkthrough against the live site to confirm:
  - admin screen rendering
  - route protection behavior in-browser
  - visual subscription panel behavior
  - visual viewer-grant workflow behavior
- Temporary local session artifacts were created under `/tmp` for verification and should be treated as sensitive local files:
  - `/tmp/gamechangrs-supabase-session.json`
  - `/tmp/gamechangrs-owner-access-token.txt`
- No production data was changed in this slice because all protected write-path verification used `dryRun=true`.

## 8. Next Step

Run a true browser-level hosted verification of `https://game-changrs.com/analytics/admin` with the owner account session, then lock the visual admin-flow checkpoint before moving into additional Phase 10 admin UX work.

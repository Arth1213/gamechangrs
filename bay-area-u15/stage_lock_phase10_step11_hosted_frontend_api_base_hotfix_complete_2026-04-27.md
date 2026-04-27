# Stage Lock: Phase 10 Step 11 Hosted Frontend API Base Hotfix Complete

Date: 2026-04-27  
Slice: restore the production-safe cricket API base fallback so the published root app calls the live Render cricket API instead of the dev-only `/cricket-api` proxy path

## 1. Goal Of The Slice

Fix the hosted frontend regression discovered during live admin verification:

- the published root app rendered `/analytics/admin`
- but the browser fetched `https://game-changrs.com/cricket-api/...`
- the custom domain returned the SPA HTML shell instead of JSON
- the admin UI then failed with:
  - `Unexpected token '<', "<!doctype "... is not valid JSON`

This slice restores the intended production-safe frontend bridge behavior:

- local development continues to use `/cricket-api`
- hosted builds fall back to `https://gamechangrs-cricket-api.onrender.com`
- explicit `VITE_CRICKET_API_BASE` still overrides both when configured

## 2. Exact Files Changed

- `src/lib/cricketApi.ts`
- `bay-area-u15/stage_lock_phase10_step11_hosted_frontend_api_base_hotfix_complete_2026-04-27.md`

## 3. Exact Migration Applied

No database migration was applied in this slice.

## 4. Exact Local Run Commands

Inspect the live failure before the fix:

```bash
curl -sS https://game-changrs.com/analytics/admin | head -n 30
curl -sS https://game-changrs.com/assets/index-BTW5W6s6.js | rg -n "analytics/admin|Subscription Enforcement|Authenticated scope|Internal Admin|Viewer access"
curl -sS https://gamechangrs-cricket-api.onrender.com/health
```

Hosted browser diagnostic before the fix:

```bash
node - <<'NODE'
const fs = require('fs');

(async () => {
  const { chromium } = require('/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/node_modules/playwright');
  const raw = fs.readFileSync('/tmp/gamechangrs-supabase-session.json', 'utf8').replace(/^\u0001/, '');
  const session = JSON.parse(raw);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 2400 } });
  const page = await context.newPage();
  const apiResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/admin/series') || url.includes('/api/viewer/series') || url.includes('/api/series/')) {
      apiResponses.push({ url, status: response.status() });
    }
  });

  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, {
    key: 'sb-snlutvotzeijzqdwlank-auth-token',
    value: JSON.stringify(session),
  });

  await page.goto('https://game-changrs.com/analytics/admin', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(15000);

  console.log(JSON.stringify({
    title: await page.title(),
    url: page.url(),
    bodyPreview: (await page.locator('body').innerText()).slice(0, 4000),
    apiResponses,
  }, null, 2));

  await browser.close();
})();
NODE
```

Build the hotfix:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run build
```

Verify the built frontend now contains the hosted Render fallback:

```bash
rg -n "gamechangrs-cricket-api\\.onrender\\.com|/cricket-api" \
  /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/dist/assets/index-CdQ9pqzY.js
```

Push the hotfix:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
git add src/lib/cricketApi.ts bay-area-u15/stage_lock_phase10_step11_hosted_frontend_api_base_hotfix_complete_2026-04-27.md
git commit -m "Restore hosted cricket API fallback for frontend"
git push origin phase10-entity-series-deploy
git push origin phase10-entity-series-deploy:main
```

## 5. Exact URLs Verified

Pre-fix live frontend / bundle:

- `https://game-changrs.com/analytics/admin`
- `https://game-changrs.com/assets/index-BTW5W6s6.js`

Authoritative backend:

- `https://gamechangrs-cricket-api.onrender.com/health`

## 6. Exact Deploy Status

Current slice status:

- hotfix implemented locally in the clean deployment worktree
- local production build succeeded
- built bundle now contains `https://gamechangrs-cricket-api.onrender.com`
- GitHub push is the next action in this slice

Live-site status before this hotfix is published:

- root admin route is now present on `game-changrs.com`
- admin shell renders for the signed-in owner session
- data fetch still fails on the live site because the current public bundle uses `/cricket-api`

## 7. Blockers Or Known Gaps

- This hotfix is not live until the updated commit is pushed and Lovable is published again.
- No backend or database blocker remains for this issue.
- The remaining publish-step risk is operational only:
  - GitHub `main` must receive this hotfix
  - Lovable must publish the updated frontend bundle

## 8. Next Step

Push this hotfix to GitHub `main`, publish once more from Lovable, and then re-run the browser-level verification of:

- `https://game-changrs.com/analytics/admin`
- live entity/series visibility
- subscription summary rendering
- viewer-access rendering

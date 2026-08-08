# NCCA Top Players Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an NCCA-only Top Players page that shows the top 20 existing composite-score players separately for Premier A, Premier B, and Premier C, with direct Player Assessment and Threat Report links.

**Architecture:** Add one read-only report-service payload that accepts only the NCCA Summer config key, uses `player_composite_score` as its sole ranking source, and groups ranked rows by the three allowed divisions. Add matching JSON and HTML routes in the API server and a page renderer that uses the existing `renderDocument`, table, navigation, typography, color, card, link, and responsive primitives used by Player Assessment and Threat Report pages.

**Tech Stack:** Node.js CommonJS, Express, PostgreSQL (`pg`), server-rendered HTML in `apps/api/src/render/pages.js`, Node built-in test runner.

## Global Constraints

- The page is available only for `bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a`.
- Rank only by the existing `player_composite_score.composite_score`; do not introduce any batter, bowler, or new selector formula.
- Keep divisions separate: Premier A, Premier B, and Premier C; never compare across divisions.
- Limit each division to 20 rows, ordered by composite score descending, percentile descending, then player name ascending.
- Every row links to the existing assessment and intelligence routes with the row's `divisionId`.
- Reuse the Player Assessment and Threat Report visual system directly; do not create a new SME theme or separate stylesheet.
- If no current composite rows exist, render a clear recomputation/readiness state rather than invented rankings.

---

## File Structure

- `bay-area-u15/apps/api/src/services/reportService.js` — NCCA guard, composite-score query, row mapper, and grouped Top Players payload.
- `bay-area-u15/apps/api/src/server.js` — imports and exposes protected NCCA HTML/JSON routes.
- `bay-area-u15/apps/api/src/render/pages.js` — renders the division tabs, ranking table, readiness state, and exports the page renderer.
- `bay-area-u15/apps/api/test/nccaTopPlayers.test.js` — service and renderer tests using a controlled database-client seam.

### Task 1: Add a testable NCCA composite-ranking payload

**Files:**
- Create: `bay-area-u15/apps/api/test/nccaTopPlayers.test.js`
- Modify: `bay-area-u15/apps/api/src/services/reportService.js:40-170`

**Interfaces:**
- Consumes: `getNccaTopPlayers({ seriesConfigKey })` and the existing `resolveSeriesContext`, `withClient`, `roundNumeric`, `normalizeText`, and `humanizeRole` helpers.
- Produces: `getNccaTopPlayers(input)` resolving to `{ series, divisions, hasRankings, readinessMessage }`, where each division is `{ divisionId, label, players }` and every player has `rank`, `playerId`, `teamName`, `roleLabel`, `compositeScore`, `percentileRank`, `confidenceLabel`, `reportPath`, and `intelligencePath`.

- [ ] **Step 1: Write the failing payload tests**

```js
test("getNccaTopPlayers rejects every non-NCCA series", async () => {
  await assert.rejects(
    () => getNccaTopPlayers({ seriesConfigKey: "another-series" }),
    { statusCode: 404 }
  );
});

test("getNccaTopPlayers groups only Premier A/B/C and caps each division at 20", async () => {
  const payload = await getNccaTopPlayers({ seriesConfigKey: NCCA_CONFIG_KEY });
  assert.deepEqual(payload.divisions.map((division) => division.label), ["Premier A", "Premier B", "Premier C"]);
  assert.ok(payload.divisions.every((division) => division.players.length <= 20));
});

test("getNccaTopPlayers uses score, percentile, and name ordering and creates report paths", async () => {
  const players = payload.divisions[0].players;
  assert.deepEqual(players.map((player) => player.displayName), ["Asha", "Bea", "Zed"]);
  assert.equal(players[0].rank, 1);
  assert.match(players[0].reportPath, /\/series\/.*\/players\/101\/report\?divisionId=11$/);
  assert.match(players[0].intelligencePath, /\/series\/.*\/players\/101\/intelligence\?divisionId=11$/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test apps/api/test/nccaTopPlayers.test.js`

Expected: FAIL because `getNccaTopPlayers` is not exported.

- [ ] **Step 3: Implement the NCCA-only payload**

Add a fixed `NCCA_TOP_PLAYERS_CONFIG_KEY` constant and a `getNccaTopPlayers` function. Resolve the series context first. If its `configKey` is not exactly the fixed NCCA key, throw an `Error` with `statusCode = 404`.

Use the following query shape so PostgreSQL, rather than presentation code, applies the cap independently to each permitted division:

```sql
with ranked as (
  select
    pcs.player_id, pcs.division_id, p.display_name, t.display_name as team_name,
    d.source_label as division_label, psa.role_type, pcs.composite_score,
    pcs.percentile_rank, psa.confidence_score,
    row_number() over (
      partition by d.source_label
      order by pcs.composite_score desc, pcs.percentile_rank desc nulls last, p.display_name asc
    ) as division_rank
  from player_composite_score pcs
  join player p on p.id = pcs.player_id
  join division d on d.id = pcs.division_id
  left join team t on t.id = pcs.team_id
  left join player_season_advanced psa
    on psa.series_id = pcs.series_id
   and psa.division_id is not distinct from pcs.division_id
   and psa.player_id = pcs.player_id
  where pcs.series_id = $1
    and d.source_label = any($2::text[])
)
select * from ranked
where division_rank <= 20
order by array_position($2::text[], division_label), division_rank;
```

Map the results into all three division groups even when a division has no rows. Build `/series/${context.configKey}/players/${playerId}/report?divisionId=${divisionId}` and `/series/${context.configKey}/players/${playerId}/intelligence?divisionId=${divisionId}`. Set `hasRankings` from the total number of mapped players, and give the zero-row case the exact readiness message: `Rankings will appear after the NCCA refresh and recomputation complete.` Export the new function and key only if the test needs it.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test apps/api/test/nccaTopPlayers.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the payload work**

```bash
git add apps/api/src/services/reportService.js apps/api/test/nccaTopPlayers.test.js
git commit -m "feat: add NCCA top players payload"
```

### Task 2: Add NCCA Top Players routes and report-system renderer

**Files:**
- Modify: `bay-area-u15/apps/api/src/server.js:55-65, 760-770, 919-930`
- Modify: `bay-area-u15/apps/api/src/render/pages.js:1950-2148, module exports`
- Modify: `bay-area-u15/apps/api/test/nccaTopPlayers.test.js`

**Interfaces:**
- Consumes: `getNccaTopPlayers({ seriesConfigKey })` from Task 1 and `renderNccaTopPlayersPage(payload)`.
- Produces: `GET /api/series/:seriesConfigKey/top-players` JSON and `GET /series/:seriesConfigKey/top-players` HTML. Both return 404 outside NCCA; the HTML route renders the existing error-page path through the standard Express error handler.

- [ ] **Step 1: Write failing route/render tests**

```js
test("renderNccaTopPlayersPage has A/B/C controls and no role split", () => {
  const html = renderNccaTopPlayersPage(fixturePayload);
  assert.match(html, /Premier A/);
  assert.match(html, /Premier B/);
  assert.match(html, /Premier C/);
  assert.doesNotMatch(html, /Top Batters|Top Bowlers/);
});

test("renderNccaTopPlayersPage includes assessment and threat links for every row", () => {
  const html = renderNccaTopPlayersPage(fixturePayload);
  assert.match(html, /Player Assessment/);
  assert.match(html, /Threat Report/);
  assert.match(html, /players\/101\/report\?divisionId=11/);
  assert.match(html, /players\/101\/intelligence\?divisionId=11/);
});

test("renderNccaTopPlayersPage explains the unavailable state", () => {
  const html = renderNccaTopPlayersPage({ ...fixturePayload, hasRankings: false });
  assert.match(html, /Rankings will appear after the NCCA refresh and recomputation complete\./);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test apps/api/test/nccaTopPlayers.test.js`

Expected: FAIL because `renderNccaTopPlayersPage` is not exported.

- [ ] **Step 3: Implement renderer and routes**

In `pages.js`, add `renderNccaTopPlayersPage(payload)` next to `renderDashboardPage`. Call `renderDocument` with the series name and existing report profile. Render a `sheet` with an `eyebrow` of `NCCA Summer 2026`, the title `Top Players`, and a concise composite-score description.

Render the three divisions as accessible tab buttons with `data-division-tab` and the corresponding panels with `data-division-panel`. Each table uses the existing `renderTable` helper and these columns in order: `#`, `Player`, `Team`, `Role`, `Composite`, `Percentile`, `Confidence`, `Assessment`, `Threat Report`. Render player names and score values with the existing escaping/number helpers; render both report links with the existing `result-link`/button styling classes. Embed only small page-local tab-switching JavaScript; do not add a stylesheet or a new dependency. Use the readiness message as `renderTable`'s empty message when a division is empty and add the global readiness state above the tabs when `hasRankings` is false.

In `server.js`, import both new functions. Add the JSON route near `/dashboard/overview` and the HTML route beside `/series/:seriesConfigKey/dashboard`; pass `req.cricketActor.seriesConfigKey` on the protected route, preserving the existing `requireSeriesViewer` access control.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `node --test apps/api/test/nccaTopPlayers.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the page and route work**

```bash
git add apps/api/src/server.js apps/api/src/render/pages.js apps/api/test/nccaTopPlayers.test.js
git commit -m "feat: add NCCA top players page"
```

### Task 3: Verify the actual NCCA page against current data and access restrictions

**Files:**
- Modify: `bay-area-u15/apps/api/test/nccaTopPlayers.test.js`

**Interfaces:**
- Consumes: the payload, routes, and renderer from Tasks 1 and 2.
- Produces: repeatable tests confirming NCCA-only access, top-20 division caps, sorting, both report links, and the recomputation-unavailable page state.

- [ ] **Step 1: Add the final coverage assertion**

```js
test("NCCA JSON and page routes preserve series-scoped report access", async () => {
  const topPlayers = await request(app).get(`/api/series/${NCCA_CONFIG_KEY}/top-players`).expect(200);
  assert.equal(topPlayers.body.series.configKey, NCCA_CONFIG_KEY);
  await request(app).get("/api/series/non-ncca/top-players").expect(404);
  await request(app).get("/series/non-ncca/top-players").expect(404);
});
```

If this repository has no HTTP test seam, keep the equivalent coverage at the service/renderer boundary and verify the two route registrations by starting the local API with its normal configuration and requesting the same paths manually. Do not introduce Supertest solely for this page.

- [ ] **Step 2: Run the feature test suite**

Run: `node --test apps/api/test/nccaTopPlayers.test.js`

Expected: PASS.

- [ ] **Step 3: Run the repository test suite and syntax checks**

Run: `npm test && node --check apps/api/src/services/reportService.js && node --check apps/api/src/server.js && node --check apps/api/src/render/pages.js`

Expected: all tests and checks PASS.

- [ ] **Step 4: Inspect the rendered result locally**

Run the API with its normal local command and open `/series/bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a/top-players`. Verify: the report typography/color/card system is present; exactly three division controls exist; each division shows at most 20 rows; rows have both links; no batter/bowler split is present; and the unavailable state is understandable if recomputation has not completed.

- [ ] **Step 5: Commit verification coverage**

```bash
git add apps/api/test/nccaTopPlayers.test.js
git commit -m "test: cover NCCA top players page"
```

## Self-Review

1. **Spec coverage:** Task 1 enforces the exact NCCA scope, existing composite score source, A/B/C grouping, deterministic ranking, top-20 cap, and existing report paths. Task 2 uses the established report rendering system and produces the tabs, table fields, and unavailable state. Task 3 verifies access scope, rank limits/order, links, styling outcome, and repository compatibility.
2. **Placeholder scan:** No `TBD`, `TODO`, “appropriate error handling”, or unnamed test work remains. The only conditional test instruction identifies the repository’s lack of an HTTP test seam and preserves equivalent tested behavior without adding a dependency.
3. **Type consistency:** `getNccaTopPlayers` produces `divisions`, `hasRankings`, `readinessMessage`, `reportPath`, and `intelligencePath`; Task 2 consumes those exact names and Task 3 verifies the same route and payload names.

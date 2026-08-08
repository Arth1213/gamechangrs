# Lovable NCCA Top Players Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and publish the protected NCCA Top Players page in the Game-Changrs Lovable React app.

**Architecture:** Extend the existing cricket API bridge with typed NCCA Top Players data and a token-authenticated fetcher. A dedicated React page consumes that response, uses the existing analytics shell/components, and routes its assessment/intelligence actions through the existing Lovable report routes. The page is registered under the protected analytics route tree, then built and published through the linked Lovable project.

**Tech Stack:** React 18, TypeScript, React Router, Tailwind/shadcn UI, Supabase Auth, existing Render cricket API.

## Global Constraints

- Fixed series key: `bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a`.
- Consume the API composite ranking only; no frontend scoring logic or fixture leaderboard data.
- Keep Premier A, Premier B, and Premier C separate; each contains at most 20 API-ranked players.
- Require the existing analytics authenticated viewer access.
- Use `/analytics/reports/:playerId` and `/analytics/intelligence/:playerId` with `series` and `divisionId` query parameters.
- Preserve the existing Lovable analytics/report visual system.

---

## File Structure

- `src/lib/cricketApi.ts` — typed Top Players response, authenticated fetcher, and route builder.
- `src/pages/AnalyticsNccaTopPlayers.tsx` — protected NCCA rankings page and all loading/error/no-rankings states.
- `src/App.tsx` — protected route registration.
- `src/lib/cricketApi.test.ts` or existing frontend test location — API bridge contract tests, if the project has a test runner; otherwise route/page behavior is verified by the production build and authenticated browser smoke test.

### Task 1: Add the typed authenticated API bridge

**Files:**
- Modify: `src/lib/cricketApi.ts:1190-1565`

**Interfaces:**
- Produces `CricketNccaTopPlayersResponse` with `{ series, divisions, hasRankings, readinessMessage }`.
- Produces `fetchCricketNccaTopPlayers(accessToken, signal?) => Promise<CricketNccaTopPlayersResponse>`.
- Produces `getAnalyticsNccaTopPlayersRoute() => "/analytics/ncca/top-players"`.

- [ ] **Step 1: Write the failing API contract test**

```ts
expect(getAnalyticsNccaTopPlayersRoute()).toBe("/analytics/ncca/top-players");
await expect(fetchCricketNccaTopPlayers("token")).resolves.toMatchObject({
  hasRankings: expect.any(Boolean),
  divisions: expect.arrayContaining([expect.objectContaining({ label: "Premier A" })]),
});
```

- [ ] **Step 2: Run it and confirm the new function is missing**

Run the project’s frontend test command if available; otherwise run `npm run build` after adding the page import in Task 2 to confirm TypeScript rejects the absent function.

- [ ] **Step 3: Implement the smallest bridge**

Add explicit types for the division/player payload. Call `getCricketApiUrl(`/api/series/${NCCA_KEY}/top-players`)` using the same `Authorization: Bearer ${accessToken}` headers and JSON error behavior as `fetchCricketPlayerReport`. Add a constant NCCA key next to the route helper; do not accept a user-controlled series parameter.

- [ ] **Step 4: Verify the bridge**

Run: `npm run build`

Expected: TypeScript compiles successfully.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cricketApi.ts
git commit -m "feat: add Lovable NCCA leaderboard API bridge"
```

### Task 2: Build the protected Lovable leaderboard page

**Files:**
- Create: `src/pages/AnalyticsNccaTopPlayers.tsx`
- Modify: `src/App.tsx:1-90`

**Interfaces:**
- Consumes `useAuth`, `fetchCricketNccaTopPlayers`, `getAnalyticsWorkspaceRoute`, `getRootCricketPlayerReportRoute`, and `getRootCricketPlayerIntelligenceRoute`.
- Produces protected route `/analytics/ncca/top-players`.

- [ ] **Step 1: Write the failing route/page assertion**

```tsx
expect(renderedPage).toContain("Top Players");
expect(renderedPage).toContain("Premier A");
expect(renderedPage).toContain("Player Assessment");
expect(renderedPage).toContain("Threat Report");
```

- [ ] **Step 2: Run the build to establish the missing page failure**

Run: `npm run build`

Expected: FAIL until the new page module and route exist.

- [ ] **Step 3: Implement the page**

Use `Navbar`, `Footer`, `Card`, `Badge`, `Button`, `Tabs`, `Table`, and existing report-page dark surface classes. On load, obtain `session.access_token`, call `fetchCricketNccaTopPlayers`, and render a retryable error state if the API fails. Render tabs from the API’s three division groups; each table has `#`, Player, Team, Role, Composite, Percentile, Confidence, Assessment, Threat Report columns. Build both report links with the row `playerId`, `divisionId`, and fixed NCCA series key. For no rankings, display the API readiness message. Include a back-to-workspace action.

Register it in `App.tsx` inside `<ProtectedRoute>`:

```tsx
<Route path="/analytics/ncca/top-players" element={
  <ProtectedRoute><AnalyticsNccaTopPlayers /></ProtectedRoute>
} />
```

- [ ] **Step 4: Verify the UI build**

Run: `npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/AnalyticsNccaTopPlayers.tsx
git commit -m "feat: add Lovable NCCA top players page"
```

### Task 3: Publish and verify the Lovable page

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes the route from Task 2 and the existing linked Lovable project.
- Produces a public production URL for an authenticated Lovable user.

- [ ] **Step 1: Run complete build verification**

Run: `npm run build && git status --short`

Expected: build succeeds and only intentionally excluded local runtime files remain.

- [ ] **Step 2: Push the frontend**

Run: `git push origin main`

Expected: `origin/main` matches local `main`.

- [ ] **Step 3: Publish using the existing Lovable project session**

Open the linked Game-Changrs Lovable project, confirm it is connected to this GitHub `main`, and use its Publish action. Do not create a replacement Lovable project.

- [ ] **Step 4: Verify production while signed in**

Open `/analytics/ncca/top-players` on the published domain. Confirm authentication is required when signed out; after signing in with NCCA viewer access, confirm all three tabs, API-backed values, and both report links render.

- [ ] **Step 5: Report the exact published URL and deployment status**

Record the final production URL, Git commit, and any runtime API/CORS failure without claiming publication if the Lovable publish step fails.

## Self-Review

1. **Spec coverage:** Task 1 creates the fixed NCCA authenticated data contract; Task 2 implements the approved Lovable route, report links, UI, and failure states; Task 3 builds, pushes, publishes, and verifies production.
2. **Placeholder scan:** No TBD/TODO or unnamed test actions remain.
3. **Type consistency:** Task 1’s `CricketNccaTopPlayersResponse` and `fetchCricketNccaTopPlayers` are the exact page inputs named by Task 2; Task 3 verifies the same fixed route.

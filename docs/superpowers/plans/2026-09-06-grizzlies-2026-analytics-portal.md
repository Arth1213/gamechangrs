# Grizzlies 2026 Analytics Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a four-user Gmail-protected Grizzlies 2026 portal with roster intelligence, auditable NCCA identity resolution, duplicate consolidation, and an inactive MiLC placeholder.

**Architecture:** Keep the roster, email allow-list, and approved identity mappings in one version-controlled portal configuration used by both the API and worker. The API verifies the existing Supabase access token and exact normalized email before returning portal data; the frontend never treats a client-side allow-list as authorization. The worker resolves mapped source-player IDs to a canonical ID before season, composite, and intelligence aggregation, preserving raw match facts.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind/shadcn, React Router, Node.js CommonJS, Express 5, PostgreSQL via `pg`, Node built-in test runner, YAML.

**Spec:** `docs/superpowers/specs/2026-09-06-grizzlies-2026-analytics-portal-design.md`

## Global Constraints

- Route: `/analytics/grizzlies/2026`; it is protected and must never render roster intelligence before authentication and server authorization succeed.
- Only `samirnshah@gmail.com`, `niravsh@gmail.com`, `helloarth09@gmail.com`, and `mohan.arun@gmail.com` may access the portal.
- Restrict squad data to San Ramon Grizzlies, Silicon Valley Strikers, and East Bay Blazers from the Western Division roster.
- Use only approved exact or explicit override mappings. Show `NCCA data not found` for any unresolved player; never silently fuzzy-match.
- Keep raw scorecard, innings, and ball-event player IDs unchanged; only derived season/composite/intelligence outputs use canonical IDs.
- Reuse existing Player Assessment and Threat Report routes, visual tokens, and `series=bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a` query context.
- Use the supplied Sreehaas Krishna CricClubs profile URL and exact spelling.
- The MiLC entry is disabled and must not have discovery, refresh, or ingestion enabled until an official CricClubs series URL and identifiers are supplied.

---

## File Structure

- `config/grizzlies-2026-portal.yaml` — allowed emails, three-team roster, approved NCCA mappings, unresolved names, and canonical identity clusters.
- `config/leagues.yaml` — disabled `2026 MiLC series` placeholder only.
- `apps/worker/src/ops/playerIdentityOverrides.js` — parses portal configuration and resolves an input player ID to its canonical NCCA ID.
- `apps/worker/src/pipeline/runSeasonAggregation.js` — canonicalizes derived season aggregation inputs.
- `apps/worker/src/pipeline/runCompositeScoring.js` — canonicalizes wicketkeeping-derived inputs before scoring.
- `apps/worker/src/pipeline/runPlayerIntelligence.js` — canonicalizes player references in intelligence inputs.
- `apps/worker/test/playerIdentityOverrides.test.js` — resolver and aggregation regression tests.
- `apps/api/src/lib/auth.js` — exact-email portal guard built on the existing token verifier.
- `apps/api/src/services/grizzliesPortalService.js` — loads configuration, joins approved NCCA IDs to current NCCA data, and produces safe row states.
- `apps/api/src/server.js` — protected portal JSON endpoint.
- `apps/api/test/grizzliesPortal.test.js` — authorization and payload unit tests.
- `src/lib/cricketApi.ts` — typed portal payload and authenticated fetch helper.
- `src/pages/AnalyticsGrizzlies2026.tsx` — branded protected route with Squad Intelligence and AI Match Analysis tabs.
- `src/App.tsx` — route registration.
- `public/grizzlies-2026-logo.png` — provided Grizzlies logo copied without alteration.

### Task 1: Add portal configuration and a testable identity resolver

**Files:**
- Create: `config/grizzlies-2026-portal.yaml`
- Create: `apps/worker/src/ops/playerIdentityOverrides.js`
- Create: `apps/worker/test/playerIdentityOverrides.test.js`

**Interfaces:**
- Consumes: `loadYamlConfig(filePath)` from `apps/worker/src/lib/config.js`.
- Produces: `loadGrizzliesPortalConfig(filePath)` and `createCanonicalPlayerResolver(config, seriesConfigKey)`.
- Resolver signature: `resolvePlayerId(playerId: number): number`; unmapped IDs return unchanged.

- [ ] **Step 1: Write failing resolver tests**

```js
test("maps every approved short NCCA profile to its canonical player", () => {
  const resolvePlayerId = createCanonicalPlayerResolver({
    identityClusters: [{ canonicalPlayerId: 8174, sourcePlayerIds: [8130, 8349, 8174] }],
  }, NCCA_SERIES_KEY);
  assert.equal(resolvePlayerId(8130), 8174);
  assert.equal(resolvePlayerId(8174), 8174);
});

test("does not alter IDs outside the NCCA cluster list", () => {
  const resolvePlayerId = createCanonicalPlayerResolver({ identityClusters: [] }, NCCA_SERIES_KEY);
  assert.equal(resolvePlayerId(9999), 9999);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test apps/worker/test/playerIdentityOverrides.test.js`

Expected: FAIL because the resolver module does not exist.

- [ ] **Step 3: Implement the configuration and resolver**

Create YAML with these immutable values:

```yaml
portal:
  slug: grizzlies-2026
  nccaSeriesConfigKey: bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
  allowedEmails:
    - samirnshah@gmail.com
    - niravsh@gmail.com
    - helloarth09@gmail.com
    - mohan.arun@gmail.com
```

Add all 51 roster rows and the twelve approved mappings from the specification. Add Sreehaas Krishna with `profileUrl: https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=2102795&clubId=1191`, and Kashyap Manchili with NCCA player ID `7283`. Store every duplicate cluster as `canonicalPlayerId` plus `sourcePlayerIds`; reject a configuration where one source ID belongs to two canonical IDs.

Seed these exact canonical clusters, selected from the NCCA profile-bearing or unannotated player record:

```yaml
identityClusters:
  - canonicalPlayerId: 7460
    sourcePlayerIds: [7460, 7421] # Aarnav Iyer
  - canonicalPlayerId: 7991
    sourcePlayerIds: [7991, 8216] # Bilal Basheer
  - canonicalPlayerId: 4583
    sourcePlayerIds: [4583, 8278] # Praneel Venna
  - canonicalPlayerId: 8167
    sourcePlayerIds: [8167, 7931, 4838] # Vinay Khandelwal
  - canonicalPlayerId: 3779
    sourcePlayerIds: [3779, 8228] # Aadhav Iyer
  - canonicalPlayerId: 3800
    sourcePlayerIds: [3800, 3948] # Ayaan Khan
  - canonicalPlayerId: 8174
    sourcePlayerIds: [8174, 8130, 8349] # Husnain Bukhari
  - canonicalPlayerId: 4077
    sourcePlayerIds: [4077, 3850] # Shivam Mishra
  - canonicalPlayerId: 3831
    sourcePlayerIds: [3831, 3900] # Supransh Kumar
```

Implement the resolver with a `Map`, validate positive integer IDs, and throw `Error("Duplicate canonical identity source player ID: <id>")` on conflicting configuration. The resolver must not read or mutate the database.

- [ ] **Step 4: Run focused tests and configuration parsing check**

Run: `node --test apps/worker/test/playerIdentityOverrides.test.js`

Expected: PASS.

Run: `node -e "const {loadGrizzliesPortalConfig}=require('./apps/worker/src/ops/playerIdentityOverrides'); console.log(loadGrizzliesPortalConfig('./config/grizzlies-2026-portal.yaml').roster.length)"`

Expected: `51`.

- [ ] **Step 5: Commit configuration and resolver**

```bash
git add config/grizzlies-2026-portal.yaml apps/worker/src/ops/playerIdentityOverrides.js apps/worker/test/playerIdentityOverrides.test.js
git commit -m "feat: add Grizzlies roster identity configuration"
```

### Task 2: Canonicalize only derived NCCA analytics

**Files:**
- Modify: `apps/worker/src/pipeline/runSeasonAggregation.js`
- Modify: `apps/worker/src/pipeline/runCompositeScoring.js`
- Modify: `apps/worker/src/pipeline/runPlayerIntelligence.js`
- Modify: `apps/worker/test/playerIdentityOverrides.test.js`

**Interfaces:**
- Consumes: `createCanonicalPlayerResolver(config, seriesConfigKey)` from Task 1.
- Produces: canonical `playerId`, `strikerPlayerId`, `bowlerPlayerId`, and `playerOutId` values only in objects passed into `buildPlayerSeasonAdvancedRows`, `buildPlayerCompositeRows`, and `buildPlayerIntelligenceRows`.

- [ ] **Step 1: Add failing aggregation tests**

```js
test("season aggregation combines duplicate source-player rows under one canonical player", () => {
  const rows = canonicalizePlayerMatchRows([
    { playerId: 8130, matchId: 1 },
    { playerId: 8174, matchId: 2 },
  ], (id) => id === 8130 ? 8174 : id);
  assert.deepEqual(rows.map((row) => row.playerId), [8174, 8174]);
});

test("intelligence canonicalization rewrites striker, bowler, and dismissed-player references", () => {
  const row = canonicalizeBallEventRow(
    { strikerPlayerId: 8130, bowlerPlayerId: 3850, playerOutId: 3900 },
    (id) => ({ 8130: 8174, 3850: 4077, 3900: 3831 }[id] || id)
  );
  assert.deepEqual(row, { strikerPlayerId: 8174, bowlerPlayerId: 4077, playerOutId: 3831 });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test apps/worker/test/playerIdentityOverrides.test.js`

Expected: FAIL because canonicalization helpers are not exported.

- [ ] **Step 3: Implement canonicalization before derived calculations**

Add small pure helpers to each pipeline module. In `runSeasonAggregation`, map `row.playerId` before `buildPlayerSeasonAdvancedRows`. In `runCompositeScoring`, map both season rows and wicketkeeping rows before `buildPlayerCompositeRows`. In `runPlayerIntelligence`, map `playerId` in innings/dismissal rows and every player-reference field in ball events before `buildPlayerIntelligenceRows`.

Do not update `player_match_advanced`, `ball_event`, `batting_innings`, `bowling_innings`, `player`, or `player_alias`. The raw source evidence remains untouched.

- [ ] **Step 4: Run regression tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit canonical derived analytics**

```bash
git add apps/worker/src/pipeline/runSeasonAggregation.js apps/worker/src/pipeline/runCompositeScoring.js apps/worker/src/pipeline/runPlayerIntelligence.js apps/worker/test/playerIdentityOverrides.test.js
git commit -m "feat: canonicalize Grizzlies NCCA identities in analytics"
```

### Task 3: Build server-enforced named-user portal data

**Files:**
- Create: `apps/api/src/services/grizzliesPortalService.js`
- Modify: `apps/api/src/lib/auth.js`
- Modify: `apps/api/src/server.js`
- Create: `apps/api/test/grizzliesPortal.test.js`

**Interfaces:**
- Consumes: authenticated actor `{ userId, email }`, portal configuration, and NCCA player/team/division rows.
- Produces: `requireGrizzliesPortalAccess(req)` and `getGrizzliesPortalPayload()`.
- Payload shape: `{ title, teams: Array<{ name, players }>, nccaSeriesConfigKey, analysisStatus }`.

- [ ] **Step 1: Write failing authorization and payload tests**

```js
test("portal guard accepts only a normalized allow-list email", async () => {
  const actor = await requireGrizzliesPortalAccess({ cricketActor: { userId: "u", email: "NIRAVSH@GMAIL.COM" } });
  assert.equal(actor.email, "niravsh@gmail.com");
});

test("portal guard rejects a signed-in user outside the allow-list", async () => {
  await assert.rejects(
    () => requireGrizzliesPortalAccess({ cricketActor: { userId: "u", email: "other@example.com" } }),
    { statusCode: 403 }
  );
});

test("portal payload exposes reports only for confirmed mappings", () => {
  const row = mapRosterPlayer({ name: "Unmatched Player" }, new Map());
  assert.equal(row.status, "not_found");
  assert.equal(row.assessmentPath, null);
  assert.equal(row.threatPath, null);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test apps/api/test/grizzliesPortal.test.js`

Expected: FAIL because portal guard and service do not exist.

- [ ] **Step 3: Implement exact-email authorization and payload**

Make `requireGrizzliesPortalAccess` call `requireAuthenticatedCricketUser(req)`, normalize the verified Supabase email, and compare it to configuration emails. On mismatch, throw `Error("You do not have access to Grizzlies 2026 Analytics.")` with `statusCode = 403`.

Implement `getGrizzliesPortalPayload()` with a single NCCA query for configured player IDs, joining `player`, latest NCCA profile URL, team, and active report data. For each roster row:

```js
{
  name, rosterCategory, teamName,
  nccaStatus: "matched" | "not_found",
  cricclubsProfileUrl: string | null,
  assessmentPath: string | null,
  threatPath: string | null
}
```

Return the supplied Sreehaas URL even if the current database profile URL is blank. Return `null` report paths for unresolved rows. Add `GET /api/portals/grizzlies/2026` behind the new guard.

- [ ] **Step 4: Run focused API tests**

Run: `node --test apps/api/test/grizzliesPortal.test.js`

Expected: PASS.

- [ ] **Step 5: Commit protected portal API**

```bash
git add apps/api/src/lib/auth.js apps/api/src/services/grizzliesPortalService.js apps/api/src/server.js apps/api/test/grizzliesPortal.test.js
git commit -m "feat: add protected Grizzlies portal API"
```

### Task 4: Add the protected GameChangrs portal page

**Files:**
- Create: `src/pages/AnalyticsGrizzlies2026.tsx`
- Modify: `src/lib/cricketApi.ts`
- Modify: `src/App.tsx`
- Create: `public/grizzlies-2026-logo.png`

**Interfaces:**
- Consumes: `fetchGrizzliesPortal(accessToken, signal)` and its typed payload from `src/lib/cricketApi.ts`.
- Produces: protected route `/analytics/grizzlies/2026`.

- [ ] **Step 1: Add typed client contract before the page**

```ts
export type CricketGrizzliesPortalPlayer = {
  name: string;
  rosterCategory: string;
  teamName: string;
  nccaStatus: "matched" | "not_found";
  cricclubsProfileUrl: string | null;
  assessmentPath: string | null;
  threatPath: string | null;
};

export async function fetchGrizzliesPortal(accessToken: string, signal?: AbortSignal) {
  return fetchAuthenticatedJson<CricketGrizzliesPortalResponse>("/api/portals/grizzlies/2026", accessToken, signal);
}
```

- [ ] **Step 2: Implement the page**

Use `ProtectedRoute` in `App.tsx`. The page must use `Navbar`, `Footer`, current card/table/tabs components, logo asset, and heading text exactly `Grizzlies 2026 Analytics - Powered by GameChangrs`.

Render two tabs:

1. **Squad Intelligence** — one tab or section per approved team, with Player, Category, NCCA Profile, Player Assessment, and Player Threat columns. Use external anchors for CricClubs profiles and React `Link` for internal report routes. Render the literal `NCCA data not found` in both report columns when paths are null.
2. **AI Match Analysis** — render `Match Analysis and AI Recommendations Coming Soon` and state that analysis begins after completed 2026 MiLC matches are ingested.

Copy the provided logo to `public/grizzlies-2026-logo.png`; do not regenerate, recolor, or replace it.

- [ ] **Step 3: Verify production build**

Run: `npm run build`

Expected: exit code 0 with `/analytics/grizzlies/2026` included in the production bundle.

- [ ] **Step 4: Commit the portal UI**

```bash
git add src/App.tsx src/lib/cricketApi.ts src/pages/AnalyticsGrizzlies2026.tsx public/grizzlies-2026-logo.png
git commit -m "feat: add Grizzlies 2026 analytics portal"
```

### Task 5: Add the inactive MiLC placeholder and prove no jobs can run

**Files:**
- Modify: `config/leagues.yaml`
- Modify: `apps/worker/test/playerIdentityOverrides.test.js`

**Interfaces:**
- Produces: `grizzlies-2026-milc` configuration entry with `enabled: false`.

- [ ] **Step 1: Write the disabled-series configuration assertion**

```js
test("2026 MiLC placeholder is disabled and has no source URL", () => {
  const config = loadYamlConfig("config/leagues.yaml");
  const series = config.series.find((entry) => entry.slug === "grizzlies-2026-milc");
  assert.deepEqual(
    { enabled: series.enabled, seriesUrl: series.series_url, autoDiscovery: series.enable_auto_discovery },
    { enabled: false, seriesUrl: "", autoDiscovery: false }
  );
});
```

- [ ] **Step 2: Add the placeholder**

```yaml
- slug: grizzlies-2026-milc
  label: 2026 MiLC series
  enabled: false
  source_system: cricclubs
  league_name: MiLC
  season_year: 2026
  series_url: ""
  source_hints: {}
  enable_auto_discovery: false
  targeting:
    age_group: Open
    divisions: []
  validation_players: []
  outputs:
    enable_raw_snapshots: false
    enable_json_exports: false
    enable_pdf_reports: false
    enable_dashboard_views: false
```

- [ ] **Step 3: Run worker tests and inspect the series entry**

Run: `npm test`

Expected: PASS.

Run: `node apps/worker/src/index.js discover --config config/leagues.yaml --series grizzlies-2026-milc`

Expected: a clear disabled-series refusal before any browser or network work.

- [ ] **Step 4: Commit the inactive placeholder**

```bash
git add config/leagues.yaml apps/worker/test/playerIdentityOverrides.test.js
git commit -m "feat: add inactive 2026 MiLC placeholder"
```

### Task 6: Recompute and release validation

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-grizzlies-2026-analytics-portal-design.md` only if validation reveals a required mapping correction.

**Interfaces:**
- Consumes: the configuration, canonicalized pipelines, API, and frontend from Tasks 1-5.
- Produces: verified portal data with a preserved raw-data trail.

- [ ] **Step 1: Run canonical NCCA recomputation**

Run:

```bash
npm --prefix bay-area-u15 run worker:compute:series -- --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
npm --prefix bay-area-u15 run worker:score:series -- --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
npm --prefix bay-area-u15 run worker:intelligence:series -- --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
```

Expected: all three commands exit 0 and write successful artifacts for the NCCA series.

- [ ] **Step 2: Validate affected canonical players**

For each duplicate cluster, query the current season, composite, and intelligence outputs by canonical player ID. Confirm one derived identity appears per configured cluster and raw source rows remain unchanged. Verify the Sreehaas CricClubs URL, Shivam/ Supransh/Husnain report links, and all twelve approved abbreviation links.

- [ ] **Step 3: Run complete automated verification**

Run:

```bash
npm --prefix bay-area-u15 test
npm run build
```

Expected: both exit 0.

- [ ] **Step 4: Commit any evidence-driven configuration correction only**

```bash
git status --short
```

Expected: no uncommitted Grizzlies files. If validation required a source-ID correction, commit only that correction with `fix: correct Grizzlies NCCA identity override`.

## Self-Review

- Spec coverage: Tasks 1-2 cover roster source, approved mappings, canonical duplicate reconciliation, and raw-data preservation. Task 3 covers server-enforced Gmail allow-list and safe NCCA/report data. Task 4 covers the branded two-tab route and logo. Task 5 covers the disabled MiLC placeholder. Task 6 covers recomputation and release verification.
- Placeholder scan: no implementation task relies on an unspecified source URL, identity inference, or future work item.
- Type consistency: Task 1 exports the resolver consumed by Task 2; Task 3 emits the typed portal payload consumed by Task 4; Task 5 uses the shared YAML loader from Task 1 tests.

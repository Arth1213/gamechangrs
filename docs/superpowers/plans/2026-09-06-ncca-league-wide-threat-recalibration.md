# NCCA League-Wide Threat Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a sample-aware, division-weighted NCCA 2026 threat score and use it consistently in Grizzlies Squad Intelligence and Player Threat reports.

**Architecture:** Keep `player_composite_score` as the division-level source. Add a separate `player_series_threat_score` table and a worker pipeline that combines eligible Premier A/B/C scores with division weights and evidence shrinkage. APIs read the persisted league-wide result so every consumer sees the same threat tier.

**Tech Stack:** PostgreSQL/Supabase migration SQL, Node.js CommonJS worker and API services, `node:test`, React/Vite.

**Spec:** `docs/superpowers/specs/2026-09-06-ncca-league-wide-threat-recalibration-design.md`

## Global Constraints

- Scope is NCCA 2026 Summer only; do not alter division-level composite scores or role classification.
- Premier A/B/C weights are exactly `1.00`, `0.70`, and `0.45`.
- Evidence confidence is `min(matches_played / 4, 1)` and neutral score is exactly `50.00`.
- Red means percentile `>= 85` with at least three total matches; one/two-match high-percentile players are Amber.
- Unknown means no eligible NCCA match evidence.
- Preserve existing unrelated worker modifications in `runSeasonAggregation.js` and `playerIdentityOverrides.test.js`.

---

### Task 1: Persisted NCCA league-threat schema

**Files:**
- Create: `supabase/migrations/20260906100000_ncca_player_series_threat_score.sql`
- Modify: `bay-area-u15/bay_area_u15_schema.sql: after player_composite_score`
- Test: `supabase/migrations/20260906100000_ncca_player_series_threat_score.sql` verified against a disposable Postgres/Supabase database

**Interfaces:**
- Consumes: `series`, `player`, `player_composite_score`, and `player_season_advanced` identities.
- Produces: `public.player_series_threat_score(series_id bigint, player_id bigint, league_threat_score numeric(8,4), league_percentile_rank numeric(8,4), total_matches integer, division_evidence jsonb, score_version text, generated_at timestamptz)` with unique `(series_id, player_id, score_version)`.

- [ ] **Step 1: Write the migration contract before schema code**

Create the migration with comments that state its required columns, foreign keys, unique key, and index. The initial execution must fail when attempting to query a nonexistent `player_series_threat_score` table in an untouched disposable database.

Run: `psql "$DATABASE_URL" -c "select * from public.player_series_threat_score limit 1"`

Expected: failure before the migration is applied because the relation does not exist.

- [ ] **Step 2: Add the idempotent table and index**

```sql
create table if not exists public.player_series_threat_score (
  id bigserial primary key,
  series_id bigint not null references public.series(id) on delete cascade,
  player_id bigint not null references public.player(id) on delete cascade,
  league_threat_score numeric(8,4) not null,
  league_percentile_rank numeric(8,4) not null,
  total_matches integer not null check (total_matches >= 0),
  division_evidence jsonb not null default '[]'::jsonb,
  score_version text not null default 'ncca-league-threat-v1',
  generated_at timestamptz not null default now(),
  unique (series_id, player_id, score_version)
);

create index if not exists idx_player_series_threat_score_rank
  on public.player_series_threat_score (series_id, league_percentile_rank desc);
```

Copy the same `CREATE TABLE` and `CREATE INDEX` definition into `bay_area_u15_schema.sql` after `player_composite_score`.

- [ ] **Step 3: Apply migration and verify its contract**

Run: `supabase db push` in the repository root, or apply the migration with the configured database migration command used by this project.

Run: `psql "$DATABASE_URL" -c "\d+ public.player_series_threat_score"`

Expected: columns, unique key, foreign keys, check constraint, and ranking index match the declared interface.

- [ ] **Step 4: Commit schema change**

```bash
git add supabase/migrations/20260906100000_ncca_player_series_threat_score.sql bay-area-u15/bay_area_u15_schema.sql
git commit -m "feat: add NCCA league threat score storage"
```

### Task 2: Pure weighted-threat calculator

**Files:**
- Create: `bay-area-u15/apps/worker/src/analytics/leagueThreatScore.js`
- Create: `bay-area-u15/apps/worker/test/leagueThreatScore.test.js`

**Interfaces:**
- Consumes: rows shaped as `{ divisionLabel, playerId, compositeScore, matchesPlayed }`.
- Produces: `buildLeagueThreatRows(rows)` returning `{ rows, summary }`, where each row has `playerId`, `leagueThreatScore`, `leaguePercentileRank`, `totalMatches`, and `divisionEvidence`.

- [ ] **Step 1: Write failing calculator tests**

```js
test("weights Premier A above identical Premier B and C evidence", () => {
  const result = buildLeagueThreatRows([
    { divisionLabel: "2026 Premier A", playerId: 1, compositeScore: 80, matchesPlayed: 4 },
    { divisionLabel: "2026 Premier B", playerId: 2, compositeScore: 80, matchesPlayed: 4 },
    { divisionLabel: "2026 Premier C", playerId: 3, compositeScore: 80, matchesPlayed: 4 },
  ]);
  assert.ok(result.rows.find((row) => row.playerId === 1).leagueThreatScore > result.rows.find((row) => row.playerId === 2).leagueThreatScore);
});

test("shrinks a one-match score toward neutral 50", () => {
  const [row] = buildLeagueThreatRows([{ divisionLabel: "2026 Premier B", playerId: 1, compositeScore: 90, matchesPlayed: 1 }]).rows;
  assert.equal(row.leagueThreatScore, 60);
});

test("excludes divisions outside Premier A B and C", () => {
  assert.equal(buildLeagueThreatRows([{ divisionLabel: "Overall", playerId: 1, compositeScore: 100, matchesPlayed: 10 }]).rows.length, 0);
});
```

Run: `node --test apps/worker/test/leagueThreatScore.test.js`

Expected: failure because `leagueThreatScore.js` does not exist.

- [ ] **Step 2: Implement the minimal calculator**

Implement constants:

```js
const DIVISION_WEIGHTS = new Map([
  ["2026 Premier A", 1],
  ["2026 Premier B", 0.7],
  ["2026 Premier C", 0.45],
]);
const NEUTRAL_COMPOSITE_SCORE = 50;
```

For every eligible player-division row, calculate `confidence`, `confidenceAdjustedComposite`, and weighted contribution. Group by player, divide total weighted contribution by the player’s participating-weight sum, and call the existing deterministic percentile helper pattern from `compositeScore.js` on the final league scores. Include each division’s source score, matches, confidence, weight, and adjusted score in `divisionEvidence`.

- [ ] **Step 3: Add tier boundary and percentile tests**

Add tests that assert:

```js
assert.equal(getLeagueThreatTier({ leaguePercentileRank: 85, totalMatches: 3 }), "red");
assert.equal(getLeagueThreatTier({ leaguePercentileRank: 99, totalMatches: 2 }), "amber");
assert.equal(getLeagueThreatTier({ leaguePercentileRank: 60, totalMatches: 1 }), "amber");
assert.equal(getLeagueThreatTier({ leaguePercentileRank: 59.99, totalMatches: 8 }), "green");
assert.equal(getLeagueThreatTier(null), "unknown");
```

Run: `node --test apps/worker/test/leagueThreatScore.test.js`

Expected: failure until the tier helper is exported and handles missing evidence.

- [ ] **Step 4: Implement the tier helper and verify all calculator tests**

Export `getLeagueThreatTier(input)` from `leagueThreatScore.js`. It must return `unknown` for absent/non-numeric rank, `red` only when `rank >= 85 && totalMatches >= 3`, `amber` for `rank >= 60` or a high rank blocked by the red evidence gate, and `green` otherwise.

Run: `node --test apps/worker/test/leagueThreatScore.test.js`

Expected: all calculator tests pass.

- [ ] **Step 5: Commit calculator**

```bash
git add bay-area-u15/apps/worker/src/analytics/leagueThreatScore.js bay-area-u15/apps/worker/test/leagueThreatScore.test.js
git commit -m "feat: calculate weighted NCCA league threat"
```

### Task 3: Idempotent worker pipeline and refresh integration

**Files:**
- Create: `bay-area-u15/apps/worker/src/pipeline/runLeagueThreatScoring.js`
- Modify: `bay-area-u15/apps/worker/src/ops/localRefresh.js: runDownstreamOperations`
- Modify: `bay-area-u15/apps/worker/src/index.js: imports, refresh operations, compute command`
- Test: `bay-area-u15/apps/worker/test/leagueThreatScoringPipeline.test.js`

**Interfaces:**
- Consumes: NCCA `player_composite_score` joined to `player_season_advanced` by `(series_id, division_id, player_id)`.
- Produces: `runLeagueThreatScoring({ series, outDir, log })`, a summary with series ID, inserted row count, eligible-player count, and top ranked evidence rows.

- [ ] **Step 1: Write a failing pipeline contract test**

Use a fake transaction client that returns two `2026 Premier A/B/C` joined rows and records SQL calls. Assert that `runLeagueThreatScoring` deletes only rows where `series_id = $1`, inserts the calculator rows, and writes `league_threat_scoring_summary.json`.

Run: `node --test apps/worker/test/leagueThreatScoringPipeline.test.js`

Expected: failure because the pipeline module does not exist.

- [ ] **Step 2: Implement source loading and replacement**

`runLeagueThreatScoring.js` must:

1. resolve series context through `runCompositeScoring.resolveSeriesContext` or an extracted shared resolver;
2. query `division.source_label`, `pcs.player_id`, `pcs.composite_score`, and `psa.matches_played` for that series;
3. pass the result to `buildLeagueThreatRows`;
4. `delete from public.player_series_threat_score where series_id = $1`;
5. batch-insert only the calculated rows with `score_version = 'ncca-league-threat-v1'`;
6. return and write the summary.

- [ ] **Step 3: Verify idempotency**

Run the pipeline twice against the disposable database, then run:

```sql
select player_id, score_version, count(*)
from public.player_series_threat_score
where series_id = 10
group by player_id, score_version
having count(*) > 1;
```

Expected: zero rows.

- [ ] **Step 4: Wire the pipeline into refresh and CLI**

Add `runLeagueThreatScoring` after `runCompositeScoring` and before `runPlayerIntelligence` in `localRefresh.js`. Import it in `index.js`, include it in both refresh operation objects, and add a `compute-league-threat` command writing `league_threat_scoring_summary.json`.

- [ ] **Step 5: Verify worker tests and commit**

Run: `node --test apps/worker/test/*.test.js`

Expected: all worker tests pass.

```bash
git add bay-area-u15/apps/worker/src/pipeline/runLeagueThreatScoring.js bay-area-u15/apps/worker/src/ops/localRefresh.js bay-area-u15/apps/worker/src/index.js bay-area-u15/apps/worker/test/leagueThreatScoringPipeline.test.js
git commit -m "feat: run league-wide threat scoring after composite scoring"
```

### Task 4: Use persisted threat in portal and reports

**Files:**
- Modify: `bay-area-u15/apps/api/src/services/grizzliesPortalService.js`
- Modify: `bay-area-u15/apps/api/src/services/reportService.js`
- Modify: `bay-area-u15/apps/api/src/render/pages.js`
- Modify: `bay-area-u15/apps/api/test/grizzliesPortal.test.js`
- Create: `bay-area-u15/apps/api/test/leagueThreatReport.test.js`

**Interfaces:**
- Consumes: `player_series_threat_score` record keyed by NCCA series/player.
- Produces: portal `threatTone` and report header `{ leagueThreatScore, leaguePercentileRank, totalMatches, threatTier }` sourced from the same persisted row.

- [ ] **Step 1: Write failing portal test for the hard evidence gate**

Replace the legacy portal threshold-only test with:

```js
assert.equal(getThreatTone({ leaguePercentileRank: 99, totalMatches: 2 }), "amber");
assert.equal(getThreatTone({ leaguePercentileRank: 85, totalMatches: 3 }), "red");
assert.equal(getThreatTone(null), "unknown");
```

Run: `node --test apps/api/test/grizzliesPortal.test.js`

Expected: failure because `getThreatTone` accepts a bare percentile and has no total-match gate.

- [ ] **Step 2: Replace `max(pcs.percentile_rank)` portal query**

In `loadPlayerFacts`, join `player_series_threat_score` on NCCA series and player ID; select `league_percentile_rank` and `total_matches`, never `max(pcs.percentile_rank)`. Pass the row to the shared threshold logic. Keep profile URL behavior unchanged.

- [ ] **Step 3: Write a failing report data test**

Create a report-service fixture that provides a selected division composite plus a league-threat row. Assert that report header tier reads the league row and that the selected division composite remains available in the supporting metrics.

Run: `node --test apps/api/test/leagueThreatReport.test.js`

Expected: failure because report data does not query `player_series_threat_score`.

- [ ] **Step 4: Add report-service league-threat loader and rendering**

Load the one league-threat row for the selected series/player in `reportService.js`, pass it through `deriveReportMetrics`, and expose it in the report header. In `render/pages.js`, make `getThreatTone` accept the persisted tier/evidence and render an evidence note containing total NCCA matches. Do not use selected division percentile for the main threat tier.

- [ ] **Step 5: Run API tests and production build**

Run: `node --test apps/api/test/*.test.js`

Expected: all API tests pass.

Run: `npm run build`

Expected: Vite build exits 0.

- [ ] **Step 6: Commit API consumer change**

```bash
git add bay-area-u15/apps/api/src/services/grizzliesPortalService.js bay-area-u15/apps/api/src/services/reportService.js bay-area-u15/apps/api/src/render/pages.js bay-area-u15/apps/api/test/grizzliesPortal.test.js bay-area-u15/apps/api/test/leagueThreatReport.test.js
git commit -m "feat: use league-wide NCCA threat tiers in reports"
```

### Task 5: Recompute NCCA and audit outcome

**Files:**
- Create: `bay-area-u15/storage/exports/bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a/league_threat_recalibration_audit.json`
- Modify: no production source files

**Interfaces:**
- Consumes: completed NCCA post-processing pipeline and persisted `player_series_threat_score` rows.
- Produces: auditable evidence for Vivaan, Kashyap, and all portal-mapped player IDs.

- [ ] **Step 1: Run only the derived NCCA stages**

Run, with the configured NCCA environment and no browser ingestion:

```bash
node apps/worker/src/index.js compute-season --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
node apps/worker/src/index.js compute-composite --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
node apps/worker/src/index.js compute-league-threat --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
node apps/worker/src/index.js compute-intelligence --series bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a
```

Expected: each command exits 0 and writes its corresponding summary JSON.

- [ ] **Step 2: Query evidence for the two reported examples**

```sql
select p.display_name, pts.league_threat_score, pts.league_percentile_rank,
       pts.total_matches, pts.division_evidence
from public.player_series_threat_score pts
join public.player p on p.id = pts.player_id
where pts.series_id = 10
  and p.id in (3881, 7283)
order by p.display_name;
```

Expected: Vivaan and Kashyap are compared from the same persisted league-wide model, with their division evidence visible.

- [ ] **Step 3: Write audit artifact**

Create JSON with the calculation version, query timestamp, model constants, row count, all mapped Grizzlies-portal player tiers, and the two selected evidence records. Do not include database credentials or raw environment variables.

- [ ] **Step 4: Final verification and commit audit artifact**

Run: `node --test apps/worker/test/*.test.js && node --test apps/api/test/*.test.js && npm run build`

Expected: all tests and build pass before stating recalibration is complete.

```bash
git add bay-area-u15/storage/exports/bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a/league_threat_recalibration_audit.json
git commit -m "docs: record NCCA threat recalibration audit"
```

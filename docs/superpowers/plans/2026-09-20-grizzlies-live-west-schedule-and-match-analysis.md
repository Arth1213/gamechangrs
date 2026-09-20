# Grizzlies live West schedule and AI Match Analysis implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task by task. Keep the changes in one working tree because the API contract, database migration, worker generation command, and React route change together.

**Goal:** Replace the static MiLC placeholder on the protected Grizzlies 2026 portal with the current MiLC 2026 West Division fixture inventory, and expose two evidence-backed AI Match Analysis reports only for completed West matches whose facts are persisted.

**Architecture:** `series_source_config`, `match`, `team`, `division`, `match_refresh_state`, innings, and ball-event records remain the source of truth. A new persisted report table stores the immutable evidence bundle, generated structured analysis, source checksum, review state, and timestamps per MiLC match. The Grizzlies portal API composes the authenticated roster payload and a West-only match/report inventory; the browser never decides whether a match is reportable. The UI replaces the static banner and fixture constant with API data and opens protected report detail routes under the existing Grizzlies portal.

**Tech Stack:** PostgreSQL/Supabase migrations, Node.js CommonJS with `pg` and Express 5, existing worker CLI, Node built-in test runner, React 18, TypeScript, React Router, Tailwind/shadcn.

**Spec:** `docs/superpowers/plans/2026-09-20-grizzlies-ai-match-analysis.md`

## Global Constraints

- Keep all routes behind `requireGrizzliesPortalAccess`; never rely on a client-side email check.
- Scope this feature to the active MiLC 2026 series and its **West** division only. The schedule must include every current and future West fixture, whether or not San Ramon Grizzlies play.
- Do not hard-code match IDs, team names, dates, scores, report availability, or report text in the frontend. The backend derives them from persisted rows.
- A scheduled, live, incomplete, skipped, or fact-incomplete fixture must never expose an analysis action.
- The initially visible reports are the two persisted, completed West matches only: the Silicon Valley Strikers match and the Grizzlies six-wicket win. A neutral match report must not claim that Grizzlies played in it.
- Generated prose may only interpret an evidence bundle computed from the persisted facts. Missing evidence must be shown as insufficient rather than inferred.
- Preserve raw source facts. This feature adds report outputs; it must not mutate match, innings, ball-event, player, score, or access data.
- Report detail pages use the GameChangrs dark surface with Grizzlies red, GameChangrs green insight/action accents, report provenance, confidence, and a literal **Back to Grizzlies 2026 Analytics** link to `/analytics/grizzlies/2026`.
- Do not publish reports or activate a new report type until the two generated reports are reviewed and explicitly approved.

## File Structure

- `supabase/migrations/<timestamp>_grizzlies_match_analysis.sql` — persisted report schema, constraints, and indexes.
- `apps/worker/src/analytics/grizzliesMatchEvidence.js` — pure, deterministic evidence-bundle and momentum calculations.
- `apps/worker/src/analytics/grizzliesMatchAnalysis.js` — evidence-bounded structured report construction and input validation.
- `apps/worker/src/ops/generateGrizzliesMatchAnalysis.js` — explicit MiLC West report generation/review CLI operation.
- `apps/worker/src/index.js` — register a narrowly scoped report-generation command.
- `apps/worker/test/grizzliesMatchEvidence.test.js` — deterministic metric, moment, and missing-data tests.
- `apps/api/src/services/grizzliesPortalService.js` — live West fixture list, report summaries, and protected report-detail retrieval.
- `apps/api/src/server.js` — list/detail endpoints guarded by the existing Grizzlies middleware.
- `apps/api/test/grizzliesPortal.test.js` — API contract, filter, and access tests.
- `src/lib/cricketApi.ts` — typed portal fixture/report contracts and authenticated fetch helpers.
- `src/lib/grizzliesPortalFallback.ts` — safe empty analysis fallback; no fake MiLC fixtures or reports.
- `src/pages/AnalyticsGrizzlies2026.tsx` — dynamic AI Match Analysis tab and completed-match report actions.
- `src/pages/AnalyticsGrizzliesMatchReport.tsx` — protected GameChangrs-styled report detail surface.
- `src/App.tsx` — nested protected report route.
- `src/lib/grizzliesPortalPresentation.js` and its test — removed from the active schedule path, or reduced to stable branding-only constants if still useful.

## Task 1: Capture the data contract before adding a report

**Files:**
- Modify: `apps/api/test/grizzliesPortal.test.js`
- Create: `apps/worker/test/grizzliesMatchEvidence.test.js`

**Interfaces:**
- Portal fixture list item:

```ts
{
  matchId: number;
  sourceMatchId: string;
  startsAt: string | null;
  dateLabel: string;
  venue: string | null;
  homeTeam: string;
  awayTeam: string;
  status: "scheduled" | "live" | "completed" | "unavailable";
  resultText: string | null;
  scoreline: string | null;
  report: { status: "unavailable" | "draft" | "reviewed" | "published"; path: string | null; };
}
```

- Detail payload includes match metadata, `evidence`, `analysis`, `reportStatus`, `generatedAt`, and `sourceDataChecksum` without exposing internal prompt or privileged user information.

- [ ] **Step 1: Write failing portal contract tests**

Add fixtures covering one completed West match with stored facts, one future West match, one completed non-West match, and one West match whose parse/analytics state is incomplete. Assert that the service:

```js
assert.equal(payload.aiMatchAnalysis.fixtures.length, 3);
assert.equal(completed.report.path, "/analytics/grizzlies/2026/matches/42");
assert.equal(scheduled.report.path, null);
assert.equal(incomplete.report.path, null);
assert.equal(payload.aiMatchAnalysis.fixtures.some((row) => row.divisionLabel !== "West"), false);
```

Also assert that an unauthorised request receives `403`, an authorised request receives the live inventory contract, and a detail request for a non-West or unavailable match is `404` rather than leaking a record.

- [ ] **Step 2: Write failing pure evidence tests**

Use a small in-memory scorecard/ball-event fixture to prove that the evidence builder calculates innings totals, run rate, wickets, dots, boundaries, phase splits, and ordered momentum events deterministically. Test that an absent required innings or ball-event collection returns an explicit `complete: false` reason and that the report builder refuses generation.

- [ ] **Step 3: Run the focused failing tests**

Run:

```bash
node --test apps/api/test/grizzliesPortal.test.js apps/worker/test/grizzliesMatchEvidence.test.js
```

Expected: failure because neither the contract nor evidence modules exist yet.

- [ ] **Step 4: Commit the test contract only after the expected failure is observed**

```bash
git add apps/api/test/grizzliesPortal.test.js apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "test: define Grizzlies match analysis contracts"
```

## Task 2: Add a persistent, reviewable report record

**Files:**
- Create: `supabase/migrations/<timestamp>_grizzlies_match_analysis.sql`

**Interfaces:**
- `public.grizzlies_match_analysis_report` is unique on `(series_id, match_id, report_type)`.
- Required status lifecycle: `draft`, `generated`, `reviewed`, `published`, `superseded`, `failed`.
- Store `evidence_json`, `analysis_json`, `source_data_checksum`, `generation_metadata`, `generated_at`, `reviewed_at`, and `published_at`.

- [ ] **Step 1: Implement the migration**

Create the table with foreign keys to `series` and `match`, a `report_type` check constrained initially to `grizzlies_match_analysis`, JSONB defaults/validation, a status check, `created_at`/`updated_at`, and a unique key. Add indexes that support the portal list query by `(series_id, match_id, status)` and newest report retrieval. Add the standard updated-at trigger only if the project migration conventions require it.

Use a `source_data_checksum` that is computed from canonical serialised input facts, not from generated prose. This is the staleness signal when match facts later change.

- [ ] **Step 2: Apply the migration to local/staging database and inspect it**

Use the repository’s normal Supabase migration command. Then run a read-only information-schema query that confirms the uniqueness and indexes. Do not run an ad hoc production schema mutation.

- [ ] **Step 3: Add repository-level tests for persistence semantics**

Test idempotent upsert for the same series/match/report type, rejection of invalid status, and that a changed checksum transitions an existing published report to `superseded` rather than overwriting the reviewed evidence silently.

- [ ] **Step 4: Commit the migration and persistence tests**

```bash
git add supabase/migrations apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "feat: persist reviewable Grizzlies match analysis"
```

## Task 3: Build evidence first, then produce bounded analysis

**Files:**
- Create: `apps/worker/src/analytics/grizzliesMatchEvidence.js`
- Create: `apps/worker/src/analytics/grizzliesMatchAnalysis.js`
- Modify: `apps/worker/test/grizzliesMatchEvidence.test.js`

**Interfaces:**

```js
buildGrizzliesMatchEvidence({ match, innings, ballEvents, batting, bowling, fielding })
// -> { complete, missing, match, teams, innings, phaseMetrics, partnerships, momentum, dataQuality }

buildGrizzliesMatchAnalysis({ evidence, grizzliesTeamName: "San Ramon Grizzlies" })
// -> { schemaVersion, strengths, weaknesses, criticalMoments, turningPoints,
//      grizzliesWatchOut, grizzliesGamePlan, evidenceNotes, confidence }
```

- [ ] **Step 1: Implement deterministic evidence assembly**

Query only the selected MiLC match’s persisted match, teams, division, refresh state, innings, batting, bowling, wicket, and ball-event rows. Compute:

- result and innings totals;
- legal-ball run rate, wickets, dot-ball rate, boundary rate, and extras;
- powerplay/middle/death phase scoring and wickets using a documented phase rule;
- meaningful partnerships and collapses;
- bowling impact and dismissal/bowler-type patterns when the source fields support them;
- 3–5 ranked momentum shifts with overs, score before/after, wickets/boundaries, and a deterministic impact score.

Return explicit availability flags for each metric rather than substituting zeros for missing data. Ensure the non-Grizzlies match carries `grizzliesParticipated: false`.

- [ ] **Step 2: Implement analysis validation and structured output**

Do not permit free-form generation until `evidence.complete` is true. Build a strict schema whose claims include `team`, `statement`, `evidenceRefs`, and `confidence`.

For both teams, generate strengths and weaknesses. Generate critical moments and turning points separately. For a neutral match, derive **Grizzlies Watch-out** and **Grizzlies game plan** as scouting implications, never as a post-game Grizzlies review. For the Grizzlies match, include both post-match review and opponent-specific preparation.

If an LLM is used, give it only the structured evidence JSON and validate the returned JSON against the schema. On invalid JSON, unsupported evidence reference, prohibited team assertion, or missing confidence, fail the run and persist no publishable report.

- [ ] **Step 3: Add tests for required report behavior**

Cover all six sections; no invented Grizzlies involvement in the neutral match; every conclusion has evidence references; missing facts block generation; and an altered source fact changes the checksum.

- [ ] **Step 4: Run focused tests**

```bash
node --test apps/worker/test/grizzliesMatchEvidence.test.js
```

Expected: pass.

- [ ] **Step 5: Commit evidence and analysis modules**

```bash
git add apps/worker/src/analytics/grizzliesMatchEvidence.js apps/worker/src/analytics/grizzliesMatchAnalysis.js apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "feat: build evidence-backed Grizzlies match analysis"
```

## Task 4: Add an explicit generation and review operation

**Files:**
- Create: `apps/worker/src/ops/generateGrizzliesMatchAnalysis.js`
- Modify: `apps/worker/src/index.js`
- Modify: `package.json`
- Modify: `apps/worker/test/grizzliesMatchEvidence.test.js`

**Interfaces:**
- Command:

```bash
npm run ops:generate:grizzlies-match-analysis -- \
  --series bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug \
  --division West \
  --match <source-match-id>
```

- `--publish` is not accepted by the initial generator. It may write only `generated` or `failed` records.

- [ ] **Step 1: Implement candidate selection guards**

Resolve the supplied series config key. Reject any match not in the West division, not `completed`, lacking scorecard/ball events, or not in a fully computed reconciliation state. Select matches by source match ID and resolve the database match ID server-side.

- [ ] **Step 2: Implement idempotent generation**

Build evidence, calculate checksum, and upsert the generated record. If the checksum matches an existing `generated` or `reviewed` report, return it without regenerating. If it differs, mark an existing report `superseded` then create/update a new `generated` record. Print a concise non-secret summary: match ID, teams, checksum prefix, evidence completeness, report status, and review requirement.

- [ ] **Step 3: Add a separate review/publish operation**

Implement a second explicitly named, admin-only CLI command that can transition a generated report to `reviewed`, then to `published` only after the reviewer sees the output. It must not be run in this task without the user’s specific review/publish approval.

- [ ] **Step 4: Test the operational guards**

Add fixtures verifying that scheduled, incomplete, non-West, and non-MiLC candidates reject before any write; identical reruns are idempotent; and only review can make a report eligible for a public-in-portal action.

- [ ] **Step 5: Commit worker operation**

```bash
git add apps/worker/src/ops/generateGrizzliesMatchAnalysis.js apps/worker/src/index.js package.json apps/worker/test/grizzliesMatchEvidence.test.js
git commit -m "feat: add reviewed Grizzlies match analysis generation"
```

## Task 5: Serve a live West inventory and protected report detail

**Files:**
- Modify: `apps/api/src/services/grizzliesPortalService.js`
- Modify: `apps/api/src/server.js`
- Modify: `apps/api/test/grizzliesPortal.test.js`

**Interfaces:**
- Existing `GET /api/portals/grizzlies/2026` adds `aiMatchAnalysis: { seriesConfigKey, officialScheduleUrl, fixtures }` without removing `teams`.
- New `GET /api/portals/grizzlies/2026/matches/:matchId/analysis` returns a report only when the match is in the MiLC West inventory and has a `reviewed` or `published` report.

- [ ] **Step 1: Replace static fixture construction with one scoped query**

Resolve the MiLC series context through the existing `resolveSeriesContext`. Query `match` joined to `team`, `division`, `match_refresh_state`, and latest report record. Filter on the persisted West division ID/label and order by `match_date`, then stable ID. Derive status from authoritative persisted fields; format display values after query. The query must not filter by the Grizzlies team.

- [ ] **Step 2: Derive report availability on the server**

Set an openable `report.path` only where all of these are true: completed match, persisted scorecard/ball-event facts, computed refresh state, and `reviewed`/`published` report. Return no direct storage URLs, prompt text, or raw internal operation metadata.

- [ ] **Step 3: Add report-detail service and route**

Require the same Grizzlies guard on the detail route. Confirm its match belongs to the scoped inventory before reading it. Return the stable structured report and evidence notes. A stale/superseded/draft record returns `404` or an explicit unavailable state, never an unreviewed analysis.

- [ ] **Step 4: Run API tests**

```bash
node --test apps/api/test/grizzliesPortal.test.js
```

Expected: pass, including existing roster payload tests.

- [ ] **Step 5: Commit API contract**

```bash
git add apps/api/src/services/grizzliesPortalService.js apps/api/src/server.js apps/api/test/grizzliesPortal.test.js
git commit -m "feat: serve live West schedule and protected match analysis"
```

## Task 6: Replace static UI with server-supplied schedule and report pages

**Files:**
- Modify: `src/lib/cricketApi.ts`
- Modify: `src/lib/grizzliesPortalFallback.ts`
- Modify: `src/pages/AnalyticsGrizzlies2026.tsx`
- Create: `src/pages/AnalyticsGrizzliesMatchReport.tsx`
- Modify: `src/App.tsx`
- Modify or remove: `src/lib/grizzliesPortalPresentation.js`
- Modify or remove: `src/lib/grizzliesPortalPresentation.test.js`

**Interfaces:**
- Add TypeScript types mirroring the tested API contract; do not duplicate service logic in React.
- Add `fetchGrizzliesMatchAnalysis(accessToken, matchId, signal)`.

- [ ] **Step 1: Make fallback safe**

The fallback may retain verified roster information but must provide an empty `fixtures` list and a clear service-unavailable message. It must not show the stale `Starting Soon` marketing panel, placeholder `TBD` opponents, fake scores, or report actions.

- [ ] **Step 2: Rebuild the AI Match Analysis tab**

Render a concise MiLC 2026 West Division header, source-of-record link, summary states, and responsive cards from `portal.aiMatchAnalysis.fixtures`. Each card shows date, venue, both teams, status, and completed result/score when supplied. Cards for scheduled/live/incomplete matches show status only. Eligible completed matches show a visually distinct **Open AI Match Analysis** button that links to the protected report route.

Do not suppress matches that do not involve Grizzlies. Do not show a button merely because `resultText` is non-empty.

- [ ] **Step 3: Create the report detail page**

Fetch data only after an authenticated session exists. Render loading, unauthorised, not-found, and service-error states separately. The report surface includes teams/result, generated/reviewed date, evidence/data-quality note, confidence labels, six requested sections, quantified moment timeline, and the exact back link. Use GameChangrs dark cards, Grizzlies red headings, and green action/insight details. Do not render raw model output as HTML.

- [ ] **Step 4: Register and protect the route**

Add `/analytics/grizzlies/2026/matches/:matchId` to `src/App.tsx` using the same authentication UX as the parent portal. Direct navigation by an unapproved Gmail account must result in the normal access denial, not a partial report.

- [ ] **Step 5: Add frontend tests**

If the project has a React test harness, add component/route tests for all-West list rendering, no action for scheduled or unavailable matches, action for reviewed completed records, exact back link, and neutral-report copy. If it does not, add pure rendering-state helpers with Node tests and verify the built app manually against the API contract.

- [ ] **Step 6: Build and manually verify**

Run the frontend typecheck/build command documented by the frontend project. In a local authenticated browser session, verify the two report actions appear only on the approved completed matches, the neutral report names no Grizzlies participation, and browser Back plus the in-page back link return to `/analytics/grizzlies/2026` with the AI tab usable.

- [ ] **Step 7: Commit UI work**

```bash
git add src/lib/cricketApi.ts src/lib/grizzliesPortalFallback.ts src/pages/AnalyticsGrizzlies2026.tsx src/pages/AnalyticsGrizzliesMatchReport.tsx src/App.tsx src/lib/grizzliesPortalPresentation.js src/lib/grizzliesPortalPresentation.test.js
git commit -m "feat: add Grizzlies West match analysis portal"
```

## Task 7: Generate, validate, review, then publish only on approval

**Files:**
- No code changes required unless validation identifies a defect.

- [ ] **Step 1: Refresh and verify the MiLC West inventory**

Run the existing MiLC discovery/inventory process with the approved series key, then query the persisted schedule read-only. Confirm it includes all West fixtures and identify the two current completed fact-complete matches. Verify that the list is not restricted to Grizzlies.

- [ ] **Step 2: Generate the two reports without publishing**

Run the new explicit generator once per completed West match. Capture the structured output and evidence checksum. Confirm every section is grounded, that no generated statement lacks evidence references, and that the neutral report does not imply Grizzlies participated.

- [ ] **Step 3: Run full automated verification**

```bash
npm test
node --test apps/api/test/*.test.js
```

Run the frontend test/build command from the frontend project. Repeat the portal API contract tests against a test/local database with the MiLC fixture data.

- [ ] **Step 4: Human content review gate**

Present both generated reports and their data-quality caveats to the user. Do not call the review/publish operation until the user explicitly approves report content and visibility.

- [ ] **Step 5: Publish after explicit approval**

Transition only the approved report IDs to `reviewed` then `published`. Re-open the authenticated portal, test both report links, and verify scheduled/unavailable West cards still have no action. Then run the existing MiLC series validation; do not change series publication state as part of report publishing.

- [ ] **Step 6: Final commit and push**

Only after all verification passes and the user has authorised it:

```bash
git status --short
git log --oneline -6
git push origin main
```

Record the pushed commit SHA, deployed API/frontend revision, the two published source match IDs, report checksums, and test/build outputs in the delivery summary.

## Review Focus

- The database query must filter by the real MiLC West division, not a brittle displayed-team list or a stale client constant.
- Availability must require verified persisted facts and a reviewed/published report—not just a completed `result_text`.
- Evidence must remain deterministic and machine-checkable; the LLM must not add unsupported cricket facts.
- The neutral report must distinguish scouting implications from a Grizzlies match review.
- Access control is enforced on both list and direct-detail API routes.
- Existing NCCA roster, Assessment, Threat, series access, and MiLC ingestion/analytics remain unchanged.

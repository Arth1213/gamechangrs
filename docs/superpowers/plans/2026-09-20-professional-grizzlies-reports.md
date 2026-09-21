# Professional Grizzlies Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver restrained, readable match reports and a matching standalone export without losing named-player decisions or evidence.

**Architecture:** Extract the existing report body into a pure React component shared by the authenticated page and a local export renderer. Keep authentication, fetching, navigation and report publication unchanged. Add textual evidence states now; connect evaluated ML metadata in the companion learning-pipeline plan.

**Tech Stack:** Existing React 18, TypeScript, Tailwind, Vite, Node test runner and the repository's Playwright dependency. No new frontend framework.

**Spec:** `docs/superpowers/specs/2026-09-20-t20-learning-pipeline-design.md`, approved 2026-09-20.

## Global Constraints

- Neutral dark background, one consistent card surface, subtle gray borders, white primary text and readable muted secondary text.
- Remove team-colored gradients, gold glow, colored bullet text, and repeated gold top borders.
- Retain a thin subdued gold page perimeter from the earlier branding request; retain Grizzlies red only in brand/team identification.
- Each tactical card: situation, named player, one or two short action bullets.
- Put samples, season splits, alternatives and source references in expandable details.
- Distinguish "Observed", "Rule-based option", "ML estimate", and "Limited evidence" with text, not colors alone.
- Preserve opponent selection, report links/back navigation, critical-moment paragraphs, scorecard figures, named partnerships and all existing tactical sections.
- Desktop aligned columns, mobile single-column cards, no horizontal page overflow.
- No changes to authentication, access grants, production records or automatic publication.
- Native execution was previously selected. Execute this plan before the companion ML plan; UI completion does not mean ML completion.

## Review Focus

1. Legacy reports have no ML metadata: visibly rule-based, not accidentally "ML estimate" (Task 1).
2. Long player names and source references on 375px screens: wrap without page overflow (Task 3).
3. Opponent switching must retain Grizzlies actions and not show the other opponent's private cards (Task 3).
4. Exported reports must neither embed tokens nor execute source text as HTML (Tasks 2–3).
5. Missing or invalidated model metadata must suppress numerical forecasts even if a stale response includes them (Task 1; learning plan's serving integration).

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/components/GrizzliesMatchReportContent.tsx` | Pure report layout, existing team/scorecard/summary cards and subdued frame |
| `src/components/GrizzliesTacticalPlan.tsx` | Concise action cards, opponent filtering, expandable evidence |
| `src/lib/grizzliesReportPresentation.js` | Shared surface classes and evidence-status presentation |
| `src/lib/grizzliesReportPresentation.d.ts` | Types for the JS presentation boundary |
| `src/pages/AnalyticsGrizzliesMatchReport.tsx` | Existing protected fetch/page shell; delegates successful content |
| `src/lib/cricketApi.ts` | Optional typed evidence/model disclosure; backward-compatible |
| `scripts/export-grizzlies-report.mjs` | Read an authorized local report JSON, render shared component and production CSS to private HTML |
| `tests/report-ui/` | Synthetic, nonproduction render/interaction harness |
| `scripts/test-grizzlies-report-ui.mjs` | Desktop/mobile Playwright checks against that harness |
| `src/lib/grizzliesMatchPresentation.test.js` | Existing score/date and frame assertions, adjusted for extracted body |
| `src/lib/grizzliesReportPresentation.test.js` | Presentation states, missing metadata and invalidation guards |

### Task 1: Shared neutral presentation and honest evidence states

**Files:** Create `src/components/GrizzliesMatchReportContent.tsx`, `src/lib/grizzliesReportPresentation.js`, `src/lib/grizzliesReportPresentation.d.ts`, `src/lib/grizzliesReportPresentation.test.js`. Modify `src/components/GrizzliesTacticalPlan.tsx`, `src/pages/AnalyticsGrizzliesMatchReport.tsx`, `src/lib/cricketApi.ts`, `src/lib/grizzliesMatchPresentation.test.js`.

**Interfaces:**
- Consumes: existing `CricketGrizzliesMatchAnalysisResponse`, `CricketTacticalClaim`, `CricketTacticalGamePlan`, `formatGrizzliesMatchScores(innings)`, `tacticalActionBullets(action)`.
- Produces: `GrizzliesMatchReportContent({report, mode?: "interactive" | "export"})`; `GrizzliesTacticalPlan({plan, mode?, learning?})`.
- Produces: `presentEvidence(meta?: LearningDisclosure, kind?: "observed" | "rule") -> {label: string, showNumeric: boolean}` and `reportStyles`.
- `LearningDisclosure = {status: "fallback" | "shadow" | "promoted" | "invalidated", modelVersion: string | null, cutoff: string | null, evaluatedScope: string[], calibrated: boolean, target?: string, reason?: string}`. Place optional `learning` on the response and on a tactical claim. Never default `calibrated` to true.

- [ ] **Step 1: Add failing presentation and structural tests.**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { presentEvidence, reportStyles } from "./grizzliesReportPresentation.js";
test("legacy and invalidated estimates do not look validated", () => {
  assert.deepEqual(presentEvidence(), { label: "Rule-based option", showNumeric: false });
  assert.deepEqual(presentEvidence({ status: "invalidated", calibrated: true }),
    { label: "Limited evidence", showNumeric: false });
  assert.equal(presentEvidence(undefined, "observed").label, "Observed");
  assert.equal(presentEvidence({ status: "shadow", calibrated: false }).showNumeric, false);
});
test("surfaces have no glow or team gradients", () => {
  assert.doesNotMatch(Object.values(reportStyles).join(" "), /gradient|shadow-|border-t-amber/);
  assert.match(reportStyles.frame, /border-\[#76633e\]/);
});
```

Change the existing frame test to read the new content component and assert one `data-testid="grizzlies-report-frame"`, the shared frame style, and absence of decorative spans. Keep existing score/date expectations.

- [ ] **Step 2: Run the tests red.**

Run `node --test src/lib/grizzliesReportPresentation.test.js src/lib/grizzliesMatchPresentation.test.js`. Expect missing new module/component failure; do not mask test import errors.

- [ ] **Step 3: Implement the shared presentation boundary.**

```js
export const reportStyles = Object.freeze({
  frame: "min-w-0 rounded-2xl border border-[#76633e] bg-[#101216] p-3 sm:p-6 lg:p-8",
  card: "min-w-0 rounded-xl border border-[#363b43] bg-[#191d23] text-[#f5f5f5]",
  inset: "min-w-0 rounded-lg border border-[#363b43] bg-[#191d23] p-4",
  muted: "text-[#bdc3cd]",
  focus: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
});
export function presentEvidence(meta, kind = "rule") {
  if (kind === "observed") return { label: "Observed", showNumeric: false };
  if (!meta) return { label: "Rule-based option", showNumeric: false };
  if (meta.status === "promoted") return { label: "ML estimate", showNumeric: true };
  return { label: meta.status === "fallback" ? "Rule-based option" : "Limited evidence", showNumeric: false };
}
```

The `showNumeric` flag is only the UI-level publication gate; probability display additionally requires `calibrated === true`, evaluated scope and serving eligibility from the learning plan. Copy the current pure `ClaimList`, `TeamHero`, `ScorecardSnapshot`, `ReportFrame` and report body into `GrizzliesMatchReportContent` rather than recreating analysis. Replace each gradient/decorative class with shared surfaces. Leave `useAuth`, `useParams`, abortable fetching, errors, Navbar/Footer and protected back-link in the page.

```tsx
{report ? <GrizzliesMatchReportContent report={report} /> : null}
// Within every decision card:
<ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#f5f5f5]">
  {(item.bullets || tacticalActionBullets(item.action)).slice(0, 2)
    .map((bullet, index) => <li key={index}>{bullet}</li>)}
</ul>
<details className="mt-4 border-t border-[#363b43] pt-3 text-sm text-[#bdc3cd]">
  <summary className={`cursor-pointer ${reportStyles.focus}`}>Evidence and alternatives</summary>
  <p className="mt-3 leading-6">{item.observation}</p>
  <p className="mt-3 leading-6">{item.action}</p>
  <p className="mt-3 break-words">{item.evidenceRefs.join(" · ")}</p>
</details>
```

Render all original bullets, including those beyond two, in details if they contain information absent from `action`; no evidence deletion. Use sentence-length action bullets from the generator, not CSS truncation. Labels are title case, neutral and small. Existing historical confidence is labeled "Evidence support", never probability. Use neutral selected-opponent fill with `aria-pressed`; tables keep their own overflow container. Export mode renders each opponent's section using the same filter and surfaces, hiding selection buttons. Keep the focal Grizzlies actions once where independent of opponent.

- [ ] **Step 4: Verify semantics, type safety and build.**

Run `node --test src/lib/grizzliesReportPresentation.test.js src/lib/grizzliesMatchPresentation.test.js src/lib/grizzliesTacticalPresentation.test.js`, `npx tsc --noEmit`, `npm run build`. Expect all pass. Inspect diff to confirm no auth or request URL changes.

- [ ] **Step 5: Commit only this task.**

```bash
git add src/components/GrizzliesMatchReportContent.tsx src/components/GrizzliesTacticalPlan.tsx src/pages/AnalyticsGrizzliesMatchReport.tsx src/lib/cricketApi.ts src/lib/grizzliesReportPresentation.js src/lib/grizzliesReportPresentation.d.ts src/lib/grizzliesReportPresentation.test.js src/lib/grizzliesMatchPresentation.test.js
git commit -m "style: simplify Grizzlies reports and clarify evidence states"
```

### Task 2: Private standalone export using the same report component

**Files:** Create `scripts/export-grizzlies-report.mjs`, `scripts/export-grizzlies-report.test.mjs`, `src/export/renderGrizzliesReport.tsx`. Modify `.gitignore` to exclude `artifacts/reports/` only if not already ignored.

**Interfaces:**
- Consumes: `GrizzliesMatchReportContent({report, mode:"export"})` from Task 1.
- Produces: `renderGrizzliesReport(report) -> string` (escaped React HTML), `exportReport({input, output, cssPaths}) -> Promise<{output, checksum}>`.
- CLI: `node scripts/export-grizzlies-report.mjs --input /absolute/private/report.json --output /absolute/private/report.html`; input is an authorized API-shaped report, not a database dump or session storage.

- [ ] **Step 1: Write the failing export test.**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { selectReportFields } from "./export-grizzlies-report.mjs";
test("export selects only report fields, never transport credentials", () => {
  const safe = selectReportFields({ match: { matchId: 2376 }, analysis: {},
    access_token: "DO_NOT_EXPORT", authorization: "DO_NOT_EXPORT", user: { email: "private" } });
  assert.equal(safe.match.matchId, 2376);
  assert.doesNotMatch(JSON.stringify(safe), /DO_NOT_EXPORT|private/);
});
```

- [ ] **Step 2: Run red.**

Run `node --test scripts/export-grizzlies-report.test.mjs`; expect missing module/export.

- [ ] **Step 3: Implement the renderer and local export.**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { GrizzliesMatchReportContent } from "../components/GrizzliesMatchReportContent";
import type { CricketGrizzliesMatchAnalysisResponse } from "../lib/cricketApi";
export function renderGrizzliesReport(report: CricketGrizzliesMatchAnalysisResponse) {
  return renderToStaticMarkup(<main className="mx-auto max-w-7xl p-4 text-[#f5f5f5]">
    <GrizzliesMatchReportContent report={report} mode="export" />
  </main>);
}
```

```js
export function selectReportFields(input) {
  return Object.fromEntries(["match", "reportStatus", "analysisModelVersion", "evidence",
    "analysis", "scorecard", "matchSummary", "sourceDataChecksum", "generatedAt",
    "reviewedAt", "publishedAt", "learning"].filter(key => key in input).map(key => [key, input[key]]));
}
```

Use `createServer({server:{middlewareMode:true}})` from installed Vite and `ssrLoadModule("/src/export/renderGrizzliesReport.tsx")`; always close in `finally`. Read only built CSS files from `dist/assets`, inline them after replacing `</style` with `<\/style`, and write UTF-8 HTML with charset, viewport and escaped rendered body. No serialized session object, `dangerouslySetInnerHTML` for data, remote uploads or public Vite fixture route. Use `wx` output writes (fail on existing output unless explicit `--overwrite`); output permission 0600. Validate required report fields and reject inputs over 20 MiB. Compute SHA-256 of output. Native `<details>` remains interactive offline. Document that this private HTML contains protected report content and must not be committed or made public.

- [ ] **Step 4: Verify export and security behavior.**

Run `node --test scripts/export-grizzlies-report.test.mjs` and `npm run build`. Render synthetic source text containing `<script>alert(1)</script>` and verify the output contains `&lt;script&gt;`, no source-origin executable script, and no credential sentinel. Task 3 checks rendering.

- [ ] **Step 5: Commit the exporter, not private output.**

```bash
git add scripts/export-grizzlies-report.mjs scripts/export-grizzlies-report.test.mjs src/export/renderGrizzliesReport.tsx .gitignore
git commit -m "feat: export private match reports with shared presentation"
```

### Task 3: Render and interaction regression gate

**Files:** Create `tests/report-ui/index.html`, `tests/report-ui/main.tsx`, `tests/report-ui/fixture.json`, `scripts/test-grizzlies-report-ui.mjs`. Add a verification receipt under `docs/verification/2026-09-20-report-presentation.md` containing results, not protected report payloads.

**Interfaces:** Consumes shared content and export from Tasks 1–2. Produces a repeatable local render test with 1440px and 375px widths, screenshots outside Git, and explicit pass/fail exit status. Synthetic fixture has both opponent teams, focal Grizzlies decisions, long names, missing ML metadata, scorecard, all tactical sections and long evidence references.

- [ ] **Step 1: Add failing assertions for the real component harness.**

```js
// In scripts/test-grizzlies-report-ui.mjs after loading the local harness:
await page.getByRole("button", { name: "Against East Bay Blazers" }).click();
await page.getByText("East Bay-specific action", { exact: true }).waitFor();
await page.getByRole("button", { name: "Against Silicon Valley Strikers" }).click();
assert.equal(await page.getByText("East Bay-specific action", { exact: true }).count(), 0);
await page.getByText("Silicon Valley-specific action", { exact: true }).waitFor();
await page.getByText("Grizzlies recovery option", { exact: true }).waitFor();
await page.getByText("Evidence and alternatives", { exact: true }).first().click();
assert.equal(await page.locator("details[open]").count(), 1);
for (const width of [1440, 375]) {
  await page.setViewportSize({ width, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const card of await page.locator("article").all()) {
    assert.equal(await card.evaluate(el => getComputedStyle(el).backgroundImage), "none");
  }
}
```

- [ ] **Step 2: Run red against an empty harness.**

Run `node scripts/test-grizzlies-report-ui.mjs`; expect missing harness/render or required controls, not a skipped suite.

- [ ] **Step 3: Complete the isolated test harness and runner.**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { GrizzliesMatchReportContent } from "../../src/components/GrizzliesMatchReportContent";
import "../../src/index.css";
import report from "./fixture.json";
createRoot(document.getElementById("root")!).render(
  <GrizzliesMatchReportContent report={report} />
);
```

Use a Vite server bound only to `127.0.0.1` and a separate harness root; preserve the app's alias and CSS config. Load Playwright from `bay-area-u15/node_modules/playwright` through `createRequire` so no new browser package is required. Never ship the harness in the production route table. Add the assertions above, keyboard Tab/Enter opening a details section, visibly focused opponent controls, all original section headings, score strip `166/7` and `167/4`, and escaped malicious text. Load the exported file in a second page; assert both opponents are present and details open with no network access. Close browser and Vite in `finally`.

- [ ] **Step 4: Verify all report tests, desktop/mobile screenshots and build.**

Run `node --test src/lib/grizzlies*Presentation.test.js scripts/export-grizzlies-report.test.mjs`, `node scripts/test-grizzlies-report-ui.mjs`, `npx tsc --noEmit`, `npm run build`. Inspect generated desktop/mobile screenshots with the image viewer; check aligned summary/scorecard, readable contrast, restrained colors, spacing and no long-text overlap. Repeat the local rendering with an authorized actual report response saved privately. Record commands, results and private screenshot paths in the verification receipt. Do not infer live publication from a local build.

- [ ] **Step 5: Commit verification and hand off the local preview.**

```bash
git add tests/report-ui scripts/test-grizzlies-report-ui.mjs docs/verification/2026-09-20-report-presentation.md
git commit -m "test: verify professional reports on desktop mobile and export"
```

## Completion and release boundary

This plan completes only presentation and private export. The companion `2026-09-20-t20-learning-pipeline.md` implements and evaluates ML; do not label this visual change as a trained system. Website publishing, Git push and OneDrive updates must be reported separately with observed receipts and current authorization. Preserve `.superpowers/`, `work/` and all unrelated worktree changes.

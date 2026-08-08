# Arth Homepage Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/arth/` homepage into a readable editorial profile while preserving all facts and links.

**Architecture:** `public/arth/index.html` is the production-served static homepage and `src/arth-profile/pages/index.html` is the runtime template. Both retain identical content structure. `public/arth/styles.css` provides the shared static-page styling.

**Tech Stack:** Static HTML, CSS, Node built-in test runner, Vite.

## Global Constraints

- Preserve profile content and internal Moneyball and Berkeley M.E.T. links.
- Maintain the supplied 2026 portrait asset.
- Update both static and runtime homepage templates.
- Do not publish directly; push verified source to GitHub `main` for Lovable.

---

### Task 1: Test the editorial homepage structure

**Files:**
- Modify: `tests/arth-moneyball-profile.test.mjs`
- Test: `node --test tests/arth-moneyball-profile.test.mjs`

**Interfaces:**
- Consumes: static and runtime homepage templates.
- Produces: tests requiring `.hero-intro`, `.signal-ribbon`, and structured AP facts in both templates.

- [ ] **Step 1: Write the failing test**

Assert that both homepage copies include the editorial hero class, the four-item signal ribbon, and no legacy `.hero-signals` or `.focus-panel` markup.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/arth-moneyball-profile.test.mjs`

Expected: FAIL because the legacy hero layout is still present.

### Task 2: Restructure the homepage templates

**Files:**
- Modify: `src/arth-profile/pages/index.html`
- Modify: `public/arth/index.html`
- Test: `node --test tests/arth-moneyball-profile.test.mjs`

**Interfaces:**
- Consumes: the current profile content and portrait URL.
- Produces: matching source and static editorial hero markup with compact program, academic, venture, and sport signals.

- [ ] **Step 1: Replace the hero content**

Create `.hero-intro` with the school label, name, concise statement, and LinkedIn action. Keep the portrait in `.portrait-frame`. Replace the legacy signal cards and focus panel with `.signal-ribbon` containing four concise links or labels.

- [ ] **Step 2: Refine About facts**

Retain narrative copy and organize the fact items as School, Completed APs, APs Pursuing, Venture, and Activities.

- [ ] **Step 3: Verify template tests pass**

Run: `node --test tests/arth-moneyball-profile.test.mjs`

Expected: PASS with all homepage assertions green.

### Task 3: Apply shared editorial styling and verify production build

**Files:**
- Modify: `public/arth/styles.css`
- Test: `npm run build`

**Interfaces:**
- Consumes: `.hero-intro`, `.signal-ribbon`, `.about-grid`, and `.fact-list` markup from Task 2.
- Produces: desktop and mobile editorial layout with constrained text width and responsive stacking.

- [ ] **Step 1: Add focused desktop styles**

Define the editorial hero grid, concise display type, portrait ratio, signal ribbon, readable text measure, and two-column fact grid.

- [ ] **Step 2: Add responsive styles**

At existing tablet and mobile breakpoints, stack the portrait after the intro, collapse the signal ribbon, and keep fact cards legible without horizontal overflow.

- [ ] **Step 3: Verify production build**

Run: `npm run build`

Expected: Vite completes without errors.

### Task 4: Push the verified redesign

**Files:**
- Verify: `public/arth/index.html`
- Verify: `src/arth-profile/pages/index.html`
- Verify: `public/arth/styles.css`

**Interfaces:**
- Consumes: finished source, static markup, and build output.
- Produces: a GitHub `main` commit ready for Lovable publication.

- [ ] **Step 1: Check whitespace and tests**

Run: `git diff --check && node --test && npm run build`

Expected: no whitespace errors, all tests pass, build exits 0.

- [ ] **Step 2: Commit and push**

Run: `git add public/arth/index.html src/arth-profile/pages/index.html public/arth/styles.css tests/arth-moneyball-profile.test.mjs && git commit -m "feat: redesign Arth homepage" && git push origin main`

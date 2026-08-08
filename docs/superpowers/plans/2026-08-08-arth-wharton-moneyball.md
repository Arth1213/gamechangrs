# Arth Wharton Moneyball Profile Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Arth's completed Wharton Moneyball Experience and its certificate, photo, PDF, and PPTX to the local `/arth` profile.

**Architecture:** The static Arth profile stores page templates in `src/arth-profile/pages/` and maps paths in `runtime.ts`. A new Moneyball detail page will follow the Berkeley M.E.T. page structure, while index and Academics pages provide entry points. All artifacts remain in the existing `public/arth/Arth-Accomp/Moneyball/` directory.

**Tech Stack:** Vite, TypeScript, static HTML templates, CSS already used by the Arth profile.

## Global Constraints

- Keep the supplied Moneyball assets in `public/arth/Arth-Accomp/Moneyball/` unchanged.
- Use only claims established by the certificate and final presentation.
- Do not run a deployment or publish command.

---

### Task 1: Add the focused Moneyball archive page and route

**Files:**
- Create: `src/arth-profile/pages/moneyball.html`
- Modify: `src/arth-profile/runtime.ts`
- Test: `npm run build`

**Interfaces:**
- Consumes: `accomplishments.css` and assets under `public/arth/Arth-Accomp/Moneyball/`.
- Produces: The `/arth/moneyball.html` route and an artifact gallery with working URLs.

- [ ] **Step 1: Add a failing route expectation**

Confirm `runtime.ts` has no `moneyballHtml` import and `PROFILE_PAGES` has no `/arth/moneyball.html` mapping.

- [ ] **Step 2: Add the static page and route**

Create `moneyball.html` with the existing page header, Academics navigation state, program overview, and four artifact cards. Import it as `moneyballHtml` and map `/arth/moneyball.html` to it.

- [ ] **Step 3: Verify the production build**

Run: `npm run build`

Expected: Vite completes without template-import or asset-reference errors.

### Task 2: Add discoverability from Journey and Archive

**Files:**
- Modify: `src/arth-profile/pages/index.html`
- Modify: `src/arth-profile/pages/academics.html`
- Test: `npm run build`

**Interfaces:**
- Consumes: the `./moneyball.html` route from Task 1.
- Produces: links to the detail page from Journey, the Archive, and the Academics featured-program area.

- [ ] **Step 1: Update the main profile**

Replace the future-tense Wharton reference with completed-program wording, add a Moneyball Journey item, and add a Wharton Moneyball Archive card linking to `./moneyball.html`.

- [ ] **Step 2: Update the Academics archive**

Add a featured-program card for Wharton Moneyball, using the program photo and a link to `./moneyball.html`.

- [ ] **Step 3: Verify the production build**

Run: `npm run build`

Expected: Vite completes successfully and emits the Arth profile assets.

### Task 3: Verify the local publish handoff

**Files:**
- Verify: `dist/arth/index.html`
- Verify: `dist/arth/moneyball.html`
- Verify: `dist/arth/Arth-Accomp/Moneyball/`

**Interfaces:**
- Consumes: production build output from Tasks 1 and 2.
- Produces: a verified local state ready for manual Lovable publication.

- [ ] **Step 1: Check built route content**

Search the generated profile output for `Wharton Moneyball` and `Moneyball Experience`.

- [ ] **Step 2: Check artifact output paths**

Confirm the certificate PDF, presentation PDF, presentation PPTX, and photo exist under `dist/arth/Arth-Accomp/Moneyball/`.

- [ ] **Step 3: Report readiness without publishing**

State that the local build passed and that the user can publish through Lovable. Do not execute a deployment command.

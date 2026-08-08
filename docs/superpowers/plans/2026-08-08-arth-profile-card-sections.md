# Arth Profile Card Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lower homepage layout with compact, theme-faithful content cards while retaining the current hero, portrait, and profile destinations.

**Architecture:** `src/arth-profile/pages/index.html` and `public/arth/index.html` must remain identical because the public copy serves production. New semantic classes express compact About, Journey, Portfolio, and Links layouts; `public/arth/styles.css` styles them from the existing dark palette and font tokens.

**Tech Stack:** Static HTML, CSS, Node.js built-in test runner, Vite.

## Global Constraints

- Preserve the dark palette, Fraunces headings, Space Grotesk body, IBM Plex Mono labels, header, signal ribbon, and `./assets/arth-headshot-20260808.png`.
- Do not show numeric section labels; Journey dates remain visible content.
- Keep Wharton and Berkeley links internal.
- Preserve Scouts and Other destinations as compact secondary links.
- Do not stage unrelated untracked files.

---

### Task 1: Establish the page contract with a failing test

**Files:**
- Modify: `tests/arth-moneyball-profile.test.mjs`

**Interfaces:**
- Consumes: `public/arth/index.html`.
- Produces: checks for markup classes and destinations used by Tasks 2–3.

- [ ] **Step 1: Add this test**

```js
test("the homepage presents compact Portfolio sections without numeric rails", async () => {
  const index = await readFile(path.join(publicArth, "index.html"), "utf8");
  const journey = index.slice(index.indexOf('id="journey"'), index.indexOf('id="accomplishments"'));
  const portfolio = index.slice(index.indexOf('id="accomplishments"'), index.indexOf('id="contact"'));
  assert.match(index, /<a href="#accomplishments">Portfolio<\/a>/);
  assert.match(portfolio, /<h2>Portfolio<\/h2>/);
  assert.match(index, /class="about-copy-grid"/);
  assert.match(index, /class="journey-card-grid"/);
  assert.match(journey, /href="\.\/moneyball\.html"/);
  assert.match(journey, /href="\.\/berkeley-metia\.html"/);
  assert.match(portfolio, /href="\.\/scouts\.html"/);
  assert.match(portfolio, /href="\.\/others\.html"/);
  assert.doesNotMatch(index, /01\s*\//);
  assert.doesNotMatch(index, /02\s*\//);
  assert.doesNotMatch(index, /03\s*\//);
});
```

- [ ] **Step 2: Verify the test fails**

Run `node --test --test-name-pattern="compact Portfolio" tests/arth-moneyball-profile.test.mjs`. Expected: failure because the new classes and Portfolio label do not exist.

- [ ] **Step 3: Commit the red test**

Run `git add tests/arth-moneyball-profile.test.mjs && git commit -m "test: define Arth compact profile sections"`.

### Task 2: Restructure source and production homepage markup

**Files:**
- Modify: `src/arth-profile/pages/index.html`
- Modify: `public/arth/index.html`

**Interfaces:**
- Consumes: Task 1 test contract.
- Produces: `.about-copy-grid`, `.journey-card-grid`, `.portfolio-grid`, and `.secondary-link-list` hooks for Task 3.

- [ ] **Step 1: Replace the About copy in both files with this paired grid**

```html
<div class="about-copy-grid">
  <p>Entrepreneurship creates the drive to build, competitive cricket sharpens discipline and performance thinking, and scouting develops service and leadership.</p>
  <p>My academic interests center on mathematics, statistics, finance, and economics. I’m building toward work where quantitative thinking, business, education, and sport meet.</p>
</div>
```

Retain a four-item fact list underneath: School year, Completed APs, Current APs, Current work.

- [ ] **Step 2: Replace the long Journey list in both files with three cards**

```html
<div class="journey-card-grid">
  <a class="journey-card journey-card-featured" href="./moneyball.html"><span>2026</span><strong>Wharton Moneyball</strong><small>NBA offense analysis</small></a>
  <a class="journey-card" href="./berkeley-metia.html"><span>2026</span><strong>Berkeley M.E.T.</strong><small>GlycoStep venture project</small></a>
  <article class="journey-card"><span>Now</span><strong>Game-Changrs + cricket</strong><small>Building through sport</small></article>
</div>
```

- [ ] **Step 3: Rename Archive to Portfolio in both files**

Change the navigation text and heading only; retain `href="#accomplishments"` and `id="accomplishments"`. Render Academics, Leadership, and Cricket as three main portfolio cards. Add visible compact links to `./scouts.html` and `./others.html` below the cards.

- [ ] **Step 4: Compact Links in both files**

Keep LinkedIn, Game-Changrs, and CricClubs as the main rows. Put Senior Scam Awareness and National Cricket Circuit in a `secondary-link-list` container with no helper paragraph.

- [ ] **Step 5: Verify and commit markup**

Run `node --test --test-name-pattern="compact Portfolio" tests/arth-moneyball-profile.test.mjs`; expected PASS. Then run `git add src/arth-profile/pages/index.html public/arth/index.html && git commit -m "feat: compact Arth profile content sections"`.

### Task 3: Style compact cards within the existing theme

**Files:**
- Modify: `public/arth/styles.css`

**Interfaces:**
- Consumes: class hooks from Task 2 and existing root design tokens.
- Produces: compact desktop cards and stacked mobile layouts.

- [ ] **Step 1: Add desktop rules**

```css
.about-copy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.2rem; }
.journey-card-grid, .portfolio-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.8rem; }
.journey-card { min-height: 10.5rem; padding: 1.15rem; border: 1px solid var(--line); border-radius: var(--radius-md); background: rgba(19, 24, 28, 0.86); }
.journey-card-featured { border-color: rgba(156, 255, 211, 0.32); background: linear-gradient(145deg, rgba(23, 63, 54, 0.9), rgba(19, 24, 28, 0.9)); }
```

Style card metadata with IBM Plex Mono, titles with Fraunces, summaries with muted body text, and `.secondary-link-list` as a quiet inline list.

- [ ] **Step 2: Add mobile rules**

```css
@media (max-width: 760px) {
  .about-copy-grid, .journey-card-grid, .portfolio-grid { grid-template-columns: 1fr; }
  .journey-card { min-height: auto; }
}
```

Keep hero and signal-ribbon rules unchanged.

- [ ] **Step 3: Verify and commit styling**

Run `node --test --test-name-pattern="compact Portfolio" tests/arth-moneyball-profile.test.mjs`; expected PASS. Then run `git add public/arth/styles.css && git commit -m "style: refine Arth compact portfolio layout"`.

### Task 4: Validate static parity and publish readiness

**Files:**
- Verify: `src/arth-profile/pages/index.html`
- Verify: `public/arth/index.html`
- Verify: `public/arth/styles.css`
- Verify: `tests/arth-moneyball-profile.test.mjs`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: a validated GitHub `main` update ready for Lovable publication.

- [ ] **Step 1: Run tests and build**

Run `node --test`, `npm run build`, and `git diff --check`. Expected: all commands exit successfully with no whitespace diagnostics.

- [ ] **Step 2: Verify the public/source homepage copies match**

Run `diff -u src/arth-profile/pages/index.html public/arth/index.html`. Expected: no output.

- [ ] **Step 3: Commit and push only implementation files**

Run `git add src/arth-profile/pages/index.html public/arth/index.html public/arth/styles.css tests/arth-moneyball-profile.test.mjs && git commit -m "feat: modernize Arth profile content layout" && git push origin main`.

- [ ] **Step 4: Hand off Lovable publication**

Tell the user the `main` update is ready and they can use Lovable’s Publish control to make it live.

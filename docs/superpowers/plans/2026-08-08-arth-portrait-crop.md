# Arth Portrait Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crop the homepage portrait in CSS and add supplied small marks to the Wharton, Berkeley, and Game-Changrs signal cards.

**Architecture:** The existing portrait frame remains the clip boundary. A CSS transform and image position adjustment change only the rendered crop. Supplied Wharton and Berkeley image crops plus the existing Game-Changrs mark are referenced in the duplicated homepage HTML, then aligned through a small signal-mark CSS hook.

**Tech Stack:** Static CSS, Node.js test runner, Vite.

## Global Constraints

- Modify both homepage copies and `public/arth/styles.css` for the crop and signal marks.
- Preserve the original portrait asset, dark theme, portrait frame, and responsive aspect ratio.
- Keep Arth’s face, sunglasses, phone, and upper body visible.

---

### Task 1: Apply and verify the portrait crop and signal marks

**Files:**
- Create: `public/arth/assets/brand/wharton-shield.png`
- Create: `public/arth/assets/brand/berkeley-b.png`
- Modify: `src/arth-profile/pages/index.html`
- Modify: `public/arth/index.html`
- Modify: `public/arth/styles.css`
- Test: `tests/arth-moneyball-profile.test.mjs`

**Interfaces:**
- Consumes: `.portrait-frame` and `.portrait-frame img` in the existing static stylesheet.
- Produces: a tighter portrait crop and accessible decorative marks within the signal cards.

- [ ] **Step 1: Add a failing contract assertion**

Add assertions that `styles.css` includes a `.portrait-frame img` crop rule and that both homepage files contain `wharton-shield.png`, `berkeley-b.png`, and `gamechangrs-hex-ball-mark.webp` in the signal ribbon.

- [ ] **Step 2: Run the targeted test**

Run `node --test --test-name-pattern="portrait crop" tests/arth-moneyball-profile.test.mjs`. Expected: failure because the crop transform and signal mark markup are absent.

- [ ] **Step 3: Add the supplied asset crops and markup**

Copy the supplied shield and `B` image crop to the listed brand asset paths. Add `<img class="signal-mark" alt="">` immediately before the existing text within the Wharton, Berkeley, and Game-Changrs signal cards in both homepage files. Use the existing Game-Changrs webp source.

- [ ] **Step 4: Add the CSS rules**

Update the `.portrait-frame img` rule to use a moderate scale near `1.18` and an upper-left `transform-origin` so full face and hair remain visible while the right-side hanger area is cropped. Preserve the existing `.signal-mark` rules.

- [ ] **Step 5: Verify and commit**

Run `node --test`, `npm run build`, and `git diff --check`; all must pass. Commit only the stylesheet and portrait test, then push `main` after confirmation that the worktree integration is complete.

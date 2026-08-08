# Arth subpage unification design

## Goal

Make Academics, Leadership, Scouts, Cricket, Berkeley M.E.T., and Wharton Moneyball visually consistent, less wordy, and easier to scan.

## Shared system

Keep the existing dark palette, Fraunces headings, Space Grotesk body text, IBM Plex Mono only where it identifies an artifact type, rounded cards, and category navigation. Replace the current hero panel plus summary-card density with a compact hero: page title, one concise summary, and a four-item fact grid.

## Content structure

Do not render generic section labels such as Programs, Highlights, Gallery, Evidence, Featured Work, or numeric labels. Use only a meaningful content title where one is necessary: `Final Project` for Wharton and `GlycoStep` for Berkeley. Other pages proceed directly from the hero to compact artifact cards.

## Card treatment

Use the same three-column desktop card grid and one-column mobile layout across all pages. Cards retain their file links and images but shorten copy to one factual line. Preserve all supplied artifacts, links, and download actions; remove repeated explanatory text only.

## Page-specific content

- Academics: retain Wharton and Berkeley program cards plus all certificates/projects.
- Leadership, Scouts, Cricket: retain every artifact and supporting note as compact cards.
- Berkeley: retain program facts, GlycoStep project, certificate, people, and gallery.
- Wharton: retain program facts, final project, certificate thumbnail, photo, PDF, and PPTX.

## Verification

Update profile tests for the unified class hooks and retained artifact links. Run full tests, Vite build, static-page parity checks, and whitespace validation before pushing `main`.

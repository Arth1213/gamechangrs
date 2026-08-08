# Arth subpage unification design

## Goal

Make Academics, Leadership, Scouts, Cricket, Berkeley M.E.T., and Wharton Moneyball visually consistent, less wordy, and easier to scan.

## Shared system

Keep the existing dark palette, Fraunces headings, Space Grotesk body text, IBM Plex Mono only where it identifies an artifact type, rounded cards, and category navigation. Use one restrained typography scale: capped page title, shared section/project title, shared body size, and limited metadata size. Replace the current hero panel plus summary-card density with a fixed-height hero: page title, one concise summary, actions, and a four-item equal-height stat rail.

## Content structure

Do not render generic section labels such as Programs, Highlights, Gallery, Evidence, Featured Work, or numeric labels. Use only a meaningful content title where one is necessary: `Final Project` for Wharton and `GlycoStep` for Berkeley. Other pages proceed directly from the hero to compact artifact cards.

## Card treatment

Use one shared left-aligned content grid: three columns on desktop, two on tablet, one on mobile. Cards have equal internal padding, aligned actions, fixed thumbnail ratios, one palette, one border, and one radius. Preserve all supplied artifacts, links, and download actions; remove repeated explanatory text only.

## Page-specific content

- Academics: retain Wharton and Berkeley program cards plus all certificates/projects.
- Leadership, Scouts, Cricket: retain every artifact and supporting note as compact cards.
- Berkeley: retain program facts, GlycoStep project, certificate, people, and gallery.
- Wharton: retain program facts, final project, certificate thumbnail, photo, PDF, and PPTX.

## Verification

Update profile tests for the unified class hooks and retained artifact links. Run full tests, Vite build, static-page parity checks, and whitespace validation before pushing `main`.

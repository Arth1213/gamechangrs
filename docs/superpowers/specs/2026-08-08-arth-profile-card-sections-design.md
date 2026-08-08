# Arth profile card-section redesign

## Goal

Make the lower portion of Arth's profile more modern, compact, and easier to scan without changing the established visual identity or removing profile destinations.

## Scope

Apply the redesign to both homepage copies:

- `src/arth-profile/pages/index.html`
- `public/arth/index.html`

Use `public/arth/styles.css` for the shared static presentation rules.

## Visual system

Keep the current dark palette, Fraunces headings, Space Grotesk body text, IBM Plex Mono metadata, rounded panels, header navigation, hero signal ribbon, and current portrait. Do not introduce the white-card palette from the discarded mockup.

## Navigation and section names

Rename the user-facing `Archive` navigation label and section heading to `Portfolio`. Keep the `#accomplishments` anchor so existing inbound links continue to work. Do not show numeric section labels such as `01`, `02`, or `03`.

## About

Use two concise paragraphs across the full available content width:

1. Entrepreneurship, cricket, and scouting as the sources of building, discipline, performance thinking, service, and leadership.
2. Mathematics, statistics, finance, and economics as the academic foundation for work at the intersection of quantitative thinking, business, education, and sport.

Place a compact four-item fact grid beneath the copy: school year, completed APs, current APs, and current work. Preserve the factual AP and venture content.

## Journey

Replace the long six-item vertical list with three compact feature cards:

- Wharton Moneyball, dated 2026 and linked to `moneyball.html`.
- Berkeley M.E.T., dated 2026 and linked to `berkeley-metia.html`.
- Game-Changrs and cricket, marked `Now`.

Dates remain visible because they are substantive content, not section numbering. Keep the links to the program pages.

## Portfolio

Replace the five-card archive grid with three clear destinations:

- Academics, linking to `academics.html` and covering programs, coursework, certificates, and project work.
- Leadership, linking to `leadership.html` and covering FBLA, scouting, and service.
- Cricket, linking to `cricket.html` and covering honors, photos, and performance.

Preserve access to Scouts and Other pursuits through compact secondary links in the portfolio section rather than a standalone main card.

## Links

Show LinkedIn, Game-Changrs, and CricClubs as compact primary link buttons. Keep Senior Scam Awareness and National Cricket Circuit as subdued secondary links, without a helper paragraph.

## Responsive behavior

Keep the desktop rail-and-content organization. At narrow widths, stack rail/content and collapse card grids to preserve readable text and tappable links. The portrait remains in the hero and retains its current image source and crop treatment.

## Verification

Add targeted test assertions for the Portfolio naming, removed numeric labels, card-based Journey, compact About structure, retained portrait and internal program links. Run `node --test`, `npm run build`, and `git diff --check` before commit.

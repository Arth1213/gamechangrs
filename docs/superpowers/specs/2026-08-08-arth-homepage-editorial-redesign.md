# Arth Homepage Editorial Redesign

## Goal

Make the `/arth/` homepage professional, legible, and calm without removing profile content.

## Layout

The homepage opens with a two-column editorial hero: a concise profile introduction and action on the left, the updated portrait on the right. The hero replaces the existing dense signal-card grid and separate current-direction panel with a compact four-item signal ribbon below the hero.

The About section uses a readable narrative column alongside a two-column fact grid. The fact grid separates completed APs from APs in progress so the longer course list can wrap naturally without making a single narrow card excessively tall.

Journey and Archive retain the present information architecture. Their cards use a restrained visual treatment, controlled text widths, and responsive grids to reduce density.

## Typography and Responsiveness

The existing Fraunces heading and Space Grotesk body pairing remains. Heading scale is reduced slightly, body copy is constrained to readable line lengths, and descriptions use a lower-contrast muted color. Desktop uses intentional two-column composition; tablet and mobile stack the hero, use two-column facts where viable, and use one column at narrow widths.

## Content Rules

- Preserve all existing links and profile facts.
- Keep Wharton Moneyball and Berkeley M.E.T. discoverable from the main page.
- Do not modify detail pages, program assets, or deployment configuration.
- Update both `src/arth-profile/pages/index.html` and `public/arth/index.html`, because the public file is served directly in production.

## Validation

- Automated test asserts the new hero, signal ribbon, and AP facts appear in both homepage copies.
- `npm run build` passes.
- The static production homepage includes the same updated image and internal program links as the source page.

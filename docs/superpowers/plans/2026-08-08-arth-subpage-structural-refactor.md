# Arth Subpage Structural Refactor Implementation Plan

**Goal:** Rebuild the shared subpage presentation system with fixed-height hero alignment, restrained typography, and consistent artifact grids.

1. Add failing stylesheet contract tests for capped page titles, equal hero stat rows, fixed artifact image ratios, and responsive grids.
2. Replace shared `accomplishments.css` hero, typography, card, grid, and action rules; retain all HTML artifacts and links.
3. Verify all profile tests, full tests, Vite build, and static-site layout CSS before merging and pushing `main`.

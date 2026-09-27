# Grizzlies vs Strikers coaching brief

## Scope and release contract

User requested a short, red-bordered upcoming-game plan inside AI Match Analysis, using the verified cross-league role history as well as MiLC 2025/2026. This is a reviewed coaching brief, not an ML forecast or a full career-history release.

- Three non-overlapping phases: 1-6, 7-15, 16-20.
- Boundary frequency is legal boundary deliveries divided by legal deliveries, not share of runs.
- Actions name the bowler, batter, phase and decision trigger. Small samples remain explicit.
- Matchup cards and batting/partnership decisions use short bullets; no em dashes.
- Supplementary divisions and formats are not pooled or treated as strength-adjusted.
- No field-direction claims without location evidence; selection and four-over limits still apply.

## Implementation

1. `grizzliesCoachPlan.js` validates the private payload and computes boundary percentages and the strict >30-ball partnership gate.
2. `GrizzliesCoachPlan.tsx` renders the restrained red-border coaching brief and expandable sources.
3. The portal links to `/analytics/grizzlies/2026/matches/2375?view=game-plan` from its AI Match Analysis tab. `?tab=analysis` selects that tab directly.
4. The existing authenticated report API supplies `analysis.coachPlan`. No public JSON, client credential or new access path is introduced.
5. The publisher clones report 6 into a separately versioned row, adding only the coaching payload. The previous row is retained and superseded in the same transaction. Historical match rendering remains the default without the query parameter.

The release script is dry-run by default. It pins match 2375, series 16, the reviewed base report checksum and the version. It refuses concurrent replacement or mismatched existing content. Supply the private payload, backend environment and two evidence-artifact paths explicitly. It inherits the API's existing TLS policy and hashes the raw source files. Run with `--publish` only after review and user authorization.

## Verification and decisions

- Unit tests cover boundary denominators, partial death phase, strong stands, malformed JSON, source references, copy length, em dashes, authenticated URLs and historical-summary compatibility.
- Independent review identified TLS policy inheritance and summary-version scope; both fixed with failing-then-passing regressions. Malformed text-field coercion also fixed with a regression.
- Existing portal authorization and report-version tests remain required.
- Check real desktop/mobile rendering, TypeScript and production build before release.
- New recent scorecards supplement this report only; this release does not claim to refresh the entire fixture inventory or enable ML training.
- Partial histories for 12 players inform role context. Unresolved cross-account histories remain excluded.

## Recovery

If the coaching release needs reversal, in one database transaction first confirm the currently published version is `coach-plan-20260926-v1`, supersede that row and restore report 6 to `published`. Do not delete either version. Remove or disable the featured game-plan link if rolling back its data. Revert this feature's Git commit if rolling back the UI; do not reset or overwrite unrelated commits.

Private source payloads and browser previews stay outside Git and the production bundle. Deployment is complete only after the GitHub push, Lovable publish and an authenticated live click-through verify the coaching report.

# Grizzlies 2026 Analytics Portal Design

## Goal

Create a sign-in-required landing page for the 2026 San Ramon Grizzlies Minor League season, branded **Grizzlies 2026 Analytics - Powered by GameChangrs**. The page is for the named Grizzlies leadership group and provides cross-team NCCA intelligence before the 2026 MiLC series has an official CricClubs source.

## Access

The portal is not public. It requires the existing Google/Gmail authentication flow and permits only these verified account emails:

- `samirnshah@gmail.com`
- `niravsh@gmail.com`
- `helloarth09@gmail.com`
- `mohan.arun@gmail.com`

After successful authentication, access is evaluated against an exact normalized-email allow-list. This does not depend on a manual per-session grant and does not authorize an email merely because its display name resembles an approved person. Users outside the allow-list receive an access-denied screen.

## Route and Brand

The protected route is `/analytics/grizzlies/2026`.

It uses the provided Grizzlies logo, the current GameChangrs assessment/threat-report typography and card treatment, and the exact page title **Grizzlies 2026 Analytics - Powered by GameChangrs**. The welcome section names Nirav Shah, Samir Shah, Arth Arun, and Arun Mohan without publishing email addresses.

## Squad Intelligence

The first tab is **Squad Intelligence**. It contains separate team sections for only:

- San Ramon Grizzlies
- Silicon Valley Strikers
- East Bay Blazers

The initial roster is sourced from the Western Division sheet of `2026 Minor League Player Rosters.xlsx`. Corrected roster names are Sreehaas Krishna for Grizzlies and Kashyap Manchili for Silicon Valley.

Each row shows roster player name, roster category, NCCA CricClubs profile, Player Assessment, and Player Threat Report. A row without a confirmed NCCA identity displays **NCCA data not found** for the report links. No fuzzy result is silently treated as a match.

### Approved abbreviated-name overrides

The following roster identities resolve to the named NCCA player records:

| Roster name | NCCA display name | NCCA player ID |
| --- | --- | ---: |
| Amogh Arepally | Amogh A | 3839 |
| Saurabh Netravalkar | Saurabh N | 8333 |
| Nisarulhaq Wahdat | Nisarulhaq W | 5013 |
| Ramesh Basnet | Ramesh B | 4503 |
| Syon Kurdekar | Syon K | 3775 |
| Saideep Ganesh | Saideep G | 3778 |
| Suliman Arabzai | Suliman A | 3913 |
| Sidhant Reddy | Sidhant R | 7339 |
| Avyukth Raghunarayan | Avyukth R | 4034 |
| Vatsal Vaghela | Vatsal V | 3882 |
| Rahul Jariwala | Rahul J | 3883 |
| Zahid Zakhil | Zahid Z | 5009 |

Sreehaas Krishna is a confirmed NCCA profile using the supplied CricClubs player URL with player ID `2102795`. Kashyap Manchili resolves to `Subramanya Kashyap Manchili (wk)`, NCCA player ID `7283`; the record currently has no stored NCCA profile URL.

### Identity reconciliation

The following duplicate NCCA identity clusters require a canonical-player override and recomputation, not just a page-level link override:

- Aarnav Iyer
- Bilal Basheer
- Praneel Venna
- Vinay Khandelwal
- Aadhav Iyer
- Ayaan Khan
- Husnain Bukhari
- Shivam Mishra
- Supransh Kumar

For each cluster, preserve raw scorecard records, map all approved source IDs to a canonical analytics player, route profile/report/intelligence links to that player, and recompute affected season aggregates, composite scores, and player intelligence. Keep the mapping and source IDs in an audit trail.

## AI Match Analysis

The second tab is **AI Match Analysis**. Before MiLC match data arrives, it presents a clear empty state: match analysis and AI recommendations are coming after the Minor League season begins. It does not generate unsupported match findings.

## MiLC Series Placeholder

Create a disabled `2026 MiLC series` configuration with the planned September 18 start. It has no CricClubs URL, IDs, scheduled ingestion, or refresh jobs until the user supplies the official source details. Once supplied, source configuration and ingestion are a separate activation step.

## Verification

- Test exact email allow-list authorization and rejection of all other accounts.
- Test roster extraction for the three intended Western Division teams and both corrected names.
- Test approved override resolution, unresolved rendering, and no automatic fuzzy linking.
- Test canonical duplicate mapping and affected recomputation behavior.
- Test the protected route, assessment/threat link generation, AI placeholder, disabled MiLC configuration, and production frontend build.

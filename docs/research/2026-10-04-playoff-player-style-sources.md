# MiLC 2026 playoff player style sources

Research date: 2026-10-04. Scope: 46 source records across Baltimore Royals, Dallas Xforia Giants, Manhattan Yorkers; 25 records have bowling activity in the supplied audit roster. The research pass was read-only; the approved persistence and validation results are recorded at the end of this document.

## Result and interpretation

- 46 exact MiLC profile routes opened and their rendered header/style fields read (42 supplied profile URLs, 4 routes constructed from known roster source IDs and then identity-checked on screen).
- 45 valid identities displayed matching player name + current scoped team + CC Player ID. Source record 8439 returned “Invalid player Id provided”; do not merge it to source8817 by name.
- 41 records have at least one source-verified selected style; 30 have selected bowling fields. Among 25 active bowlers: 18 selected bowling styles, 4 blank bowling fields, 3 unresolved records.
- “verified” means identity-bound, explicitly declared primary-source value with no unresolved material contradiction found during this scoped pass. It does not mean independently verified bowling action. Direct CricClubs fields can be wrong/defaulted: Harmeet Singh and Kunwarjeet Singh demonstrate contradictory declarations resolved by official team identity bridges. Adit Kappa, Mohammad Mohsin, and Agni Chopra remain quarantined.
- In JSON, fields are omitted when absent, not filled from names or memory. A false record can retain raw exact-profile declarations for audit, but these MUST NOT be imported automatically. Missing bowling remains missing even on a batting-verified record.

HTTP/web-open requests to the current CricClubs profiles failed (Cloudflare challenge/inaccessible). Parent established browser access; a separate background in-app tab read exact rendered DOM. No login, CAPTCHA solving, private contacts, DOB, or external writes performed.

## Selected styles by exact identity

The source column links the exact roster route. Values are preserved as declared, except the explicitly resolved official-team corrections below. “—” means absent. “Quarantine” means no automatic import.

| Player ID | Player | Active bowler | CC ID | Selected batting | Selected bowling | Status / exact source |
|---|---|---|---|---|---|---|
| 9231 | Aaditya Patel | No | 5537835 | right-handed | right-arm-fast | Selected · [profile](https://cricclubs.com/MiLC/user/5Tg_z2xcTqUEQA2WAV0Fhg) |
| 8463 | Aaryan Batra | Yes | 2404566 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/p58TzkB0gIsL43cMzue5Cg) |
| 8462 | Adil Bhatti | Yes | 680849 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/zadCLCTlKZOWEkeHl-7URw) |
| 8441 | Agni Chopra | No | 6171414 | Right Handed Batter | Right Arm Medium | Quarantine · [profile](https://cricclubs.com/MiLC/user/qsTCsvz2MnDwRgbmZ5AWuQ) |
| 8465 | Asif Mehmood | Yes | 4593285 | — | — | Quarantine · [profile](https://cricclubs.com/MiLC/user/2O9uwYivPrbfy1K2nkQlgQ) |
| 9441 | Ishaan Vairagiwala | Yes | 1998830 | Left Hand Batter (Middle Order) | Left Arm Fast | Selected · [profile](https://cricclubs.com/MiLC/user/tyAPZ7jDw90dUT0bnLGRbQ) |
| 9443 | Jaskaran Malhotra | No | 1778010 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/CDTArJPVC4ldiBQBNBhAXg) |
| 8437 | Kunwarjeet Singh | No | 4546142 | Left Handed | — | Selected · [profile](https://cricclubs.com/MiLC/user/3M46Rda-VnqNrmsBFGlZFA) |
| 8468 | Mohammad Mohsin | Yes | 2898346 | Right Handed Batter | — | Quarantine · [profile](https://cricclubs.com/MiLC/user/OECjQhH_Q2vJ-eEfJ-T2lg) |
| 8817 | Prannav Chettipalayam | No | 603364 | Right Hand Batter (Top Order) | — | Selected · [profile](https://cricclubs.com/MiLC/user/1WRYR5BXZM0ZTZcBMrjAFw) |
| 8439 | Prannav Chettipalayam | No | — | — | — | Quarantine · [profile](https://cricclubs.com/MiLC/user/jIa-fsj8yGwvwNdvek_2Jw) |
| 9222 | Rishi Dhawan | Yes | 2101139 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/CWObf7H5WptjogzOr35DYQ) |
| 8440 | Ritwik Behera | Yes | 2003372 | Right Handed Batter | Right Arm Off Spin | Selected · [profile](https://cricclubs.com/MiLC/user/-0uyZliRaguKOF4T-m5cmA) |
| 9223 | Rudra Kushwah | No | 5296158 | Right Handed Batter | Right Arm Off Spin | Selected · [profile](https://cricclubs.com/MiLC/user/mm3_Scr8Ev_NTeCqJ6uShA) |
| 8464 | Sarbjeet Ladda | Yes | 2920782 | Right Handed Batter | Right Arm Leg Spin | Selected · [profile](https://cricclubs.com/MiLC/user/TCQL3WtBJ1dlMOc92gSqmQ) |
| 8438 | Sharad Lumba | Yes | 497287 | Right Handed Batter | Right Arm Off Spin | Selected · [profile](https://cricclubs.com/MiLC/user/13lYsD_s5CK9KZRIPMYPyg) |
| 8830 | Tanush Apte | No | 865200 | Right Handed Batter | — | Selected · [profile](https://cricclubs.com/MiLC/user/gg13BAxGcGLupxCxNe4Ycw) |
| 9440 | Yevin Goonatilake | No | 2235091 | Right Handed Batter | Right Arm Leg Spin | Selected · [profile](https://cricclubs.com/MiLC/user/kte4TwOmqPVx7UM2HywKnw) |
| 8974 | Aakarshit Gomeil | No | 3481003 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/znFXEbTwWIXLPFaI027bTA) |
| 9447 | Andries Gous | No | 3267964 | Right Hand Batter (Top Order) | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/qVxoqVafdDHNF8V9YtvQ1Q) |
| 8997 | Ehsan Adil | Yes | 2637168 | Right Hand Batter (Top Order) | Right Arm Fast | Selected · [profile](https://cricclubs.com/MiLC/user/eNFX5BK0xSDKH600z1yVYA) |
| 8991 | Firasuddin Syed | No | 3629643 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/t6zpDMSRJO2xOKZUDw60Qg) |
| 9345 | Harmeet Singh | Yes | 315981 | Left Handed | Slow left-arm orthodox | Selected · [profile](https://cricclubs.com/MiLC/user/I6ddTz8jtZAIQ3DSrpJdXA) |
| 9001 | Kamal Passi | Yes | 6173483 | Right Hand Batter (Top Order) | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/fWQ9ZxNq1jkyNrcMhMVn7w) |
| 9358 | Laksh Warty | No | 6924440 | right-handed | right-arm-off-spin | Selected · [profile](https://cricclubs.com/MiLC/user/uRQ5CH588Y9R3JjSHy9K6A) |
| 9000 | Raghav Prabhune | Yes | 4252117 | right-handed | right-arm-fast | Selected · [profile](https://cricclubs.com/MiLC/user/eIymQSubnhZDGHJFBXwQPg) |
| 9357 | Rahmatullah Niazi | Yes | 3230641 | right-hand-batter-middle-order | right-arm-fast | Selected · [profile](https://cricclubs.com/MiLC/user/ZH74cp6Nx6Mfwxeleonahw) |
| 8999 | Sankirth Bhattula | Yes | 3481004 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/b8fgkITrSRccmkYc94TlfQ) |
| 9344 | Shaurya Singh | No | 4574256 | right-handed | right-arm-leg-spin | Selected · [profile](https://cricclubs.com/MiLC/user/Peix4q8GFr_EMYI7a31eqA) |
| 8972 | Shayan Jahangir | No | 1392181 | Right Handed Batter | Right Arm Fast | Selected · [profile](https://cricclubs.com/MiLC/user/YFh46bt1e7wxx-6wyeezVg) |
| 8973 | Smit Patel | No | 4549225 | Right Handed Batter | — | Selected · [profile](https://cricclubs.com/MiLC/user/lw1TFzk3pgjJ7HVdN27IgA) |
| 8998 | Yaqoob Haidery | Yes | 3227839 | Right Handed Batter | — | Selected · [profile](https://cricclubs.com/MiLC/user/ZyLUkKfFnDJi-v-eTaGWhQ) |
| 8995 | Zia Muhammad Shahzad | Yes | 2093738 | Right Handed Batter | Right Arm Leg Spin | Selected · [profile](https://cricclubs.com/MiLC/user/USm4ate2i02ElpivDMuMXA) |
| 8576 | Adit Kappa | Yes | 1282847 | Right Hand Batter (Top Order) | Right Arm Medium | Quarantine · [profile](https://cricclubs.com/MiLC/user/izopVI6tYlLXPlg1QETGig) |
| 8567 | Aditya Anand | No | 6819551 | Right Hand Batter (Top Order) | — | Selected · [profile](https://cricclubs.com/MiLC/user/-WGqqP6W1MkmkLQMshrG3A) |
| 8566 | Akshay Homraj | No | 1226106 | Right Hand Batter (Top Order) | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/9_OtVA6LAumUWFmU_WaKEQ) |
| 8574 | Amrinder Gill | Yes | 3391701 | Right Hand Batter (Top Order) | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/2y9ADhO35OkqVdzr9D6n9g) |
| 8573 | Dhruv Pawar | Yes | 1803658 | Right Hand Batter (Top Order) | — | Selected · [profile](https://cricclubs.com/MiLC/user/VCUeLsNwEvr2u6u5_ZJQbA) |
| 8572 | Justin Dill | Yes | 2312288 | Right Hand Batter (Top Order) | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/BxQCSfaaBYLd_c6O9H-c_A) |
| 9063 | Laksh Parikh | Yes | 2003407 | Left Hand Batter (Middle Order) | Left Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/WMroKu8xLHgvVP-7W7ScpQ) |
| 8602 | Noman Iftikhar | Yes | 2175594 | Right Hand Batter (Top Order) | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/SlUm0TVHJq7sNKtzfydekQ) |
| 8633 | Preet Shah | Yes | 1728055 | Right Hand Batter (Top Order) | — | Selected · [profile](https://cricclubs.com/MiLC/user/QRct3hb9FzzGoF4a35IkXQ) |
| 8570 | Rishikesh Bodugum | No | 4546290 | Right Handed Batter | Right Arm Medium | Selected · [profile](https://cricclubs.com/MiLC/user/rKKRRbUHKLAz_pFCw97iSA) |
| 8568 | Syed Abdullah | No | 3392123 | Right Hand Batter (Top Order) | — | Selected · [profile](https://cricclubs.com/MiLC/user/9oNkH0yGj58XqTsSi2slAA) |
| 8571 | Talha Mumtaz | No | 4250106 | Right Hand Batter (Top Order) | — | Selected · [profile](https://cricclubs.com/MiLC/user/pweXeQwiCyVC1j3Ll_GY4g) |
| 8569 | Yasir Mohammad | Yes | 835135 | Right Handed Batter | — | Selected · [profile](https://cricclubs.com/MiLC/user/OvRgP8jnFCbE8U6Yt3D9Og) |

## Conflicts, identity bridges, and candidate-only alternatives

### Harmeet Singh — 9345: resolved official correction

Exact CC315981 currently says right-handed / right-arm medium. [Seattle Orcas official profile](https://www.seattleorcas.com/players/harmeet-singh-36489-profile) declares left-handed batting and slow left-arm orthodox, independently agreeing with [ICC36489](https://www.icc-cricket.com/rankings/36489/harmeet-singh). The [official Orcas MiLC article dated September 18, 2026](https://www.seattleorcas.com/news/seattle-orcas-players-to-watch-in-minor-league-cricket) expressly assigns the team's Harmeet Singh to Dallas Xforia Giants. This is an identity bridge beyond same-name; select the official-team + ICC styles, rejecting the erroneous current CC fields.

### Kunwarjeet Singh — 8437: resolved official correction

Current CC4546142 says right-handed. [MI New York's official February 20, 2025 draft article](https://minycricket.com/news/mi-new-york-draft-picks-for-mlc-2025) expressly identifies its Kunwarjeet Singh as a Baltimore Royals player and describes him as “left-handed middle-order batter.” Select left-handed batting. Bowling remains absent.

### Adit Kappa — 8576: unresolved, quarantine both fields

Current exact CC1282847 says right-handed top-order / right-arm medium. [Opened ICC135288](https://www.icc-cricket.com/rankings/135288/adit-kappa) declares left-handed / slow left-arm orthodox. [Opened American Cricket Academy roster](https://www.americancricketacademy.org/private/players/all) declares left hand / LMF. Both handedness and pace-versus-spin conflict. No primary exact-ID/team bridge was found within this pass. Do not select a style from name similarity or majority vote.

### Mohammad Mohsin — 8468: unresolved identity/style, quarantine

Exact current CC2898346 is Baltimore Royals, right-handed batting, bowling blank. [Opened USA ICC65880](https://www.icc-cricket.com/rankings/65880/mohammad-mohsin) declares left-handed / leg break googly. No primary identity bridge to CC2898346 established. Do not substitute the famous USA player's style by name.

### Agni Chopra — 8441: unresolved, quarantine current fields

Exact CC6171414 says right-handed / right-arm medium. [MI New York official draft article](https://minycricket.com/news/mi-new-york-draft-picks-for-mlc-2025) names Agni Chopra as a left-handed batter. That article does not expressly name his Baltimore affiliation or CC ID. Current fields are not safe to import until the identity bridge is independently confirmed.

### Blank bowling fields and candidate-only sources

- Asif Mehmood (8465): exact CC4593285 declares neither batting nor bowling. No verified replacement found.
- Yaqoob Haidery (8998), Preet Shah (8633): current exact profiles declare batting but leave bowling blank. No verified replacement found.
- Dhruv Pawar (8573): current exact profile has bowling blank. [Cricmax's own students page](https://cricmax.com/our-students/) describes a Dhruv Pawar as left-arm orthodox spin with right-handed batting; no exact-ID/team bridge was found, so this remains a candidate, not a selected bowling style.
- Yasir Mohammad (8569): current exact profile has bowling blank. [The same Cricmax page](https://cricmax.com/our-students/) describes Yasir Mohammad as a right-arm wrist spinner; no exact-ID/team bridge was found, so candidate only.
- Prannav Chettipalayam (8439): invalid exact source. The other Prannav source (8817/CC603364) is valid and declares right-handed top-order batting. Never automatically transfer across the two source IDs.

### Pace-label distinctions and corroboration

[Aaryan Batra's opened ICC profile](https://www.icc-cricket.com/tournaments/u19cricketworldcup/teams/1152/players/95716/aaryan-batra/) says right-arm medium fast; it was read by ordinary HTTP because web-open failed. Exact current profile says right-arm medium. Preserve the current exact label; do not overstate precision or infer medium-fast identity equivalence.

[Ehsan Adil's opened ICC profile](https://www.icc-cricket.com/rankings/57482/ehsan-adil) says right-arm fast medium, while exact current profile says right-arm fast. The selected value records the exact declared label, not a claim that all pace labels are identical.

[Noman Iftikhar's opened official USPL profile](https://www.cricuspl.com/player/noman-iftikhar/) independently describes right-handed batting and right-handed medium pace. Its biography identifies Somerset Cavs MiLC history, matching the exact current CC2175594 team history.

## Reproducibility / handoff

Durable machine-readable evidence: [combined identity and style ledger](evidence/2026-10-04-playoff-style-profiles.json). The ledger includes all 159 researched identities, including unresolved records, source URLs, source quotes, identity evidence, verification flags, and notes. Apply eligible values per field, not merely per record. Do not overwrite existing known-good fields with unknown, quarantined, or contradictory source values.

## Approved application and verification

Applied 2026-10-04 at 19:52 UTC, followed by metadata-only unresolved-review markers at 20:03 UTC.

- Enriched 147 exact-identity records with 147 batting and 109 bowling styles. These include playoff players and their opponents needed for matchup classification. No career or other-season performance statistics were imported.
- Both Prannav source records (8439, 8817) were excluded from persistence and intelligence regeneration pending duplicate-identity resolution.
- Regenerated MiLC 2026 intelligence for 44 selected roster IDs: 1,152 matchup rows, 98 dismissal rows, and 84 profile rows representing 42 players at series and division scope. Two selected players have no qualifying output. Writes were scoped and transactional.
- Active playoff bowlers classified: 18/25. Opponent bowlers faced classified: 46/64. Events with a known opponent bowling style: 909/1,301.
- Seven active playoff bowlers remain unresolved: Asif Mehmood, Mohammad Mohsin, Adit Kappa, Yaqoob Haidery, Dhruv Pawar, Preet Shah, Yasir Mohammad. Missing or conflicting values were not guessed.
- Nine unresolved valid-profile records received provenance and review-status metadata only. Their style values remain unchanged. Future refresh protection preserves reviewed NULLs as well as known styles.
- Before/after hashes matched for all 89,045 unrelated matchup rows, 11,270 unrelated dismissal rows, 5,421 unrelated profile rows, and all 1,641 threat-score rows. NCCA and unrelated series intelligence were not regenerated.
- Verification: 51 API tests and 91 worker tests passed (142 total). A rollback-only database integration test confirmed all seven reviewed style columns and source evidence survive contradictory profile refreshes, while other cached profile fields can refresh. Original snapshots were restored exactly after that test.
- Desktop and mobile checks passed for the corrected missing-bowling and singleton-dismissal cards. Run-outs now use "Bowler style not applicable" rather than implying a bowling-style weakness.

Release state: production style metadata and scoped intelligence are updated. The API/report wording, parser correction, scoped-refresh code, and future-refresh safeguards are local changes and have not been committed, pushed, or deployed in this turn.

Pre-write snapshots and application receipts are retained outside Git at `/Users/artharun/Downloads/GAME-CHANGRS/local-backups/playoff-style-2026-10-04-1952/`. This is a local backup, not a OneDrive backup.

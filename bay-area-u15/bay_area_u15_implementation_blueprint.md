# Bay Area U15 Cricket Performance Intelligence Implementation Blueprint

## 1. Goal

Build a browser-assisted scraping and analytics pipeline for CricClubs that:

- starts from a single series URL
- auto-discovers the target U15 divisions
- enumerates all relevant matches
- pulls scorecard, commentary, team, and player data
- loads it into a cloud-friendly relational schema
- computes opponent-adjusted analytics and coach-facing outputs

This blueprint is written so it can be handed to another Codex environment and used as the working implementation plan.

## 2. Recommended Build Shape

### 2A. Core Principle

Do not treat CricClubs as a simple HTML site. Treat it as:

- a browser-first web app for discovery
- a source of internal JSON/XHR data once the session is established
- a scorecard and commentary source that still needs reconciliation

### 2B. Recommended Stack

| Layer | Recommended Choice |
|---|---|
| language | Python for ETL and analytics |
| browser automation | Playwright |
| schema migrations | SQL files plus optional Alembic or dbmate |
| cloud database | Supabase Postgres or managed Postgres |
| object storage | Supabase Storage |
| local scratch analysis | DuckDB |
| scheduling | GitHub Actions first, then Railway or Render worker if needed |
| frontend and dashboard | Lovable app connected to GitHub |

## 3. Repository Layout

| Path | Purpose |
|---|---|
| `apps/web` | Lovable-facing UI and dashboard app |
| `apps/worker` | scraper and ETL runner |
| `apps/worker/discovery` | series and division discovery logic |
| `apps/worker/extract` | raw page and raw JSON collection |
| `apps/worker/parse` | scorecard, stats, and commentary parsers |
| `apps/worker/load` | database loaders and upserts |
| `apps/worker/validate` | reconciliation checks and QA reports |
| `apps/worker/analytics` | advanced metrics and composite scores |
| `packages/db` | schema SQL, migrations, seed data |
| `config/leagues.yaml` | target series, divisions, and schedule config |
| `config/weights.yaml` | opponent weighting rules |
| `config/player_overrides.csv` | duplicate-name or manual mapping overrides |
| `storage/raw` | local raw snapshot mirror during development |
| `storage/exports` | local QA outputs during development |

## 4. Exact Auto-Discovery Workflow

This section describes the exact workflow for:

- what is detected from the series page
- how the 4 U15 divisions are locked
- how matches are enumerated
- how scorecard, commentary, team, and player data are loaded into the schema

### 4A. Input Contract

The system should accept this minimum input:

| Input | Example |
|---|---|
| `series_url` | `https://cricclubs.com/USACricketJunior/series-list/uMgpWfOUngCk4uXJEGyssQ?...` |
| `target_divisions` | `U15 Phase 1 Div 1`, `U15 Phase 1 Div 2`, `U15 Phase 2 Div 1`, `U15 Phase 2 Div 2` |
| `business_rules` | `Div 1 stronger than Div 2`, `Div 1 Phase 2 strongest` |
| `season_year` | `2026` |

### 4B. What To Detect From The Series Page

From the series page, detect and persist the following:

| Item | How To Detect | Store In |
|---|---|---|
| league name | path segment after domain, for example `USACricketJunior` | `series.league_name` |
| series id | path segment after `/series-list/` | `series.source_series_id` |
| series title | visible page title and header | `series.name` |
| year | page header or input parameter | `series.year` |
| series metadata | start date, format, ball type, category, level | `series` |
| presence of division switcher | visible `Change Division` or division selector | `discovery log` |
| stats navigation paths | `See all` actions for batting, bowling, rankings, fielding | `series` or `division` URLs |
| matches navigation path | `Matches -> Results` route | `series.results_base_url` |

#### Practical Detection Sequence

1. Open the top-level `series_url` in Playwright with a desktop browser profile.
2. Wait for `networkidle`.
3. Capture:
   - final URL
   - page title
   - visible series metadata
   - text labels for stats sections
   - visible controls like `Change Division` and `See all`
4. Intercept network requests while the page loads.
5. Save:
   - raw HTML snapshot
   - browser request log
   - browser response log for relevant CricClubs endpoints

### 4C. How To Lock Onto The 4 U15 Divisions

This is the exact lock-on workflow.

#### Step 1. Reach A Stats Page From The Series Page

Use one of the `See all` actions from the series page to reach a stats view such as:

- batting records
- bowling records
- fielding records
- rankings

Batting records is the best default because it clearly exposes division, team, year, and series selectors.

#### Step 2. Read The Division Selector

On the stats page:

1. locate the division dropdown
2. open the dropdown
3. read all visible division labels
4. normalize labels using:
   - trim whitespace
   - collapse repeated spaces
   - preserve case-insensitive matching

#### Step 3. Match Exact Target Labels

Filter the discovered labels to these exact targets:

- `U15 Phase 1 Div 1`
- `U15 Phase 1 Div 2`
- `U15 Phase 2 Div 1`
- `U15 Phase 2 Div 2`

If all 4 are present, mark discovery successful.

If one or more are missing:

- record a data quality warning
- stop the production run
- allow manual fallback mapping if needed

#### Step 4. Resolve Internal Division Identifiers

For each target division:

1. select the division from the dropdown in the browser
2. intercept the XHR requests triggered by the selection
3. capture:
   - internal `divisionId`
   - resolved stats URL
   - series id and league id used in requests
   - any division-specific team or match endpoints

Persist these into the `division` table as the canonical discovery result.

#### Step 5. Assign Business Strength Tiers

After division discovery, assign:

| Division | Strength Tier |
|---|---|
| `U15 Phase 1 Div 1` | strong |
| `U15 Phase 2 Div 1` | strongest |
| `U15 Phase 1 Div 2` | developing |
| `U15 Phase 2 Div 2` | developing or medium depending on later calibration |

Store this in:

- `division.strength_tier`
- `config/weights.yaml`

### 4D. How To Enumerate All Matches

After division lock-on, enumerate matches for each target division.

#### Step 1. Reach The Results Page

Either:

- navigate from the series page through `Matches -> Results`

or

- construct the results page URL using discovered parameters:
  - `leagueId`
  - `year`
  - `series`
  - `seriesName`

#### Step 2. Discover The Match Enumeration Mechanism

Use the browser to inspect the requests triggered by the results page. Prefer the structured XHR path when available.

Observed pattern:

- `core/public/series/{seriesId}/division/{divisionId}/matches?...&page={n}&size={m}`

#### Step 3. Enumerate Pages

For each of the 4 target divisions:

1. request page 1
2. parse the response
3. continue paging until:
   - no records are returned
   - returned page count is less than page size
   - an explicit last-page signal is observed

#### Step 4. Persist Match Inventory

For each discovered match, persist:

| Field | Target Table |
|---|---|
| source match id | `match.source_match_id` |
| division id | `match.division_id` |
| series id | `match.series_id` |
| date and time | `match.match_date`, `match.match_datetime` |
| venue | `match.venue` |
| team names or ids | `team`, `match.team1_id`, `match.team2_id` |
| result text | `match.result_text` |
| status | `match.status` |
| scorecard URL | `match.scorecard_url` |
| ball-by-ball URL | `match.ball_by_ball_url` |

#### Step 5. Save Raw Match Inventory

Store:

- raw results page HTML
- raw XHR response JSON
- normalized match inventory extract

This makes reprocessing easy if parsing rules change later.

### 4E. How To Pull Team Data

Use the series-level and division-level team endpoints discovered during browser inspection.

#### Preferred Sources

| Source | Use |
|---|---|
| series teams endpoint | canonical team list for the series |
| division teams endpoint | team participation by division |
| results cards | fallback for team names and abbreviations |
| scorecards | final fallback if team lists are incomplete |

#### Load Sequence

1. upsert teams into `team`
2. create or update `team_season_competition`
3. assign division participation through `team_division_entry`
4. store team aliases when abbreviations differ from full names

### 4F. How To Pull Player Data

Players should be discovered from multiple sources, in this order:

| Source | Why |
|---|---|
| scorecard player links | most reliable source of player ids |
| batting, bowling, fielding stats pages | broad coverage across the division |
| commentary references | good for abbreviated names and role context |
| user profile page | optional metadata enrichment |

#### Load Sequence

1. extract all player links from scorecards and stats tables
2. parse the internal player identifier from `/user/{playerId}`
3. upsert into `player`
4. store display names and abbreviations in `player_alias`
5. create or update `team_membership`
6. attach source confidence and manual review flags if matching is uncertain

### 4G. How To Pull Scorecard Data Into The Schema

For each enumerated match:

#### Step 1. Open Match Page

Load:

- match page URL `/results/{matchId}`

Capture:

- raw HTML
- request log
- scorecard-related XHR responses

#### Step 2. Preferred Structured Sources

Use these structured requests when available:

| Endpoint Type | Load Into |
|---|---|
| match info | `match` |
| scorecard header | `match`, `innings` |
| full scorecard | `innings`, `batting_innings`, `bowling_spell`, `fielding_event` |

#### Step 3. Parse And Load

Load in this order:

1. upsert `match`
2. upsert `innings`
3. upsert `batting_innings`
4. upsert `bowling_spell`
5. upsert `fielding_event`
6. capture unresolved names into `data_quality_issue`

### 4H. How To Pull Commentary Into The Schema

For each enumerated match:

#### Step 1. Pull Commentary Source

Preferred source:

- commentary XHR endpoint from the match page

Fallback source:

- `?tab=ball_by_ball` route if direct XHR cannot be reused

#### Step 2. Store Raw Commentary

Save:

- raw commentary JSON
- raw commentary HTML fallback
- source timestamp

#### Step 3. Parse To `ball_event`

Each delivery becomes one row in `ball_event`.

Parse:

- innings number
- over number
- ball number
- striker
- non-striker
- bowler
- batter runs
- extras
- extra type
- total runs
- wicket flag
- dismissal type
- player out
- fielder
- commentary text
- phase

#### Step 4. Cricket-Specific Parsing Rules

Handle these explicitly:

- byes and leg-byes do not count as batter runs
- wides and no-balls affect extras and total runs
- run out does not count as a bowler-earned wicket
- retired hurt is not treated like a normal dismissal
- over summaries should not be loaded as ball events

#### Step 5. Reconcile Against Scorecard

After commentary load:

1. sum `ball_event.total_runs` by innings
2. compare against `innings.total_runs`
3. compare wicket counts
4. compare batter runs by player against scorecard innings
5. compare bowler runs and wickets against bowling figures where possible

Persist any mismatches to `data_quality_issue`.

## 5. End-To-End Load Workflow By Table

| Stage | Tables |
|---|---|
| discovery | `series`, `division`, `ingest_run`, `raw_artifact` |
| competition context | `team`, `team_division_entry`, `team_season_competition` |
| player identity | `player`, `player_alias`, `team_membership` |
| standings and stats snapshots | `team_strength_snapshot`, `player_stats_snapshot`, `player_strength_snapshot` |
| match inventory | `match` |
| scorecard facts | `innings`, `batting_innings`, `bowling_spell`, `fielding_event` |
| commentary facts | `ball_event`, `over_summary` |
| validation | `data_quality_issue` |
| analytics | `player_match_advanced`, `player_matchup`, `player_season_advanced`, `player_composite_score` |

## 6. Worker Execution Plan

### Phase 1. Discovery Worker

Inputs:

- series URL
- season year
- target divisions

Outputs:

- series metadata
- division mapping
- results and stats URLs
- raw discovery artifacts

### Phase 2. Snapshot Worker

Outputs:

- batting stats snapshots
- bowling stats snapshots
- fielding stats snapshots
- rankings snapshots
- points or standings snapshots if available

### Phase 3. Match Inventory Worker

Outputs:

- all match rows for each target division
- match URLs
- raw match listing artifacts

### Phase 4. Match Detail Worker

Outputs:

- raw scorecard artifacts
- raw commentary artifacts
- normalized innings, batting, bowling, fielding, and ball-event rows

### Phase 5. Validation Worker

Outputs:

- reconciliation summary
- mismatch flags
- unmatched player alias list

### Phase 6. Analytics Worker

Outputs:

- opponent-adjusted metrics
- player matchup tables
- development and consistency metrics
- composite scores

### Phase 7. Report Worker

Outputs:

- cached JSON payloads
- generated PDFs
- downloadable cloud storage artifacts

## 7. Cloud Execution Strategy

### Recommended Production Split

| Job Type | Where It Should Run |
|---|---|
| Playwright discovery and scrape | worker environment |
| parsing and ETL | worker environment |
| analytics recompute | worker environment |
| PDF generation | worker environment |
| dashboard and player search | Lovable app |
| file downloads | storage-backed app routes |

### Suggested Schedule

| Job | Cadence |
|---|---|
| full weekly scrape | Sunday 11 PM Pacific |
| targeted match backfill | on demand |
| player report refresh | after analytics recompute |
| health check | daily |

## 8. Executive Dashboard And Report Design Requirements

The selector-facing output should follow these application design rules.

### 8A. Assessment Snapshot

The executive report should show all four skill areas:

- batting
- bowling
- fielding
- wicketkeeping

Even when a player is clearly being selected for one dominant skill, the report should still present the full skill profile for completeness.

### 8B. Composite Score And Recommendation

The composite selector score and top-line recommendation should remain anchored to the player’s **primary role**.

That means:

- bowlers should be primarily judged as bowlers
- batters should be primarily judged as batters
- fielding and wicketkeeping should support the evaluation rather than overpower the main role-based selection case

### 8C. Standard Stats Display

The executive report should include standard CricClubs stats in two views:

- current series stats
- overall CricClubs stats

These should be presented for:

- batting
- bowling
- fielding

Preferred presentation:

- summary tiles
- grouped panels
- visually scannable cards

Avoid relying only on dense tables for these standard stats.

### 8D. Visual Interpretation Layer

The selector interpretation section should be fast to scan and visual.

Preferred treatment:

- interpretation cards instead of plain tables where possible
- short labels such as `Strong`, `Ready`, `Watch`, `Improving`
- one-line or two-line selector-friendly assessment copy

### 8E. Required Executive UI Elements

The selector dashboard should also support:

- a top-right recommendation badge such as `Strong Consideration`
- a peer comparison strip for 2 to 3 comparable players
- mini trend graphics for:
  - recent form
  - strong-opposition performance

These are not just nice-to-have mockup features. They should be treated as part of the executive report design brief.

## 9. Validation Checklist

Before calling the pipeline production-ready, verify:

| Check | Pass Condition |
|---|---|
| division discovery | all 4 U15 divisions found |
| match coverage | match counts align with visible results pages |
| player identity | no unresolved duplicate names in target reports |
| innings totals | commentary and scorecard totals reconcile |
| wickets | commentary wickets reconcile to scorecard dismissals |
| bowling figures | spell totals reconcile to scorecard bowling rows |
| sample reports | known players produce believable outputs |

## 10. First Practical Build Order

Build in this order:

1. discovery module
2. division lock-on module
3. results enumeration module
4. match scorecard loader
5. commentary loader
6. reconciliation checks
7. advanced metrics
8. PDF and Lovable app integration

## 11. Deliverables To Hand Off To Another Codex Environment

The minimum handoff bundle should include:

| Artifact | Purpose |
|---|---|
| `bay_area_u15_cricket_plan.md` | strategy and architecture |
| `bay_area_u15_implementation_blueprint.md` | exact execution workflow |
| `bay_area_u15_schema.sql` | first-pass production schema |
| `config/leagues.yaml` | target series and division config |
| `config/weights.yaml` | weighting rules |
| `config/player_overrides.csv` | name-resolution overrides |

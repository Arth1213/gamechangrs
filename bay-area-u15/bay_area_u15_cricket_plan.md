# Bay Area U15 Cricket Performance Intelligence Plan

## 1. Player Stats By Role

The right way to think about this is:

- Layer 1: raw standard stats from CricClubs
- Layer 2: match-by-match validated stats from scorecards
- Layer 3: ball-by-ball derived stats
- Layer 4: opponent-adjusted and matchup stats
- Layer 5: development and consistency stats

### 1A. Universal Player Profile Fields

| Category | Fields to Capture |
|---|---|
| Identity | `player_id`, full name, display name, short name variants, canonical name |
| Team Context | `team_id`, team name, division, phase, season, series |
| Role Context | primary role, batting role, bowling role, wicketkeeper flag, captain flag |
| Metadata | batting style, bowling style, player page URL if available |
| Tracking | first seen date, last seen date, source page, source snapshot timestamp |
| Quality | name-match confidence, duplicate-name override flag, manual review flag |

### 1B. Standard Batting Stats

| Stat Group | Fields |
|---|---|
| Volume | matches, innings, not outs, runs, balls faced |
| Outcome | highest score, average, strike rate |
| Scoring Pattern | fours, sixes, boundary runs |
| Milestones | 30s, 50s, 100s if present |
| Ranking | batting rank/position if shown on stats page |
| Snapshot Context | division, phase, series, snapshot date |

### 1C. Standard Bowling Stats

| Stat Group | Fields |
|---|---|
| Volume | matches, innings, overs, balls bowled |
| Outcome | wickets, runs conceded, maidens |
| Efficiency | economy, bowling average, strike rate |
| Peak | best bowling figures |
| Milestones | 3W, 5W if present |
| Ranking | bowling rank/position if shown |
| Snapshot Context | division, phase, series, snapshot date |

### 1D. Standard Fielding Stats

| Stat Group | Fields |
|---|---|
| Dismissals | catches, wicketkeeper catches, stumpings |
| Run Out Contribution | direct run outs, indirect run outs |
| Total Impact | total dismissals / total fielding events |
| Ranking | fielding rank/position if shown |
| Snapshot Context | division, phase, series, snapshot date |

### 1E. Match-Level Batting Stats

| Category | Fields |
|---|---|
| Basic | match id, innings no, batting position, runs, balls, not out flag |
| Dismissal | dismissal type, dismissed by bowler, fielder involved |
| Scoring Split | 0s, 1s, 2s, 3s, 4s, 6s |
| Pressure Context | score when player arrived, wickets fallen, chase/defend, target, required rate |
| Phase Split | powerplay runs/balls, middle runs/balls, death runs/balls |
| Match Value | runs share of innings, top-score flag, chase contribution |

### 1F. Match-Level Bowling Stats

| Category | Fields |
|---|---|
| Basic | match id, innings no, overs, balls, maidens, wickets, runs conceded |
| Extras | wides, no-balls, byes allowed context, leg-byes allowed context |
| Ball Outcomes | dot balls, singles conceded, doubles, triples, fours conceded, sixes conceded |
| Wicket Detail | bowled, caught, LBW, run-out involvement, stumping-assisted wickets |
| Spell Context | opening spell, middle spell, death spell, score when introduced |
| Match Value | wickets share, economy vs innings economy, pressure overs |

### 1G. Match-Level Fielding Stats

| Category | Fields |
|---|---|
| Basic | catches, keeper catches, stumpings, direct run outs, indirect run outs |
| Context | batter dismissed, innings phase, wicket importance |
| Opportunity | chance involvement count if inferable |
| Match Value | dismissal impact score |

### 1H. Ball-by-Ball Derived Stats

These are the most important value-add stats.

#### Batter Ball-by-Ball Metrics

| Metric | Meaning |
|---|---|
| balls faced | legal deliveries faced |
| batter runs | only runs off the bat |
| strike rate by phase | powerplay, middle, death |
| dot-ball % | dots / balls faced |
| boundary-ball % | boundaries / balls faced |
| singles rotation % | singles / balls faced |
| control proxy | non-dismissal, productive-ball ratio |
| dismissal rate | dismissals / balls faced |
| scoring pattern split | % of runs in 1s, 2s, boundaries |
| boundary dependency | % of total runs from 4s/6s |
| pressure batting | scoring rate under high required rate or collapse conditions |
| vs bowler matchup stats | runs, balls, dismissal count, boundary rate, dot % against each bowler |

#### Bowler Ball-by-Ball Metrics

| Metric | Meaning |
|---|---|
| legal balls bowled | valid deliveries |
| batter runs conceded | runs off the bat only |
| total runs conceded | includes applicable extras |
| dot-ball % | dots / legal balls |
| wicket-ball % | wickets / legal balls |
| boundary conceded % | boundaries conceded / legal balls |
| false shot proxy | low-scoring pressure balls |
| economy by phase | powerplay, middle, death |
| pressure overs | overs with low runs and/or wicket events |
| set-batter control | performance vs batters after 10+ balls faced |
| new-batter impact | performance vs batters in first 5 balls faced |
| vs batter matchup stats | balls, runs conceded, wickets, dot %, boundary % against each batter |

#### Ball Event Fields Used To Derive These

| Field | Why It Matters |
|---|---|
| over, ball | event sequence |
| striker, non-striker, bowler | matchup analysis |
| batter runs | batter credit |
| extras | innings total |
| extra type | wide, no-ball, bye, leg-bye logic |
| total runs | scoreboard reconciliation |
| wicket flag | dismissal event |
| dismissal type | bowler credit vs team fielding event |
| player out | player-level dismissal tracking |
| fielder | fielding attribution |
| commentary text | traceability and parser fallback |
| phase | powerplay, middle, death |
| score state | pressure/leverage metrics |
| wickets in hand | leverage and context |

### 1I. Opponent-Adjusted Derived Stats

These are the true impact stats.

#### Team-Strength Adjusted

| Metric | Meaning |
|---|---|
| batting runs vs strong teams | runs weighted by opponent team strength |
| bowling wickets vs strong teams | wickets weighted by batting team strength |
| strike rate vs Div 1 | batter output against stronger division |
| economy vs Div 1 | bowler control against stronger division |
| top-team performance index | output against top N teams only |
| pressure contribution vs strong teams | performance in high-value situations vs strong opposition |

#### Player-vs-Player Adjusted

| Metric | Meaning |
|---|---|
| runs vs elite bowlers | batter output weighted by bowler strength tier |
| wickets of elite batters | bowler dismissals weighted by batter strength tier |
| dot % vs elite batters | bowler control against top batters |
| dismissal rate vs elite bowlers | batter resilience against top bowlers |
| matchup quality index | quality-adjusted head-to-head score |
| weighted boundary rate | boundary scoring/conceding adjusted by opponent quality |

#### Suggested Strength Inputs

| Strength Type | Input |
|---|---|
| Team strength | division premium, points table rank, wins, NRR |
| Batter strength | percentile from batting leaderboard plus role context |
| Bowler strength | percentile from bowling leaderboard plus role context |
| Fielding strength | fielding leaderboard or team dismissal contribution |
| Match leverage | phase, wickets in hand, score pressure, chase pressure |

### 1J. Development and Consistency Stats

These help coaches most.

| Category | Metrics |
|---|---|
| Recent Form | last 3 matches, last 5 matches, rolling average, rolling strike rate, rolling economy |
| Consistency | variance of runs, variance of wickets, consistency score, floor vs ceiling performance |
| Improvement | first-half vs second-half of season, phase 1 vs phase 2 trend |
| Strong-Opposition Growth | performance trend vs Div 1 or top teams over time |
| Match Impact | contribution in wins vs losses, impact in close games |
| Role Development | batting position changes, bowling usage changes, phase responsibility changes |
| Clutch Indicators | wickets of top-order batters, chase contributions, death-over performance |
| Sample Quality | matches played, innings count, valid ball sample size, confidence score |

## 2. Database Schema

I would use a normalized core schema plus a few analytics tables or materialized views.

### 2A. Core Reference Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `series` | one competition series | `series_id`, name, year, series_url |
| `division` | division/phase grouping | `division_id`, `series_id`, name, phase_name, division_name, strength_tier |
| `team` | teams in a series/division | `team_id`, name, short_name |
| `player` | canonical player entity | `player_id`, canonical_name, display_name, batting_style, bowling_style |
| `team_season_roster` | player-team membership by season/division | `roster_id`, `player_id`, `team_id`, `division_id`, role flags |

### 2B. Snapshot Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `team_strength_snapshot` | team strength inputs at a point in time | `snapshot_id`, `team_id`, `division_id`, points, wins, nrr, rank, strength_score |
| `player_strength_snapshot` | player strength tier at a point in time | `snapshot_id`, `player_id`, `division_id`, batting_pctile, bowling_pctile, fielding_pctile, tier |
| `player_stats_snapshot` | raw standard stats exactly as seen on stats pages | `snapshot_id`, `player_id`, `division_id`, stat_type, all raw fields, snapshot_ts |

### 2C. Match Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `match` | one match record | `match_id`, `series_id`, `division_id`, date, venue, status, result_text, team1_id, team2_id, winner_team_id |
| `innings` | one innings within a match | `innings_id`, `match_id`, innings_no, batting_team_id, bowling_team_id, total_runs, wickets, overs, balls |
| `batting_innings` | one player batting card row | `batting_innings_id`, `innings_id`, `player_id`, batting_position, runs, balls, dismissal_type, bowler_id, fielder_id |
| `bowling_spell` | one player bowling card row | `bowling_spell_id`, `innings_id`, `player_id`, overs, balls, maidens, runs, wickets, wides, no_balls |
| `fielding_event` | fielding dismissal attributions | `fielding_event_id`, `match_id`, `innings_id`, fielder_id, dismissal_type, player_out_id, bowler_id, over_ball |

### 2D. Ball-Level Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `ball_event` | one delivery-level event | `ball_event_id`, `match_id`, `innings_id`, over_no, ball_no, striker_id, non_striker_id, bowler_id, batter_runs, extras, extra_type, total_runs, wicket_flag, dismissal_type, player_out_id, fielder_id, commentary_text, phase |
| `over_summary` | optional speed layer for over-level analysis | `over_summary_id`, `match_id`, `innings_id`, over_no, bowler_id, runs, wickets, dots, boundaries |
| `match_commentary_raw` | raw commentary chunks for traceability | `raw_id`, `match_id`, page_url, raw_html_path, parsed_flag |

### 2E. Derived Analytics Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `player_match_advanced` | advanced metrics per player per match | `player_match_adv_id`, `match_id`, `player_id`, role_type, advanced metric columns |
| `player_matchup` | player-vs-player aggregates | `matchup_id`, `series_id`, batter_id, bowler_id, balls, runs, wickets, dots, boundaries |
| `player_season_advanced` | season-level advanced stats | `player_season_adv_id`, `player_id`, `division_id`, role_type, advanced metric columns |
| `player_composite_score` | final coach-facing score | `score_id`, `player_id`, `division_id`, batting_score, bowling_score, fielding_score, composite_score, percentile |
| `data_quality_issue` | reconciliation and parsing flags | `issue_id`, entity_type, entity_id, issue_type, severity, details |

### 2F. Key Relationships

| From | To | Relationship |
|---|---|---|
| `series` | `division` | one-to-many |
| `division` | `match` | one-to-many |
| `team` | `match` | many-to-many through team1/team2 |
| `player` | `team_season_roster` | one-to-many |
| `match` | `innings` | one-to-many |
| `innings` | `batting_innings` | one-to-many |
| `innings` | `bowling_spell` | one-to-many |
| `innings` | `ball_event` | one-to-many |
| `player` | `ball_event` | referenced as striker/non-striker/bowler/player_out/fielder |
| `player` | `player_stats_snapshot` | one-to-many |
| `player` | `player_match_advanced` | one-to-many |
| `player` | `player_season_advanced` | one-to-many |
| `player` | `player_matchup` | many-to-many via batter/bowler roles |

## 3. High-Level Extraction Flow

### 3A. High-Level First

1. Read the top-level series page and discover the series metadata and all division/phase links.
2. Discover all relevant match and stats pages for each division/phase.
3. Store raw page snapshots before parsing.
4. Parse standard stats pages into snapshot tables.
5. Parse match scorecards into match, innings, batting, bowling, and fielding tables.
6. Parse ball-by-ball commentary into structured `ball_event` rows.
7. Reconcile ball-by-ball against innings and scorecard totals.
8. Compute advanced metrics.
9. Compute opponent-adjusted scores.
10. Publish outputs for database, API, dashboard, and reports.

### 3B. Practical Notes

- Raw capture always comes before parsing.
- Scorecard and commentary must both be stored.
- Ball-by-ball parsing must separate `batter_runs` from `extras`.
- Reconciliation is mandatory before analytics are trusted.
- All derived scores should be versioned so weight changes are traceable.

## 4. Inputs Needed To Reuse This Across Leagues

Ideally, you should be able to provide just the top-level series page and let the system discover the rest.

### 4A. Minimum Inputs

| Input | Required? | Why |
|---|---|---|
| top-level series URL | Yes | starting point for discovery |
| season/year | Usually yes | helps filtering and labeling |
| target age group or team segment | Yes | for example `U15` |
| target phases/divisions | Optional but strongly recommended | for example `Phase 1 Div 1`, `Phase 1 Div 2`, `Phase 2 Div 1`, `Phase 2 Div 2` |
| club/series label | Optional | naming and output organization |

### 4B. Helpful Inputs

| Input | Why It Helps |
|---|---|
| one or two sample player names | useful for validation and test reports |
| known strong divisions | for example `Div 1` stronger than `Div 2` |
| preferred weighting rules | team/division premium and elite thresholds |
| expected output type | database only, dashboard, PDF, or API |
| run frequency | one-time or weekly refresh |
| manual player-name overrides | avoids identity mismatches |

### 4C. What The System Should Auto-Discover

If the site structure cooperates, from the top-level series page the scraper should discover:

- all divisions and phases
- division stats pages
- results pages
- match URLs
- scorecard URLs
- ball-by-ball URLs
- team links
- player links if available

### 4D. When More Inputs May Be Needed

| Situation | Extra Input Needed |
|---|---|
| duplicate player names | manual mapping file |
| inconsistent division labels | target division aliases |
| missing player/team metadata | optional override table |
| custom weighting | config file with formulas and thresholds |
| site access challenges | browser session or cookie-based scrape mode |

### 4E. Verified Auto-Discovery Findings For Bay Area Hub

The following was validated in a live browser-assisted inspection of the 2026 Bay Area USAC Hub series and related pages.

#### Input Model That Works

| Input Type | Value |
|---|---|
| Series URL | `https://cricclubs.com/USACricketJunior/series-list/uMgpWfOUngCk4uXJEGyssQ?divisionId=Bo-G1A7_UwgUN13_EOMC7g%3Fyear%3Dundefined&seriesName=2026%2520Bay%2520Area%2520USAC%2520Hub` |
| Target Filters | `U15 Phase 1 Div 1`, `U15 Phase 1 Div 2`, `U15 Phase 2 Div 1`, `U15 Phase 2 Div 2` |
| Business Rules | `Div 1 stronger than Div 2`; `Div 1 Phase 2 strongest` |

#### What Was Confirmed

| Discovery Item | Status | Notes |
|---|---|---|
| series page loads | Yes | confirmed in real browser session |
| divisions and phases | Yes | discovered through live division dropdown |
| division stats pages | Yes | reachable through `See all` actions on the series page |
| results page | Yes | reachable through the `Matches -> Results` navigation |
| match URLs | Yes | exposed on the results page as `/results/{matchId}` |
| scorecard data | Yes | present on match pages and loaded via internal requests |
| ball-by-ball data | Yes | commentary is loaded for match pages |
| team data | Yes | discoverable from series-level requests |
| player links | Yes | visible on scorecard pages as `/user/{playerId}` links |

#### Important Caveat

This should not be implemented as a plain `requests` or `curl` scraper. Direct fetches can hit anti-bot protection. The reliable approach is:

1. use a real browser session for discovery and session establishment
2. observe the internal XHR or fetch calls the site itself makes
3. call those structured endpoints where possible
4. fall back to DOM parsing only when necessary

#### Exact Division Options Confirmed

The live division selector exposed these options:

- `U15 Phase 1 Div 1`
- `U15 Phase 1 Div 2`
- `U15 Phase 2 Div 1`
- `U15 Phase 2 Div 2`

#### Concrete URL Patterns Confirmed

| Item | Pattern |
|---|---|
| Series page | `/USACricketJunior/series-list/{seriesId}` |
| Results page | `/USACricketJunior/results?leagueId={leagueId}&year={year}&series={seriesId}&division=all&seriesName={seriesName}` |
| Match page | `/USACricketJunior/results/{matchId}` |
| Stats pages | `/USACricketJunior/statistics/batting-records`, `/bowling-records`, `/fielding-records`, `/rankings-records` |
| Player profile links | `/USACricketJunior/user/{playerId}` |

#### Internal Data Calls Observed

These patterns were observed during live page navigation and are strong candidates for structured extraction:

| Purpose | Endpoint Pattern |
|---|---|
| league info | `core/public/league/USACricketJunior/info` |
| years | `core/public/league/{leagueId}/years` |
| current series | `core/public/league/{leagueId}/series/current` |
| series teams | `core/public/series/{seriesId}/teams?leagueId={leagueId}&year={year}` |
| division teams | `core/public/series/division/{divisionId}/teams?leagueId={leagueId}&year={year}` |
| division matches | `core/public/series/{seriesId}/division/{divisionId}/matches?...` |
| batting stats | `core/public/stats/getBattingStats?...` |
| match info | `core/public/match/getMatchInfo?clubId={leagueId}&matchId={matchId}` |
| match scorecard header | `core/public/series/match/{matchId}/scorecard/header?leagueId={leagueId}` |
| match scorecard | `core/public/series/match/{matchId}/scorecard?leagueId={leagueId}` |
| match commentary | `core/public/series/match/{matchId}/scorecard/commentary?leagueId={leagueId}` |

#### Practical Meaning

This means the ideal workflow is realistic:

1. provide one top-level series URL
2. provide target division filters
3. provide business rules
4. let the system auto-discover the rest through browser-assisted discovery and structured endpoint extraction

## 5. How I Will Execute It

I would execute this in phases so we reduce risk early.

### Phase 1. Discovery and POC

- Input one Bay Area Hub series page.
- Discover all U15 Phase 1/2 Div 1/2 links.
- Store raw HTML for stats pages and 2 to 3 matches.
- Parse one sample match fully, including ball-by-ball.

### Phase 2. Core Data Model

- Build core tables for series, division, team, player, match, innings, batting, bowling, fielding, and ball events.
- Load standard stats snapshots.
- Load parsed match data.

### Phase 3. Validation

- Reconcile innings totals.
- Reconcile wickets and overs.
- Flag missing or ambiguous player mappings.
- Produce a quality report.

### Phase 4. Advanced Analytics

- Build ball-by-ball derived stats.
- Build opponent-adjusted metrics.
- Build matchup tables.
- Build development and consistency metrics.

### Phase 5. Coach Outputs

- Produce player-level summary tables.
- Generate JSON for dashboard/API.
- Generate PDF reports.
- Add ranking and percentile outputs.

### Phase 6. Automation

- Add repeatable run config.
- Add scheduled refresh.
- Add error logging and data quality alerts.

### Execution Notes Specific To CricClubs

| Area | Recommended Approach |
|---|---|
| discovery | Playwright browser session |
| bulk structured pulls | use the internal XHR or fetch endpoints after discovery |
| anti-bot handling | desktop user agent, persistent session, polite delays, retries |
| raw evidence retention | save raw HTML and raw JSON responses before parsing |
| parser strategy | prefer JSON payload parsing over DOM scraping when both are available |
| data trust | reconcile commentary totals with scorecards before publishing derived metrics |

## 6. What I Will Need

### 6A. Technical Needs

| Need | Why |
|---|---|
| browser automation tool | CricClubs may require real browser navigation |
| local or hosted database | DuckDB for POC, Postgres for multi-user deployment |
| file storage for raw snapshots | keeps source-of-truth pages for reprocessing |
| parser pipeline | converts raw pages to structured tables |
| scheduler | weekly refreshes |
| reporting layer | PDF/API/dashboard generation |

### 6B. Business Inputs From You

| Need | Why |
|---|---|
| exact target series URL | starting point |
| target divisions/phases | tells us what to include |
| rule that Div 1 is stronger | feeds weighting |
| preferred strength thresholds | elite/strong/developing definitions |
| example players to validate | sanity checks with real expectations |
| coach interpretation preferences | helps tune composite scores |

### 6C. Validation Inputs

| Need | Why |
|---|---|
| 2 to 3 players you know well | compare system output to real cricket judgment |
| a few matches you trust | anchor tests |
| expected good-day and bad-day examples | helps calibrate advanced metrics |
| duplicate-name corrections | keeps player identity clean |

### 6D. Optional But Very Useful

| Need | Why |
|---|---|
| access to prior manual score sheets | helps verify edge cases |
| coach notes by player | future calibration |
| roster files | improves player-team matching |
| preferred report format | lets me shape outputs for actual use |

### 6E. Additional Technical Needs For This Site

| Need | Why |
|---|---|
| Playwright or equivalent browser automation | top-level discovery and anti-bot resilience |
| persistent browser profile or cookies | stabilizes repeated runs if the site challenges fresh sessions |
| raw JSON snapshot store | internal data calls are likely better than DOM parsing for repeatability |
| manual mapping table | protects against duplicate player names and abbreviated scorecard names |
| scheduled worker environment | Playwright scraping should run outside the frontend app runtime |

## 7. Recommended Storage And Deployment Architecture

Because you want to build locally on your MacBook with Codex and then use GitHub plus Lovable for cloud delivery, the architecture should separate:

- application code
- structured analytics database
- raw scrape artifacts
- scheduled scraping and ETL workers
- the Lovable-hosted frontend or app experience

### 7A. Recommended Production Shape

| Layer | Recommended Choice | Why |
|---|---|---|
| source code | GitHub | single source of truth for app and pipeline code |
| frontend and app UX | Lovable connected to GitHub | easy UI iteration and deployment workflow |
| primary database | managed Postgres, preferably Supabase Postgres | cloud accessible, relational, SQL-friendly, works well with Lovable-style stacks |
| file storage | Supabase Storage for raw snapshots and generated PDFs | keeps files near the database and easy to access from the app |
| scraper and ETL runner | GitHub Actions for scheduled jobs initially; move to Railway, Render, or Fly.io worker if runtime grows | Playwright scraping should not depend on browser execution inside the frontend app |
| local development cache | DuckDB optional | fast local analysis and debugging without replacing the cloud source of truth |

### 7B. Recommended Data Placement

| Data Type | Where To Store It | Notes |
|---|---|---|
| normalized tables | Postgres | main source for app queries and reports |
| raw HTML snapshots | object storage | store by series, division, match, page type, timestamp |
| raw JSON or XHR responses | object storage | especially useful when internal endpoints are available |
| generated PDFs | object storage | persist and cache downloadable coach reports |
| temporary local analysis outputs | DuckDB or local files | useful during development only |
| config files | GitHub repo | versioned weights, target leagues, mappings |

### 7C. Why Postgres Or Supabase Is Better Than DuckDB For Cloud Use

| Option | Good For | Limitation |
|---|---|---|
| DuckDB only | local prototyping, exploratory analytics, one-user workflows | not ideal as the shared production database behind Lovable |
| Postgres only | production relational system | needs separate storage and auth decisions |
| Supabase Postgres plus Storage | best default for this project | gives database, storage, auth, and server-side functions in one cloud platform |

#### Recommendation

Use:

- `Supabase Postgres` for the core relational schema
- `Supabase Storage` for raw scrape artifacts and generated PDFs
- `GitHub` for source code and configuration
- `Lovable` for app or dashboard generation and GitHub-linked deployment
- `Playwright worker` running from GitHub Actions or a small worker host for weekly scraping

### 7D. Recommended Environment Strategy

| Environment | What Lives There |
|---|---|
| local MacBook | Codex development, parser iteration, local test runs, DuckDB scratch analysis |
| GitHub | app code, ETL code, migrations, configs, CI |
| cloud database | canonical structured data |
| cloud storage | raw snapshots, PDFs, exports |
| scheduled worker | weekly scrape, ETL, recompute, report refresh |
| Lovable app | dashboard, search, report download, admin views |

### 7E. Recommended Execution Split

Do not make the Lovable app itself responsible for doing the heavy scraping.

Instead:

1. scraper worker collects raw series, division, match, scorecard, and commentary data
2. ETL job parses and validates data into Postgres
3. analytics job computes advanced metrics and composite scores
4. report job generates PDFs and stores them in cloud storage
5. Lovable app reads from Postgres and Storage, then serves dashboards and downloads

This split is more reliable because browser scraping and long ETL jobs are operational workloads, not frontend-app responsibilities.

### 7F. Suggested Folder And Storage Layout

#### Repo layout

| Path | Purpose |
|---|---|
| `apps/web` | Lovable-facing frontend or dashboard code |
| `apps/worker` | scraping and ETL worker |
| `packages/db` | schema, migrations, seed scripts |
| `packages/analytics` | metric computation logic |
| `config/leagues.yaml` | series and division targeting |
| `config/weights.yaml` | weighting rules |
| `config/player_overrides.csv` | duplicate name or mapping overrides |

#### Object storage layout

| Prefix | Purpose |
|---|---|
| `raw/series/{series_id}/overview/{timestamp}` | series snapshots |
| `raw/division/{division_id}/stats/{stat_type}/{timestamp}` | stats snapshots |
| `raw/match/{match_id}/scorecard/{timestamp}` | scorecard raw files |
| `raw/match/{match_id}/commentary/{timestamp}` | commentary raw files |
| `reports/player/{player_id}/{report_version}.pdf` | generated player reports |
| `exports/{run_id}/` | ad hoc exports and QA outputs |

### 7G. Recommended Rollout Path

| Stage | Storage Choice | Why |
|---|---|---|
| POC | local files plus DuckDB plus optional Postgres mirror | fastest iteration |
| early shared use | Supabase Postgres plus Supabase Storage | easiest cloud-accessible setup |
| scaled production | Supabase or managed Postgres plus object storage plus dedicated worker host | best long-term reliability |

### 7H. Final Recommendation

For your setup, the best default is:

- build locally on your MacBook using Codex
- keep the repo in GitHub
- use Supabase as the cloud database and storage layer
- use Lovable for the UI or dashboard on top of that data
- run scraping and ETL as a separate scheduled worker, not inside the Lovable app runtime

That gives you:

- easy local development
- a cloud-accessible database
- durable raw storage
- a clean path for Lovable to consume and present the data
- flexibility to move off Lovable later if needed

## Recommendation On Inputs

For your workflow, the cleanest operating model is:

1. You give the series home page URL.
2. You specify the target scope: `U15 Phase 1 Div 1`, `U15 Phase 1 Div 2`, `U15 Phase 2 Div 1`, `U15 Phase 2 Div 2`.
3. You tell the system which divisions are stronger and any custom weighting preferences.
4. The scraper discovers the rest: stats pages, results pages, match pages, scorecards, ball-by-ball pages, players, and teams.

## Executive Output Recommendations

The selector or coach-facing report should follow these presentation rules:

### Assessment And Recommendation

- include batting, bowling, fielding, and wicketkeeping in the assessment snapshot
- keep the composite selector score focused on the player’s primary role
- use other skill areas as supporting context rather than overriding the primary-role recommendation

### Standard Stats In The Report

Include standard CricClubs statistics in two views:

- current series statistics
- overall CricClubs statistics

For each of those, show:

- batting
- bowling
- fielding

These should be presented as clean visual summary panels or tiles, not just dense tables.

### Visual Selector Interpretation

The report should use a fast-scanning interpretation section with:

- visual status cards
- short tags such as `Strong`, `Ready`, `Watch`, `Improving`
- concise selector language
- visible emphasis on strong-opposition readiness and primary-role value

## Short Version

This is not just a scraper. It is a structured cricket intelligence pipeline:

- discover the series structure
- capture all raw pages
- parse player, team, match, scorecard, and ball-by-ball data
- validate that the structured data is correct
- compute role-specific and opponent-adjusted metrics
- surface coach-friendly outputs

## Companion Artifacts

Use these files together when handing this off to another Codex environment:

| File | Purpose |
|---|---|
| `bay_area_u15_cricket_plan.md` | strategy, architecture, storage guidance, and verified discovery notes |
| `bay_area_u15_implementation_blueprint.md` | exact build workflow and auto-discovery execution steps |
| `bay_area_u15_schema.sql` | first-pass production schema for Postgres or Supabase Postgres |
| `bay_area_u15_executive_report.md` | executive narrative, value proposition, and sample selector output |
| `config/leagues.yaml` | series targeting and discovery configuration |
| `config/weights.yaml` | weighting and scoring rules |
| `apps/worker` | starter scraper and ETL scaffold |

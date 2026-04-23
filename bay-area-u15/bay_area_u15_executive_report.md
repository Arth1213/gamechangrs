# Bay Area U15 Cricket Performance Intelligence

## Executive Summary

This analytics platform is designed to answer a question that standard scorecards and season leaderboards cannot answer well:

**Which players are truly impacting games against the strongest opposition, in the moments that matter most?**

Traditional cricket statistics are helpful, but they often flatten context. A player can score heavily against weaker attacks, bowl tidy spells against fragile batting lineups, or accumulate dismissals without telling a selector how that player performs against top competition. For Bay Area Hub cricket, especially across multiple divisions and phases, selectors and coaches need a more intelligent view.

This solution turns CricClubs match data, scorecards, and ball-by-ball commentary into a structured intelligence system that highlights:

- how players perform against stronger teams and stronger individuals
- how batters fare against good bowlers
- how bowlers perform against top batters
- how players respond in pressure phases and high-leverage moments
- how form, consistency, and development evolve across the season

The result is a selector- and coach-facing executive dashboard that surfaces not just volume, but **quality of contribution**.

## What This Analytics Platform Will Deliver

At a high level, the system will deliver 5 major outcomes.

### 1. Player Intelligence Beyond Standard Stats

The system will capture standard batting, bowling, and fielding summaries, but it will go further by building validated match-level and ball-level records for every player in the target divisions.

This allows coaches to move from:

- "He took 2 wickets."

to:

- "He created pressure with a 47% dot-ball rate against a Div 1 Phase 2 batting unit, dismissed a top-order batter, and held his economy in the middle overs."

### 2. Ball-by-Ball Derived Stats

This is one of the most important differentiators of the platform.

Instead of relying only on final bowling figures or batting totals, the system uses commentary and scorecard detail to understand the quality of each delivery.

That means it can derive:

- batter dot-ball percentage
- strike rotation percentage
- boundary dependency
- bowler dot-ball percentage
- boundary conceded percentage
- pressure overs
- batter-vs-bowler matchup records
- wicket attribution quality
- phase-wise performance

Why this matters:

- a bowler who concedes the same final runs as another bowler may still have produced better pressure and matchup control
- a batter who scored 35 may have done so against elite bowlers under pressure, which can be more selector-relevant than a routine 50
- commentary-level data reveals matchup quality that scorecards alone do not show

### 3. Opponent-Adjusted Derived Stats

This is the second major differentiator.

Not all runs, wickets, or dismissals are equal. This system adjusts output based on the quality of the opposition.

It will weight performance using:

- team strength
- division tier
- phase strength
- opponent batter quality
- opponent bowler quality
- match leverage

Why this matters:

- performance against `Div 1` is not the same as performance against `Div 2`
- performance in `Div 1 Phase 2` can be more selector-relevant than performance in earlier or weaker competition
- wickets of top batters should matter more than wickets of lower-order players
- runs against quality bowling attacks should carry more value than runs against weaker attacks

This is what allows the platform to identify players who may be underappreciated by raw stats alone.

### 4. Development And Consistency Tracking

Selectors and coaches do not only want to know who had one great day. They want to know:

- who is trending up
- who is reliable
- who performs under pressure
- who is improving against stronger competition

This platform will surface:

- rolling recent form
- phase-to-phase improvement
- consistency scores
- strong-opposition growth
- impact in wins and close games
- role evolution, such as batting position and bowling usage

### 5. Executive Dashboard And Comparison View

The output is intended for quick decision-making.

A coach or selector should be able to:

- search a player
- view a compact performance profile
- compare peers in the same cohort
- inspect strong-opposition output
- understand why a player ranks where they do

The system is designed to support both:

- fast executive scan
- deeper drill-down into matchups and phase splits

## Why This Is Unique

There are three areas that make this system meaningfully different from a normal leaderboard or stats export.

### Ball-by-Ball Context

The platform does not stop at innings totals. It looks at the sequence of events within the innings:

- which batter faced which bowler
- whether the ball created pressure
- whether a wicket was truly credited to the bowler
- whether runs were off the bat or from extras
- what phase and score context the event happened in

This creates a richer and more truthful picture of player impact.

### Opposition Quality Weighting

The platform recognizes that a player’s output should be judged partly by who they did it against.

This is especially important in a hub structure with multiple divisions and phases, where stronger competition is not evenly distributed.

### Transparent Composite Scoring

The platform is not meant to be a black box. It will produce a composite score, but that score will be built from visible components such as:

- opponent-adjusted efficiency
- leverage performance
- consistency
- versatility
- fielding

Selectors can see both the score and the reasons behind it.

## How These Stats Will Be Created At A High Level

The system will create these stats in 6 stages.

### Stage 1. Discover The Competition Structure

Starting from one series URL, the system will:

- identify the series
- locate the target U15 divisions
- discover the results, stats, scorecard, and commentary paths

### Stage 2. Capture Raw Source Data

The scraper will save:

- raw series pages
- raw stats pages
- raw results data
- raw scorecard data
- raw commentary data

This preserves traceability and allows reprocessing if logic changes.

### Stage 3. Normalize Into Structured Match Data

The pipeline will convert raw data into structured entities such as:

- teams
- players
- matches
- innings
- batting cards
- bowling spells
- fielding events
- ball events

### Stage 4. Reconcile For Trust

Before advanced metrics are published, the system will compare:

- commentary totals vs innings totals
- wickets vs dismissal summaries
- player runs vs batting cards
- bowler figures vs commentary-derived spells

This step is critical because the value of the dashboard depends on trust.

### Stage 5. Compute Advanced Metrics

Once data is validated, the system will calculate:

- ball-by-ball derived metrics
- opponent-adjusted metrics
- matchup tables
- consistency and development indicators

### Stage 6. Publish Executive Outputs

Finally, the system will generate:

- player summary views
- selector comparison dashboards
- downloadable reports
- ranking and percentile views

## Example Executive Selector View

Below is a sample executive output for **Shreyak Porecha**. This is a **sample mock output**, not a final computed production report.

## Sample Player Dashboard: Shreyak Porecha

### Player Snapshot

| Field | Value |
|---|---|
| Player | Shreyak Porecha |
| Team | DCL Legends |
| Primary Role | Bowler |
| Secondary Role | Lower-order batting / fielding contributor |
| Target Cohort | U15 Div 1 and Div 2 comparison pool |
| Reporting Window | 2026 Bay Area USAC Hub |

### Executive Summary

Shreyak profiles as a competitive-impact bowler whose value is better understood through pressure creation and opponent context than through raw wickets alone. His strongest selector signal is his ability to sustain control against stronger teams, although his spell quality can vary when attacking set batters late in the innings. On weaker days, the ball-by-ball record still shows whether he created pressure even when the final wicket column stayed quiet.

### Sample Executive Scorecard

| Category | Sample Score | Selector Interpretation |
|---|---|---|
| Overall Composite | 74 | Above-average impact player in target cohort |
| Bowling Impact | 79 | Strongest area |
| Strong Opposition Score | 76 | Performance travels reasonably well against stronger teams |
| Pressure Performance | 72 | Useful in meaningful overs, not just low-stakes spells |
| Consistency | 68 | Good floor, but not yet elite consistency |
| Matchup Quality | 77 | Holds up well against stronger batters overall |
| Fielding Impact | 61 | Positive but not primary value driver |

### Sample Bowling Intelligence Panel

| Metric | Sample Value | Why It Matters |
|---|---|---|
| Dot-ball % | 46% | indicates pressure created ball by ball |
| Boundary Conceded % | 9% | shows damage control against batters |
| Wicket-ball % | 3.8% | not elite in sample, but acceptable with pressure profile |
| Economy vs Div 1 | 4.8 | stronger signal than all-opponent economy |
| Economy vs Div 2 | 3.9 | suggests expected control vs weaker opposition |
| Top-order wickets | 4 | better signal than raw total wickets alone |
| Pressure overs | 6 | useful indicator of captaincy trust and spell value |
| Set-batter control | Moderate | area to improve against established batters |

### Sample Matchup View

| Opponent Type | Sample Interpretation |
|---|---|
| vs strong batters | maintained control but did not always convert pressure into wickets |
| vs new batters | relatively effective at limiting early scoring |
| vs set batters | more vulnerable to release shots and occasional boundary damage |
| vs Div 1 Phase 2 | performance remains selector-relevant even when raw wicket count is modest |

### Example Match Narrative

In a representative stronger-opposition match, Shreyak’s spell may not look dominant in the final bowling column, but the ball-by-ball pattern still matters. For example, a spell with multiple dots, a run-out involvement sequence, and one expensive release ball should be interpreted differently from a spell that was poor throughout. The analytics separates pressure creation from final wicket credit so selectors can see whether he was unlucky, neutral, or genuinely ineffective.

### Sample Development Readout

| Development Area | Sample Assessment |
|---|---|
| vs stronger teams | encouraging profile |
| middle-over control | good |
| death-over control | developing |
| conversion of pressure into wickets | developing |
| consistency across matches | improving but still variable |

### Selector Takeaway

Shreyak is the type of player who should not be judged by raw wickets alone. His value is more visible when measured through ball-by-ball pressure, opponent quality, and matchup context. The system is specifically designed to make players like this easier to identify and compare.

## What A Selector Dashboard Will Let Users Do

At the executive level, the dashboard should support:

- ranking players by composite score
- filtering by division, phase, role, and team
- comparing players side by side
- drilling into strong-opposition performance
- understanding why a score is high or low
- downloading a player report

## Executive Report Design Recommendations

The executive report and dashboard should present player assessment in a way that is quick for selectors and coaches to absorb.

### Assessment Structure

- show all four skill areas in the assessment snapshot:
  - batting
  - bowling
  - fielding
  - wicketkeeping
- keep the composite selection score and recommendation anchored to the player’s **primary role**
- use the non-primary skills as supporting evidence rather than letting them overpower the main role-based recommendation

### Standard Stats Presentation

The player report should include familiar standard stats in two clean views:

- current series CricClubs stats
- overall CricClubs career stats

Those standard stats should be shown for:

- batting
- bowling
- fielding

and visually grouped as summary panels or tiles rather than buried in dense tables.

### Selector Interpretation Presentation

The “selector interpretation” section should be highly visual and fast to scan.

Recommended treatment:

- status cards instead of plain tables when possible
- short labels such as `Strong`, `Ready`, `Watch`, `Improving`
- concise one-line assessment copy under each label
- visual emphasis on the 4 to 6 most important judgments

### Overall Report Principle

Selectors should be able to understand the report in under a minute by scanning:

- composite score
- primary-role assessment
- strong-opposition signal
- standard series and overall stats
- final selector takeaway

## Final Executive Positioning

This platform gives selectors and coaches a decision tool, not just a data dump.

Its real value is not merely that it stores cricket data. Its value is that it turns fragmented CricClubs pages, scorecards, and commentary into a selector-ready view of:

- quality of performance
- quality of opposition
- quality of contribution under pressure
- trajectory of development over time

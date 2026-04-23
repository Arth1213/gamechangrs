# Bay Area U15 Cricket Intelligence: Getting Started

## Do We Have Everything Needed To Build?

We have **most of the planning and scaffolding needed to start building**, including:

- product and analytics plan
- implementation blueprint
- first-pass database schema
- executive writeup and sample selector output
- league config
- weighting config
- starter worker scaffold

What we **do not yet have** is the completed production implementation of:

- full Playwright discovery logic
- full structured endpoint extraction
- scorecard parser
- commentary parser
- database loader
- reconciliation engine
- analytics computation engine
- PDF/dashboard rendering layer

So the honest answer is:

- **yes, we have everything needed to begin building in a structured way**
- **no, we do not yet have the finished end-to-end implementation**

## Files You Should Keep Handy

These are the core handoff files.

| File | Why It Matters |
|---|---|
| `bay_area_u15_cricket_plan.md` | master strategy and architecture document |
| `bay_area_u15_implementation_blueprint.md` | exact build and auto-discovery workflow |
| `bay_area_u15_schema.sql` | first-pass database schema |
| `bay_area_u15_executive_report.md` | business-facing value proposition and sample selector dashboard |
| `config/leagues.yaml` | target series and division configuration |
| `config/weights.yaml` | weighting and scoring rules |
| `apps/worker/README.md` | worker scaffold overview |
| `apps/worker/src/*` | starter code structure for scraper, ETL, validation, and analytics |

## UI And Report Fine-Tuning Requirements To Preserve

Treat these as part of the application design, not just mockup details:

- the assessment snapshot must include batting, bowling, fielding, and wicketkeeping
- the composite selector score and recommendation must remain focused on the player’s primary role
- the executive report must show standard CricClubs stats in two views:
  - current series
  - overall CricClubs
- those standard stats should be shown visually as grouped panels or tiles
- selector interpretation should be highly visual and fast to scan
- the executive dashboard should preserve:
  - a recommendation badge such as `Strong Consideration`
  - a peer comparison strip
  - trend graphics for recent form and strong-opposition performance

## Executive Document Location

The executive document with the sample dashboard/report for Shreyak is here:

- `bay_area_u15_executive_report.md`

Full path:

- `/Users/armohan/Desktop/temp/bay_area_u15_executive_report.md`

## Recommended File Set To Carry Into Another Codex Environment

If you are bundling this into another Codex environment, these are the minimum files to carry over:

| Priority | File |
|---|---|
| essential | `bay_area_u15_cricket_plan.md` |
| essential | `bay_area_u15_implementation_blueprint.md` |
| essential | `bay_area_u15_schema.sql` |
| essential | `bay_area_u15_executive_report.md` |
| essential | `config/leagues.yaml` |
| essential | `config/weights.yaml` |
| essential | `apps/worker/README.md` |
| essential | `apps/worker/src/index.js` |
| essential | `apps/worker/src/discovery/seriesDiscovery.js` |
| essential | `apps/worker/src/extract/matchInventory.js` |
| essential | `apps/worker/src/extract/matchDetail.js` |
| essential | `apps/worker/src/parse/scorecardParser.js` |
| essential | `apps/worker/src/parse/commentaryParser.js` |
| essential | `apps/worker/src/load/repository.js` |
| essential | `apps/worker/src/validate/reconcile.js` |
| essential | `apps/worker/src/analytics/compute.js` |
| useful | `package.json` |

## Additional Things You Should Keep Handy

These are not mandatory, but they will make the next build phase much smoother.

| Item | Why |
|---|---|
| one or two known-good match URLs | quick implementation testing |
| one or two known player names | sanity checks for player matching |
| examples of “good day” and “bad day” players | helps validate selector output |
| any duplicate-name corrections | avoids identity confusion |
| cloud credentials plan | needed when wiring Supabase or another Postgres backend |
| preferred output format | helps prioritize dashboard vs PDF vs API first |

## Best Next-Build Sequence

This is the recommended order for the next Codex session.

### Step 1. Finish Discovery

Implement and test:

- `apps/worker/src/discovery/seriesDiscovery.js`

Goal:

- discover the series metadata
- discover the target U15 divisions
- discover stats URLs
- confirm results URL

### Step 2. Finish Match Inventory

Implement and test:

- `apps/worker/src/extract/matchInventory.js`

Goal:

- enumerate all matches for the 4 target U15 divisions
- save normalized match inventory
- save raw discovery artifacts

### Step 3. Add Raw Artifact Capture

Implement:

- raw HTML save
- raw JSON/XHR save
- organized file paths

Goal:

- preserve source-of-truth artifacts before parsing

### Step 4. Implement Scorecard Parsing

Implement and test:

- `apps/worker/src/extract/matchDetail.js`
- `apps/worker/src/parse/scorecardParser.js`

Goal:

- extract innings
- batting cards
- bowling cards
- dismissals
- player links

### Step 5. Implement Commentary Parsing

Implement and test:

- `apps/worker/src/parse/commentaryParser.js`

Goal:

- create clean `ball_event` rows
- distinguish batter runs, extras, and wicket attribution

### Step 6. Implement Database Loading

Implement and test:

- `apps/worker/src/load/repository.js`

Goal:

- upsert into Postgres or Supabase Postgres
- preserve ids and relationships cleanly

### Step 7. Implement Reconciliation

Implement and test:

- `apps/worker/src/validate/reconcile.js`

Goal:

- commentary totals reconcile with scorecard totals
- bowling figures reconcile with commentary-derived spell totals
- player runs reconcile with batting cards

### Step 8. Implement Analytics

Implement and test:

- `apps/worker/src/analytics/compute.js`

Goal:

- ball-by-ball derived stats
- opponent-adjusted metrics
- consistency and development metrics
- composite scores

### Step 9. Build Output Layer

Then build:

- selector dashboard
- player comparison view
- report JSON
- PDF generation

## Exact Instructions To Give In The Next Codex Session

You can copy one of these directly.

### Prompt 1: Discovery And Inventory

Build the first working slice of the Bay Area U15 CricClubs pipeline using the files already in this workspace.

Start with:

- `bay_area_u15_cricket_plan.md`
- `bay_area_u15_implementation_blueprint.md`
- `bay_area_u15_schema.sql`
- `config/leagues.yaml`
- `config/weights.yaml`
- `apps/worker/src/*`

Your task is to complete:

- `apps/worker/src/discovery/seriesDiscovery.js`
- `apps/worker/src/extract/matchInventory.js`

Requirements:

- use Playwright
- use the Bay Area Hub series URL from config
- auto-discover the 4 target divisions
- enumerate all matches for those divisions
- save raw HTML and raw JSON artifacts
- output clean normalized JSON files under `storage/exports`

Do not stop at planning. Implement and verify.

### Prompt 2: Scorecard And Commentary Parsing

Using the existing Bay Area U15 scaffold in this workspace, implement the next pipeline slice:

- `apps/worker/src/extract/matchDetail.js`
- `apps/worker/src/parse/scorecardParser.js`
- `apps/worker/src/parse/commentaryParser.js`

Requirements:

- pull scorecard and commentary for inventoried matches
- normalize innings, batting, bowling, fielding, and `ball_event` rows
- handle extras correctly
- distinguish bowler-earned wickets from run outs
- save raw and normalized outputs for inspection
- verify on a DCL Legends match involving Shreyak Porecha if available

### Prompt 3: Database Load And Reconciliation

Using `bay_area_u15_schema.sql` and the existing worker scaffold, implement:

- `apps/worker/src/load/repository.js`
- `apps/worker/src/validate/reconcile.js`

Requirements:

- load normalized data into Postgres-compatible tables
- generate reconciliation checks
- log mismatches to a quality-issues table or JSON output
- verify commentary totals against innings totals

### Prompt 4: Analytics And Selector View

Using the Bay Area U15 scaffold and configs already in this workspace, implement:

- `apps/worker/src/analytics/compute.js`

Requirements:

- compute ball-by-ball derived stats
- compute opponent-adjusted metrics using `config/weights.yaml`
- compute consistency and development metrics
- produce a selector-friendly JSON summary for a sample player, ideally Shreyak Porecha

### Prompt 5: Preserve The Executive Report Design

When implementing the selector dashboard and report layer, preserve the current report-design decisions already documented in this workspace.

Requirements:

- show batting, bowling, fielding, and wicketkeeping in the assessment snapshot
- keep the composite selector score focused on the player’s primary role
- include standard CricClubs stats in two views:
  - current series
  - overall CricClubs
- present those stats as visual summary panels or tiles
- make selector interpretation visual and quick to scan
- preserve:
  - recommendation badge
  - peer comparison strip
  - trend graphics for recent form and strong-opposition performance

## If You Want The Safest Start

The safest first next step is:

1. finish discovery
2. finish match inventory
3. save raw artifacts

That gives you a strong foundation before you invest in full parsing and analytics.

## Final Recommendation

Before you start the next build session, keep these three files open first:

- `bay_area_u15_cricket_plan.md`
- `bay_area_u15_implementation_blueprint.md`
- `bay_area_u15_executive_report.md`

Those three documents together explain:

- what the product is
- why it matters
- how the pipeline should work
- what the selector output should look like

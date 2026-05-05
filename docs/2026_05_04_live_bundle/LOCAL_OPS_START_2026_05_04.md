# Local Ops Start Guide - 2026-05-04

## Workspace path

- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15`

## Prerequisites

1. `bay-area-u15/.env` must exist.
2. `npm install` must have been run in `bay-area-u15`.
3. The analytics database must be reachable.
4. App-auth values must still point to the main app Supabase project.

## First health check

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm run ops:doctor
```

You want these to pass:

- `.env` present
- database reachable
- league config files present
- Playwright runtime available

## Start the local API only

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4012 npm run api:start
```

## Start the local-ops UI

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4012 npm run ops:ui:start
```

Open:

- `http://127.0.0.1:4012/local-ops`

## Restart procedure

If local-ops looks stuck:

1. Stop the running process.
2. Start it again with the same command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4012 npm run ops:ui:start
```

## Useful commands

### Probe a source URL

```bash
npm run ops:probe -- --source cricclubs --url "https://cricclubs.com/..."
```

### Register a new series

```bash
npm run ops:register -- --source cricclubs --url "https://cricclubs.com/..." --label "Series Name" --seasonYear 2026 --targetAgeGroup Open
```

### Stage discovery plus inventory

```bash
npm run ops:stage -- --series <series-key>
```

### Run current ingest

```bash
npm run worker:run:series -- --series <series-key>
```

### Compute season outputs

```bash
npm run worker:compute:series -- --series <series-key>
npm run worker:score:series -- --series <series-key>
npm run worker:intelligence:series -- --series <series-key>
```

### Process queued work

```bash
npm run worker:process-queue
npm run worker:process-manual-refresh-queue
```

## Local auth behavior

The local analytics API checks bearer tokens against the main app Supabase project via:

- `bay-area-u15/apps/api/src/lib/auth.js`

That means this pair must be correct in `bay-area-u15/.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Common failure points

### 401 on analytics/admin pages

Check:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- the signed-in app user is from the live app project

### Database connection failure

Check:

- `DATABASE_URL`
- `DATABASE_SSL_MODE=require`

### Local-ops page not loading

Check:

- `LOCAL_OPS_ENABLE_UI` is set by `npm run ops:ui:start`
- `PORT=4012` is not already occupied

## Current safe default

Use:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4012 npm run ops:ui:start
```

That is the best default command to hand to Codex or run manually on this machine.

# Game-Changrs Restore Point - 2026-05-04

## Purpose

This is the current restore-point guide for the live Game-Changrs stack after:

- main app Supabase cutover to `tpiegapsjeetvwsybjiu`
- analytics/local-ops retention on `azgebbtasywunltdhdby`
- live production publish on `game-changrs.com`

Use this document when you need to rebuild the project from scratch on this Mac or on a replacement machine.

## Current source-of-truth locations

### Working repo

- Repo path: `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy`
- GitHub repo: `https://github.com/Arth1213/gamechangrs.git`

### OneDrive backup root

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504`

### Local backup root

- `/Users/artharun/Downloads/GAME-CHANGRS-BACKUPS/2026_05-04-Game-Changrs-Live-Bundle`

## What must be preserved

You need all of the following to do a complete restore:

1. A repo snapshot.
2. A portable Git bundle.
3. Root frontend `.env`.
4. `bay-area-u15/.env`.
5. The main app Supabase project identifiers and API keys.
6. The analytics Postgres connection details.
7. Render/Lovable/IONOS/Resend reference values.
8. Database dumps for every recoverable Supabase/Postgres database.

## Restore files to expect

### Code and repo artifacts

- `gamechangrs-2026_05_04-live-bundle.bundle`
- `gamechangrs-phase10-deploy-2026_05_04-live-bundle.tar.gz`
- `gamechangrs-github-source-2026_05_04-live-bundle.tar.gz`

### Docs

- `START_HERE_2026_05_04.html`
- `RESTORE_POINT_2026_05_04.html`
- `ARCHITECTURE_2026_05_04.html`
- `CONFIG_REFERENCE_2026_05_04.html`
- `LOCAL_OPS_START_2026_05_04.html`
- `RESTORE_POINT_2026_05_04.md`
- `ARCHITECTURE_2026_05_04.md`
- `CONFIG_REFERENCE_2026_05_04.md`
- `LOCAL_OPS_START_2026_05_04.md`
- `CODEX_RESTORE_PROMPT_2026_05_04.txt`

### Local-only secret/value companions

- `CONFIG_VALUES_LOCAL_ONLY_2026_05_04.md`
- `root.env.restore-copy`
- `bay-area-u15.env.restore-copy`

### Database backups

- `supabase-main-app-schema-2026_05_04.sql`
- `supabase-main-app.dump`
- `supabase-analytics-schema-2026_05_04.sql`
- `supabase-analytics.dump`

## Full rebuild from scratch

### Option A: Restore from GitHub

```bash
cd /Users/artharun/Downloads
git clone https://github.com/Arth1213/gamechangrs.git GAME-CHANGRS/gamechangrs-phase10-deploy
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
git checkout main
```

### Option B: Restore from the portable Git bundle

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS-BACKUPS/2026_05-04-Game-Changrs-Live-Bundle
git clone gamechangrs-2026_05_04-live-bundle.bundle /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
git checkout main
```

### Restore the root frontend env

```bash
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504/2026_05-04-Game-Changrs-Live-Bundle/root.env.restore-copy /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/.env
```

### Restore the analytics/local-ops env

```bash
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504/2026_05-04-Game-Changrs-Live-Bundle/bay-area-u15.env.restore-copy /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/.env
```

### Install the frontend app

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm install
```

### Install the analytics/local-ops workspace

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm install
```

### Validate local frontend

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run dev -- --host 127.0.0.1 --port 8084
```

Expected checks:

- login page loads
- marketplace loads
- coaching marketplace loads
- Technique AI loads
- analytics pages can authenticate against the Render API

### Validate local local-ops/API

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
PORT=4012 npm run ops:ui:start
```

Expected checks:

- `http://127.0.0.1:4012/health`
- `http://127.0.0.1:4012/local-ops`

## Cloud reconnect order

1. Confirm the Supabase org is still `dlurarovcdxflspxonnu`.
2. Confirm the main app Supabase project is `tpiegapsjeetvwsybjiu`.
3. Confirm the analytics database is still `azgebbtasywunltdhdby`.
4. Confirm Render `gamechangrs-cricket-api` env values.
5. Confirm Lovable project is still connected to GitHub `main`.
6. Confirm `game-changrs.com` DNS in IONOS still points to the Lovable publish target.
7. Confirm Resend keys/domain state if email flows are required.

## Codex restore option

Use this prompt file:

- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/2026_05_04_live_bundle/CODEX_RESTORE_PROMPT_2026_05_04.txt`

Use these input files:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504/2026_05-04-Game-Changrs-Live-Bundle/START_HERE_2026_05_04.html`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504/2026_05-04-Game-Changrs-Live-Bundle/RESTORE_POINT_2026_05_04.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260504/2026_05-04-Game-Changrs-Live-Bundle/CONFIG_VALUES_LOCAL_ONLY_2026_05_04.md`

### What Codex should do

1. Recreate the repo from GitHub or the bundle.
2. Put `root.env.restore-copy` at repo root as `.env`.
3. Put `bay-area-u15.env.restore-copy` at `bay-area-u15/.env`.
4. Install root dependencies and `bay-area-u15` dependencies.
5. Start frontend and local-ops.
6. Report any missing external credentials or cloud access gaps.

## Known reality checks

- The marketplace ownership issue for `helloarth09@gmail.com` was repaired by moving the live row to the current auth UUID.
- Only one live marketplace row was present at this checkpoint. There is no second live marketplace listing recoverable from the current app database snapshot.
- The analytics stack remains on its own database. Do not merge it into the main app project during restore.

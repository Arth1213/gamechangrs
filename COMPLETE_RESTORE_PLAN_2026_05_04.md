# Game-Changrs Complete Restore Plan

Date: 2026-05-04

Purpose:

- restore Game-Changrs from a clean laptop or clean workspace
- restore both the frontend and the cricket analytics/local-ops backend
- restore from either the latest GitHub code or the fixed 2026-05-03 restore point

## Summary

### Restore stages

| Stage | Goal | Output |
| --- | --- | --- |
| 0 | Get backup files and account access ready | OneDrive backup folder available locally |
| 1 | Recreate the repo | `gamechangrs-phase10-deploy/` restored on disk |
| 2 | Restore secret files | `.env` and `bay-area-u15/.env` back in place |
| 3 | Install dependencies and tools | local machine can run frontend and API |
| 4 | Start and verify locally | frontend, API, and local ops open successfully |
| 5 | Reconnect cloud systems | Supabase, Render, Lovable, DNS confirmed |
| 6 | Republish production if needed | `game-changrs.com` and Render API live again |

### Restore modes

Use one of these:

1. Latest current system
   Use GitHub `main`.
2. Fixed restore point snapshot
   Use GitHub branch `backup/2026_05-03-Game-Changrs-Restore-Point` or the offline git bundle.

### Restore anchors

- Repo: `https://github.com/Arth1213/gamechangrs.git`
- Latest known doc commit on `main`: `0b967834ec818c1f1898d5c2a1c13a14d8f063a3`
- Restore backup branch: `backup/2026_05-03-Game-Changrs-Restore-Point`
- Restore backup branch commit: `60f80447b7b601e8a1ecdf72b1063db5a029d222`
- Restore backup tag: `2026_05-03-Game-Changrs-Restore-Point`
- Restore backup tag commit: `41dbf58eebb8b3a8950e09279c41cd2783c08c32`

## Stage 0: What You Need Before Starting

### Backup folder

Primary OneDrive backup root:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

Restore-point folder inside OneDrive:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point`

### Required backup files

Code backups:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-github-source-2026_05_03.tar.gz`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-worktree-2026_05_03.tar.gz`

Secret and env backups:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/bay-area-u15.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/render-and-api-secret-values-20260503.md`

Reference docs:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/RESTORE_README_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/RESTORE_CHECKLIST_FOR_OPERATOR_2026_05_04.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/ENV_REQUIREMENTS_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CLOUD_RECOVERY_STATUS_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/game_changrs_preservation_record_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CODEX_RESTORE_PROMPT_2026_05_03.txt`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CODEX_CLEAN_SLATE_RESTORE_PROMPT_2026_05_04.txt`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/START_HERE_FOR_RESTORE_2026_05_04.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/START_HERE_FOR_RESTORE_2026_05_04.txt`

### External access still required

- GitHub account/repo access
- Supabase analytics project access
- Render service access
- Lovable project access
- IONOS DNS/domain access
- OpenAI API key source of truth

### Known gap

The main app Supabase project ref `snlutvotzeijzqdwlank` is not currently visible from the accessible Supabase account context. If app auth or app-managed data breaks, that project access will still need to be recovered separately.

## Stage 1: Recreate The Repo

### Option A: Restore the latest current system from GitHub `main`

Command:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS
```

What it does:

- creates the parent workspace directory

Command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS
git clone https://github.com/Arth1213/gamechangrs.git gamechangrs-phase10-deploy
```

What it does:

- clones the repo from GitHub into a clean folder named `gamechangrs-phase10-deploy`

Command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
git checkout main
git pull origin main
```

What it does:

- switches to `main`
- updates local code to the latest pushed production-aligned code

### Option B: Restore the fixed backup branch snapshot

Command:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS
cd /Users/artharun/Downloads/GAME-CHANGRS
git clone https://github.com/Arth1213/gamechangrs.git gamechangrs-phase10-deploy
cd gamechangrs-phase10-deploy
git checkout backup/2026_05-03-Game-Changrs-Restore-Point
```

What it does:

- restores the pinned backup branch snapshot with the preserved restore docs

### Option C: Offline restore from the git bundle

Command:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS
cd /Users/artharun/Downloads/GAME-CHANGRS
git clone /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle gamechangrs-phase10-deploy
cd gamechangrs-phase10-deploy
git checkout backup/2026_05-03-Game-Changrs-Restore-Point
```

What it does:

- rebuilds the repo without using GitHub
- uses the offline git bundle stored in OneDrive

## Stage 2: Restore Secret Files

### Restore the root frontend env file

Command:

```bash
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/.env
```

What it does:

- puts the frontend `.env` back into the repo root

### Restore the analytics/local-ops env file

Command:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/.env
```

What it does:

- ensures the `bay-area-u15` folder exists
- restores the local ops/API `.env`

### Optional secret reference file

Reference file:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/render-and-api-secret-values-20260503.md`

What it is for:

- source-of-truth backup for Render/API-related secret values that were intentionally kept out of git

## Stage 3: Install Local Prerequisites And Dependencies

### Tools expected on the machine

- Git
- Node.js and npm
- Supabase CLI

### Install root app dependencies

Command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm install
```

What it does:

- installs the frontend dependencies for the root app

### Install analytics/local-ops dependencies

Command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm install
```

What it does:

- installs the Node dependencies for the cricket API and local ops

## Stage 4: Start The System Locally

### Start the frontend

Command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run dev
```

What it does:

- starts the frontend dev server
- prints the local URL in the terminal

What to do next:

- open the URL printed by Vite
- verify the home page loads
- verify login page loads

### Start the cricket API and local ops server

Command:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
set -a
source .env
set +a
npm run api:start
```

What it does:

- loads all env vars from `bay-area-u15/.env`
- starts the analytics API/local ops server using those values

What to do next:

- use the port printed by the server
- if `LOCAL_OPS_ENABLE_UI` is enabled, open `http://127.0.0.1:<API_PORT>/local-ops`
- verify analytics API health if a health route is available

## Stage 5: Verify The Local Restore

### Minimum verification checklist

Verify these:

- frontend home page loads
- sign-in page loads
- analytics pages load
- a player report opens
- `bay-area-u15` API starts without env errors
- local ops page opens if enabled

### If something fails

Check in this order:

1. `.env` restored to repo root
2. `bay-area-u15/.env` restored correctly
3. `npm install` completed in both locations
4. local API terminal output for missing env vars
5. Supabase access and database connection values

## Stage 6: Restore Cloud Connections

### Supabase analytics project

Known project:

- project name: `game-changrs-cricket-analytics`
- ref: `azgebbtasywunltdhdby`

What to do:

1. sign in to Supabase
2. confirm the analytics project is visible
3. restore/check:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
4. confirm functions:
   - `analytics-player-report-chat`

Useful commands:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
supabase login
supabase projects list
supabase link --project-ref azgebbtasywunltdhdby
supabase functions list --project-ref azgebbtasywunltdhdby
```

### Render API service

Known service:

- `https://gamechangrs-cricket-api.onrender.com`

Known config:

- root directory: `bay-area-u15`
- build command: `npm install`
- start command: `npm run api:start`

What to do:

1. open the Render service
2. verify env vars
3. verify branch is `main`
4. run a manual deploy if needed

### Lovable frontend

Known project:

- `https://lovable.dev/projects/e14399ba-fbf2-42cf-bf82-4c38048ee762`

Known repo link:

- `Arth1213/gamechangrs`

Known branch:

- `main`

What to do:

1. open the Lovable project
2. confirm repo connection is still healthy
3. sync from GitHub `main` if needed
4. publish
5. verify `game-changrs.com`

### IONOS DNS/domain

Known live domain:

- `game-changrs.com`

What to do:

1. sign in to IONOS
2. open `game-changrs.com`
3. verify DNS records still exist
4. verify `_lovable` TXT verification record still exists
5. verify root `A @ -> 185.158.133.1`

## Stage 7: Production Republish

### Frontend republish path

1. push the desired code to GitHub `main`
2. open Lovable
3. sync/pull latest GitHub changes if needed
4. publish
5. verify the site on `game-changrs.com`

### Backend republish path

1. push the desired backend code to GitHub `main`
2. open Render service `gamechangrs-cricket-api`
3. trigger manual deploy if auto-deploy did not run
4. verify the Render service health URL or API response

## Stage 8: Clean-Slate Codex Handoff

### What you physically do first

1. Put the OneDrive backup folder back onto the machine so this path exists:

`/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

2. Make sure the backup folder still contains:

- `root.env.restore-copy`
- `raw-secret-files/bay-area-u15/.env`
- `render-and-api-secret-values-20260503.md`
- `2026_05-03-Game-Changrs-Restore-Point/`

3. Open Codex in a new workspace.

4. Point Codex at:

`/Users/artharun/Downloads/GAME-CHANGRS`

### Exact Codex prompt to paste

```text
Restore Game-Changrs from a clean slate using the backup files at /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503.

Requirements:
1. Recreate the repo at /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy.
2. Prefer cloning from GitHub https://github.com/Arth1213/gamechangrs.git and checking out main if GitHub is reachable.
3. If GitHub is not reachable, restore from the git bundle at /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle and use backup/2026_05-03-Game-Changrs-Restore-Point.
4. Restore .env from /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy.
5. Restore bay-area-u15/.env from /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env.
6. Run npm install in the repo root and in bay-area-u15.
7. Start the frontend and the bay-area-u15 API locally.
8. Verify the frontend home page, sign-in page, analytics pages, and local ops page if enabled.
9. Tell me exactly what external accounts or secrets are still needed after the local restore.

Use these reference docs while restoring:
- /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/RESTORE_README_2026_05_03.md
- /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/RESTORE_CHECKLIST_FOR_OPERATOR_2026_05_04.md
- /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CLOUD_RECOVERY_STATUS_2026_05_03.md
- /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/game_changrs_preservation_record_2026_05_03.md

Do the work end to end. Do not ask me to rediscover file paths that are already listed above.
```

## Stage 9: Files To Open First During A Disaster Recovery

Open these in this order:

1. `COMPLETE_RESTORE_PLAN_2026_05_04.md`
2. `RESTORE_CHECKLIST_FOR_OPERATOR_2026_05_04.md`
3. `game_changrs_preservation_record_2026_05_03.md`
4. `render-and-api-secret-values-20260503.md`

## Final Notes

- Use `main` when you want the latest current system.
- Use the backup branch when you want the preserved restore-point workflow.
- Do not commit `.env` files back into git.
- The main unresolved dependency is the missing visibility into Supabase project ref `snlutvotzeijzqdwlank`.

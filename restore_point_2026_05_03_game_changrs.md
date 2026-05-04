# Game-Changrs Restore Point

Name: `2026_05-03-Game-Changrs-Restore-Point`

Date: 2026-05-03

## Restore Anchor

- GitHub repo: `https://github.com/Arth1213/gamechangrs.git`
- Restore backup branch commit: `60f80447b7b601e8a1ecdf72b1063db5a029d222`
- Restore backup tag commit: `41dbf58eebb8b3a8950e09279c41cd2783c08c32`
- Restore branch: `backup/2026_05-03-Game-Changrs-Restore-Point`
- Restore tag: `2026_05-03-Game-Changrs-Restore-Point`

Note:

- The backup branch and backup tag currently point to different commits.
- Use the backup branch when you want the most complete restore documentation set.
- Use the backup tag when you want the original tagged snapshot exactly as tagged on 2026-05-03.

## What This Restore Point Covers

- Main Game-Changrs frontend code under `src/`
- Supabase migrations and edge functions under `supabase/`
- Cricket analytics API under `bay-area-u15/apps/api/`
- Local ops console and worker flows under `bay-area-u15/`
- Analytics runbooks and stage-lock documents under `bay-area-u15/`
- Portable Git history backup via `git bundle`
- Local source snapshot archives

## What This Restore Point Does Not Automatically Recreate

- Supabase cloud secrets
- Render environment variable values
- Lovable account linkage and publish state
- Google auth provider credentials/settings
- DNS / domain registrar settings
- Email provider or SMTP configuration if managed outside Supabase/Render

## Restore Inventory

### Primary Backup Location

Primary synced backup location:

`/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

Local mirror created on this machine:

`/Users/artharun/Downloads/GAME-CHANGRS-BACKUPS/2026_05-03-Game-Changrs-Restore-Point`

### Code Anchors

- GitHub branch: `backup/2026_05-03-Game-Changrs-Restore-Point`
- GitHub tag: `2026_05-03-Game-Changrs-Restore-Point`
- Portable Git backup: `gamechangrs-2026_05-03-restore.bundle`
- GitHub-style source archive: `gamechangrs-github-source-2026_05-03.tar.gz`

### Local Backup Artifacts

Primary OneDrive backup directory:

`/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

Local backup directory:

`/Users/artharun/Downloads/GAME-CHANGRS-BACKUPS/2026_05-03-Game-Changrs-Restore-Point`

Expected artifacts:

- `gamechangrs-worktree-2026_05-03.tar.gz`
- `gamechangrs-secrets-local-only-2026_05-03.tar.gz`
- `gamechangrs-2026_05-03-restore.bundle`
- `gamechangrs-github-source-2026_05-03.tar.gz`
- `RESTORE_README_2026_05_03.md`
- `ENV_REQUIREMENTS_2026_05_03.md`
- `CLOUD_RECOVERY_STATUS_2026_05_03.md`
- `CODEX_RESTORE_PROMPT_2026_05_03.txt`
- `root.env.restore-copy`
- `bay-area-u15.env.restore-copy`
- `raw-secret-files/bay-area-u15/.env`

## Cloud Components To Restore Or Reconnect

### GitHub

Purpose:

- source of truth for code
- restore anchor via branch and tag
- source for Lovable sync
- source for Render deploys

Restore requirement:

- access to GitHub account with permission to `Arth1213/gamechangrs`

### Lovable Frontend Project

Purpose:

- visual/editor workflow and publish surface for the frontend

Restore requirement:

- access to the Lovable project linked to this repo
- ability to re-sync from GitHub `main`
- ability to publish after verifying the correct branch/commit was merged into `main`

### Render Service

Purpose:

- hosts the cricket analytics Node/Express API

Known service:

- service URL: `https://gamechangrs-cricket-api.onrender.com`

Restore requirement:

- access to the Render service config
- ability to verify:
  - root directory
  - build command
  - start command
  - env vars

### Supabase Main App Project

Purpose:

- auth
- root app data
- storage
- edge functions

Repo-linked project id:

- `snlutvotzeijzqdwlank`

Restore requirement:

- dashboard or CLI access to the project
- ability to restore env/secrets
- ability to deploy edge functions

### Supabase Analytics Database Project

Purpose:

- cricket analytics source-of-truth Postgres used by the cricket API and local ops

Restore requirement:

- working `DATABASE_URL`
- Supabase URL / anon key / service role where applicable
- database password or pooler URI

## New Laptop Restore Procedure

### 1. Recreate the workspace

Preferred first source:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

Fallback sources:

- `/Users/artharun/Downloads/GAME-CHANGRS-BACKUPS/2026_05-03-Game-Changrs-Restore-Point`
- GitHub branch/tag
- the portable git bundle

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS
cd /Users/artharun/Downloads/GAME-CHANGRS
git clone https://github.com/Arth1213/gamechangrs.git gamechangrs-phase10-deploy
cd gamechangrs-phase10-deploy
git checkout 2026_05-03-Game-Changrs-Restore-Point
```

Alternative offline restore from bundle:

```bash
git clone gamechangrs-2026_05-03-restore.bundle gamechangrs-phase10-deploy
cd gamechangrs-phase10-deploy
git checkout 2026_05-03-Game-Changrs-Restore-Point
```

### 2. Restore local secret files

Primary OneDrive secret file paths:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env`

Restore these back into the repo as:

- `.env`
- `bay-area-u15/.env`

Example:

```bash
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/.env
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/.env
```

### 3. Install dependencies

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm install
cd bay-area-u15
npm install
```

### 4. Restore Supabase config and functions

The repo already contains:

- `supabase/migrations/`
- `supabase/functions/`
- `supabase/config.toml`

Required next actions:

- log into Supabase CLI
- link to the correct project
- verify project id
- verify edge function secrets
- deploy missing functions if needed

### 5. Start the frontend

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run dev
```

### 6. Start the local cricket API

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
set -a
source .env
set +a
PORT=4011 npm run api:start
```

### 7. Start the local ops console

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
set -a
source .env
set +a
PORT=4012 npm run ops:ui:start
```

### 8. Verification URLs

Frontend dev:

- `http://127.0.0.1:8080/`

Local cricket API:

- `http://127.0.0.1:4011/health`

Local ops console:

- `http://127.0.0.1:4012/local-ops`

Hosted cricket API:

- `https://gamechangrs-cricket-api.onrender.com/health`

## Hosted Recovery Steps

### Supabase

1. Confirm the correct project(s) exist and you still have admin access.
2. Restore missing secrets.
3. Confirm auth providers remain configured.
4. Confirm storage buckets exist.
5. Redeploy edge functions if needed.
6. Run schema migrations if a new project must be rebuilt.

### Render

1. Reconnect the repo if needed.
2. Confirm branch is `main`.
3. Confirm root directory points to `bay-area-u15`.
4. Confirm build command is `npm install`.
5. Confirm start command is `npm run api:start`.
6. Restore required env vars.
7. deploy.
8. verify `/health`.

### Lovable

1. Open the linked project.
2. Confirm GitHub sync points to the correct repo.
3. Ensure `main` contains the desired restore commit.
4. Publish the frontend again.
5. Verify the production routes.

## What You Need Besides `.env`

Yes. If the laptop is lost, `.env` files alone are not enough.

You also need:

- GitHub account access
- Supabase account/project access
- Render account/service access
- Lovable project access
- database password / connection URI source
- Supabase edge-function secret values
- Google auth provider credentials if Google sign-in is used
- domain/DNS provider access if `game-changrs.com` ever needs to be repointed

## Codex Recovery Prompt

See:

- `CODEX_RESTORE_PROMPT_2026_05_03.txt`

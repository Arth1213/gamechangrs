# Game-Changrs Restore Checklist For Operator

Date: 2026-05-04

This is the shortest practical restore guide for rebuilding Game-Changrs on a new laptop.

## 1. Files You Need

Primary backup folder in OneDrive:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503`

Main restore folder inside that backup:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point`

Main code backup files:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-github-source-2026_05_03.tar.gz`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-worktree-2026_05_03.tar.gz`

Secret and env backup files:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/bay-area-u15.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/render-and-api-secret-values-20260503.md`

Restore documentation files:

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/RESTORE_README_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/ENV_REQUIREMENTS_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CLOUD_RECOVERY_STATUS_2026_05_03.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CODEX_RESTORE_PROMPT_2026_05_03.txt`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/game_changrs_preservation_record_2026_05_03.md`

## 2. GitHub Restore Anchors

Repo:

- `https://github.com/Arth1213/gamechangrs.git`

Backup branch:

- `backup/2026_05-03-Game-Changrs-Restore-Point`

Backup branch commit:

- `60f80447b7b601e8a1ecdf72b1063db5a029d222`

Backup tag:

- `2026_05-03-Game-Changrs-Restore-Point`

Backup tag commit:

- `41dbf58eebb8b3a8950e09279c41cd2783c08c32`

Use the backup branch if you want the most complete restore documentation. Use the backup tag if you want the exact tagged restore snapshot.

## 3. Restore The Repo

If GitHub is available:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS
cd /Users/artharun/Downloads/GAME-CHANGRS
git clone https://github.com/Arth1213/gamechangrs.git gamechangrs-phase10-deploy
cd gamechangrs-phase10-deploy
git checkout backup/2026_05-03-Game-Changrs-Restore-Point
```

If GitHub is not available:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS
cd /Users/artharun/Downloads/GAME-CHANGRS
git clone /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle gamechangrs-phase10-deploy
cd gamechangrs-phase10-deploy
git checkout backup/2026_05-03-Game-Changrs-Restore-Point
```

## 4. Restore Secret Files

Copy the root app env file:

```bash
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/.env
```

Copy the local ops env file:

```bash
mkdir -p /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
cp /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15/.env
```

## 5. Install Dependencies

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm install
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
npm install
```

## 6. Start The App Locally

Frontend:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
npm run dev
```

Cricket API and local ops:

```bash
cd /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15
set -a
source .env
set +a
npm run api:start
```

## 7. What You Still Need Access To

- GitHub account and repo access
- Supabase analytics project access
- Render service access
- Lovable project access
- Domain and DNS access in IONOS
- OpenAI key source of truth

These are preserved as references in:

- `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/game_changrs_preservation_record_2026_05_03.md`

## 8. Important Known Gaps

- Main app Supabase project ref `snlutvotzeijzqdwlank` is not accessible from the current visible Supabase account context.
- Google OAuth ownership for Game-Changrs is not fully identified in current Google Cloud access.
- No full SQL dump was captured in this restore point.

## 9. Fastest Codex Prompt

Use this prompt with Codex after placing the backup files back onto a new machine:

```text
Restore Game-Changrs from the OneDrive backup at /Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503. Use the backup branch backup/2026_05-03-Game-Changrs-Restore-Point when GitHub is available, otherwise use the git bundle in the restore folder. Restore .env and bay-area-u15/.env from the backup copies, install dependencies, start the frontend and bay-area-u15 API, verify the local ops and analytics flows, and then tell me what external accounts or secrets are still required to make production fully live again.
```

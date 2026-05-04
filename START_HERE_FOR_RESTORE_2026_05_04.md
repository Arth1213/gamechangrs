# Start Here For Restore

Date: 2026-05-04

Use this file first if you need to restore Game-Changrs from a clean machine.

## What To Open First

Open these in this order:

1. `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/START_HERE_FOR_RESTORE_2026_05_04.md`
2. `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/COMPLETE_RESTORE_PLAN_2026_05_04.md`
3. `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/game_changrs_preservation_record_2026_05_03.md`
4. `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/render-and-api-secret-values-20260503.md`

## Files That Must Exist In OneDrive

- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/root.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/bay-area-u15.env.restore-copy`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/raw-secret-files/bay-area-u15/.env`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/render-and-api-secret-values-20260503.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/gamechangrs-2026_05-03-restore.bundle`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/COMPLETE_RESTORE_PLAN_2026_05_04.md`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/COMPLETE_RESTORE_PLAN_2026_05_04.docx`
- `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CODEX_CLEAN_SLATE_RESTORE_PROMPT_2026_05_04.txt`

## Fast Restore Path

1. Restore or sync the OneDrive backup folder to the machine.
2. Open Codex with workspace `/Users/artharun/Downloads/GAME-CHANGRS`.
3. Paste the prompt from:

`/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/CODEX_CLEAN_SLATE_RESTORE_PROMPT_2026_05_04.txt`

4. Let Codex recreate the repo, restore `.env` files, install dependencies, and start the services.
5. If GitHub is unavailable, Codex should use the git bundle from the OneDrive restore folder.

## If You Want To Restore Manually

Use the full command-by-command guide here:

`/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260503/2026_05-03-Game-Changrs-Restore-Point/COMPLETE_RESTORE_PLAN_2026_05_04.md`

## Known External Dependencies

You still need:

- GitHub repo access
- Supabase analytics project access
- Render service access
- Lovable project access
- IONOS DNS access
- OpenAI API key source of truth

## Known Gap

Supabase project ref `snlutvotzeijzqdwlank` is not currently visible from the accessible Supabase account context and may still need separate recovery.

# Backup Everything Protocol

This file defines exactly what "backup everything for me" means for Game-Changrs.

## Current standard

When asked to **backup everything**, perform all of the following unless the user narrows the scope:

1. Verify repo state.
2. Commit and push all intended changes to `main`.
3. Confirm the worktree is clean after push.
4. Create or update a dated OneDrive backup folder under:
   `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/YYYYMMDD`
5. Create a named restore-point folder inside that dated folder.
6. Create a portable Git bundle from the current repo state.
7. Create a source tarball from the Git-tracked repo state.
8. Create a full worktree tarball from the local project directory when requested or when the current backup convention includes it.
9. Copy local env and secret restore files into the backup set when those files exist and the backup request includes secrets.
10. Include or refresh restore instructions and backup-status documentation.
11. Include checksums for the generated backup artifacts when practical.
12. Generate or refresh one single layman-friendly restore guide that can be followed from a clean slate without jumping across multiple documents.
13. Generate or refresh the current simplified Game-Changrs system map in both HTML and PDF form.
14. Generate or refresh the current detailed platform inventory in both HTML and PDF form.
15. Refresh the canonical restore handoff folder:
   `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT`
16. Confirm that GitHub contains the latest code and that the local OneDrive backup contains the corresponding restore artifacts.
17. Remove superseded local Supabase dump / export artifacts from the local backup folder after the fresh backup is verified, unless the user explicitly asks to keep historical local copies.
18. Send a restore-point summary email after the backup completes, attaching the layman-friendly restore guide, the Codex restore prompt, the simplified system map, and the detailed platform inventory.

## Database backup shorthand

When asked to **backup my database**, perform the database portion of the backup workflow even if the user did not ask for a full restore point.

Minimum expected database backup action:

1. Create a fresh analytics schema export.
2. Create a fresh analytics data export.
3. Create a fresh main app database backup using the best available path:
   - prefer a direct Postgres dump when tooling and permissions allow
   - otherwise create a logical table export for the live main app schemas
4. Store the generated database artifacts under:
   `/Users/artharun/Downloads/GAME-CHANGRS/backups`
5. After the new database backup is verified, clear older local Supabase dump / export artifacts that have been superseded by the new backup set unless the user explicitly asks to retain them.
6. Report back the exact artifact filenames, timestamps, and any caveats about format or completeness.

Current preferred formats:

- analytics database:
  - schema SQL export
  - data SQL export or full Postgres dump when available
- main app database:
  - full Postgres dump when available
  - otherwise logical export archive covering the live application tables and a note about the fallback method

## Expected backup outputs

A full backup should aim to include these categories:

- GitHub `main` contains the latest intended code.
- the local app/source state is pushed to GitHub and mirrored into the OneDrive restore-point backup set
- OneDrive restore-point folder contains:
  - repo bundle
  - repo source archive
  - worktree archive
  - restore docs
  - backup status file
  - repo state file
  - checksum file
- email notification sent with restore-point details and restore instructions
- Secret and env backup copies when included:
  - root `.env` restore copy
  - `bay-area-u15/.env` restore copy
  - any local config restore copies already part of the established backup convention
- Database exports or dumps when available and requested.
- current simplified system map in HTML and PDF when available
- current detailed platform inventory in HTML and PDF when available
- current `docs/RESTORE_PACK_CURRENT` handoff pack

## Restore documentation minimum

When "backup everything" is requested, the backup should either include or reference:

- a start-here restore document
- a complete restore plan
- a single layman-friendly restore guide in HTML or DOCX that can be followed from a clean slate
- a Codex restore prompt that can drive the restore end to end once the files are placed on disk
- a local-ops / series-management operator guide with startup steps and localhost URLs
- a single-page system map that explains the full app footprint in layman terms
- a more detailed platform inventory that expands configs, public values, storage locations, and platform usage
- one canonical current handoff folder that a new operator can open first without hunting through old docs
- current repo state / commit reference
- exact OneDrive restore path
- exact GitHub branch / commit to restore
- exact bundle filename
- env restore file locations
- any known external dependencies still required after restore
- a config coverage inventory that clearly splits:
  - repo-local config files included in the backup set
  - database backup artifacts included in the backup set
  - platform-managed configs that are documented but still require dashboard access
  - the current database boundaries used by the app stack

The single-file layman restore guide should explicitly call out config coverage for at least:

- Render
- Resend
- Lovable
- Google auth / OAuth
- Supabase
- any additional live platform dependency currently used by the stack

Important:

- list config categories, file names, project refs, service URLs, and ownership boundaries
- do not print raw secret values into the layman restore guide or notification email
- if any platform-side setup must be completed before restore can succeed, include a plain-English "set this before restore" checklist for that platform
- the layman guide should distinguish:
  - what must be restored onto disk first
  - what must be configured in external dashboards before startup
  - what can be verified after services are running

Minimum named docs to include or refresh when practical:

- `docs/RESTORE_PACK_CURRENT/START_HERE.md`
- `docs/LATEST_RESTORE_GUIDE.html`
- `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt`
- `LOCAL_OPS_SERIES_MANAGEMENT_START_HERE_CURRENT.md`
- `docs/GAMECHANGRS_SYSTEM_MAP_CURRENT.html`
- `docs/GAMECHANGRS_SYSTEM_MAP_CURRENT.pdf`
- `docs/GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.html`
- `docs/GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.pdf`
- one single-file layman restore guide such as `LATEST_RESTORE_GUIDE.html` or newer equivalent
- `START_HERE_FOR_RESTORE_2026_05_04.md` or newer equivalent
- `COMPLETE_RESTORE_PLAN_2026_05_04.md` or newer equivalent
- `CODEX_CLEAN_SLATE_RESTORE_PROMPT_2026_05_04.txt` or newer equivalent
- `LOCAL_OPS_SERIES_MANAGEMENT_START_HERE_2026_05_10.md` or newer equivalent

Current refresh helper:

- `scripts/sync_restore_pack_current.sh`

Expected contents of `docs/RESTORE_PACK_CURRENT`:

- `START_HERE.md`
- `LATEST_RESTORE_GUIDE.html`
- `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt`
- `LOCAL_OPS_SERIES_MANAGEMENT_START_HERE_CURRENT.md`
- `GAMECHANGRS_SYSTEM_MAP_CURRENT.html`
- `GAMECHANGRS_SYSTEM_MAP_CURRENT.pdf`
- `GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.html`
- `GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.pdf`

## What to report back

After completing a full backup, report:

- pushed branch and commit hash
- whether the worktree is clean
- OneDrive backup folder path
- restore-point folder path
- artifact filenames created or updated
- whether secrets/env files were included
- whether database dumps were included
- which single-file layman restore guide was generated or refreshed
- which Codex restore prompt was attached for restore automation
- which system map files were generated or refreshed
- which detailed platform inventory files were generated or refreshed
- whether `docs/RESTORE_PACK_CURRENT` was refreshed
- whether old local Supabase dump / export artifacts were cleaned up
- whether the notification email was sent
- any missing pieces or external dependencies still not captured

## Backup notification email

After every `backup everything for me` request that includes a restore point, send an email to:

- `mohan.arun@gmail.com`
- `helloarth09@gmail.com`

Subject format:

- `Game-Changrs : Last complete Backup: YYYY-MM-DD HH:MM TZ`

The email should include:

- latest restore-point folder path
- current `main` commit hash
- backup branch and backup tag
- main restore artifacts
- restore order / instructions
- any caveat about database dump freshness or external dependencies

The email should attach:

- one single-file layman restore guide in HTML or DOCX format
- one Codex restore prompt file that can be pasted directly into Codex to restore from the backup set
- one single-page Game-Changrs simplified system map in HTML or PDF form, preferably both when practical
- one detailed platform inventory in HTML or PDF form, preferably both when practical
- the email body should also point the reader to `docs/RESTORE_PACK_CURRENT/START_HERE.md` as the first file to open

## Current known backup location pattern

- Root:
  `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup`

## Important note

If the user says **backup everything**, do not stop at just `git push`.
That request means GitHub state, OneDrive restore-point artifacts, and restore documentation should all be brought up to date unless the user explicitly asks for a lighter checkpoint.

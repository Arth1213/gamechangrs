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
12. Confirm that GitHub contains the latest code and that the local OneDrive backup contains the corresponding restore artifacts.

## Expected backup outputs

A full backup should aim to include these categories:

- GitHub `main` contains the latest intended code.
- OneDrive restore-point folder contains:
  - repo bundle
  - repo source archive
  - worktree archive
  - restore docs
  - backup status file
  - repo state file
  - checksum file
- Secret and env backup copies when included:
  - root `.env` restore copy
  - `bay-area-u15/.env` restore copy
  - any local config restore copies already part of the established backup convention
- Database exports or dumps when available and requested.

## Restore documentation minimum

When "backup everything" is requested, the backup should either include or reference:

- a start-here restore document
- a complete restore plan
- current repo state / commit reference
- exact OneDrive restore path
- exact GitHub branch / commit to restore
- exact bundle filename
- env restore file locations
- any known external dependencies still required after restore

## What to report back

After completing a full backup, report:

- pushed branch and commit hash
- whether the worktree is clean
- OneDrive backup folder path
- restore-point folder path
- artifact filenames created or updated
- whether secrets/env files were included
- whether database dumps were included
- any missing pieces or external dependencies still not captured

## Current known backup location pattern

- Root:
  `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup`

## Important note

If the user says **backup everything**, do not stop at just `git push`.
That request means GitHub state, OneDrive restore-point artifacts, and restore documentation should all be brought up to date unless the user explicitly asks for a lighter checkpoint.

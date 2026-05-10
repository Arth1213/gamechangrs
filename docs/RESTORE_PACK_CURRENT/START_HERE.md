# Game-Changrs Restore Pack Current

This folder is the handoff pack a new operator should open first.

If someone new needs to restore Game-Changrs on a laptop, tell them to open `START_HERE.html` first, then use the files in this folder in this order.

## Use this order

1. Open `START_HERE.html`
2. Open `LATEST_RESTORE_GUIDE.html`
3. If using Codex to do the restore, open `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt`
4. If local operator work is needed after restore, use `LOCAL_OPS_SERIES_MANAGEMENT_START_HERE_CURRENT.md`
5. Use `GAMECHANGRS_SYSTEM_MAP_CURRENT.html` or `.pdf` to understand the simplified system
6. Use `GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.html` or `.pdf` when exact platform/config ownership is needed

## What this pack is for

This pack is meant to make restore and handoff easy for a new person.

It should answer:

- what Game-Changrs actually is
- what files need to be restored first
- which files come from Git and which files come from the OneDrive restore-point backup
- what external platforms need manual setup before startup
- what commands to run
- what URLs to open
- what “working correctly” looks like

## Very important distinction

- the repo code comes from GitHub or from the git bundle in the restore-point backup
- the env files do **not** come from Git
- the env files must be copied from the OneDrive restore-point backup into:
  - `gamechangrs-phase10-deploy/.env`
  - `gamechangrs-phase10-deploy/bay-area-u15/.env`

## Important rule

This folder should always contain the current copies of the canonical restore artifacts.

When `backup everything for me` is requested, this pack should be refreshed before the OneDrive restore point and backup email are created.

# Game-Changrs Codex Reopen Checklist

Use this after signing back into Codex so the right Game-Changrs context comes back immediately.

## Open these paths first

- Parent workspace root:
  `/Users/artharun/Downloads/GAME-CHANGRS`
- Canonical Game-Changrs repo:
  `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy`
- Analytics/backend workspace inside the repo:
  `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15`
- Current restore/handoff pack:
  `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT`
- Local backup artifacts:
  `/Users/artharun/Downloads/GAME-CHANGRS/backups`
- OneDrive backup root:
  `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup`
- Latest known restore point as of 2026-07-08:
  `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/20260708/2026_07_08-Game-Changrs-Complete-Restore-Point-1932-PDT`
- Live Arth profile content inside the main repo:
  `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/public/arth`
- Separate Arth workspace root:
  `/Users/artharun/arthcode`

## What is canonical vs non-canonical

- Use `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy` as the source of truth for code changes.
- Use `/Users/artharun/Downloads/GAME-CHANGRS` as the umbrella workspace when you want code, backups, and helper folders visible together.
- `bay-area-u15` is not a separate repo. It is the analytics/backend and local-ops workspace inside the canonical repo.
- `public/arth` is the live Arth profile content that ships with the main site.
- `/Users/artharun/arthcode` is a separate Arth workspace and should only be treated as active if you are intentionally working there.
- Do not treat these as source of truth unless doing recovery or comparison:
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-main`
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy-codex-general`
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy-codex-min`
  - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy-codex-safe`

## Reopen flow in Codex

1. Open the workspace at:
   `/Users/artharun/Downloads/GAME-CHANGRS`
2. Tell Codex to treat:
   `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy`
   as the canonical repo.
3. Ask Codex to read these files before making any changes:
   - `docs/RESTORE_PACK_CURRENT/START_HERE.html`
   - `docs/RESTORE_PACK_CURRENT/LATEST_RESTORE_GUIDE.html`
   - `docs/RESTORE_PACK_CURRENT/GAMECHANGRS_SYSTEM_MAP_CURRENT.html`
   - `docs/RESTORE_PACK_CURRENT/GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.html`
   - `docs/RESTORE_PACK_CURRENT/CODEX_REOPEN_CHECKLIST_CURRENT.html`
4. If the task is analytics, tell Codex to inspect:
   `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15`
5. If the task is Arth profile work, tell Codex whether the change belongs in:
   - `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/public/arth`
   - `/Users/artharun/arthcode`

## Prompt to paste into Codex after sign-in

```text
Read /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT/START_HERE.html,
/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT/LATEST_RESTORE_GUIDE.html,
/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT/GAMECHANGRS_SYSTEM_MAP_CURRENT.html,
/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT/GAMECHANGRS_PLATFORM_INVENTORY_DETAIL_CURRENT.html,
and /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT/CODEX_REOPEN_CHECKLIST_CURRENT.html.

Treat /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy as the canonical Game-Changrs repo.
If the task involves analytics or local ops, also inspect /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/bay-area-u15.
If the task involves the Arth profile, also inspect /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/public/arth and /Users/artharun/arthcode.

Build context first, then summarize current state before making changes.
```

## Backup and restore locations to remember

- All dated OneDrive restore points live under:
  `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup`
- The local database/schema backup folder is:
  `/Users/artharun/Downloads/GAME-CHANGRS/backups`
- The restore pack that should always be current inside the repo is:
  `/Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy/docs/RESTORE_PACK_CURRENT`
- The `backup everything for me` workflow should refresh this checklist, the restore guide, the system map, the detailed inventory, and the OneDrive restore-point folder together.

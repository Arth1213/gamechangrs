# Automatic Full Restore Points Design

## Goal

Create a recoverable restore point before every analytics data-writing refresh and after every successful refresh. Each point must be mirrored to the established OneDrive root and contain the database, source and raw refresh artifacts, code, restore instructions, and Codex recovery prompts.

## Scope

The policy applies to `refresh-series` and `refresh-match`, whether started from the CLI or local operator console. It creates two independent points for a successful refresh:

1. `pre-refresh`: the state immediately before database-writing work begins.
2. `post-refresh`: the completed, validated state after fact ingest and downstream recomputation.

If a refresh fails, the pre-refresh point remains the recovery baseline. The failure summary, raw source artifacts, and run files are retained alongside it; no post-refresh point is declared valid.

## Storage Layout

Local staging root:

`/Users/artharun/Downloads/GAME-CHANGRS/backups/YYYYMMDD/<timestamp>-<series-key>-<phase>`

OneDrive mirror root:

`/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup/YYYYMMDD/<timestamp>-<series-key>-<phase>`

Every restore point contains:

- PostgreSQL logical dump and SHA-256 checksum.
- Git bundle and source archive at the exact Git SHA.
- Series configuration, weights, worker/API implementation, and package lockfiles.
- Raw discovery, inventory, scorecard, commentary, run files, refresh summary, validation summary, and failure artifacts for the operation.
- `START_HERE.md`, a restore checklist, explicit database restore commands, and source/artifact restore paths.
- Current Codex reopen checklist and clean-slate restore prompt.
- A manifest recording timestamps, phase, series key, Git SHA, database dump checksum, artifact list, and OneDrive destination.
- An encrypted secret archive containing required environment restore copies and service configuration.

## Key Management

The encryption passphrase is generated or retrieved from macOS Keychain under a stable Game-Changrs backup service/account entry. The passphrase is never written to Git, the manifest, logs, or OneDrive. Restore instructions identify the Keychain entry and explain the manual recovery path if the original Mac is unavailable.

## Refresh Integration

The refresh wrapper performs this sequence:

1. Validate backup prerequisites: `pg_dump`, Keychain entry, local backup root, and OneDrive root.
2. Create and verify the pre-refresh restore point before live discovery and any analytics database write.
3. Run the existing completed-match-only refresh pipeline.
4. On success, create and verify the post-refresh restore point.
5. On failure, append failure artifacts to the pre-refresh point and return a summary that names the recovery point.

The system does not publish data. A backup failure prevents the refresh from starting, because proceeding would remove the guaranteed rollback point.

## Restore Procedure

`START_HERE.md` directs an operator to select the latest valid post-refresh point, or the latest pre-refresh point after a failed operation; verify the manifest and checksums; clone from the bundle or source archive; restore environment files only after decrypting the secret archive; restore PostgreSQL into the target database; restore raw artifacts; install dependencies; and run the included verification commands.

The Codex prompt tells a new session exactly where the restore point is, which phase is valid, how to recover the Keychain password on the original Mac, which database dump to use, and which verification commands establish a successful recovery.

## Error Handling and Verification

- Database dump failure, checksum mismatch, missing Keychain item, encryption failure, or incomplete OneDrive mirror fails the backup phase.
- The manifest is written only after all required files exist and their checksums have been recorded.
- The OneDrive mirror is verified by file count, manifest checksum, database-dump checksum, and encrypted-secret-archive checksum.
- Automated tests cover point naming, manifest construction, phase transitions, backup-failure blocking, and failure-artifact attachment.
- An integration smoke test uses a temporary directory and a mock database-dump command; it never writes production data.

## Explicit Non-Goals

- Automatic restore execution is not enabled; restore remains an explicit operator action.
- Encryption keys are not copied to OneDrive.
- The system does not bypass CricClubs anti-bot controls or fabricate match data when source access fails.

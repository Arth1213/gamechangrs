# Automatic Full Restore Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create verified encrypted pre-refresh and post-refresh recovery packs locally and in OneDrive for every data-writing Game-Changrs refresh.

**Architecture:** A small Node backup module owns naming, manifests, checksums, Keychain passphrase retrieval, archive validation, and failure-artifact attachment. A CLI wrapper performs database dumps and file packaging; the existing refresh wrappers call it before live discovery and after successful validation, and surface the recovery-point paths in every refresh summary.

**Tech Stack:** Node.js CommonJS, PostgreSQL `pg_dump`/`pg_restore`, macOS Keychain `security`, `tar`, `shasum`, `openssl`, Git, Node built-in `node:test`, OneDrive local sync folder.

## Global Constraints

- Create the pre-refresh point before any discovery, inventory, or analytics database write.
- Create the post-refresh point only after all selected matches ingest, recompute, and validate successfully.
- Backup failures block refresh execution; a failed refresh retains the verified pre-refresh point and its failure artifacts.
- Never write an encryption key, plaintext secret, database URL, or raw environment value to Git, logs, manifests, or OneDrive.
- Use `/Users/artharun/Library/CloudStorage/OneDrive-Personal/Game-Changrs-Backup` as the OneDrive mirror root.
- Do not publish as part of a refresh or backup.

---

## File Structure

- Create: `bay-area-u15/apps/worker/src/ops/restorePoint.js` — archive creation, Keychain access, checksums, manifests, OneDrive mirror verification, and failure attachment.
- Create: `bay-area-u15/apps/worker/src/ops/restorePointCli.js` — explicit backup command for recovery-point creation and verification.
- Create: `bay-area-u15/apps/worker/test/restorePoint.test.js` — deterministic unit tests using temporary directories and mock commands.
- Modify: `bay-area-u15/apps/worker/src/ops/localRefresh.js` — pre/post refresh orchestration and failure-artifact attachment.
- Modify: `bay-area-u15/apps/worker/src/index.js` — `backup-restore-point` command and refresh dependencies.
- Modify: `bay-area-u15/package.json` — backup command and test discovery.
- Modify: `BACKUP_EVERYTHING_PROTOCOL.md` — automate the standard restore-point policy and Keychain recovery instructions.
- Modify: `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt` and `docs/RESTORE_PACK_CURRENT/*` — include phase-aware restore selection and new artifact layout.

### Task 1: Build the deterministic restore-point primitives

**Files:**
- Create: `bay-area-u15/apps/worker/test/restorePoint.test.js`
- Create: `bay-area-u15/apps/worker/src/ops/restorePoint.js`

**Interfaces:**
- Produces: `buildRestorePointPaths({ localRoot, oneDriveRoot, now, seriesKey, phase }) => { localDir, oneDriveDir, name }`
- Produces: `buildRestoreManifest(input) => object`
- Produces: `verifyRestorePoint({ localDir, oneDriveDir }) => { ok, errors, manifest }`
- Produces: `attachFailureArtifacts({ restorePointDir, refreshSummaryPath, runDirectory }) => string[]`

- [ ] **Step 1: Write failing deterministic tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRestorePointPaths, buildRestoreManifest, verifyRestorePoint } = require('../src/ops/restorePoint');

test('creates date-partitioned pre-refresh paths in local and OneDrive roots', () => {
  const paths = buildRestorePointPaths({
    localRoot: '/tmp/local', oneDriveRoot: '/tmp/onedrive',
    now: new Date('2026-08-08T20:00:00Z'), seriesKey: 'ncca', phase: 'pre-refresh',
  });
  assert.match(paths.localDir, /20260808\/2026_08_08-200000-ncca-pre-refresh$/);
  assert.match(paths.oneDriveDir, /20260808\/2026_08_08-200000-ncca-pre-refresh$/);
});

test('manifest never accepts a plaintext secret path', () => {
  assert.throws(() => buildRestoreManifest({ phase: 'pre-refresh', plaintextSecretPaths: ['.env'] }), /plaintext secret/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/worker/test/restorePoint.test.js`

Expected: FAIL because `restorePoint.js` does not exist.

- [ ] **Step 3: Implement pure path, manifest, checksum, and verification functions**

```js
function buildRestorePointPaths({ localRoot, oneDriveRoot, now, seriesKey, phase }) {
  const stamp = formatUtc(now);
  const day = stamp.slice(0, 8);
  const name = `${stamp.slice(0, 4)}_${stamp.slice(4, 6)}_${stamp.slice(6, 8)}-${stamp.slice(9)}-${seriesKey}-${phase}`;
  return { name, localDir: path.join(localRoot, day, name), oneDriveDir: path.join(oneDriveRoot, day, name) };
}
```

Make `verifyRestorePoint` require `manifest.json`, `SHA256SUMS.txt`, a database dump entry, a Git bundle entry, the encrypted secret archive entry, and matching manifest/checksum bytes in the OneDrive mirror.

- [ ] **Step 4: Run the primitive tests**

Run: `node --test apps/worker/test/restorePoint.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bay-area-u15/apps/worker/src/ops/restorePoint.js bay-area-u15/apps/worker/test/restorePoint.test.js
git commit -m "feat: add restore point primitives"
```

### Task 2: Add secure backup packaging and explicit CLI operation

**Files:**
- Create: `bay-area-u15/apps/worker/src/ops/restorePointCli.js`
- Modify: `bay-area-u15/apps/worker/src/index.js`
- Modify: `bay-area-u15/package.json`
- Test: `bay-area-u15/apps/worker/test/restorePoint.test.js`

**Interfaces:**
- Consumes: Task 1 primitives.
- Produces: `createRestorePoint({ series, phase, refreshArtifactPaths, envFilePaths, commandRunner }) => Promise<summary>`.
- Produces: `npm run ops:backup:restore-point -- --series <series-key> --phase pre-refresh`.

- [ ] **Step 1: Add a failing packaging test with a mock command runner**

```js
test('creates a verified encrypted restore point without exposing the passphrase', async () => {
  const commands = [];
  const summary = await createRestorePoint({
    series: { slug: 'ncca' }, phase: 'pre-refresh', localRoot, oneDriveRoot,
    envFilePaths: [fixtureEnv],
    commandRunner: async (program, args) => { commands.push([program, ...args]); },
    getKeychainPassphrase: async () => 'test-passphrase',
  });
  assert.equal(summary.verified, true);
  assert.equal(JSON.stringify(summary).includes('test-passphrase'), false);
  assert.ok(commands.some(([program]) => program === 'pg_dump'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/worker/test/restorePoint.test.js`

Expected: FAIL because `createRestorePoint` is not exported.

- [ ] **Step 3: Implement packaging**

Implement these exact operations in `createRestorePoint`:

```text
1. `security find-generic-password -s Game-Changrs-Backup -a restore-point -w`
2. `pg_dump --format=custom --file <localDir>/database/analytics.dump "$DATABASE_URL"`
3. `git bundle create <localDir>/source/gamechangrs.bundle HEAD`
4. `git archive --format=tar.gz --output <localDir>/source/gamechangrs-source.tar.gz HEAD`
5. `tar -czf <localDir>/artifacts/refresh-artifacts.tar.gz <allowed refresh artifact paths>`
6. encrypt only copied env restore files with `openssl enc -aes-256-cbc -pbkdf2 -salt`, providing the passphrase through a file descriptor rather than command arguments
7. write `manifest.json`, `SHA256SUMS.txt`, `START_HERE.md`, and `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt`
8. copy the completed point to the OneDrive directory, then call `verifyRestorePoint`
```

Refuse to run if `pg_dump`, `security`, `openssl`, or the OneDrive directory is unavailable. Remove the temporary unencrypted env staging directory in a `finally` block.

- [ ] **Step 4: Add CLI wiring**

Add this package script:

```json
"ops:backup:restore-point": "node apps/worker/src/index.js backup-restore-point --config config/leagues.yaml"
```

Add the `backup-restore-point` command to `index.js`; accept `--series`, `--phase`, and `--refreshSummaryPath`, write `restore_point_summary.json`, and exit nonzero on verification failure.

- [ ] **Step 5: Run the test and CLI help checks**

Run: `npm test && npm run ops:help`

Expected: all tests pass and help lists `backup-restore-point`.

- [ ] **Step 6: Commit**

```bash
git add bay-area-u15/apps/worker/src/ops/restorePointCli.js bay-area-u15/apps/worker/src/index.js bay-area-u15/package.json bay-area-u15/apps/worker/test/restorePoint.test.js
git commit -m "feat: create encrypted restore points"
```

### Task 3: Enforce pre/post restore points around every refresh path

**Files:**
- Modify: `bay-area-u15/apps/worker/src/ops/localRefresh.js`
- Modify: `bay-area-u15/apps/worker/src/index.js`
- Modify: `bay-area-u15/apps/api/src/services/localOpsService.js`
- Test: `bay-area-u15/apps/worker/test/restorePoint.test.js`

**Interfaces:**
- Consumes: `createRestorePoint()` from Task 2.
- Produces: refresh summaries with `restorePoints.preRefresh`, `restorePoints.postRefresh`, and `restorePoints.failureArtifacts`.

- [ ] **Step 1: Add failing orchestration tests**

```js
test('refresh does not begin discovery when pre-refresh backup verification fails', async () => {
  await assert.rejects(
    refreshSeries({ series, createRestorePoint: async () => { throw new Error('backup verification failed'); }, discoverSeries: async () => { throw new Error('must not run'); } }),
    /backup verification failed/
  );
});

test('refresh creates a post-refresh point only after ingest and validation succeed', async () => {
  const phases = [];
  await refreshSeries({ series, createRestorePoint: async ({ phase }) => phases.push(phase), /* successful injected operations */ });
  assert.deepEqual(phases, ['pre-refresh', 'post-refresh']);
});
```

- [ ] **Step 2: Run the orchestration tests to verify they fail**

Run: `node --test apps/worker/test/restorePoint.test.js`

Expected: FAIL because refresh dependency injection and restore-point integration do not exist.

- [ ] **Step 3: Implement the wrapper**

In `refreshSeries`, call `createRestorePoint({ phase: 'pre-refresh' })` before `discoverSeries`. Store the verified summary under `summary.restorePoints.preRefresh`. On ingest/recompute/validation failure, call `attachFailureArtifacts` and write the error summary before rethrowing. On full success, call `createRestorePoint({ phase: 'post-refresh', refreshArtifactPaths: [...] })` and store the result under `summary.restorePoints.postRefresh`.

Pass `createRestorePoint` from both CLI and local-ops execution paths. Do not create a restore point for `--skipPipeline true`, because it is explicitly inventory-only.

- [ ] **Step 4: Run all worker tests and static checks**

Run: `npm test && node --check apps/worker/src/ops/localRefresh.js && node --check apps/api/src/services/localOpsService.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bay-area-u15/apps/worker/src/ops/localRefresh.js bay-area-u15/apps/worker/src/index.js bay-area-u15/apps/api/src/services/localOpsService.js bay-area-u15/apps/worker/test/restorePoint.test.js
git commit -m "feat: require restore points for refreshes"
```

### Task 4: Refresh the operational restore handoff

**Files:**
- Modify: `BACKUP_EVERYTHING_PROTOCOL.md`
- Modify: `CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt`
- Modify: `docs/RESTORE_PACK_CURRENT/START_HERE.md`
- Modify: `docs/RESTORE_PACK_CURRENT/CODEX_REOPEN_CHECKLIST_CURRENT.md`
- Modify: `scripts/sync_restore_pack_current.sh`

**Interfaces:**
- Consumes: restore-point manifest layout from Task 2.
- Produces: a phase-aware, clean-slate restore procedure.

- [ ] **Step 1: Write the required restore commands into `START_HERE.md`**

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in secrets/env.restore.enc -out /private/tmp/gamechangrs-env.tar.gz
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" database/analytics.dump
sha256sum -c SHA256SUMS.txt
```

Document that the password is retrieved from Keychain on the original Mac with `security find-generic-password -s Game-Changrs-Backup -a restore-point -w`; it must not be stored in OneDrive.

- [ ] **Step 2: Update the protocol and Codex prompt**

Require selection of the newest verified `post-refresh` point, or the newest verified `pre-refresh` point after a failure. Require manifest and checksum verification before any database restore. Include source/artifact recovery, external-service prerequisites, and no-secret-log rules.

- [ ] **Step 3: Refresh the canonical restore pack**

Run: `bash scripts/sync_restore_pack_current.sh`

Expected: prints the canonical `docs/RESTORE_PACK_CURRENT` path and all required source files are present.

- [ ] **Step 4: Verify documentation integrity**

Run: `rg -n "Game-Changrs-Backup|pre-refresh|post-refresh|SHA256SUMS|Game-Changrs-Backup" BACKUP_EVERYTHING_PROTOCOL.md CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt docs/RESTORE_PACK_CURRENT`

Expected: phase selection, OneDrive root, checksum verification, Keychain retrieval, and restore commands are all present.

- [ ] **Step 5: Commit**

```bash
git add BACKUP_EVERYTHING_PROTOCOL.md CODEX_CLEAN_SLATE_RESTORE_PROMPT_CURRENT.txt docs/RESTORE_PACK_CURRENT scripts/sync_restore_pack_current.sh
git commit -m "docs: add phase-aware restore instructions"
```

## Self-Review

- Spec coverage: Tasks 1–2 create verified encrypted database/code/artifact/secret packs; Task 3 enforces pre/post use for CLI and console refreshes; Task 4 supplies the restore guide and Codex prompts.
- Placeholder scan: no TODO/TBD placeholders present.
- Type consistency: `createRestorePoint` is defined in Task 2 and consumed by Task 3; `buildRestorePointPaths`, `buildRestoreManifest`, and `verifyRestorePoint` are defined in Task 1 and consumed by Task 2.

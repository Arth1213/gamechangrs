# DB Change Runbook

This repo is **not** safe for a blind root-level `supabase db push`.

Use the small wrapper scripts in [`scripts/`](./scripts) instead. They keep the
main app database and analytics database separate, and they track future
migration applies in `public.codex_schema_migrations`.

## Why this exists

- The repo contains migrations for **two different databases**.
- The main app uses its own curated manifest:
  [`migration-manifests/main_app_supabase_migrations_2026_05_04.txt`](./migration-manifests/main_app_supabase_migrations_2026_05_04.txt)
- Analytics/local-ops now has its own curated manifest:
  [`migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt`](./migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt)

## Safe rule

- Never run root-level `supabase db push`.
- Decide first which database owns the change.
- Append the new SQL file to the correct manifest.
- Use the target-specific wrapper only.

## Scripts

- `scripts/db-check-status.sh <target>`
- `scripts/db-apply-main-app.sh [--baseline-existing] [--dry-run]`
- `scripts/db-apply-analytics.sh [--baseline-existing] [--dry-run]`

Targets:

- `main-app`
- `analytics`

## Connection inputs

### Main app database

Set:

- `MAIN_APP_DATABASE_URL`

### Analytics database

Preferred:

- `ANALYTICS_DATABASE_URL`

Fallback:

- `bay-area-u15/.env` `DATABASE_URL`

## One-time baseline for the current live databases

The live databases already contain historical schema changes that were not
tracked in `public.codex_schema_migrations`.

Run this **once per database** when you are confident the live database already
matches the manifest:

```bash
MAIN_APP_DATABASE_URL='postgres://...' bash ./scripts/db-apply-main-app.sh --baseline-existing
```

```bash
ANALYTICS_DATABASE_URL='postgres://...' bash ./scripts/db-apply-analytics.sh --baseline-existing
```

This inserts tracking rows only. It does **not** execute SQL files.

## Future DB change workflow

1. Decide ownership:
   - marketplace / coaching / auth-adjacent app tables -> `main-app`
   - analytics / local-ops / entity access / player intelligence -> `analytics`
2. Add a new SQL migration file in `supabase/migrations/`.
3. Append that file to the correct manifest.
4. Run status:

```bash
MAIN_APP_DATABASE_URL='postgres://...' bash ./scripts/db-check-status.sh main-app
```

or

```bash
ANALYTICS_DATABASE_URL='postgres://...' bash ./scripts/db-check-status.sh analytics
```

5. Take a backup.
6. Run a dry run:

```bash
MAIN_APP_DATABASE_URL='postgres://...' bash ./scripts/db-apply-main-app.sh --dry-run
```

or

```bash
ANALYTICS_DATABASE_URL='postgres://...' bash ./scripts/db-apply-analytics.sh --dry-run
```

7. Apply for real:

```bash
MAIN_APP_DATABASE_URL='postgres://...' bash ./scripts/db-apply-main-app.sh
```

or

```bash
ANALYTICS_DATABASE_URL='postgres://...' bash ./scripts/db-apply-analytics.sh
```

8. Verify the affected runtime flow immediately.

## Notes

- The wrappers stop on first SQL error.
- The tracking table is intentionally tiny and future-facing.
- This does **not** try to rewrite or reconcile older Supabase migration history.
- If a future migration is blocked by earlier live history, handle that as a
  deliberate repair step, not inside a broad repo-wide push.

# Game-Changrs Config Reference - 2026-05-04

## Purpose

This document records the active configuration surface outside normal source code.

Secret values are intentionally not committed to git. The exact secret-bearing companion is:

- `CONFIG_VALUES_LOCAL_ONLY_2026_05_04.md`

That file should live only in the backup bundle, not in GitHub.

## Main app frontend env

File:

- repo root `.env`

Current shape:

- `VITE_SUPABASE_PROJECT_ID=tpiegapsjeetvwsybjiu`
- `VITE_SUPABASE_URL=https://tpiegapsjeetvwsybjiu.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<secret value in local-only companion>`

Purpose:

- frontend Supabase auth
- frontend table access
- frontend storage access

## Supabase config.toml

File:

- `supabase/config.toml`

Current live project id:

- `project_id = "tpiegapsjeetvwsybjiu"`

Important note:

- this file should stay pointed at the main app project
- do not repoint this file to the analytics project unless you are intentionally working on a different Supabase workspace

## Analytics/local-ops env

File:

- `bay-area-u15/.env`

Current shape:

- `DATABASE_URL=<analytics database URL, local-only companion>`
- `DATABASE_SSL_MODE=require`
- `DATABASE_SCHEMA_PATH=bay_area_u15_schema.sql`
- `SUPABASE_PROJECT_REF=tpiegapsjeetvwsybjiu`
- `SUPABASE_URL=https://tpiegapsjeetvwsybjiu.supabase.co`
- `SUPABASE_ANON_KEY=<secret value in local-only companion>`
- `SUPABASE_SERVICE_ROLE_KEY=` currently blank in the checked local file

Interpretation:

- `DATABASE_URL` still points at analytics
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` point at the main app project for token validation
- blank `SUPABASE_SERVICE_ROLE_KEY` does not currently block the existing API auth path

## Supabase project refs

- Supabase org id: `dlurarovcdxflspxonnu`
- Main app project ref: `tpiegapsjeetvwsybjiu`
- Analytics project ref: `azgebbtasywunltdhdby`

## Hosted services

### Render

- Service: `gamechangrs-cricket-api`
- URL: `https://gamechangrs-cricket-api.onrender.com`

Expected critical env groups:

- analytics DB connection
- main app Supabase auth trust values
- OpenAI key
- port/runtime values

### Lovable

- Project URL: `https://lovable.dev/projects/e14399ba-fbf2-42cf-bf82-4c38048ee762`
- Custom domain target: `https://game-changrs.com`

### GitHub

- Repo: `https://github.com/Arth1213/gamechangrs.git`
- Primary production branch: `main`

### DNS

- Provider: `IONOS`
- Primary custom domain: `game-changrs.com`

### Email

- Provider: `Resend`
- Used by app edge functions for:
  - seller contact
  - connection email
  - session notification

## What must be refreshed after changes

Update the backup bundle whenever any of these change:

- root `.env`
- `bay-area-u15/.env`
- `supabase/config.toml`
- main app Supabase project ref or keys
- analytics database URL/password
- Render env values
- Lovable project reference or publish target
- Resend key/domain values
- IONOS DNS values

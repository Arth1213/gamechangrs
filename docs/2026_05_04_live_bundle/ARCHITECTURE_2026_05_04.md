# Game-Changrs Architecture - 2026-05-04

## Stack summary

Game-Changrs is split into two backend data domains:

1. Main app/auth/coaching/marketplace on dedicated Supabase project `tpiegapsjeetvwsybjiu`
2. Cricket analytics/local-ops compute on dedicated analytics project/database `azgebbtasywunltdhdby`

## Component table

| Component | Location | Runtime | Purpose | Primary data source | Backup posture |
| --- | --- | --- | --- | --- | --- |
| Frontend app | repo root | Vite + React | Public site, auth flows, marketplace, coaching, Technique AI UI | Main app Supabase + Render API | repo bundle + tar + env copy |
| Main app Supabase | `tpiegapsjeetvwsybjiu` | Supabase | Auth, app tables, app storage, app edge functions | Supabase app project | API key references + schema/dump backup |
| App edge functions | `supabase/functions` | Deno on Supabase | contact form, seller email, session email, AI helpers | Main app Supabase secrets/env | repo + function env reference |
| Coaching marketplace | frontend + app DB | React + Supabase | coach/player profiles, connections, booking | main app tables | in app DB backup |
| Gear marketplace | frontend + app DB | React + Supabase | listing creation, public feed, seller contact handoff | `marketplace_listings` + `public_marketplace_listings` | in app DB backup |
| Technique AI | frontend + app DB | React + Supabase | local analysis + saved reports | `analysis_results` table | repo + app DB backup |
| Hosted cricket API | `bay-area-u15/apps/api` | Node/Express on Render | analytics pages, auth-aware series access, local-ops UI | analytics DB + app auth validation | repo + Render config doc |
| Local-ops console | `bay-area-u15/apps/api` | Node/Express local | series onboarding, workflow controls, operator console | analytics DB | repo + `bay-area-u15/.env` backup |
| Worker pipeline | `bay-area-u15/apps/worker` | Node local | discovery, inventory, ingest, compute, publish | analytics DB | repo + `bay-area-u15/.env` backup |
| Analytics database | `azgebbtasywunltdhdby` | Supabase Postgres | series data, matches, player intelligence, access model | analytics DB | logical dump + schema backup |
| Render service | `gamechangrs-cricket-api` | Render | hosted analytics/backend API | analytics DB + app auth config | external service + backup doc |
| Lovable project | project `e14399ba-fbf2-42cf-bf82-4c38048ee762` | Lovable | frontend publish and custom-domain delivery | GitHub main sync | external service + backup doc |
| GitHub repo | `Arth1213/gamechangrs` | GitHub | source of truth for code history | git | pushed commits + git bundle |
| Domain + DNS | IONOS | DNS | `game-changrs.com` custom domain routing | IONOS DNS records | external account + DNS reference doc |
| Email provider | Resend | API | transactional email for app flows | Supabase function env | external account + secret/value doc |

## Main app Supabase ownership

The app project owns:

- Auth
- `players`
- `coaches`
- `coaching_categories`
- `connections`
- `sessions`
- `ratings`
- `marketplace_listings`
- `public_marketplace_listings`
- `seller_contacts`
- `analysis_results`
- `contact_submissions`
- `coach_availability`
- `blocked_dates`
- buckets such as `profile-pictures` and `analysis-videos`

## Analytics project ownership

The analytics/local-ops project owns:

- series registry
- staging/inventory/compute/publish workflow state
- player intelligence and analytics data model
- entity/series access model for analytics
- local operator workflow state

## Auth boundary

The analytics API does not use the analytics Supabase project for user auth. It validates bearer tokens against the main app Supabase project via:

- `bay-area-u15/apps/api/src/lib/auth.js`

That means:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the API env must point at the main app project
- `DATABASE_URL` in the API env must keep pointing at analytics

## Current production map

- Public app domain: `https://game-changrs.com`
- Hosted analytics API: `https://gamechangrs-cricket-api.onrender.com`
- Main app Supabase: `https://tpiegapsjeetvwsybjiu.supabase.co`
- Analytics project ref: `azgebbtasywunltdhdby`

## High-risk areas

### Risk 1: auth drift

If Render auth settings drift away from the app project, analytics/admin pages break even when the database is healthy.

### Risk 2: schema cross-contamination

Do not push analytics-only migrations into the app project.

### Risk 3: secret drift

Resend, Lovable, Supabase, and Render values live outside git and must be preserved in the backup bundle.

### Risk 4: false restore confidence

The codebase alone is not enough. Full recovery requires external system access plus the local-only config/value backup.

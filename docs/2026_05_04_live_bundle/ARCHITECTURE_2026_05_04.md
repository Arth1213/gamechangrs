# Game-Changrs Architecture - 2026-05-04

## Stack summary

Game-Changrs is split into two backend data domains:

1. Main app/auth/coaching/marketplace on dedicated Supabase project `tpiegapsjeetvwsybjiu`
2. Cricket analytics/local-ops compute on dedicated analytics project/database `azgebbtasywunltdhdby`

## Component table

### Frontend and user-facing app

| Component | Location | Runtime | Purpose | Primary data source | Backup posture |
| --- | --- | --- | --- | --- | --- |
| Frontend app shell | repo root | Vite + React | Public site, auth flows, navigation, shared UI | Main app Supabase + Render API | repo bundle + tar + env copy |
| Home/About/public pages | repo root | Vite + React | marketing pages, public messaging, entry points | frontend repo content | repo bundle + tar |
| Coaching marketplace | frontend + app DB | React + Supabase | coach/player profiles, connections, booking | main app tables | repo + app DB backup |
| Gear marketplace | frontend + app DB | React + Supabase | listing creation, public feed, seller contact handoff | `marketplace_listings` + `public_marketplace_listings` | repo + app DB backup |
| Technique AI | frontend + app DB | React + Supabase | local analysis workflow + saved reports | `analysis_results` table | repo + app DB backup |

### Main app auth, data, and functions

| Component | Location | Runtime | Purpose | Primary data source | Backup posture |
| --- | --- | --- | --- | --- | --- |
| Main app Supabase | `tpiegapsjeetvwsybjiu` | Supabase | Auth, app tables, app storage, app edge functions | Supabase app project | API key references + schema/dump backup |
| App edge functions | `supabase/functions` | Deno on Supabase | contact form, seller email, session email, AI helpers | Main app Supabase secrets/env | repo + function env reference |
| App storage buckets | main app Supabase storage | Supabase Storage | profile pictures, analysis videos, app uploads | main app project storage | app DB/project backup context |

### Analytics and local-ops

| Component | Location | Runtime | Purpose | Primary data source | Backup posture |
| --- | --- | --- | --- | --- | --- |
| Hosted cricket API | `bay-area-u15/apps/api` | Node/Express on Render | analytics pages, auth-aware series access, local-ops UI | analytics DB + app auth validation | repo + Render config doc |
| Local-ops console | `bay-area-u15/apps/api` | Node/Express local | series onboarding, workflow controls, operator console | analytics DB | repo + `bay-area-u15/.env` backup |
| Worker pipeline | `bay-area-u15/apps/worker` | Node local | discovery, inventory, ingest, compute, publish | analytics DB | repo + `bay-area-u15/.env` backup |
| Analytics database | `azgebbtasywunltdhdby` | Supabase Postgres | series data, matches, player intelligence, access model | analytics DB | logical dump + schema backup |

### Delivery and external platforms

| Component | Location | Runtime | Purpose | Primary data source | Backup posture |
| --- | --- | --- | --- | --- | --- |
| Render service | `gamechangrs-cricket-api` | Render | hosted analytics/backend API | analytics DB + app auth config | external service + backup doc |
| Lovable project | project `e14399ba-fbf2-42cf-bf82-4c38048ee762` | Lovable | frontend publish and custom-domain delivery | GitHub main sync | external service + backup doc |
| GitHub repo | `Arth1213/gamechangrs` | GitHub | source of truth for code history | git | pushed commits + git bundle |
| Domain + DNS | IONOS | DNS | `game-changrs.com` custom domain routing | IONOS DNS records | external account + DNS reference doc |
| Email provider | Resend | API | transactional email for app flows | Supabase function env | external account + secret/value doc |

## Build and platform map

This section answers which tool or platform was used to build, maintain, host, or operate each major part of Game-Changrs.

| Area | Built or maintained with | Hosted or operated by | Notes |
| --- | --- | --- | --- |
| Frontend React app | Lovable for the original app scaffold and frontend workflow, then Codex for ongoing code changes, fixes, production cleanup, docs, and verification | Browser client + Lovable publish + GitHub `main` | Source code lives in the repo root |
| Home page, About page, marketplace, coaching UI, Technique AI UI | Mostly repo code maintained through Codex in the local worktree; some earlier frontend structure originated from the Lovable workflow | Delivered through the frontend publish at `game-changrs.com` | Recent fixes such as saved Technique AI reports and timezone-safe booking were done through Codex |
| Main app auth, app tables, storage, and edge functions | Supabase project setup plus repo migrations/functions maintained through Codex | Main app Supabase project `tpiegapsjeetvwsybjiu` | This is the live source for auth, marketplace, coaching, Technique AI report storage, and email-triggering functions |
| Analytics/local-ops backend and worker pipeline | Built and maintained in the repo through Codex | Local Node runtime and Render | Code lives under `bay-area-u15` |
| Hosted analytics/admin API | Repo code maintained through Codex | Render service `gamechangrs-cricket-api` | Render uses analytics DB access and main-app Supabase token validation |
| Analytics database and series compute data model | Schema and data model maintained from repo/local-ops work, with data stored in Supabase Postgres | Analytics Supabase/Postgres project `azgebbtasywunltdhdby` | Separate from the main app project on purpose |
| Frontend publishing | GitHub-backed Lovable project | Lovable + custom domain routing | Lovable pulls from GitHub and serves the frontend publish target |
| Backend hosting | Repo deployment target | Render | Render is only for the analytics/backend API, not the main frontend |
| Source control and recovery history | Git + GitHub + Codex-created backup artifacts | GitHub | GitHub `main` is the code source of truth; the backup bundle adds portable recovery artifacts |
| Email delivery | Supabase edge functions call Resend | Resend | Resend is the mail transport, not the business-logic host |
| Domain routing and DNS | Manual operator setup | IONOS | IONOS owns DNS and custom-domain records |

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

## Logical architecture diagram

```text
                                   GAME-CHANGRS LOGICAL ARCHITECTURE

  Users / Browsers
         |
         v
  game-changrs.com
  (Lovable-published frontend from GitHub main)
         |
         +--------------------------+
         |                          |
         v                          v
  Main App Supabase           Render Hosted API
  tpiegapsjeetvwsybjiu        gamechangrs-cricket-api
  - Auth                      - analytics/admin endpoints
  - app tables                - auth-aware series access
  - storage                   - local-ops UI when hosted
  - edge functions            - player analytics/chat services
         |                          |
         |                          v
         |                   Analytics DB
         |                   azgebbtasywunltdhdby
         |                   - series registry
         |                   - match/player intelligence
         |                   - workflow and access state
         |
         +--> marketplace
         +--> coaching marketplace
         +--> Technique AI saved reports
         +--> contact/session email triggers


  Local operator machine
  /Users/artharun/Downloads/GAME-CHANGRS/gamechangrs-phase10-deploy
         |
         +--> frontend local dev
         |
         +--> bay-area-u15 local-ops
               - local API
               - worker pipeline
               - staging / ingest / compute / publish
               - connects to analytics DB
               - validates bearer tokens against main app Supabase


  Supporting external platforms
  - GitHub: source control and production branch
  - Lovable: frontend publish layer
  - Render: hosted analytics/backend API
  - Supabase main app: auth/app data/functions/storage
  - Supabase analytics: analytics/local-ops database
  - Resend: transactional email delivery
  - IONOS: DNS and custom domain routing
```

## High-risk areas

### Risk 1: auth drift

If Render auth settings drift away from the app project, analytics/admin pages break even when the database is healthy.

### Risk 2: schema cross-contamination

Do not push analytics-only migrations into the app project.

### Risk 3: secret drift

Resend, Lovable, Supabase, and Render values live outside git and must be preserved in the backup bundle.

### Risk 4: false restore confidence

The codebase alone is not enough. Full recovery requires external system access plus the local-only config/value backup.

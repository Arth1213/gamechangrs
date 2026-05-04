# Clean Supabase Split Architecture - 2026-05-04

## Goal

Replace the missing main app Supabase project `snlutvotzeijzqdwlank` with a new dedicated Game-Changrs app project without collapsing the app and the cricket analytics/local-ops stack into one database.

## Target Architecture

### 1. Main Game-Changrs app Supabase project

This project should own:

- Auth
- Frontend Supabase client
- Coaching marketplace tables
- Gear marketplace tables
- Contact form submissions
- Technique AI saved analysis history
- Profile picture storage
- Analysis video storage
- App edge functions under `supabase/functions`

### 2. Cricket analytics and local-ops project `azgebbtasywunltdhdby`

This project should keep owning:

- `bay-area-u15` worker and API `DATABASE_URL`
- Series compute and player intelligence data
- Local ops workflows
- Hosted analytics API data model
- Phase 10 entity and viewer access model inside the analytics database

### 3. Bridge between both projects

The analytics API currently validates bearer tokens by calling Supabase Auth:

- `bay-area-u15/apps/api/src/lib/auth.js`

After migration, the analytics API must continue using its current analytics `DATABASE_URL`, but it must validate user tokens against the new main app Supabase project instead of `snlutvotzeijzqdwlank`.

## Why This Is The Clean Split

- It keeps app auth and app data in one app-owned place.
- It keeps analytics compute and local-ops data in the analytics-owned place that is already accessible.
- It avoids a mixed project where marketplace, coaching, auth, series compute, and local ops all share one Supabase boundary.
- It preserves current analytics compute and data pulls with the smallest backend blast radius.

## Current Dependency Surface

### Main app currently tied to the missing project

- Frontend client:
  - `.env`
  - `src/integrations/supabase/client.ts`
- Auth:
  - `src/contexts/AuthContext.tsx`
- Edge functions called directly from frontend:
  - `src/pages/Contact.tsx`
  - `src/components/coaching/VideoAnalyzer.tsx`
- App tables used by frontend and functions:
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
- App storage buckets:
  - `profile-pictures`
  - `analysis-videos`

### Analytics stack currently separate except for auth trust

- Database connection:
  - `bay-area-u15/.env`
  - `bay-area-u15/apps/api/src/lib/connection.js`
  - `bay-area-u15/apps/worker/src/lib/db.js`
- Auth trust path that must be updated during cutover:
  - `bay-area-u15/apps/api/src/lib/auth.js`

## Critical Risks

### Risk 1. Auth break between app and analytics

If the frontend starts issuing tokens from the new main app project before the analytics API is updated to trust that project, analytics pages, admin access, and player intelligence routes will start returning 401.

### Risk 2. False assumption that old app data can be preserved

The missing project held app auth and app tables. That data is not recoverable from this repo alone. Migration preserves functionality and architecture, not the missing live rows.

### Risk 3. Applying analytics-only schema to the new app project

Top-level `supabase/migrations` now contains both original app migrations and later Phase 10 analytics access-foundation migrations. Blindly pushing all migrations into the new app project would create an unnecessary and confusing hybrid schema.

### Risk 4. Edge function secret drift

Several app functions depend on runtime secrets:

- `LOVABLE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `RESEND_API_KEY`
- `SITE_URL`

Missing one of these will make the migration look partially successful while important flows quietly fail.

### Risk 5. OAuth redirect mismatch

The main app uses Supabase Auth and frontend callback URLs built from the live origin:

- `src/lib/authRedirect.ts`

If the new project does not have correct site URL and redirect URLs, email auth and Google auth will break even if the frontend env is correct.

### Risk 6. Publishing too early

If Lovable or frontend publish happens before the new project, new secrets, and Render auth trust are all in place, production will break in a way that looks random across pages.

## Decision

Do not reuse `azgebbtasywunltdhdby` as the new main app project.

Create a new dedicated Game-Changrs app Supabase project and use `azgebbtasywunltdhdby` only for analytics/local ops.

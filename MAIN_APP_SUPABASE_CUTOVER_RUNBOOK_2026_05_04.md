# Main App Supabase Cutover Runbook - 2026-05-04

This runbook is intentionally staged so every step has:

- a narrow objective
- a validation check
- a revert path

Do not skip validation gates.

## Preconditions

You will need:

- a newly created Supabase project for the main Game-Changrs app
- access to its dashboard and API keys
- access to Render env vars for the cricket API
- access to Lovable publish for the frontend

Do not start production cutover until the new project is fully prepared and tested locally.

## Step 0. Freeze and checkpoint

### Objective

Create a no-risk rollback point before any project or env changes.

### Actions

1. Confirm Git clean state in the working repo.
2. Create a new backup branch and tag.
3. Save current `.env`, `bay-area-u15/.env`, and Render env values outside the repo.

### Validate

- Current production login still works.
- Current public stats still load.
- Current analytics pages still load.

### Revert

- None needed. This is a checkpoint only.

## Step 1. Create the new main app Supabase project

### Objective

Provision the dedicated replacement for the missing app backend.

### Actions

1. Create a new Supabase project.
2. Record:
   - project ref
   - project URL
   - anon key
   - service role key
3. Set Auth site URL to `https://game-changrs.com`.
4. Add redirect URLs for:
   - `https://game-changrs.com/auth`
   - local development origins you use

### Validate

- Project appears in Supabase dashboard and CLI.
- API keys are visible.
- Auth settings save successfully.

### Revert

- Delete the unused new project if you decide not to continue.

## Step 2. Prepare app schema only

### Objective

Apply only the app-owned schema to the new project.

### Actions

1. Do not run a blind `supabase db push` from the current root.
2. Use only the migration list in:
   - `migration-manifests/main_app_supabase_migrations_2026_05_04.txt`
3. Do not apply:
   - `migration-manifests/analytics_local_ops_owned_by_azgebbtasywunltdhdby_2026_05_04.txt`

### Validate

- Tables exist:
  - `players`
  - `coaches`
  - `coaching_categories`
  - `connections`
  - `sessions`
  - `ratings`
  - `marketplace_listings`
  - `seller_contacts`
  - `analysis_results`
  - `contact_submissions`
  - `coach_availability`
  - `blocked_dates`
- View exists:
  - `public_marketplace_listings`
- Buckets exist:
  - `profile-pictures`
  - `analysis-videos`

### Revert

- Drop the new project and recreate it if the wrong schema was applied.

## Step 3. Deploy app edge functions to the new project

### Objective

Restore the app-owned serverless behavior in the new app project.

### Functions to deploy

- `analyze-cricket`
- `analyze-gear-image`
- `contact-form`
- `contact-seller`
- `generate-career-summary`
- `scrape-profile-url`
- `send-connection-email`
- `send-session-notification`

Do not deploy analytics-only functions here unless there is a deliberate reason:

- `analytics-player-report-chat`
- `cricclubs-player-analytics`

### Secrets required in the new app project

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY`
- `RESEND_API_KEY`
- `SITE_URL=https://game-changrs.com`

### Validate

- Function deploys succeed.
- `contact-form` returns 200 for valid input.
- `analyze-cricket` returns a valid analysis payload.
- `contact-seller` returns success against a seeded test listing.

### Revert

- Leave the old production app untouched. Delete or redeploy the new project functions if needed.

## Step 4. Seed minimum app data required for smoke tests

### Objective

Create just enough data to validate core product flows.

### Actions

1. Create one test coach profile.
2. Create one test player profile.
3. Create one marketplace listing and matching seller contact.
4. Create one sample session slot.

### Validate

- Coaching marketplace renders records.
- Marketplace renders public listing.
- Booking flow can read availability.

### Revert

- Delete seeded test rows from the new project.

## Step 5. Point local frontend to the new main app project

### Objective

Test the app end-to-end locally against the replacement backend.

### Actions

1. Update local `.env` with the new main app project URL and publishable key.
2. Update `supabase/config.toml` with the new project ref.
3. Keep `bay-area-u15` `DATABASE_URL` unchanged.

### Validate

- Local frontend loads.
- Sign up works.
- Email or Google auth callback lands correctly on `/auth`.
- Sign in and sign out work.
- Home and About render.
- Marketplace public list loads.
- Coaching marketplace loads.
- Technique AI page loads.

### Revert

- Restore the previous `.env`.
- Restore the previous `supabase/config.toml`.

## Step 6. Repoint cricket API auth only

### Objective

Keep analytics/local-ops on `azgebbtasywunltdhdby`, but make the hosted API trust tokens from the new main app project.

### Actions

Update Render env vars for the cricket API:

- `SUPABASE_URL=<new-main-app-supabase-url>`
- `SUPABASE_ANON_KEY=<new-main-app-anon-key>`

Do not change:

- `DATABASE_URL`
- `DATABASE_SSL_MODE`

### Validate

- Analytics routes still load for public pages.
- Signed-in analytics routes accept tokens from the new app project.
- Admin and viewer access flows still authorize correctly.
- Local ops and worker compute still work because their DB connection remains unchanged.

### Revert

- Restore the previous Render `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Restart the Render service.

## Step 7. Run full local validation

### Objective

Prove the replacement backend preserves functionality before touching production publish state.

### Validate

- Frontend auth
  - email signup
  - email sign in
  - Google sign in
  - sign out
- Marketplace
  - public browse
  - create listing
  - contact seller
- Coaching marketplace
  - browse coaches
  - request connection
  - book session
- Technique AI
  - analyze clip
  - save history
  - open history
- Profile management
  - upload profile picture
- Analytics
  - public dashboard summary
  - signed-in analytics route
  - player intelligence
- Public stats
  - home page counts
  - about page counts

### Revert

- Restore local envs and Render auth env if any test breaks.

## Step 8. Production cutover

### Objective

Promote the already-validated backend change to production.

### Actions

1. Update production frontend env in the publish source.
2. Confirm Render auth env is already changed and healthy.
3. Publish frontend only after backend validation is green.

### Validate

- Production login
- Production Google auth
- Production marketplace browse
- Production coaching marketplace
- Production Technique AI analyze
- Production analytics signed-in route
- Production public stats

### Revert

- Restore previous production frontend env or republish previous frontend state.
- Restore previous Render auth env if needed.

## Step 9. Post-cutover hardening

### Actions

1. Rotate any exposed local secrets copied into old env files.
2. Remove references to `snlutvotzeijzqdwlank` from:
   - root `.env`
   - `supabase/config.toml`
   - `bay-area-u15/.env`
3. Record the new architecture in restore docs.

### Validate

- `rg snlutvotzeijzqdwlank` only finds historical documentation or archived restore notes.

### Revert

- None expected if the earlier checkpoints were respected.

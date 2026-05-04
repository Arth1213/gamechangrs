# Game-Changrs Environment Requirements

Date: 2026-05-03

## Root Frontend `.env`

Current keys required by the root app:

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Optional key used by analytics bridge logic:

- `VITE_CRICKET_API_BASE`

## Local Ops / Cricket API `bay-area-u15/.env`

Current keys present:

- `DATABASE_SCHEMA_PATH`
- `DATABASE_SSL_MODE`
- `DATABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Optional runtime keys used by the API/chat paths:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `LOVABLE_API_KEY`
- `SUPABASE_AUTH_TIMEOUT_MS`
- `PORT`
- `LOCAL_OPS_ENABLE_UI`

## Supabase Edge Function Secrets

These values live in Supabase, not in git:

- `LOVABLE_API_KEY`
- `OPENAI_API_KEY` if used for chat/provider paths
- `SUPABASE_SERVICE_ROLE_KEY`
- standard project-managed `SUPABASE_URL`

## Render Environment Requirements

Expected minimum runtime env for the hosted cricket API:

- `DATABASE_URL`
- `DATABASE_SSL_MODE`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT`

Potentially required depending on the feature set in use:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `LOVABLE_API_KEY`
- `CORS_ALLOW_ORIGIN`
- `SUPABASE_AUTH_TIMEOUT_MS`

## Non-File Restore Dependencies

These are required even if all files are restored:

- GitHub repo access
- Render service access
- Supabase dashboard or CLI access
- Lovable project access
- Google auth provider credentials/config if sign-in is enabled
- domain registrar / DNS access for `game-changrs.com`


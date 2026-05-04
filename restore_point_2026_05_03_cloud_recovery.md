# Game-Changrs Cloud Recovery Status

Date: 2026-05-03

## Summary

This document records what was backed up from cloud-connected systems at restore-point creation time and what still depends on live account access.

## GitHub

Backed up:

- repo backup branch `backup/2026_05-03-Game-Changrs-Restore-Point`
- repo backup branch commit `60f80447b7b601e8a1ecdf72b1063db5a029d222`
- branch `backup/2026_05-03-Game-Changrs-Restore-Point`
- tag `2026_05-03-Game-Changrs-Restore-Point`
- local portable git bundle
- local GitHub-style source archive

## Supabase Main App Project

Repo-linked project id:

- `snlutvotzeijzqdwlank`

Backed up:

- `supabase/migrations/`
- `supabase/functions/`
- `supabase/config.toml`
- root frontend env key names

Constraints observed during backup:

- direct CLI function listing against `snlutvotzeijzqdwlank` returned `403`
- no full SQL dump was taken from this project from this machine during this restore-point creation

Recovery implication:

- to fully restore this project after a total-loss event, you must still have Supabase dashboard or CLI access to the live project, or separately maintain a project-level database export outside this repo

## Supabase Analytics Project

Accessible project ref observed from this machine:

- `azgebbtasywunltdhdby`

Backed up:

- analytics code and migrations in git
- local ops runbooks and worker logic in git
- edge function inventory was readable for:
  - `analytics-player-report-chat`
  - `public-site-metrics`

Constraints observed during backup:

- `supabase db dump` required Docker or an alternate dump path
- local machine did not have `pg_dump`
- therefore no full SQL dump was produced during this restore-point creation

Recovery implication:

- if the analytics Supabase project itself is lost, you need either:
  - direct database dump access, or
  - to rebuild from the local raw series exports and rerun the onboarding/compute flows

## Render

Known hosted service:

- `https://gamechangrs-cricket-api.onrender.com`

Backed up:

- repo code for the hosted cricket API
- restore steps and env requirements in repo docs

Not backed up directly from Render:

- live env var values
- service dashboard metadata
- deploy history

Recovery implication:

- you need Render account access and the service env values

## Lovable

Backed up:

- frontend source code in git
- publish recovery steps in repo docs

Not backed up directly from Lovable:

- project-level editor metadata
- publish history
- any Lovable-only account settings

Recovery implication:

- you need Lovable project access to republish the frontend

## What You Still Need Besides `.env`

- GitHub account access
- Supabase project access
- Render service access
- Lovable project access
- Google auth credentials/config if sign-in is enabled
- domain/DNS access for `game-changrs.com`
- API key source of truth for:
  - `OPENAI_API_KEY`
  - `LOVABLE_API_KEY`
- database password / connection-string source of truth

## Recommendation

For a stronger disaster-recovery posture, the next improvement should be:

1. install `pg_dump` or Docker on the operator machine
2. produce scheduled SQL dumps for both Supabase-backed databases
3. store those dumps in a secure backup location outside the laptop
4. keep the secret archive separate from the code archive

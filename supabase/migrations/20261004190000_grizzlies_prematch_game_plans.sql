-- Private pre-match plans have no completed-match FK. Keep historical reports unchanged.
create table if not exists public.grizzlies_game_plan (
  id bigserial primary key,
  season_year integer not null check (season_year = 2026),
  plan_key text not null check (plan_key in ('dallas-xforia', 'baltimore-royals', 'manhattan-yorkers')),
  version text not null,
  status text not null check (status in ('reviewed', 'published', 'superseded')),
  plan_json jsonb not null check (jsonb_typeof(plan_json) = 'object'),
  evidence_checksum text not null,
  reviewed_at timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (season_year, plan_key, version),
  check (status <> 'published' or published_at is not null)
);
create unique index if not exists grizzlies_game_plan_one_published
  on public.grizzlies_game_plan (season_year, plan_key) where status = 'published';
alter table public.grizzlies_game_plan enable row level security;
revoke all on public.grizzlies_game_plan from anon, authenticated;
revoke all on sequence public.grizzlies_game_plan_id_seq from anon, authenticated;
-- No public RLS policy. The existing server DB role reads only after the
-- Grizzlies portal allowlist has approved the caller.

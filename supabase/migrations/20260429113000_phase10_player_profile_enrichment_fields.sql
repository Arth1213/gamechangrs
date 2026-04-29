alter table public.player
  add column if not exists primary_role_bucket text,
  add column if not exists batting_hand text,
  add column if not exists batting_style_bucket text,
  add column if not exists bowling_arm text,
  add column if not exists bowling_style_bucket text,
  add column if not exists bowling_style_detail text,
  add column if not exists profile_last_enriched_at timestamptz;

create index if not exists idx_player_primary_role_bucket
  on public.player (primary_role_bucket);

create index if not exists idx_player_batting_style_bucket
  on public.player (batting_style_bucket);

create index if not exists idx_player_bowling_style_bucket
  on public.player (bowling_style_bucket);

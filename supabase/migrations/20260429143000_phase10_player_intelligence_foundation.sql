create table if not exists public.player_intelligence_matchup (
  id bigserial primary key,
  series_id bigint not null references public.series(id) on delete cascade,
  scope_type text not null,
  division_id bigint references public.division(id) on delete set null,
  player_id bigint not null references public.player(id) on delete cascade,
  perspective text not null,
  split_group text not null,
  split_value text not null,
  split_label text,
  phase_bucket text not null default 'overall',
  match_count integer not null default 0,
  delivery_events integer not null default 0,
  legal_balls integer not null default 0,
  runs_scored integer not null default 0,
  runs_conceded integer not null default 0,
  dismissals integer not null default 0,
  wickets integer not null default 0,
  dot_balls integer not null default 0,
  boundaries integer not null default 0,
  wides integer not null default 0,
  no_balls integer not null default 0,
  strike_rate numeric(8,2),
  economy numeric(8,2),
  batting_average numeric(8,2),
  balls_per_dismissal numeric(8,2),
  balls_per_wicket numeric(8,2),
  dot_ball_pct numeric(8,2),
  boundary_ball_pct numeric(8,2),
  control_error_pct numeric(8,2),
  generated_at timestamptz not null default now()
);

create index if not exists idx_player_intelligence_matchup_lookup
  on public.player_intelligence_matchup (series_id, player_id, perspective, split_group, phase_bucket);

create table if not exists public.player_intelligence_dismissal (
  id bigserial primary key,
  series_id bigint not null references public.series(id) on delete cascade,
  scope_type text not null,
  division_id bigint references public.division(id) on delete set null,
  player_id bigint not null references public.player(id) on delete cascade,
  bowler_style_bucket text not null,
  bowler_style_label text,
  dismissal_type text not null,
  dismissal_count integer not null default 0,
  match_count integer not null default 0,
  average_runs_at_dismissal numeric(8,2),
  average_balls_faced_at_dismissal numeric(8,2),
  generated_at timestamptz not null default now()
);

create index if not exists idx_player_intelligence_dismissal_lookup
  on public.player_intelligence_dismissal (series_id, player_id, bowler_style_bucket, dismissal_type);

create table if not exists public.player_intelligence_profile (
  id bigserial primary key,
  series_id bigint not null references public.series(id) on delete cascade,
  scope_type text not null,
  division_id bigint references public.division(id) on delete set null,
  player_id bigint not null references public.player(id) on delete cascade,
  batting_match_count integer not null default 0,
  bowling_match_count integer not null default 0,
  batting_legal_balls integer not null default 0,
  bowling_legal_balls integer not null default 0,
  batting_rotation_ratio numeric(8,2),
  batting_high_leverage_strike_rate numeric(8,2),
  bowling_high_leverage_economy numeric(8,2),
  bowling_pressure_control_error_pct numeric(8,2),
  boundary_dot_threshold numeric(8,2),
  dismissal_dot_threshold numeric(8,2),
  boundary_after_three_dots_pct numeric(8,2),
  dismissal_after_three_dots_pct numeric(8,2),
  generated_at timestamptz not null default now()
);

create index if not exists idx_player_intelligence_profile_lookup
  on public.player_intelligence_profile (series_id, player_id, scope_type);

-- NCCA league-wide threat score. This preserves division-level composites and
-- persists the weighted, sample-aware score consumed by threat surfaces.
create table if not exists public.player_series_threat_score (
  id bigserial primary key,
  series_id bigint not null references public.series(id) on delete cascade,
  player_id bigint not null references public.player(id) on delete cascade,
  league_threat_score numeric(8,4) not null,
  league_percentile_rank numeric(8,4) not null,
  total_matches integer not null check (total_matches >= 0),
  division_evidence jsonb not null default '[]'::jsonb,
  score_version text not null default 'ncca-league-threat-v1',
  generated_at timestamptz not null default now(),
  unique (series_id, player_id, score_version)
);

create index if not exists idx_player_series_threat_score_rank
  on public.player_series_threat_score (series_id, league_percentile_rank desc);

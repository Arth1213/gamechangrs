-- Persisted, reviewable AI match analysis for the protected Grizzlies portal.
-- Raw match facts remain in match, innings, and ball_event; this table stores
-- only derived evidence and report output keyed to a single source match.

create table if not exists public.grizzlies_match_analysis_report (
  id bigserial primary key,
  series_id bigint not null references public.series(id) on delete cascade,
  match_id bigint not null references public.match(id) on delete cascade,
  report_type text not null default 'grizzlies_match_analysis'
    check (report_type = 'grizzlies_match_analysis'),
  status text not null default 'draft'
    check (status in ('draft', 'generated', 'reviewed', 'published', 'superseded', 'failed')),
  evidence_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence_json) = 'object'),
  analysis_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(analysis_json) = 'object'),
  source_data_checksum text not null,
  generation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_metadata) = 'object'),
  failure_reason text,
  generated_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, match_id, report_type)
);

create index if not exists idx_grizzlies_match_analysis_report_match_status
  on public.grizzlies_match_analysis_report (series_id, match_id, status);

create index if not exists idx_grizzlies_match_analysis_report_visible
  on public.grizzlies_match_analysis_report (series_id, status, published_at desc nulls last);

drop trigger if exists set_grizzlies_match_analysis_report_updated_at
  on public.grizzlies_match_analysis_report;

create trigger set_grizzlies_match_analysis_report_updated_at
before update on public.grizzlies_match_analysis_report
for each row execute function public.update_updated_at_column();

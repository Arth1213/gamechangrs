-- Keep reviewed/published legacy output visible while a new analysis model is
-- generated and reviewed independently for the same match.

alter table public.grizzlies_match_analysis_report
  add column if not exists analysis_model_version text;

update public.grizzlies_match_analysis_report
set analysis_model_version = 'legacy-v1'
where analysis_model_version is null;

alter table public.grizzlies_match_analysis_report
  alter column analysis_model_version set not null;

do $$
declare
  existing_constraint text;
begin
  select constraint_row.conname
  into existing_constraint
  from (
    select
      constraint_def.conname,
      array_agg(attribute_def.attname order by key_position.ordinality) as key_columns
    from pg_constraint constraint_def
    cross join lateral unnest(constraint_def.conkey) with ordinality as key_position(attnum, ordinality)
    join pg_attribute attribute_def
      on attribute_def.attrelid = constraint_def.conrelid
     and attribute_def.attnum = key_position.attnum
    where constraint_def.conrelid = 'public.grizzlies_match_analysis_report'::regclass
      and constraint_def.contype = 'u'
    group by constraint_def.conname
  ) constraint_row
  where constraint_row.key_columns = array['series_id', 'match_id', 'report_type']::name[]
  limit 1;

  if existing_constraint is not null then
    execute format(
      'alter table public.grizzlies_match_analysis_report drop constraint %I',
      existing_constraint
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.grizzlies_match_analysis_report'::regclass
      and conname = 'grizzlies_match_analysis_report_version_key'
  ) then
    alter table public.grizzlies_match_analysis_report
      add constraint grizzlies_match_analysis_report_version_key
      unique (series_id, match_id, report_type, analysis_model_version);
  end if;
end
$$;

create index if not exists idx_grizzlies_match_analysis_report_visible_version
  on public.grizzlies_match_analysis_report (
    series_id,
    match_id,
    status,
    published_at desc nulls last,
    reviewed_at desc nulls last
  );

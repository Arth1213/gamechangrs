-- Bay Area U15 Cricket Performance Intelligence
-- First-pass production schema for Postgres / Supabase Postgres

BEGIN;

CREATE TABLE IF NOT EXISTS ingest_run (
  id BIGSERIAL PRIMARY KEY,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source_label TEXT NOT NULL DEFAULT 'cricclubs',
  series_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS raw_artifact (
  id BIGSERIAL PRIMARY KEY,
  ingest_run_id BIGINT REFERENCES ingest_run(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  source_kind TEXT,
  league_name TEXT,
  source_series_id TEXT,
  source_division_id TEXT,
  source_match_id TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum_sha256 TEXT
);

CREATE TABLE IF NOT EXISTS series (
  id BIGSERIAL PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'cricclubs',
  league_name TEXT NOT NULL,
  source_series_id TEXT NOT NULL,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  season_label TEXT,
  series_url TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  ball_type TEXT,
  series_type TEXT,
  max_overs INTEGER,
  category TEXT,
  level_name TEXT,
  winner_team_name TEXT,
  runner_team_name TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, league_name, source_series_id)
);

CREATE TABLE IF NOT EXISTS division (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  source_division_id TEXT,
  source_label TEXT NOT NULL,
  normalized_label TEXT NOT NULL,
  age_group TEXT,
  phase_no INTEGER,
  division_no INTEGER,
  strength_tier TEXT,
  stats_url TEXT,
  results_url TEXT,
  is_target BOOLEAN NOT NULL DEFAULT FALSE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, normalized_label)
);

CREATE TABLE IF NOT EXISTS team (
  id BIGSERIAL PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'cricclubs',
  source_team_id TEXT,
  canonical_name TEXT NOT NULL,
  short_name TEXT,
  team_code TEXT,
  display_name TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, canonical_name)
);

CREATE TABLE IF NOT EXISTS team_alias (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'display',
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (team_id, alias)
);

CREATE TABLE IF NOT EXISTS player (
  id BIGSERIAL PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'cricclubs',
  league_name TEXT,
  source_player_id TEXT,
  canonical_name TEXT NOT NULL,
  display_name TEXT,
  batting_style TEXT,
  bowling_style TEXT,
  primary_role TEXT,
  is_wicketkeeper BOOLEAN,
  is_captain BOOLEAN,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile_url TEXT,
  UNIQUE (source_system, league_name, source_player_id)
);

CREATE TABLE IF NOT EXISTS player_alias (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL DEFAULT 'scorecard',
  source_context TEXT,
  confidence_score NUMERIC(5,4),
  is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (player_id, alias, alias_type)
);

CREATE TABLE IF NOT EXISTS team_season_competition (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  UNIQUE (series_id, team_id, season_year)
);

CREATE TABLE IF NOT EXISTS team_division_entry (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT NOT NULL REFERENCES division(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  division_label TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (division_id, team_id)
);

CREATE TABLE IF NOT EXISTS team_membership (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  series_id BIGINT REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  role_label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  source_context TEXT,
  valid_from DATE,
  valid_to DATE
);

CREATE TABLE IF NOT EXISTS match (
  id BIGSERIAL PRIMARY KEY,
  source_system TEXT NOT NULL DEFAULT 'cricclubs',
  league_name TEXT,
  source_match_id TEXT NOT NULL,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  match_type TEXT,
  status TEXT,
  match_date DATE,
  match_datetime TIMESTAMPTZ,
  venue TEXT,
  result_text TEXT,
  toss_winner_team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  toss_decision TEXT,
  team1_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
  team2_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
  winner_team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  scorecard_url TEXT,
  ball_by_ball_url TEXT,
  match_page_url TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, league_name, source_match_id)
);

CREATE TABLE IF NOT EXISTS innings (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  innings_no INTEGER NOT NULL,
  batting_team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
  bowling_team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
  total_runs INTEGER,
  wickets INTEGER,
  overs_decimal NUMERIC(6,2),
  legal_balls INTEGER,
  extras_total INTEGER,
  byes INTEGER,
  leg_byes INTEGER,
  wides INTEGER,
  no_balls INTEGER,
  penalty_runs INTEGER,
  target_runs INTEGER,
  start_score INTEGER,
  start_wickets INTEGER,
  UNIQUE (match_id, innings_no)
);

CREATE TABLE IF NOT EXISTS batting_innings (
  id BIGSERIAL PRIMARY KEY,
  innings_id BIGINT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
  batting_position INTEGER,
  is_not_out BOOLEAN,
  dismissal_type TEXT,
  dismissal_text TEXT,
  dismissed_by_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  primary_fielder_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  runs INTEGER,
  balls_faced INTEGER,
  fours INTEGER,
  sixes INTEGER,
  strike_rate NUMERIC(8,2),
  entered_score INTEGER,
  entered_wickets INTEGER,
  retired_hurt BOOLEAN NOT NULL DEFAULT FALSE,
  did_not_bat BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (innings_id, player_id)
);

CREATE TABLE IF NOT EXISTS bowling_spell (
  id BIGSERIAL PRIMARY KEY,
  innings_id BIGINT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE RESTRICT,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE RESTRICT,
  overs_decimal NUMERIC(6,2),
  legal_balls INTEGER,
  maidens INTEGER,
  runs_conceded INTEGER,
  wickets INTEGER,
  wides INTEGER,
  no_balls INTEGER,
  dot_balls INTEGER,
  economy NUMERIC(8,2),
  best_figures TEXT,
  spell_sequence INTEGER,
  UNIQUE (innings_id, player_id, spell_sequence)
);

CREATE TABLE IF NOT EXISTS fielding_event (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  innings_id BIGINT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  over_no INTEGER,
  ball_no NUMERIC(4,1),
  player_out_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  bowler_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  fielder_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  dismissal_type TEXT NOT NULL,
  is_direct_run_out BOOLEAN,
  is_indirect_run_out BOOLEAN,
  is_wicketkeeper_event BOOLEAN,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS ball_event (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  innings_id BIGINT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  innings_no INTEGER NOT NULL,
  event_index INTEGER,
  over_no INTEGER NOT NULL,
  ball_in_over INTEGER NOT NULL,
  ball_label TEXT NOT NULL,
  phase TEXT,
  striker_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  non_striker_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  bowler_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  batting_team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  bowling_team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  batter_runs INTEGER NOT NULL DEFAULT 0,
  extras INTEGER NOT NULL DEFAULT 0,
  extra_type TEXT,
  total_runs INTEGER NOT NULL DEFAULT 0,
  is_legal_ball BOOLEAN NOT NULL DEFAULT TRUE,
  wicket_flag BOOLEAN NOT NULL DEFAULT FALSE,
  dismissal_type TEXT,
  player_out_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  primary_fielder_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  wicket_credited_to_bowler BOOLEAN,
  commentary_text TEXT,
  score_after_runs INTEGER,
  wickets_after INTEGER,
  leverage_score NUMERIC(8,4),
  opponent_team_weight NUMERIC(8,4),
  opponent_player_weight NUMERIC(8,4),
  phase_weight NUMERIC(8,4),
  leverage_weight NUMERIC(8,4),
  total_event_weight NUMERIC(8,4),
  parse_confidence NUMERIC(5,4),
  reconciliation_status TEXT,
  UNIQUE (match_id, innings_no, ball_label, COALESCE(event_index, 0))
);

CREATE TABLE IF NOT EXISTS over_summary (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  innings_id BIGINT NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  innings_no INTEGER NOT NULL,
  over_no INTEGER NOT NULL,
  bowler_player_id BIGINT REFERENCES player(id) ON DELETE SET NULL,
  legal_balls INTEGER,
  runs_in_over INTEGER,
  wickets_in_over INTEGER,
  dots_in_over INTEGER,
  boundaries_in_over INTEGER,
  over_state_text TEXT,
  UNIQUE (match_id, innings_no, over_no)
);

CREATE TABLE IF NOT EXISTS team_strength_snapshot (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  team_id BIGINT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  points INTEGER,
  matches INTEGER,
  wins INTEGER,
  losses INTEGER,
  ties INTEGER,
  no_results INTEGER,
  net_run_rate NUMERIC(8,3),
  rank_no INTEGER,
  division_premium NUMERIC(8,4),
  strength_score NUMERIC(8,4),
  source_artifact_id BIGINT REFERENCES raw_artifact(id) ON DELETE SET NULL,
  UNIQUE (division_id, team_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS player_stats_snapshot (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL,
  stat_type TEXT NOT NULL,
  matches INTEGER,
  innings INTEGER,
  not_outs INTEGER,
  runs INTEGER,
  balls_faced INTEGER,
  fours INTEGER,
  sixes INTEGER,
  fifties INTEGER,
  hundreds INTEGER,
  highest_score TEXT,
  batting_average NUMERIC(8,2),
  strike_rate NUMERIC(8,2),
  overs_decimal NUMERIC(6,2),
  legal_balls INTEGER,
  maidens INTEGER,
  runs_conceded INTEGER,
  wickets INTEGER,
  best_bowling TEXT,
  bowling_average NUMERIC(8,2),
  bowling_strike_rate NUMERIC(8,2),
  economy NUMERIC(8,2),
  dots INTEGER,
  wides INTEGER,
  no_balls INTEGER,
  catches INTEGER,
  wk_catches INTEGER,
  direct_run_outs INTEGER,
  indirect_run_outs INTEGER,
  stumpings INTEGER,
  total_fielding INTEGER,
  rank_no INTEGER,
  points NUMERIC(10,2),
  source_artifact_id BIGINT REFERENCES raw_artifact(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS player_strength_snapshot (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  batting_percentile NUMERIC(8,4),
  bowling_percentile NUMERIC(8,4),
  fielding_percentile NUMERIC(8,4),
  overall_percentile NUMERIC(8,4),
  strength_tier TEXT,
  strength_score NUMERIC(8,4),
  UNIQUE (division_id, player_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS player_match_advanced (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT NOT NULL REFERENCES match(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  role_type TEXT NOT NULL,
  balls_faced INTEGER,
  batter_runs INTEGER,
  dot_ball_pct NUMERIC(8,4),
  boundary_ball_pct NUMERIC(8,4),
  singles_rotation_pct NUMERIC(8,4),
  dismissal_rate NUMERIC(8,4),
  legal_balls_bowled INTEGER,
  bowler_runs_conceded INTEGER,
  total_runs_conceded INTEGER,
  wicket_ball_pct NUMERIC(8,4),
  boundary_conceded_pct NUMERIC(8,4),
  pressure_overs INTEGER,
  fielding_impact_score NUMERIC(8,4),
  team_strength_adjusted_score NUMERIC(8,4),
  player_strength_adjusted_score NUMERIC(8,4),
  leverage_adjusted_score NUMERIC(8,4),
  match_impact_score NUMERIC(8,4),
  UNIQUE (match_id, player_id, role_type)
);

CREATE TABLE IF NOT EXISTS player_matchup (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  batter_player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  bowler_player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  match_id BIGINT REFERENCES match(id) ON DELETE SET NULL,
  balls INTEGER NOT NULL DEFAULT 0,
  batter_runs INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  dismissals INTEGER NOT NULL DEFAULT 0,
  dots INTEGER NOT NULL DEFAULT 0,
  fours INTEGER NOT NULL DEFAULT 0,
  sixes INTEGER NOT NULL DEFAULT 0,
  byes INTEGER NOT NULL DEFAULT 0,
  leg_byes INTEGER NOT NULL DEFAULT 0,
  wides INTEGER NOT NULL DEFAULT 0,
  no_balls INTEGER NOT NULL DEFAULT 0,
  weighted_runs NUMERIC(10,4),
  weighted_dismissals NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS player_season_advanced (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  role_type TEXT NOT NULL,
  matches_played INTEGER,
  innings_count INTEGER,
  balls_sample INTEGER,
  raw_runs INTEGER,
  raw_wickets INTEGER,
  batting_weighted_efficiency NUMERIC(8,4),
  bowling_weighted_efficiency NUMERIC(8,4),
  leverage_score NUMERIC(8,4),
  consistency_score NUMERIC(8,4),
  versatility_score NUMERIC(8,4),
  fielding_score NUMERIC(8,4),
  strong_opposition_score NUMERIC(8,4),
  recent_form_score NUMERIC(8,4),
  development_trend_score NUMERIC(8,4),
  confidence_score NUMERIC(8,4),
  UNIQUE (series_id, division_id, player_id, role_type)
);

CREATE TABLE IF NOT EXISTS player_composite_score (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  division_id BIGINT REFERENCES division(id) ON DELETE SET NULL,
  player_id BIGINT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  team_id BIGINT REFERENCES team(id) ON DELETE SET NULL,
  batting_score NUMERIC(8,4),
  bowling_score NUMERIC(8,4),
  fielding_score NUMERIC(8,4),
  leverage_score NUMERIC(8,4),
  consistency_score NUMERIC(8,4),
  versatility_score NUMERIC(8,4),
  strong_opposition_score NUMERIC(8,4),
  development_score NUMERIC(8,4),
  composite_score NUMERIC(8,4),
  percentile_rank NUMERIC(8,4),
  score_version TEXT NOT NULL DEFAULT 'v1',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, division_id, player_id, score_version)
);

CREATE TABLE IF NOT EXISTS data_quality_issue (
  id BIGSERIAL PRIMARY KEY,
  ingest_run_id BIGINT REFERENCES ingest_run(id) ON DELETE SET NULL,
  issue_scope TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id BIGINT,
  source_reference TEXT,
  severity TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  issue_message TEXT NOT NULL,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_raw_artifact_series ON raw_artifact (source_series_id, source_division_id, source_match_id);
CREATE INDEX IF NOT EXISTS idx_division_series ON division (series_id, normalized_label);
CREATE INDEX IF NOT EXISTS idx_team_name ON team (canonical_name);
CREATE INDEX IF NOT EXISTS idx_player_name ON player (canonical_name);
CREATE INDEX IF NOT EXISTS idx_player_source ON player (source_system, league_name, source_player_id);
CREATE INDEX IF NOT EXISTS idx_match_series_division ON match (series_id, division_id, match_date);
CREATE INDEX IF NOT EXISTS idx_match_source_match_id ON match (source_match_id);
CREATE INDEX IF NOT EXISTS idx_innings_match ON innings (match_id, innings_no);
CREATE INDEX IF NOT EXISTS idx_batting_innings_player ON batting_innings (player_id, match_id);
CREATE INDEX IF NOT EXISTS idx_bowling_spell_player ON bowling_spell (player_id, match_id);
CREATE INDEX IF NOT EXISTS idx_fielding_event_player ON fielding_event (fielder_player_id, match_id);
CREATE INDEX IF NOT EXISTS idx_ball_event_match_innings_over ON ball_event (match_id, innings_no, over_no, ball_in_over);
CREATE INDEX IF NOT EXISTS idx_ball_event_batter_bowler ON ball_event (striker_player_id, bowler_player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_snapshot_player ON player_stats_snapshot (player_id, stat_type, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_player_strength_snapshot_player ON player_strength_snapshot (player_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_player_matchup_pair ON player_matchup (batter_player_id, bowler_player_id);
CREATE INDEX IF NOT EXISTS idx_player_composite_score ON player_composite_score (series_id, division_id, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_data_quality_issue_scope ON data_quality_issue (issue_scope, entity_table, severity);

COMMIT;

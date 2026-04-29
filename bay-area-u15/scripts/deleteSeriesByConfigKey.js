#!/usr/bin/env node

const path = require("path");
const { Pool } = require("pg");
const { loadEnvFile } = require("../apps/api/src/lib/env");

loadEnvFile(path.resolve(__dirname, "..", ".env"));

function printUsage() {
  console.error(
    "Usage: node bay-area-u15/scripts/deleteSeriesByConfigKey.js --config-key <series-config-key> [--dry-run]"
  );
}

function getFlagValue(flagName) {
  const index = process.argv.indexOf(flagName);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1];
}

function getSslConfig() {
  const sslMode = String(process.env.DATABASE_SSL_MODE || "disable").toLowerCase();

  if (sslMode === "require") {
    return { rejectUnauthorized: false };
  }

  if (sslMode === "verify-full") {
    return { rejectUnauthorized: true };
  }

  return undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Populate bay-area-u15/.env before running this script.");
  }

  return new Pool({
    connectionString,
    ssl: getSslConfig(),
  });
}

async function fetchTarget(client, configKey) {
  const result = await client.query(
    `
      select
        c.id as config_id,
        c.config_key,
        c.name as config_name,
        c.entity_id,
        s.id as series_id,
        s.name as series_name,
        s.league_name,
        s.source_series_id,
        ssm.scoring_model_id
      from public.series_source_config c
      left join public.series s
        on s.id = c.series_id
      left join public.series_scoring_model ssm
        on ssm.series_id = s.id
      where c.config_key = $1
      order by ssm.is_active desc nulls last, ssm.id desc nulls last
      limit 1
    `,
    [configKey]
  );

  return result.rows[0] || null;
}

async function fetchSummary(client, configKey) {
  const result = await client.query(
    `
      with target as (
        select
          c.id as config_id,
          c.series_id,
          ssm.scoring_model_id
        from public.series_source_config c
        left join public.series_scoring_model ssm
          on ssm.series_id = c.series_id
        where c.config_key = $1
        order by ssm.is_active desc nulls last, ssm.id desc nulls last
        limit 1
      )
      select 'series_source_config' as table_name, count(*)::int as row_count
      from public.series_source_config
      where id = (select config_id from target)
      union all
      select 'series', count(*)::int
      from public.series
      where id = (select series_id from target)
      union all
      select 'series_operation_request', count(*)::int
      from public.series_operation_request
      where series_source_config_id = (select config_id from target)
      union all
      select 'manual_match_refresh_request', count(*)::int
      from public.manual_match_refresh_request
      where series_source_config_id = (select config_id from target)
      union all
      select 'series_access_request', count(*)::int
      from public.series_access_request
      where series_source_config_id = (select config_id from target)
      union all
      select 'series_access_grant', count(*)::int
      from public.series_access_grant
      where series_source_config_id = (select config_id from target)
      union all
      select 'series_target_division_config', count(*)::int
      from public.series_target_division_config
      where series_source_config_id = (select config_id from target)
      union all
      select 'series_report_profile', count(*)::int
      from public.series_report_profile
      where series_id = (select series_id from target)
      union all
      select 'series_scoring_model', count(*)::int
      from public.series_scoring_model
      where series_id = (select series_id from target)
      union all
      select 'division', count(*)::int
      from public.division
      where series_id = (select series_id from target)
      union all
      select 'match', count(*)::int
      from public.match
      where series_id = (select series_id from target)
      union all
      select 'validation_anchor', count(*)::int
      from public.validation_anchor
      where series_id = (select series_id from target)
      union all
      select 'team_season_competition', count(*)::int
      from public.team_season_competition
      where series_id = (select series_id from target)
      union all
      select 'team_division_entry', count(*)::int
      from public.team_division_entry
      where series_id = (select series_id from target)
      union all
      select 'team_membership', count(*)::int
      from public.team_membership
      where series_id = (select series_id from target)
      union all
      select 'team_strength_snapshot', count(*)::int
      from public.team_strength_snapshot
      where series_id = (select series_id from target)
      union all
      select 'player_stats_snapshot', count(*)::int
      from public.player_stats_snapshot
      where series_id = (select series_id from target)
      union all
      select 'player_strength_snapshot', count(*)::int
      from public.player_strength_snapshot
      where series_id = (select series_id from target)
      union all
      select 'player_matchup', count(*)::int
      from public.player_matchup
      where series_id = (select series_id from target)
      union all
      select 'player_season_advanced', count(*)::int
      from public.player_season_advanced
      where series_id = (select series_id from target)
      union all
      select 'player_composite_score', count(*)::int
      from public.player_composite_score
      where series_id = (select series_id from target)
      union all
      select 'scoring_model_reference_count', count(*)::int
      from public.series_scoring_model
      where scoring_model_id = (select scoring_model_id from target)
    `,
    [configKey]
  );

  return result.rows;
}

async function deleteSeries(client, target) {
  await client.query(
    `
      delete from public.series_source_config
      where id = $1
    `,
    [target.config_id]
  );

  if (target.series_id) {
    await client.query(
      `
        delete from public.series
        where id = $1
      `,
      [target.series_id]
    );
  }

  if (target.scoring_model_id) {
    const referenceResult = await client.query(
      `
        select count(*)::int as row_count
        from public.series_scoring_model
        where scoring_model_id = $1
      `,
      [target.scoring_model_id]
    );

    const copiedFromResult = await client.query(
      `
        select count(*)::int as row_count
        from public.scoring_model
        where copied_from_model_id = $1
      `,
      [target.scoring_model_id]
    );

    if (referenceResult.rows[0].row_count === 0 && copiedFromResult.rows[0].row_count === 0) {
      await client.query(
        `
          delete from public.scoring_model
          where id = $1
        `,
        [target.scoring_model_id]
      );
    }
  }
}

async function main() {
  const configKey = getFlagValue("--config-key");
  const dryRun = process.argv.includes("--dry-run");

  if (!configKey) {
    printUsage();
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const target = await fetchTarget(client, configKey);

    if (!target) {
      throw new Error(`No series_source_config found for config key: ${configKey}`);
    }

    const beforeSummary = await fetchSummary(client, configKey);

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            target,
            beforeSummary,
          },
          null,
          2
        )
      );
      return;
    }

    await deleteSeries(client, target);

    const existsResult = await client.query(
      `
        select
          exists(select 1 from public.series_source_config where config_key = $1) as config_exists,
          exists(select 1 from public.series where id = $2) as series_exists,
          exists(select 1 from public.scoring_model where id = $3) as scoring_model_exists
      `,
      [configKey, target.series_id, target.scoring_model_id]
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          mode: "delete",
          target,
          beforeSummary,
          afterState: existsResult.rows[0],
        },
        null,
        2
      )
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

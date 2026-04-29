const fs = require("fs");

const { loadYamlConfig, writeYamlConfig } = require("../lib/config");
const { withTransaction } = require("../lib/db");
const { normalizeText, toInteger } = require("../lib/cricket");
const { validateSeries } = require("./localValidate");

function buildLogger(log) {
  return typeof log === "function" ? log : console.log;
}

function fetchOne(client, query, params = []) {
  return client.query(query, params).then((result) => result.rows[0] || null);
}

async function resolveSeriesContext(client, seriesConfigKey) {
  const row = await fetchOne(
    client,
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.is_active,
        s.id as series_id,
        s.name as series_name
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );

  if (!row) {
    throw new Error(`Unable to resolve series context for publish: ${seriesConfigKey}`);
  }

  return {
    seriesSourceConfigId: toInteger(row.series_source_config_id),
    configKey: normalizeText(row.config_key),
    isActive: row.is_active === true,
    seriesId: toInteger(row.series_id),
    seriesName: normalizeText(row.series_name),
  };
}

function updateLocalSeriesEnabled(configPath, seriesConfigKey, enabled) {
  const config = loadYamlConfig(configPath);
  const seriesList = Array.isArray(config?.series) ? config.series : [];
  const entryIndex = seriesList.findIndex((entry) => normalizeText(entry.slug) === normalizeText(seriesConfigKey));

  if (entryIndex === -1) {
    throw new Error(`Series slug ${seriesConfigKey} is missing from ${configPath}`);
  }

  const entry = seriesList[entryIndex];
  const previousEnabled = entry.enabled !== false;
  seriesList[entryIndex] = {
    ...entry,
    enabled: enabled === true,
  };
  config.series = seriesList;
  writeYamlConfig(configPath, config);

  return {
    previousEnabled,
    nextEnabled: enabled === true,
  };
}

async function applyPublishTransaction(client, context) {
  const refreshUpdate = await client.query(
    `
      update public.match_refresh_state mrs
      set
        parse_status = case when mrs.parse_status = 'skipped' then 'skipped' else 'parsed' end,
        analytics_status = 'computed',
        needs_rescrape = false,
        needs_reparse = false,
        needs_recompute = false,
        last_parsed_at = coalesce(mrs.last_parsed_at, now()),
        last_analytics_at = now(),
        last_change_reason = 'local_publish_gate',
        last_error_message = null
      from public.match m
      where mrs.match_id = m.id
        and m.series_id = $1
    `,
    [context.seriesId]
  );

  const activated = await fetchOne(
    client,
    `
      update public.series_source_config
      set is_active = true,
          updated_at = now()
      where id = $1
      returning id, config_key, is_active
    `,
    [context.seriesSourceConfigId]
  );

  return {
    promotedMatchCount: refreshUpdate.rowCount || 0,
    seriesSourceConfigId: toInteger(activated?.id) || context.seriesSourceConfigId,
    activated: activated?.is_active === true,
  };
}

async function publishSeries({ series, configPath, log, dryRun = false }) {
  const logger = buildLogger(log);
  logger(`[publish-series] ${series.slug}: validating publish readiness`);

  const validation = await validateSeries({ series, configPath, log });

  if (!validation.publishReady) {
    logger(`[publish-series] ${series.slug}: blocked by validation gate`);
    return {
      ok: false,
      dryRun,
      seriesConfigKey: series.slug,
      validation,
      message: "Series is not publish-ready. Run ops:validate:series and resolve failed checks first.",
    };
  }

  const contextPreview = await withTransaction(
    async (client) => resolveSeriesContext(client, series.slug),
    { rollback: true }
  );

  if (dryRun) {
    const dbPreview = await withTransaction(
      async (client) => applyPublishTransaction(client, contextPreview),
      { rollback: true }
    );

    logger(`[publish-series] ${series.slug}: dry-run publish validated`);
    return {
      ok: true,
      dryRun: true,
      seriesConfigKey: contextPreview.configKey,
      seriesName: contextPreview.seriesName,
      validation,
      configUpdate: {
        previousEnabled: validation.localConfig.enabled,
        nextEnabled: true,
      },
      dbUpdate: dbPreview,
      message: "Dry-run publish validated.",
    };
  }

  const previousConfigRaw = fs.readFileSync(configPath, "utf8");
  let configUpdate = null;

  try {
    configUpdate = updateLocalSeriesEnabled(configPath, series.slug, true);
    const dbUpdate = await withTransaction(async (client) => {
      const context = await resolveSeriesContext(client, series.slug);
      return applyPublishTransaction(client, context);
    });

    logger(`[publish-series] ${series.slug}: series activated for local/frontend consumption`);
    return {
      ok: true,
      dryRun: false,
      seriesConfigKey: contextPreview.configKey,
      seriesName: contextPreview.seriesName,
      validation,
      configUpdate,
      dbUpdate,
      message: "Series published locally and activated for frontend consumption.",
    };
  } catch (error) {
    try {
      fs.writeFileSync(configPath, previousConfigRaw, "utf8");
    } catch (_) {
      // Best-effort local config restore.
    }
    throw error;
  }
}

module.exports = {
  publishSeries,
};

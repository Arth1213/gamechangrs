const { loadYamlConfig } = require("../lib/config");
const { withClient } = require("../lib/db");
const { normalizeText, toInteger, toNumber } = require("../lib/cricket");

function buildLogger(log) {
  return typeof log === "function" ? log : console.log;
}

function fetchOne(client, query, params = []) {
  return client.query(query, params).then((result) => result.rows[0] || null);
}

function roundPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Number((value * 100).toFixed(2));
}

function buildCheck({ key, label, status, summary, details, required = true }) {
  return {
    key,
    label,
    status,
    required,
    summary,
    details: details || {},
  };
}

function isCheckFailure(check) {
  return check?.required !== false && check?.status === "fail";
}

async function resolveSeriesContext(client, seriesConfigKey) {
  const row = await fetchOne(
    client,
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.is_active,
        c.target_age_group,
        s.id as series_id,
        s.name as series_name,
        s.source_series_id,
        s.year as season_year,
        e.id as entity_id,
        e.display_name as entity_name,
        sm.id as scoring_model_id,
        sm.version_label as scoring_model_version,
        rp.id as report_profile_id,
        rp.profile_key as report_profile_key
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      left join public.entity e on e.id = c.entity_id
      left join public.series_scoring_model ssm
        on ssm.series_id = s.id
       and ssm.is_active = true
      left join public.scoring_model sm on sm.id = ssm.scoring_model_id
      left join public.series_report_profile srp
        on srp.series_id = s.id
       and srp.is_active = true
      left join public.report_profile rp on rp.id = srp.report_profile_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );

  if (!row) {
    throw new Error(`Unable to resolve series context for config key: ${seriesConfigKey}`);
  }

  return {
    seriesSourceConfigId: toInteger(row.series_source_config_id),
    configKey: normalizeText(row.config_key),
    isActive: row.is_active === true,
    targetAgeGroup: normalizeText(row.target_age_group),
    seriesId: toInteger(row.series_id),
    seriesName: normalizeText(row.series_name),
    sourceSeriesId: normalizeText(row.source_series_id),
    seasonYear: toInteger(row.season_year),
    entityId: row.entity_id || null,
    entityName: normalizeText(row.entity_name),
    scoringModelId: toInteger(row.scoring_model_id),
    scoringModelVersion: normalizeText(row.scoring_model_version) || "v1",
    reportProfileId: toInteger(row.report_profile_id),
    reportProfileKey: normalizeText(row.report_profile_key),
  };
}

async function loadQualityGates(client, scoringModelId) {
  if (!scoringModelId) {
    return {};
  }

  const result = await client.query(
    `
      select
        gate_key,
        numeric_value,
        text_value,
        bool_value
      from public.scoring_model_quality_gate
      where scoring_model_id = $1
      order by gate_key
    `,
    [scoringModelId]
  );

  return result.rows.reduce((accumulator, row) => {
    const key = normalizeText(row.gate_key);
    if (!key) {
      return accumulator;
    }

    accumulator[key] = {
      numericValue: toNumber(row.numeric_value, null),
      textValue: normalizeText(row.text_value),
      boolValue: row.bool_value === true ? true : row.bool_value === false ? false : null,
    };
    return accumulator;
  }, {});
}

async function loadStatusBreakdown(client, seriesId, columnName) {
  const allowedColumns = new Set(["parse_status", "analytics_status", "reconciliation_status"]);
  if (!allowedColumns.has(columnName)) {
    throw new Error(`Unsupported status column: ${columnName}`);
  }

  const result = await client.query(
    `
      select
        coalesce(${columnName}, '<null>') as status,
        count(*)::int as count
      from public.match_refresh_state mrs
      join public.match m on m.id = mrs.match_id
      where m.series_id = $1
      group by ${columnName}
      order by ${columnName}
    `,
    [seriesId]
  );

  return result.rows.map((row) => ({
    status: normalizeText(row.status),
    count: toInteger(row.count) || 0,
  }));
}

async function loadCoverageMetrics(client, seriesId) {
  const row = await fetchOne(
    client,
    `
      with parsed_matches as (
        select count(distinct be.match_id)::int as count
        from public.ball_event be
        join public.match m on m.id = be.match_id
        where m.series_id = $1
      ),
      profiled_players as (
        select count(distinct p.id)::int as count
        from public.player p
        where coalesce(nullif(p.batting_style_bucket, ''), nullif(p.bowling_style_bucket, '')) is not null
      )
      select
        (select count(*)::int from public.division d where d.series_id = $1) as division_count,
        (select count(*)::int from public.match m where m.series_id = $1) as match_count,
        (select count(*)::int from public.match_refresh_state mrs join public.match m on m.id = mrs.match_id where m.series_id = $1) as refresh_state_count,
        (select count from parsed_matches) as parsed_match_count,
        (select count(*)::int from public.match_refresh_state mrs join public.match m on m.id = mrs.match_id where m.series_id = $1 and mrs.parse_status = 'skipped') as skipped_match_count,
        (select count(*)::int from public.player_season_advanced psa where psa.series_id = $1) as season_row_count,
        (select count(*)::int from public.player_composite_score pcs where pcs.series_id = $1) as composite_row_count,
        (select count(*)::int from public.player_intelligence_profile pip where pip.series_id = $1) as intelligence_profile_count,
        (select count(distinct psa.player_id)::int from public.player_season_advanced psa where psa.series_id = $1) as season_player_count,
        (select count(distinct pcs.player_id)::int from public.player_composite_score pcs where pcs.series_id = $1) as composite_player_count,
        (select count(distinct pip.player_id)::int from public.player_intelligence_profile pip where pip.series_id = $1) as intelligence_player_count
    `,
    [seriesId]
  );

  return {
    divisionCount: toInteger(row?.division_count) || 0,
    matchCount: toInteger(row?.match_count) || 0,
    refreshStateCount: toInteger(row?.refresh_state_count) || 0,
    parsedMatchCount: toInteger(row?.parsed_match_count) || 0,
    skippedMatchCount: toInteger(row?.skipped_match_count) || 0,
    seasonRowCount: toInteger(row?.season_row_count) || 0,
    compositeRowCount: toInteger(row?.composite_row_count) || 0,
    intelligenceProfileCount: toInteger(row?.intelligence_profile_count) || 0,
    seasonPlayerCount: toInteger(row?.season_player_count) || 0,
    compositePlayerCount: toInteger(row?.composite_player_count) || 0,
    intelligencePlayerCount: toInteger(row?.intelligence_player_count) || 0,
  };
}

function loadConfigEntry(configPath, seriesConfigKey) {
  const config = loadYamlConfig(configPath);
  const allSeries = Array.isArray(config?.series) ? config.series : [];
  return allSeries.find((entry) => normalizeText(entry.slug) === normalizeText(seriesConfigKey)) || null;
}

async function validateSeries({ series, configPath, log }) {
  const logger = buildLogger(log);
  logger(`[validate-series] ${series.slug}: collecting readiness state`);

  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, series.slug);
    const configEntry = loadConfigEntry(configPath, context.configKey);
    const qualityGates = await loadQualityGates(client, context.scoringModelId);
    const coverage = await loadCoverageMetrics(client, context.seriesId);
    const parseStatuses = await loadStatusBreakdown(client, context.seriesId, "parse_status");
    const analyticsStatuses = await loadStatusBreakdown(client, context.seriesId, "analytics_status");
    const reconciliationStatuses = await loadStatusBreakdown(client, context.seriesId, "reconciliation_status");

    const requiredParsedMatchCount = Math.max(coverage.matchCount - coverage.skippedMatchCount, 0);
    const parsedCoverageRatio =
      requiredParsedMatchCount > 0 ? coverage.parsedMatchCount / requiredParsedMatchCount : 1;
    const refreshCoverageRatio =
      coverage.matchCount > 0 ? coverage.refreshStateCount / coverage.matchCount : null;
    const parsedStatusCount = parseStatuses
      .filter((row) => row.status === "parsed")
      .reduce((sum, row) => sum + row.count, 0);
    const skippedStatusCount = parseStatuses
      .filter((row) => row.status === "skipped")
      .reduce((sum, row) => sum + row.count, 0);
    const computedStatusCount = analyticsStatuses
      .filter((row) => row.status === "computed")
      .reduce((sum, row) => sum + row.count, 0);
    const reconciliationWarnCount = reconciliationStatuses
      .filter((row) => row.status === "warn")
      .reduce((sum, row) => sum + row.count, 0);
    const reconciliationPendingCount = reconciliationStatuses
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + row.count, 0);
    const validationPlayers = Array.isArray(configEntry?.validation_players)
      ? configEntry.validation_players.map((entry) => normalizeText(entry)).filter(Boolean)
      : [];

    const checks = [
      buildCheck({
        key: "config-entry",
        label: "Local config entry",
        status: configEntry ? "pass" : "fail",
        summary: configEntry
          ? `Config entry found with enabled=${configEntry.enabled !== false}.`
          : "Series slug is missing from config/leagues.yaml.",
        details: {
          configPath,
          enabled: configEntry ? configEntry.enabled !== false : null,
        },
      }),
      buildCheck({
        key: "active-scoring-model",
        label: "Active scoring model",
        status: context.scoringModelId ? "pass" : "fail",
        summary: context.scoringModelId
          ? `Scoring model ${context.scoringModelId} (${context.scoringModelVersion}) is assigned.`
          : "No active scoring model is assigned to this series.",
        details: {
          scoringModelId: context.scoringModelId,
          scoringModelVersion: context.scoringModelVersion,
        },
      }),
      buildCheck({
        key: "active-report-profile",
        label: "Active report profile",
        status: context.reportProfileId ? "pass" : "fail",
        summary: context.reportProfileId
          ? `Report profile ${context.reportProfileKey || context.reportProfileId} is assigned.`
          : "No active report profile is assigned to this series.",
        details: {
          reportProfileId: context.reportProfileId,
          reportProfileKey: context.reportProfileKey,
        },
      }),
      buildCheck({
        key: "division-inventory",
        label: "Division inventory",
        status: coverage.divisionCount > 0 ? "pass" : "fail",
        summary:
          coverage.divisionCount > 0
            ? `${coverage.divisionCount} division/group rows are staged for this series.`
            : "No division/group rows are staged for this series.",
        details: {
          divisionCount: coverage.divisionCount,
        },
      }),
      buildCheck({
        key: "match-inventory",
        label: "Match inventory",
        status: coverage.matchCount > 0 ? "pass" : "fail",
        summary:
          coverage.matchCount > 0
            ? `${coverage.matchCount} match rows are staged for this series.`
            : "No match rows are staged for this series.",
        details: {
          matchCount: coverage.matchCount,
        },
      }),
      buildCheck({
        key: "refresh-state-coverage",
        label: "Refresh-state coverage",
        status:
          coverage.matchCount > 0 && coverage.refreshStateCount === coverage.matchCount ? "pass" : "fail",
        summary:
          coverage.matchCount > 0 && coverage.refreshStateCount === coverage.matchCount
            ? `Refresh-state rows cover all ${coverage.matchCount} tracked matches.`
            : `Refresh-state rows cover ${coverage.refreshStateCount} of ${coverage.matchCount} tracked matches.`,
        details: {
          refreshStateCount: coverage.refreshStateCount,
          matchCount: coverage.matchCount,
          coveragePct: roundPercent(refreshCoverageRatio),
        },
      }),
      buildCheck({
        key: "parsed-match-coverage",
        label: "Parsed match coverage",
        status:
          coverage.matchCount > 0 && coverage.parsedMatchCount === requiredParsedMatchCount ? "pass" : "fail",
        summary:
          coverage.matchCount > 0 && coverage.parsedMatchCount === requiredParsedMatchCount
            ? coverage.skippedMatchCount > 0
              ? `Parsed ball-by-ball exists for all ${requiredParsedMatchCount} playable matches, with ${coverage.skippedMatchCount} no-live-commentary matches skipped.`
              : `Parsed ball-by-ball exists for all ${coverage.matchCount} tracked matches.`
            : coverage.skippedMatchCount > 0
              ? `Parsed ball-by-ball exists for ${coverage.parsedMatchCount} of ${requiredParsedMatchCount} playable matches, with ${coverage.skippedMatchCount} no-live-commentary matches skipped.`
              : `Parsed ball-by-ball exists for ${coverage.parsedMatchCount} of ${coverage.matchCount} tracked matches.`,
        details: {
          parsedMatchCount: coverage.parsedMatchCount,
          matchCount: coverage.matchCount,
          requiredParsedMatchCount,
          skippedMatchCount: coverage.skippedMatchCount,
          coveragePct: roundPercent(parsedCoverageRatio),
        },
      }),
      buildCheck({
        key: "season-aggregation",
        label: "Season aggregation",
        status: coverage.seasonRowCount > 0 ? "pass" : "fail",
        summary:
          coverage.seasonRowCount > 0
            ? `${coverage.seasonRowCount} player_season_advanced rows are available.`
            : "No player_season_advanced rows are available.",
        details: {
          seasonRowCount: coverage.seasonRowCount,
          seasonPlayerCount: coverage.seasonPlayerCount,
        },
      }),
      buildCheck({
        key: "composite-scoring",
        label: "Composite scoring",
        status: coverage.compositeRowCount > 0 ? "pass" : "fail",
        summary:
          coverage.compositeRowCount > 0
            ? `${coverage.compositeRowCount} player_composite_score rows are available.`
            : "No player_composite_score rows are available.",
        details: {
          compositeRowCount: coverage.compositeRowCount,
          compositePlayerCount: coverage.compositePlayerCount,
        },
      }),
      buildCheck({
        key: "intelligence-compute",
        label: "Player intelligence compute",
        status: coverage.intelligenceProfileCount > 0 ? "pass" : "fail",
        summary:
          coverage.intelligenceProfileCount > 0
            ? `${coverage.intelligenceProfileCount} player_intelligence_profile rows are available.`
            : "No player_intelligence_profile rows are available.",
        details: {
          intelligenceProfileCount: coverage.intelligenceProfileCount,
          intelligencePlayerCount: coverage.intelligencePlayerCount,
        },
      }),
      buildCheck({
        key: "parse-status-drift",
        label: "Parse-status drift",
        required: false,
        status:
          parsedStatusCount === coverage.parsedMatchCount &&
          skippedStatusCount === coverage.skippedMatchCount
            ? "pass"
            : "warn",
        summary:
          parsedStatusCount === coverage.parsedMatchCount &&
          skippedStatusCount === coverage.skippedMatchCount
            ? "match_refresh_state.parse_status agrees with parsed and skipped match coverage."
            : `match_refresh_state.parse_status marks ${parsedStatusCount} parsed and ${skippedStatusCount} skipped matches while ball_event rows exist for ${coverage.parsedMatchCount} matches and ${coverage.skippedMatchCount} matches are classified as skipped.`,
        details: {
          parsedStatusCount,
          skippedStatusCount,
          parsedMatchCount: coverage.parsedMatchCount,
          skippedMatchCount: coverage.skippedMatchCount,
          statuses: parseStatuses,
        },
      }),
      buildCheck({
        key: "analytics-status-drift",
        label: "Analytics-status drift",
        required: false,
        status:
          computedStatusCount === coverage.matchCount && coverage.matchCount > 0 ? "pass" : "warn",
        summary:
          computedStatusCount === coverage.matchCount && coverage.matchCount > 0
            ? "match_refresh_state.analytics_status is already aligned with full computed coverage."
            : `match_refresh_state.analytics_status marks ${computedStatusCount} computed matches while ${coverage.matchCount} matches are tracked.`,
        details: {
          computedStatusCount,
          matchCount: coverage.matchCount,
          statuses: analyticsStatuses,
        },
      }),
      buildCheck({
        key: "reconciliation-watch",
        label: "Reconciliation watch",
        required: false,
        status:
          reconciliationPendingCount === 0 && reconciliationWarnCount === 0 ? "pass" : "warn",
        summary:
          reconciliationPendingCount === 0 && reconciliationWarnCount === 0
            ? "No reconciliation warnings are recorded."
            : `${reconciliationWarnCount} warn and ${reconciliationPendingCount} pending reconciliation rows remain.`,
        details: {
          statuses: reconciliationStatuses,
          reconciliationWarnCount,
          reconciliationPendingCount,
          note: "Reconciliation is still a warning-level gate because apps/worker/src/validate/reconcile.js is not finalized yet.",
        },
      }),
      buildCheck({
        key: "validation-player-list",
        label: "Validation player list",
        required: false,
        status: validationPlayers.length > 0 ? "pass" : "warn",
        summary:
          validationPlayers.length > 0
            ? `${validationPlayers.length} validation players are configured in config/leagues.yaml.`
            : "No validation players are configured in config/leagues.yaml.",
        details: {
          validationPlayers,
        },
      }),
    ];

    const publishReady = !checks.some(isCheckFailure);
    const passCount = checks.filter((check) => check.status === "pass").length;
    const failCount = checks.filter((check) => check.status === "fail").length;
    const warnCount = checks.filter((check) => check.status === "warn").length;

    logger(
      `[validate-series] ${context.configKey}: ${publishReady ? "publish-ready" : "not publish-ready"} (${passCount} pass / ${warnCount} warn / ${failCount} fail)`
    );

    return {
      ok: true,
      publishReady,
      seriesConfigKey: context.configKey,
      generatedAt: new Date().toISOString(),
      series: {
        seriesSourceConfigId: context.seriesSourceConfigId,
        seriesId: context.seriesId,
        seriesName: context.seriesName,
        sourceSeriesId: context.sourceSeriesId,
        seasonYear: context.seasonYear,
        targetAgeGroup: context.targetAgeGroup,
        entityId: context.entityId,
        entityName: context.entityName,
        isActive: context.isActive,
      },
      localConfig: {
        configPath,
        enabled: configEntry ? configEntry.enabled !== false : null,
        validationPlayers,
      },
      qualityGates,
      coverage: {
        ...coverage,
        requiredParsedMatchCount,
        parsedCoveragePct: roundPercent(parsedCoverageRatio),
        refreshCoveragePct: roundPercent(refreshCoverageRatio),
      },
      statusBreakdown: {
        parseStatuses,
        analyticsStatuses,
        reconciliationStatuses,
      },
      counts: {
        pass: passCount,
        warn: warnCount,
        fail: failCount,
      },
      checks,
      message: publishReady
        ? "Series is ready for local publish activation."
        : "Series is not ready for local publish activation.",
    };
  });
}

module.exports = {
  validateSeries,
};

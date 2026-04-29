const path = require("path");
const { normalizeLabel, normalizeText, toInteger } = require("../../../api/src/lib/utils");
const { withTransaction } = require("../lib/db");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const { loadYamlConfig, writeYamlConfig } = require("../lib/config");
const { probeSeries } = require("../probe/probeSeries");

async function registerSeries(input) {
  const label = normalizeText(input.label);
  const rawUrl = normalizeText(input.url);
  const seasonYear = toInteger(input.seasonYear);

  if (!label) {
    throw new Error("register requires --label");
  }

  if (!rawUrl) {
    throw new Error("register requires --url");
  }

  if (!seasonYear) {
    throw new Error("register requires --seasonYear");
  }

  const sourceSystem = normalizeLabel(input.sourceSystem) || "cricclubs";
  const probe = await probeSeries({
    url: rawUrl,
    label,
    sourceSystem,
    configPath: input.configPath,
  });

  if (probe.capabilities.executiveReport.status === "blocked") {
    throw new Error(
      `Registration is blocked because the probe could not establish minimum executive report viability for ${label}.`
    );
  }

  const result = await withTransaction(async (client) => {
    const entity = await resolveEntity(client, input.entity);
    const capacity = await getEntitySeriesCapacity(client, entity.id);
    assertEntitySeriesCreationAllowed(capacity);

    const sourceReference = parseSeriesSourceReference({
      sourceSystem,
      seriesUrl: rawUrl,
      expectedLeagueName: input.expectedLeagueName || probe.sourceContext?.pathname?.split("/").filter(Boolean)[0],
      sourceSeriesId: input.sourceSeriesId || probe.sourceContext?.sourceSeriesId,
    });

    const existing = await fetchOne(
      client,
      `
        select
          c.id as series_source_config_id,
          c.config_key,
          s.id as series_id,
          s.name as series_name
        from public.series s
        join public.series_source_config c on c.series_id = s.id
        where s.source_system = $1
          and s.league_name = $2
          and s.source_series_id = $3
        limit 1
      `,
      [sourceReference.sourceSystem, sourceReference.leagueName, sourceReference.sourceSeriesId]
    );

    if (existing) {
      const error = new Error(
        `Series already exists as ${normalizeText(existing.config_key) || normalizeText(existing.series_name)}.`
      );
      error.statusCode = 409;
      throw error;
    }

    const configKey = await buildUniqueSeriesConfigKey(client, {
      entitySlug: entity.slug,
      seriesName: label,
      seasonYear,
      sourceSeriesId: sourceReference.sourceSeriesId,
    });

    const template = await findTemplateSeriesContext(client, entity.id);
    const isActive = input.activate === true;

    const seriesRow = await fetchOne(
      client,
      `
        insert into public.series (
          source_system,
          league_name,
          source_series_id,
          name,
          year,
          season_label,
          series_url,
          entity_id
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8)
        returning *
      `,
      [
        sourceReference.sourceSystem,
        sourceReference.leagueName,
        sourceReference.sourceSeriesId,
        label,
        seasonYear,
        `${seasonYear} ${label}`,
        sourceReference.seriesUrl,
        entity.id,
      ]
    );

    const seriesSourceConfigRow = await fetchOne(
      client,
      `
        insert into public.series_source_config (
          config_key,
          name,
          source_system,
          series_url,
          expected_league_name,
          expected_series_name,
          season_year,
          target_age_group,
          scrape_completed_only,
          include_ball_by_ball,
          include_player_profiles,
          enable_auto_discovery,
          is_active,
          notes,
          series_id,
          entity_id,
          created_by_user_id,
          updated_by_user_id
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        returning *
      `,
      [
        configKey,
        label,
        sourceReference.sourceSystem,
        sourceReference.seriesUrl,
        sourceReference.leagueName,
        label,
        seasonYear,
        normalizeText(input.targetAgeGroup),
        true,
        true,
        true,
        true,
        isActive,
        normalizeText(input.notes),
        toInteger(seriesRow.id),
        entity.id,
        null,
        null,
      ]
    );

    if (template?.reportProfileId) {
      await client.query(
        `
          insert into public.series_report_profile (
            series_id,
            report_profile_id,
            assigned_by,
            is_active
          )
          values ($1,$2,$3,true)
        `,
        [toInteger(seriesRow.id), template.reportProfileId, "local-ops"]
      );
    }

    const scoringModel = await cloneSeriesScoringModel(client, {
      targetSeriesId: toInteger(seriesRow.id),
      targetConfigKey: configKey,
      targetSeriesName: label,
      templateScoringModelId: template?.scoringModelId || null,
    });

    return {
      entity,
      capacity,
      sourceReference,
      probe,
      series: {
        configKey,
        seriesId: toInteger(seriesRow.id),
        seriesSourceConfigId: toInteger(seriesSourceConfigRow.id),
        seriesName: label,
        seasonYear,
        targetAgeGroup: normalizeText(input.targetAgeGroup),
        isActive,
        sourceSystem: sourceReference.sourceSystem,
        leagueName: sourceReference.leagueName,
        sourceSeriesId: sourceReference.sourceSeriesId,
        seriesUrl: sourceReference.seriesUrl,
        scoringModelId: toInteger(scoringModel?.id),
      },
    };
  }, { rollback: input.dryRun === true });

  if (!input.dryRun) {
    const configEntry = buildConfigEntry(result);
    upsertSeriesConfigEntry(input.configPath, configEntry);

    const outDir = path.resolve(
      process.cwd(),
      "storage/exports",
      "registry",
      result.series.configKey
    );
    ensureDir(outDir);
    writeJsonFile(path.join(outDir, "registration.json"), {
      generatedAt: new Date().toISOString(),
      registration: result,
      configEntry,
    });
  }

  return {
    message: input.dryRun ? "Dry-run series registration validated." : "Series registered locally.",
    ...result,
    configPath: input.configPath,
  };
}

async function resolveEntity(client, input) {
  const raw = normalizeText(input);
  if (raw) {
    const row = await fetchOne(
      client,
      `
        select id, slug, display_name
        from public.entity
        where id::text = $1
           or slug = $1
        limit 1
      `,
      [raw]
    );

    if (!row) {
      throw new Error(`Entity not found for ${raw}`);
    }

    return {
      id: normalizeText(row.id),
      slug: normalizeText(row.slug),
      displayName: normalizeText(row.display_name),
    };
  }

  const rows = await client.query(
    `
      select id, slug, display_name
      from public.entity
      order by created_at, id
    `
  );

  if (rows.rowCount === 1) {
    const row = rows.rows[0];
    return {
      id: normalizeText(row.id),
      slug: normalizeText(row.slug),
      displayName: normalizeText(row.display_name),
    };
  }

  throw new Error("Multiple entities exist. Pass --entity explicitly.");
}

async function getEntitySeriesCapacity(client, entityId) {
  const row = await fetchOne(
    client,
    `
      select
        e.id as entity_id,
        e.slug as entity_slug,
        e.display_name as entity_name,
        es.max_series,
        es.status as subscription_status,
        count(distinct c.id)::int as series_count
      from public.entity e
      left join public.entity_subscription es on es.entity_id = e.id
      left join public.series_source_config c on c.entity_id = e.id
      where e.id = $1
      group by e.id, e.slug, e.display_name, es.max_series, es.status
      limit 1
    `,
    [entityId]
  );

  if (!row) {
    throw new Error(`Entity not found for id: ${entityId}`);
  }

  return {
    maxSeries: toInteger(row.max_series),
    subscriptionStatus: normalizeLabel(row.subscription_status),
    seriesCount: toInteger(row.series_count) || 0,
  };
}

function assertEntitySeriesCreationAllowed(capacity) {
  if (!["active", "trial", "internal", ""].includes(capacity.subscriptionStatus)) {
    throw new Error("Entity subscription is not active for series creation.");
  }

  if (capacity.maxSeries !== null && capacity.maxSeries !== undefined && capacity.seriesCount >= capacity.maxSeries) {
    throw new Error(`Series allocation is at limit (${capacity.seriesCount}/${capacity.maxSeries}).`);
  }
}

async function fetchOne(client, query, params = []) {
  const result = await client.query(query, params);
  return result.rows[0] || null;
}

function parseSeriesSourceReference(input) {
  const sourceSystem = normalizeLabel(input.sourceSystem) || "cricclubs";
  if (sourceSystem !== "cricclubs") {
    throw new Error("Only CricClubs registration is supported in this slice.");
  }

  const rawUrl = normalizeText(input.seriesUrl);
  if (!rawUrl) {
    throw new Error("Series source URL is required.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new Error(`Unable to parse series URL: ${rawUrl}`);
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const leagueName = normalizeText(input.expectedLeagueName) || normalizeText(pathParts[0]);
  const sourceSeriesId = normalizeText(
    input.sourceSeriesId
    || parsed.searchParams.get("sourceSeriesId")
    || parsed.searchParams.get("league")
    || parsed.searchParams.get("seriesId")
    || parsed.searchParams.get("series")
    || parsed.pathname.match(/(\d+)(?:\/)?$/)?.[1]
  );

  if (!leagueName) {
    throw new Error("Could not derive the CricClubs namespace or expected league name from the URL.");
  }

  if (!sourceSeriesId) {
    throw new Error("Could not derive a source series id from the URL. Pass --sourceSeriesId explicitly.");
  }

  return {
    sourceSystem,
    leagueName,
    sourceSeriesId,
    seriesUrl: parsed.toString(),
    clubId: normalizeText(parsed.searchParams.get("clubId")),
  };
}

function slugifyKeyPart(value) {
  return normalizeLabel(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function buildUniqueSeriesConfigKey(client, input) {
  const base = [
    slugifyKeyPart(input.entitySlug),
    String(input.seasonYear || "").trim(),
    slugifyKeyPart(input.seriesName),
    slugifyKeyPart(input.sourceSeriesId),
  ]
    .filter(Boolean)
    .join("-")
    .replace(/-{2,}/g, "-")
    .slice(0, 140);

  const fallbackBase = base || `series-${Date.now()}`;
  let candidate = fallbackBase;
  let suffix = 2;

  while (true) {
    const existing = await fetchOne(
      client,
      `
        select config_key
        from public.series_source_config
        where config_key = $1
        limit 1
      `,
      [candidate]
    );

    if (!existing) {
      return candidate;
    }

    candidate = `${fallbackBase}-${suffix}`;
    suffix += 1;
  }
}

async function buildUniqueScoringModelKey(client, baseKey) {
  const normalizedBase = slugifyKeyPart(baseKey) || "series-model";
  let candidate = normalizedBase;
  let suffix = 2;

  while (true) {
    const existing = await fetchOne(
      client,
      `
        select model_key
        from public.scoring_model
        where model_key = $1
        limit 1
      `,
      [candidate]
    );

    if (!existing) {
      return candidate;
    }

    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
}

async function findTemplateSeriesContext(client, entityId) {
  const row = await fetchOne(
    client,
    `
      select
        c.config_key,
        c.series_id,
        srp.report_profile_id,
        ssm.scoring_model_id
      from public.series_source_config c
      left join public.series_report_profile srp
        on srp.series_id = c.series_id
       and srp.is_active = true
      left join public.series_scoring_model ssm
        on ssm.series_id = c.series_id
       and ssm.is_active = true
      where c.entity_id = $1
      order by c.is_active desc, c.updated_at desc nulls last, c.id desc
      limit 1
    `,
    [entityId]
  );

  if (!row) {
    return null;
  }

  return {
    configKey: normalizeText(row.config_key),
    seriesId: toInteger(row.series_id),
    reportProfileId: toInteger(row.report_profile_id),
    scoringModelId: toInteger(row.scoring_model_id),
  };
}

async function cloneSeriesScoringModel(client, input) {
  const sourceModelId = toInteger(input.templateScoringModelId);
  const modelKey = await buildUniqueScoringModelKey(client, `${input.targetConfigKey}-v1`);
  const modelName = `${input.targetSeriesName} Default Model`;
  const sourceModel = sourceModelId
    ? await fetchOne(
        client,
        `
          select *
          from public.scoring_model
          where id = $1
          limit 1
        `,
        [sourceModelId]
      )
    : null;

  const model = await fetchOne(
    client,
    `
      insert into public.scoring_model (
        model_key,
        name,
        description,
        version_label,
        scope_type,
        status,
        is_active,
        copied_from_model_id
      )
      values ($1,$2,$3,$4,'series','draft',true,$5)
      returning *
    `,
    [
      modelKey,
      modelName,
      normalizeText(sourceModel?.description) || `Default scoring model for ${input.targetSeriesName}.`,
      normalizeText(sourceModel?.version_label) || "v1",
      sourceModelId || null,
    ]
  );

  await client.query(
    `
      insert into public.series_scoring_model (
        series_id,
        scoring_model_id,
        assigned_by,
        is_active
      )
      values ($1,$2,$3,true)
    `,
    [input.targetSeriesId, toInteger(model.id), "local-ops"]
  );

  if (!sourceModelId) {
    return model;
  }

  const copyConfigs = [
    `insert into public.scoring_model_points_formula (scoring_model_id, base_score, wins_weight, nrr_weight, rank_weight, min_weight, max_weight)
     select $2, base_score, wins_weight, nrr_weight, rank_weight, min_weight, max_weight
     from public.scoring_model_points_formula where scoring_model_id = $1`,
    `insert into public.scoring_model_team_strength_rule (scoring_model_id, division_key, division_label, division_premium, display_order)
     select $2, division_key, division_label, division_premium, display_order
     from public.scoring_model_team_strength_rule where scoring_model_id = $1`,
    `insert into public.scoring_model_player_tier_rule (scoring_model_id, discipline, tier_name, percentile_min, percentile_max, weight_multiplier, display_order)
     select $2, discipline, tier_name, percentile_min, percentile_max, weight_multiplier, display_order
     from public.scoring_model_player_tier_rule where scoring_model_id = $1`,
    `insert into public.scoring_model_phase_weight (scoring_model_id, role_type, phase_name, weight_multiplier)
     select $2, role_type, phase_name, weight_multiplier
     from public.scoring_model_phase_weight where scoring_model_id = $1`,
    `insert into public.scoring_model_leverage_weight (scoring_model_id, scenario_key, scenario_label, weight_multiplier, enabled, description)
     select $2, scenario_key, scenario_label, weight_multiplier, enabled, description
     from public.scoring_model_leverage_weight where scoring_model_id = $1`,
    `insert into public.scoring_model_composite_weight (scoring_model_id, primary_role, component_key, component_label, weight_value, display_order)
     select $2, primary_role, component_key, component_label, weight_value, display_order
     from public.scoring_model_composite_weight where scoring_model_id = $1`,
    `insert into public.scoring_model_quality_gate (scoring_model_id, gate_key, gate_label, numeric_value, text_value, bool_value)
     select $2, gate_key, gate_label, numeric_value, text_value, bool_value
     from public.scoring_model_quality_gate where scoring_model_id = $1`,
  ];

  for (const sql of copyConfigs) {
    await client.query(sql, [sourceModelId, toInteger(model.id)]);
  }

  return model;
}

function buildConfigEntry(result) {
  const probe = result.probe || {};
  const sourceContext = probe.sourceContext || {};
  return {
    slug: result.series.configKey,
    label: result.series.seriesName,
    enabled: false,
    source_system: result.series.sourceSystem,
    league_name: result.series.leagueName,
    season_year: result.series.seasonYear,
    series_url: result.series.seriesUrl,
    source_hints: {
      namespace: result.series.leagueName,
      club_id: sourceContext.clubId || result.sourceReference.clubId || undefined,
      series_id: result.series.sourceSeriesId,
    },
    targeting: {
      age_group: result.series.targetAgeGroup || "Open",
      divisions: [],
    },
    validation_players: [],
    outputs: {
      enable_raw_snapshots: true,
      enable_json_exports: true,
      enable_pdf_reports: false,
      enable_dashboard_views: true,
    },
  };
}

function upsertSeriesConfigEntry(configPath, entry) {
  const config = loadYamlConfig(configPath);
  const seriesList = Array.isArray(config.series) ? config.series : [];
  const existingIndex = seriesList.findIndex((series) => normalizeText(series.slug) === normalizeText(entry.slug));

  if (existingIndex === -1) {
    seriesList.push(entry);
  } else {
    seriesList[existingIndex] = {
      ...seriesList[existingIndex],
      ...entry,
    };
  }

  config.series = seriesList;
  writeYamlConfig(configPath, config);
}

module.exports = {
  registerSeries,
};

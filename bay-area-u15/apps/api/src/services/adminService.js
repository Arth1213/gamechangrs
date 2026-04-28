"use strict";

const {
  normalizeText,
  normalizeLabel,
  toBoolean,
  toInteger,
  toNumber,
} = require("../lib/utils");
const {
  fetchOne,
  loadActiveScoringModel,
  resolveSeriesContext,
  withClient,
  withTransaction,
} = require("./seriesService");
const {
  assertSubscriptionActionAllowed,
} = require("./subscriptionService");
const {
  loadEntityManagementSnapshot,
} = require("./accessService");

async function getSetupPayload(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    return getSetupPayloadWithClient(client, context);
  });
}

async function updateSetup(input) {
  return withTransaction(
    async (client) => {
      const context = await resolveSeriesContext(client, input.seriesConfigKey);
      if (!context) {
        const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
        error.statusCode = 404;
        throw error;
      }

      const sourceSetup = input.body?.sourceSetup || {};
      const divisions = Array.isArray(input.body?.divisions) ? input.body.divisions : [];

      if (sourceSetup.isActive === true && context.row.is_active !== true) {
        await assertSubscriptionActionAllowed(client, {
          seriesConfigKey: input.seriesConfigKey,
          action: "activate_series",
        });
      }

      await client.query(
        `
          update series_source_config
          set
            name = coalesce($2, name),
            series_url = coalesce($3, series_url),
            expected_league_name = coalesce($4, expected_league_name),
            expected_series_name = coalesce($5, expected_series_name),
            season_year = coalesce($6, season_year),
            target_age_group = coalesce($7, target_age_group),
            scrape_completed_only = coalesce($8, scrape_completed_only),
            include_ball_by_ball = coalesce($9, include_ball_by_ball),
            include_player_profiles = coalesce($10, include_player_profiles),
            enable_auto_discovery = coalesce($11, enable_auto_discovery),
            is_active = coalesce($12, is_active),
            notes = coalesce($13, notes),
            updated_at = now()
          where id = $1
        `,
        [
          context.row.id,
          nullableText(sourceSetup.name),
          nullableText(sourceSetup.seriesUrl),
          nullableText(sourceSetup.expectedLeagueName),
          nullableText(sourceSetup.expectedSeriesName),
          toInteger(sourceSetup.seasonYear),
          nullableText(sourceSetup.targetAgeGroup),
          booleanOrNull(sourceSetup.scrapeCompletedOnly),
          booleanOrNull(sourceSetup.includeBallByBall),
          booleanOrNull(sourceSetup.includePlayerProfiles),
          booleanOrNull(sourceSetup.enableAutoDiscovery),
          booleanOrNull(sourceSetup.isActive),
          nullableText(sourceSetup.notes),
        ]
      );

      if (normalizeText(input.body?.reportProfileKey)) {
        await assignReportProfile(client, context.seriesId, input.body.reportProfileKey);
      }

      for (const division of divisions) {
        const configId = toInteger(division.id);
        if (!configId) {
          continue;
        }
        await client.query(
          `
            update series_target_division_config
            set
              target_label = coalesce($2, target_label),
              phase_no = coalesce($3, phase_no),
              division_no = coalesce($4, division_no),
              strength_rank = coalesce($5, strength_rank),
              strength_tier = coalesce($6, strength_tier),
              include_flag = coalesce($7, include_flag),
              notes = coalesce($8, notes)
            where id = $1
          `,
          [
            configId,
            nullableText(division.targetLabel),
            toInteger(division.phaseNo),
            toInteger(division.divisionNo),
            toInteger(division.strengthRank) || strengthRankFromTier(division.strengthTier),
            nullableText(division.strengthTier),
            booleanOrNull(division.includeFlag),
            nullableText(division.notes),
          ]
        );
      }

      const payload = await getSetupPayloadWithClient(client, context);
      return {
        message: input.dryRun ? "Dry-run setup update validated." : "Setup updated.",
        payload,
      };
    },
    { dryRun: input.dryRun }
  );
}

async function createSeries(input) {
  const actorUserId = nullableText(input.actorUserId);
  const entityId = nullableText(input.body?.entityId);
  const sourceSetup = input.body?.sourceSetup || {};
  const requestedReportProfileKey = normalizeText(input.body?.reportProfileKey);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to create a series.");
    error.statusCode = 400;
    throw error;
  }

  if (!entityId) {
    const error = new Error("entityId is required to create a series.");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(
    async (client) => {
      const entityAccess = await loadEntityManagementSnapshot(client, {
        userId: actorUserId,
        entityId,
      });

      if (!entityAccess.authFoundationReady) {
        const error = new Error(
          "Phase 10 entity auth foundation is not available in the database yet. Apply the tenant-foundation migration first."
        );
        error.statusCode = 503;
        throw error;
      }

      if (!entityAccess.canManage) {
        const error = new Error("You do not have admin access to create a series for this entity.");
        error.statusCode = 403;
        throw error;
      }

      const seriesName = nullableText(sourceSetup.name) || nullableText(sourceSetup.expectedSeriesName);
      const seasonYear = toInteger(sourceSetup.seasonYear);
      const isActive = booleanOrNull(sourceSetup.isActive) === true;

      if (!seriesName) {
        const error = new Error("Series display name is required.");
        error.statusCode = 400;
        throw error;
      }

      if (!seasonYear) {
        const error = new Error("Season year is required.");
        error.statusCode = 400;
        throw error;
      }

      const sourceReference = parseSeriesSourceReference({
        sourceSystem: nullableText(sourceSetup.sourceSystem) || "cricclubs",
        seriesUrl: sourceSetup.seriesUrl,
        expectedLeagueName: sourceSetup.expectedLeagueName,
      });

      const existingSeries = await fetchOne(
        client,
        `
          select
            s.id as series_id,
            s.name as series_name,
            c.config_key
          from public.series s
          left join public.series_source_config c on c.series_id = s.id
          where s.source_system = $1
            and s.league_name = $2
            and s.source_series_id = $3
          limit 1
        `,
        [
          sourceReference.sourceSystem,
          sourceReference.leagueName,
          sourceReference.sourceSeriesId,
        ]
      );

      if (existingSeries) {
        const error = new Error(
          `This source series is already configured as ${normalizeText(existingSeries.config_key) || normalizeText(existingSeries.series_name) || "an existing series"}.`
        );
        error.statusCode = 409;
        throw error;
      }

      const capacity = await getEntitySeriesCapacity(client, entityAccess.entityId);
      assertEntitySeriesCreationAllowed(capacity);

      const configKey = await buildUniqueSeriesConfigKey(client, {
        entitySlug: entityAccess.entitySlug,
        seriesName,
        seasonYear,
        sourceSeriesId: sourceReference.sourceSeriesId,
      });

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
          seriesName,
          seasonYear,
          `${seasonYear} ${seriesName}`,
          sourceReference.seriesUrl,
          entityAccess.entityId,
        ]
      );

      const sourceConfigRow = await fetchOne(
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
          seriesName,
          sourceReference.sourceSystem,
          sourceReference.seriesUrl,
          nullableText(sourceSetup.expectedLeagueName) || sourceReference.leagueName,
          nullableText(sourceSetup.expectedSeriesName) || seriesName,
          seasonYear,
          nullableText(sourceSetup.targetAgeGroup),
          booleanOrNull(sourceSetup.scrapeCompletedOnly) !== false,
          booleanOrNull(sourceSetup.includeBallByBall) !== false,
          booleanOrNull(sourceSetup.includePlayerProfiles) !== false,
          booleanOrNull(sourceSetup.enableAutoDiscovery) !== false,
          isActive,
          nullableText(sourceSetup.notes),
          toInteger(seriesRow.id),
          entityAccess.entityId,
          actorUserId,
          actorUserId,
        ]
      );

      const templateContext = await findTemplateSeriesContext(client, {
        entityId: entityAccess.entityId,
        excludeSeriesId: toInteger(seriesRow.id),
      });

      if (requestedReportProfileKey) {
        await assignReportProfile(client, toInteger(seriesRow.id), requestedReportProfileKey);
      } else if (normalizeText(templateContext?.reportProfile?.profile_key)) {
        await assignReportProfile(
          client,
          toInteger(seriesRow.id),
          normalizeText(templateContext.reportProfile.profile_key)
        );
      }

      await cloneSeriesScoringModel(client, {
        targetSeriesId: toInteger(seriesRow.id),
        targetConfigKey: normalizeText(sourceConfigRow.config_key),
        targetSeriesName: seriesName,
        templateSeriesId: templateContext?.seriesId,
        actorUserId,
      });

      const createdContext = await resolveSeriesContext(client, normalizeText(sourceConfigRow.config_key));
      const payload = await getSetupPayloadWithClient(client, createdContext);

      return {
        message: input.dryRun ? "Dry-run series creation validated." : "Series created.",
        series: {
          seriesSourceConfigId: toInteger(sourceConfigRow.id),
          entityId: entityAccess.entityId,
          entitySlug: entityAccess.entitySlug,
          entityName: entityAccess.entityName,
          configKey: normalizeText(sourceConfigRow.config_key),
          seriesName,
          targetAgeGroup: nullableText(sourceSetup.targetAgeGroup),
          seasonYear,
          sourceSystem: sourceReference.sourceSystem,
          seriesUrl: sourceReference.seriesUrl,
          isActive,
          accessRole: entityAccess.accessRole || "admin",
          canManage: true,
          matchCount: 0,
          computedMatches: 0,
          warningMatches: 0,
          playerCount: 0,
        },
        payload,
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function getTuningPayload(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    return getTuningPayloadWithClient(client, context);
  });
}

async function updateTuning(input) {
  return withTransaction(
    async (client) => {
      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey: input.seriesConfigKey,
        action: "weight_tuning",
      });

      const context = await resolveSeriesContext(client, input.seriesConfigKey);
      if (!context) {
        const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
        error.statusCode = 404;
        throw error;
      }
      if (!context.scoringModel) {
        const error = new Error(`No active scoring model found for ${input.seriesConfigKey}.`);
        error.statusCode = 404;
        throw error;
      }

      const scoringModelId = toInteger(context.scoringModel.id);
      const body = input.body || {};

      if (body.pointsFormula) {
        await client.query(
          `
            insert into scoring_model_points_formula (
              scoring_model_id,
              base_score,
              wins_weight,
              nrr_weight,
              rank_weight,
              min_weight,
              max_weight
            )
            values ($1,$2,$3,$4,$5,$6,$7)
            on conflict (scoring_model_id)
            do update set
              base_score = excluded.base_score,
              wins_weight = excluded.wins_weight,
              nrr_weight = excluded.nrr_weight,
              rank_weight = excluded.rank_weight,
              min_weight = excluded.min_weight,
              max_weight = excluded.max_weight
          `,
          [
            scoringModelId,
            toNumber(body.pointsFormula.baseScore, 1),
            toNumber(body.pointsFormula.winsWeight, 0.45),
            toNumber(body.pointsFormula.nrrWeight, 0.30),
            toNumber(body.pointsFormula.rankWeight, 0.25),
            toNumber(body.pointsFormula.minWeight, 0.85),
            toNumber(body.pointsFormula.maxWeight, 1.30),
          ]
        );
      }

      await upsertRuleRows(client, scoringModelId, body.teamStrengthRules, {
        sql: `
          insert into scoring_model_team_strength_rule (
            scoring_model_id,
            division_key,
            division_label,
            division_premium,
            display_order
          )
          values ($1,$2,$3,$4,$5)
          on conflict (scoring_model_id, division_key)
          do update set
            division_label = excluded.division_label,
            division_premium = excluded.division_premium,
            display_order = excluded.display_order
        `,
        values: (row, index) => [
          normalizeText(row.divisionKey),
          nullableText(row.divisionLabel) || normalizeText(row.divisionKey),
          toNumber(row.divisionPremium, 1),
          toInteger(row.displayOrder) ?? index,
        ],
      });

      await upsertRuleRows(client, scoringModelId, body.playerTierRules, {
        sql: `
          insert into scoring_model_player_tier_rule (
            scoring_model_id,
            discipline,
            tier_name,
            percentile_min,
            percentile_max,
            weight_multiplier,
            display_order
          )
          values ($1,$2,$3,$4,$5,$6,$7)
          on conflict (scoring_model_id, discipline, tier_name)
          do update set
            percentile_min = excluded.percentile_min,
            percentile_max = excluded.percentile_max,
            weight_multiplier = excluded.weight_multiplier,
            display_order = excluded.display_order
        `,
        values: (row, index) => [
          normalizeText(row.discipline),
          normalizeText(row.tierName),
          toNumber(row.percentileMin, 0),
          row.percentileMax === null || row.percentileMax === "" ? null : toNumber(row.percentileMax),
          toNumber(row.weightMultiplier, 1),
          toInteger(row.displayOrder) ?? index,
        ],
      });

      await upsertRuleRows(client, scoringModelId, body.phaseWeights, {
        sql: `
          insert into scoring_model_phase_weight (
            scoring_model_id,
            role_type,
            phase_name,
            weight_multiplier
          )
          values ($1,$2,$3,$4)
          on conflict (scoring_model_id, role_type, phase_name)
          do update set
            weight_multiplier = excluded.weight_multiplier
        `,
        values: (row) => [
          normalizeText(row.roleType),
          normalizeText(row.phaseName),
          toNumber(row.weightMultiplier, 1),
        ],
      });

      await upsertRuleRows(client, scoringModelId, body.leverageWeights, {
        sql: `
          insert into scoring_model_leverage_weight (
            scoring_model_id,
            scenario_key,
            scenario_label,
            weight_multiplier,
            enabled,
            description
          )
          values ($1,$2,$3,$4,$5,$6)
          on conflict (scoring_model_id, scenario_key)
          do update set
            scenario_label = excluded.scenario_label,
            weight_multiplier = excluded.weight_multiplier,
            enabled = excluded.enabled,
            description = excluded.description
        `,
        values: (row) => [
          normalizeText(row.scenarioKey),
          nullableText(row.scenarioLabel) || normalizeText(row.scenarioKey),
          toNumber(row.weightMultiplier, 1),
          row.enabled === undefined ? true : toBoolean(row.enabled),
          nullableText(row.description),
        ],
      });

      await upsertRuleRows(client, scoringModelId, body.compositeWeights, {
        sql: `
          insert into scoring_model_composite_weight (
            scoring_model_id,
            primary_role,
            component_key,
            component_label,
            weight_value,
            display_order
          )
          values ($1,$2,$3,$4,$5,$6)
          on conflict (scoring_model_id, primary_role, component_key)
          do update set
            component_label = excluded.component_label,
            weight_value = excluded.weight_value,
            display_order = excluded.display_order
        `,
        values: (row, index) => [
          normalizeText(row.primaryRole),
          normalizeText(row.componentKey),
          nullableText(row.componentLabel) || normalizeText(row.componentKey),
          toNumber(row.weightValue, 0),
          toInteger(row.displayOrder) ?? index,
        ],
      });

      await upsertRuleRows(client, scoringModelId, body.qualityGates, {
        sql: `
          insert into scoring_model_quality_gate (
            scoring_model_id,
            gate_key,
            gate_label,
            numeric_value,
            text_value,
            bool_value
          )
          values ($1,$2,$3,$4,$5,$6)
          on conflict (scoring_model_id, gate_key)
          do update set
            gate_label = excluded.gate_label,
            numeric_value = excluded.numeric_value,
            text_value = excluded.text_value,
            bool_value = excluded.bool_value
        `,
        values: (row) => [
          normalizeText(row.gateKey),
          nullableText(row.gateLabel) || normalizeText(row.gateKey),
          row.numericValue === null || row.numericValue === "" ? null : toNumber(row.numericValue),
          row.textValue === null || row.textValue === "" ? null : normalizeText(row.textValue),
          row.boolValue === null || row.boolValue === undefined || row.boolValue === ""
            ? null
            : toBoolean(row.boolValue),
        ],
      });

      const payload = await getTuningPayloadWithClient(client, context);
      return {
        message: input.dryRun ? "Dry-run tuning update validated." : "Tuning updated.",
        payload,
      };
    },
    { dryRun: input.dryRun }
  );
}

async function getMatchOpsPayload(input) {
  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, input.seriesConfigKey);
    if (!context) {
      const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
      error.statusCode = 404;
      throw error;
    }

    return getMatchOpsPayloadWithClient(client, context, input);
  });
}

async function createManualRefreshRequest(input) {
  return withTransaction(
    async (client) => {
      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey: input.seriesConfigKey,
        action: "manual_refresh",
      });

      const context = await resolveSeriesContext(client, input.seriesConfigKey);
      if (!context) {
        const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
        error.statusCode = 404;
        throw error;
      }

      const normalized = normalizeMatchUrl(input.body?.matchUrl, context.row.expected_league_name);
      const existingMatch = await fetchOne(
        client,
        `
          select
            m.id,
            m.source_match_id,
            d.source_label as division_label,
            t1.display_name || ' v ' || t2.display_name as match_title
          from match m
          join team t1 on t1.id = m.team1_id
          join team t2 on t2.id = m.team2_id
          left join division d on d.id = m.division_id
          where m.series_id = $1
            and m.source_match_id = $2
          limit 1
        `,
        [context.seriesId, normalized.sourceMatchId]
      );

      const requestRow = await fetchOne(
        client,
        `
          insert into manual_match_refresh_request (
            series_source_config_id,
            match_id,
            request_source_system,
            request_match_url,
            normalized_match_url,
            request_source_match_id,
            request_reason,
            requested_by,
            status
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          returning *
        `,
        [
          context.row.id,
          existingMatch ? existingMatch.id : null,
          context.sourceSystem,
          normalizeText(input.body?.matchUrl),
          normalized.normalizedUrl,
          normalized.sourceMatchId,
          nullableText(input.body?.reason),
          nullableText(input.body?.requestedBy) || "phase8-api",
          "pending",
        ]
      );

      if (existingMatch) {
        await client.query(
          `
            update match_refresh_state
            set
              needs_rescrape = true,
              needs_reparse = true,
              needs_recompute = true,
              parse_status = 'pending',
              analytics_status = 'pending',
              last_change_reason = 'manual_refresh_request',
              last_error_message = null
            where match_id = $1
          `,
          [existingMatch.id]
        );
      }

      return {
        message: input.dryRun
          ? "Dry-run refresh request validated."
          : "Manual refresh request created.",
        request: {
          requestId: toInteger(requestRow.id),
          normalizedMatchUrl: normalized.normalizedUrl,
          requestSourceMatchId: normalized.sourceMatchId,
          requestedBy: normalizeText(requestRow.requested_by),
          reason: normalizeText(requestRow.request_reason),
        },
        resolvedMatch: existingMatch
          ? {
              matchId: toInteger(existingMatch.id),
              sourceMatchId: normalizeText(existingMatch.source_match_id),
              divisionLabel: normalizeText(existingMatch.division_label),
              matchTitle: normalizeText(existingMatch.match_title),
            }
          : null,
      };
    },
    { dryRun: input.dryRun }
  );
}

async function updateMatchSelectionOverride(input) {
  return withTransaction(
    async (client) => {
      const context = await resolveSeriesContext(client, input.seriesConfigKey);
      if (!context) {
        const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
        error.statusCode = 404;
        throw error;
      }

      const matchId = toInteger(input.matchId);
      const override = normalizeLabel(input.body?.override);
      if (!["auto", "force_include", "force_exclude"].includes(override)) {
        const error = new Error("override must be one of auto, force_include, or force_exclude.");
        error.statusCode = 400;
        throw error;
      }
      if (override !== "auto" && !normalizeText(input.body?.reason)) {
        const error = new Error("reason is required when forcing include or exclude.");
        error.statusCode = 400;
        throw error;
      }

      const matchRow = await fetchOne(
        client,
        `
          select m.id, m.source_match_id
          from match m
          where m.id = $1
            and m.series_id = $2
          limit 1
        `,
        [matchId, context.seriesId]
      );
      if (!matchRow) {
        const error = new Error(`Match ${matchId} does not belong to ${input.seriesConfigKey}.`);
        error.statusCode = 404;
        throw error;
      }

      await client.query(
        `
          update match_refresh_state
          set
            admin_selection_override = $2,
            admin_override_reason = $3,
            admin_override_by = $4,
            admin_override_at = case when $2 = 'auto' then null else now() end,
            last_change_reason = 'admin_selection_override'
          where match_id = $1
        `,
        [
          matchId,
          override,
          override === "auto" ? null : normalizeText(input.body?.reason),
          override === "auto" ? null : normalizeText(input.body?.requestedBy) || "phase8-api",
        ]
      );

      return {
        message: input.dryRun ? "Dry-run override validated." : "Selection override updated.",
        matchId,
        sourceMatchId: normalizeText(matchRow.source_match_id),
        override,
        reason: override === "auto" ? "" : normalizeText(input.body?.reason),
      };
    },
    { dryRun: input.dryRun }
  );
}

async function getSetupPayloadWithClient(client, context) {
  const divisionsResult = await client.query(
    `
      select
        tdc.id,
        tdc.target_label,
        tdc.normalized_label,
        tdc.phase_no,
        tdc.division_no,
        tdc.strength_rank,
        tdc.strength_tier,
        tdc.include_flag,
        tdc.notes,
        d.source_division_id,
        d.source_label,
        d.stats_url,
        d.results_url
      from series_target_division_config tdc
      left join division d on d.id = tdc.division_id
      where tdc.series_source_config_id = $1
      order by tdc.phase_no, tdc.division_no, tdc.id
    `,
    [context.row.id]
  );

  const aliasResult = await client.query(
    `
      select
        tdc.id,
        array_remove(array_agg(a.alias_label order by a.alias_label), null) as aliases
      from series_target_division_config tdc
      left join series_target_division_alias a
        on a.series_target_division_config_id = tdc.id
      where tdc.series_source_config_id = $1
      group by tdc.id
    `,
    [context.row.id]
  );

  const aliasByDivision = new Map(
    aliasResult.rows.map((row) => [toInteger(row.id), row.aliases || []])
  );

  const reportProfiles = (
    await client.query(
      `
        select *
        from report_profile
        order by name, id
      `
    )
  ).rows;

  const validationAnchors = (
    await client.query(
      `
        select *
        from validation_anchor
        where series_id = $1
        order by priority_rank, id
      `,
      [context.seriesId]
    )
  ).rows;

  const summary = await fetchOne(
    client,
    `
      select
        count(*)::int as total_matches,
        count(*) filter (where mrs.reconciliation_status = 'warn')::int as warning_matches,
        count(*) filter (where mrs.analytics_status = 'computed')::int as computed_matches
      from match m
      left join match_refresh_state mrs on mrs.match_id = m.id
      where m.series_id = $1
    `,
    [context.seriesId]
  );

  return {
    series: {
      configKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
    },
    sourceSetup: {
      id: toInteger(context.row.id),
      name: normalizeText(context.row.name),
      sourceSystem: normalizeText(context.row.source_system),
      seriesUrl: normalizeText(context.row.series_url),
      expectedLeagueName: normalizeText(context.row.expected_league_name),
      expectedSeriesName: normalizeText(context.row.expected_series_name),
      seasonYear: toInteger(context.row.season_year),
      targetAgeGroup: normalizeText(context.row.target_age_group),
      scrapeCompletedOnly: toBoolean(context.row.scrape_completed_only),
      includeBallByBall: toBoolean(context.row.include_ball_by_ball),
      includePlayerProfiles: toBoolean(context.row.include_player_profiles),
      enableAutoDiscovery: toBoolean(context.row.enable_auto_discovery),
      isActive: toBoolean(context.row.is_active),
      notes: normalizeText(context.row.notes),
    },
    divisions: divisionsResult.rows.map((row) => ({
      id: toInteger(row.id),
      targetLabel: normalizeText(row.target_label),
      normalizedLabel: normalizeText(row.normalized_label),
      phaseNo: toInteger(row.phase_no),
      divisionNo: toInteger(row.division_no),
      strengthRank: toInteger(row.strength_rank),
      strengthTier: normalizeText(row.strength_tier),
      includeFlag: toBoolean(row.include_flag),
      notes: normalizeText(row.notes),
      sourceDivisionId: normalizeText(row.source_division_id),
      sourceLabel: normalizeText(row.source_label),
      statsUrl: normalizeText(row.stats_url),
      resultsUrl: normalizeText(row.results_url),
      aliases: aliasByDivision.get(toInteger(row.id)) || [],
    })),
    reportProfile: {
      activeProfileKey: normalizeText(context.reportProfile?.profile_key),
      activeProfileName: normalizeText(context.reportProfile?.name),
      options: reportProfiles.map((row) => ({
        profileKey: normalizeText(row.profile_key),
        name: normalizeText(row.name),
        description: normalizeText(row.description),
      })),
    },
    validationAnchors: validationAnchors.map((row) => ({
      id: toInteger(row.id),
      entityType: normalizeText(row.entity_type),
      entityName: normalizeText(row.entity_name),
      expectationText: normalizeText(row.expectation_text),
      priorityRank: toInteger(row.priority_rank),
      isActive: toBoolean(row.is_active),
    })),
    liveSummary: {
      totalMatches: toInteger(summary?.total_matches) || 0,
      warningMatches: toInteger(summary?.warning_matches) || 0,
      computedMatches: toInteger(summary?.computed_matches) || 0,
    },
  };
}

async function getTuningPayloadWithClient(client, context) {
  if (!context.scoringModel) {
    return {
      series: {
        configKey: context.configKey,
        seriesId: context.seriesId,
        seriesName: context.seriesName,
      },
      scoringModel: null,
      pointsFormula: null,
      teamStrengthRules: [],
      playerTierRules: [],
      phaseWeights: [],
      leverageWeights: [],
      compositeWeights: [],
      qualityGates: [],
    };
  }

  const scoringModelId = toInteger(context.scoringModel.id);
  const pointsFormula = await fetchOne(
    client,
    `
      select *
      from scoring_model_points_formula
      where scoring_model_id = $1
      limit 1
    `,
    [scoringModelId]
  );
  const teamStrengthRules = await client.query(
    `
      select *
      from scoring_model_team_strength_rule
      where scoring_model_id = $1
      order by display_order, division_key
    `,
    [scoringModelId]
  );
  const playerTierRules = await client.query(
    `
      select *
      from scoring_model_player_tier_rule
      where scoring_model_id = $1
      order by discipline, display_order, tier_name
    `,
    [scoringModelId]
  );
  const phaseWeights = await client.query(
    `
      select *
      from scoring_model_phase_weight
      where scoring_model_id = $1
      order by role_type, phase_name
    `,
    [scoringModelId]
  );
  const leverageWeights = await client.query(
    `
      select *
      from scoring_model_leverage_weight
      where scoring_model_id = $1
      order by scenario_key
    `,
    [scoringModelId]
  );
  const compositeWeights = await client.query(
    `
      select *
      from scoring_model_composite_weight
      where scoring_model_id = $1
      order by primary_role, display_order, component_key
    `,
    [scoringModelId]
  );
  const qualityGates = await client.query(
    `
      select *
      from scoring_model_quality_gate
      where scoring_model_id = $1
      order by gate_key
    `,
    [scoringModelId]
  );

  return {
    series: {
      configKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
    },
    scoringModel: {
      id: scoringModelId,
      modelKey: normalizeText(context.scoringModel.model_key),
      name: normalizeText(context.scoringModel.name),
      versionLabel: normalizeText(context.scoringModel.version_label),
      status: normalizeText(context.scoringModel.status),
    },
    pointsFormula: pointsFormula
      ? {
          baseScore: toNumber(pointsFormula.base_score, 1),
          winsWeight: toNumber(pointsFormula.wins_weight, 0.45),
          nrrWeight: toNumber(pointsFormula.nrr_weight, 0.30),
          rankWeight: toNumber(pointsFormula.rank_weight, 0.25),
          minWeight: toNumber(pointsFormula.min_weight, 0.85),
          maxWeight: toNumber(pointsFormula.max_weight, 1.30),
        }
      : null,
    teamStrengthRules: teamStrengthRules.rows.map((row) => ({
      id: toInteger(row.id),
      divisionKey: normalizeText(row.division_key),
      divisionLabel: normalizeText(row.division_label),
      divisionPremium: toNumber(row.division_premium, 1),
      displayOrder: toInteger(row.display_order) || 0,
    })),
    playerTierRules: playerTierRules.rows.map((row) => ({
      id: toInteger(row.id),
      discipline: normalizeText(row.discipline),
      tierName: normalizeText(row.tier_name),
      percentileMin: toNumber(row.percentile_min, 0),
      percentileMax: row.percentile_max === null ? null : toNumber(row.percentile_max),
      weightMultiplier: toNumber(row.weight_multiplier, 1),
      displayOrder: toInteger(row.display_order) || 0,
    })),
    phaseWeights: phaseWeights.rows.map((row) => ({
      id: toInteger(row.id),
      roleType: normalizeText(row.role_type),
      phaseName: normalizeText(row.phase_name),
      weightMultiplier: toNumber(row.weight_multiplier, 1),
    })),
    leverageWeights: leverageWeights.rows.map((row) => ({
      id: toInteger(row.id),
      scenarioKey: normalizeText(row.scenario_key),
      scenarioLabel: normalizeText(row.scenario_label),
      weightMultiplier: toNumber(row.weight_multiplier, 1),
      enabled: toBoolean(row.enabled),
      description: normalizeText(row.description),
    })),
    compositeWeights: compositeWeights.rows.map((row) => ({
      id: toInteger(row.id),
      primaryRole: normalizeText(row.primary_role),
      componentKey: normalizeText(row.component_key),
      componentLabel: normalizeText(row.component_label),
      weightValue: toNumber(row.weight_value, 0),
      displayOrder: toInteger(row.display_order) || 0,
    })),
    qualityGates: qualityGates.rows.map((row) => ({
      id: toInteger(row.id),
      gateKey: normalizeText(row.gate_key),
      gateLabel: normalizeText(row.gate_label),
      numericValue: row.numeric_value === null ? null : toNumber(row.numeric_value),
      textValue: normalizeText(row.text_value),
      boolValue: row.bool_value === null ? null : toBoolean(row.bool_value),
    })),
  };
}

async function getMatchOpsPayloadWithClient(client, context, input) {
  const limit = Math.min(Math.max(toInteger(input.limit) || 25, 1), 100);
  const query = normalizeText(input.query);
  const like = query ? `%${query}%` : null;

  const summary = await fetchOne(
    client,
    `
      select
        count(*)::int as total_matches,
        count(*) filter (where mrs.reconciliation_status = 'warn')::int as warning_matches,
        count(*) filter (where mrs.admin_selection_override <> 'auto')::int as overridden_matches,
        count(*) filter (where mrs.analytics_status = 'computed')::int as computed_matches,
        count(*) filter (
          where coalesce(mrs.needs_rescrape, false) = true
             or coalesce(mrs.needs_reparse, false) = true
             or coalesce(mrs.needs_recompute, false) = true
        )::int as pending_ops
      from match m
      left join match_refresh_state mrs on mrs.match_id = m.id
      where m.series_id = $1
    `,
    [context.seriesId]
  );

  const matches = (
    await client.query(
      `
        select
          m.id,
          m.source_match_id,
          d.source_label as division_label,
          m.match_date,
          t1.display_name || ' v ' || t2.display_name as match_title,
          m.result_text,
          m.match_page_url,
          m.scorecard_url,
          m.ball_by_ball_url,
          mrs.admin_selection_override,
          mrs.admin_override_reason,
          mrs.analytics_status,
          mrs.parse_status,
          mrs.reconciliation_status,
          mrs.needs_rescrape,
          mrs.needs_reparse,
          mrs.needs_recompute,
          mrs.last_change_reason,
          mrs.last_error_message
        from match m
        join team t1 on t1.id = m.team1_id
        join team t2 on t2.id = m.team2_id
        left join division d on d.id = m.division_id
        left join match_refresh_state mrs on mrs.match_id = m.id
        where m.series_id = $1
          and (
            $2::text is null
            or t1.display_name ilike $2
            or t2.display_name ilike $2
            or m.source_match_id ilike $2
            or d.source_label ilike $2
          )
        order by m.match_date desc nulls last, m.id desc
        limit $3
      `,
      [context.seriesId, like, limit]
    )
  ).rows.map((row) => ({
    matchId: toInteger(row.id),
    sourceMatchId: normalizeText(row.source_match_id),
    divisionLabel: normalizeText(row.division_label),
    matchDate: row.match_date,
    matchDateLabel: normalizeText(row.match_date) ? new Date(row.match_date).toISOString().slice(0, 10) : "",
    matchTitle: normalizeText(row.match_title),
    resultText: normalizeText(row.result_text),
    matchPageUrl: normalizeText(row.match_page_url),
    scorecardUrl: normalizeText(row.scorecard_url),
    ballByBallUrl: normalizeText(row.ball_by_ball_url),
    adminSelectionOverride: normalizeText(row.admin_selection_override) || "auto",
    adminOverrideReason: normalizeText(row.admin_override_reason),
    analyticsStatus: normalizeText(row.analytics_status) || "pending",
    parseStatus: normalizeText(row.parse_status) || "pending",
    reconciliationStatus: normalizeText(row.reconciliation_status) || "pending",
    needsRescrape: toBoolean(row.needs_rescrape),
    needsReparse: toBoolean(row.needs_reparse),
    needsRecompute: toBoolean(row.needs_recompute),
    lastChangeReason: normalizeText(row.last_change_reason),
    lastErrorMessage: normalizeText(row.last_error_message),
  }));

  const requests = (
    await client.query(
      `
        select
          mmrr.id,
          mmrr.request_match_url,
          mmrr.normalized_match_url,
          mmrr.request_source_match_id,
          mmrr.request_reason,
          mmrr.requested_by,
          mmrr.requested_at,
          mmrr.status,
          mmrr.resolution_note,
          m.source_match_id as linked_source_match_id
        from manual_match_refresh_request mmrr
        left join match m on m.id = mmrr.match_id
        where mmrr.series_source_config_id = $1
        order by mmrr.requested_at desc, mmrr.id desc
        limit 10
      `,
      [context.row.id]
    )
  ).rows.map((row) => ({
    requestId: toInteger(row.id),
    requestMatchUrl: normalizeText(row.request_match_url),
    normalizedMatchUrl: normalizeText(row.normalized_match_url),
    requestSourceMatchId: normalizeText(row.request_source_match_id),
    linkedSourceMatchId: normalizeText(row.linked_source_match_id),
    reason: normalizeText(row.request_reason),
    requestedBy: normalizeText(row.requested_by),
    requestedAt: row.requested_at,
    status: normalizeText(row.status),
    resolutionNote: normalizeText(row.resolution_note),
  }));

  return {
    series: {
      configKey: context.configKey,
      seriesId: context.seriesId,
      seriesName: context.seriesName,
    },
    filters: {
      query,
      limit,
    },
    summary: {
      totalMatches: toInteger(summary?.total_matches) || 0,
      warningMatches: toInteger(summary?.warning_matches) || 0,
      overriddenMatches: toInteger(summary?.overridden_matches) || 0,
      computedMatches: toInteger(summary?.computed_matches) || 0,
      pendingOps: toInteger(summary?.pending_ops) || 0,
    },
    matches,
    recentRequests: requests,
  };
}

async function assignReportProfile(client, seriesId, reportProfileKey) {
  const reportProfile = await fetchOne(
    client,
    `
      select *
      from report_profile
      where profile_key = $1
      limit 1
    `,
    [normalizeText(reportProfileKey)]
  );

  if (!reportProfile) {
    const error = new Error(`Report profile ${reportProfileKey} not found.`);
    error.statusCode = 404;
    throw error;
  }

  await client.query(
    `
      update series_report_profile
      set is_active = false
      where series_id = $1
    `,
    [seriesId]
  );

  const existing = await fetchOne(
    client,
    `
      select *
      from series_report_profile
      where series_id = $1
        and report_profile_id = $2
      limit 1
    `,
    [seriesId, reportProfile.id]
  );

  if (existing) {
    await client.query(
      `
        update series_report_profile
        set is_active = true,
            assigned_at = now(),
            assigned_by = 'phase8-api'
        where id = $1
      `,
      [existing.id]
    );
    return;
  }

  await client.query(
    `
      insert into series_report_profile (
        series_id,
        report_profile_id,
        assigned_by,
        is_active
      )
      values ($1,$2,$3,$4)
    `,
    [seriesId, reportProfile.id, "phase8-api", true]
  );
}

async function upsertRuleRows(client, scoringModelId, rows, config) {
  if (!Array.isArray(rows) || !rows.length) {
    return;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    await client.query(config.sql, [scoringModelId, ...config.values(row, index)]);
  }
}

async function getEntitySeriesCapacity(client, entityId) {
  const row = await fetchOne(
    client,
    `
      select
        e.id as entity_id,
        e.slug as entity_slug,
        e.display_name as entity_name,
        es.plan_key,
        es.plan_display_name,
        es.status as subscription_status,
        es.enforcement_mode,
        es.max_series,
        count(distinct c.id)::int as series_count,
        count(distinct case when c.is_active = true then c.id end)::int as active_series_count
      from public.entity e
      left join public.entity_subscription es on es.entity_id = e.id
      left join public.series_source_config c on c.entity_id = e.id
      where e.id = $1
      group by
        e.id,
        e.slug,
        e.display_name,
        es.plan_key,
        es.plan_display_name,
        es.status,
        es.enforcement_mode,
        es.max_series
      limit 1
    `,
    [entityId]
  );

  if (!row) {
    const error = new Error(`Entity not found for id: ${entityId}`);
    error.statusCode = 404;
    throw error;
  }

  return {
    entityId: normalizeText(row.entity_id),
    entitySlug: normalizeText(row.entity_slug),
    entityName: normalizeText(row.entity_name),
    planKey: normalizeText(row.plan_key),
    planDisplayName: normalizeText(row.plan_display_name),
    subscriptionStatus: normalizeText(row.subscription_status),
    enforcementMode: normalizeText(row.enforcement_mode) || "hard",
    maxSeries: toInteger(row.max_series),
    seriesCount: toInteger(row.series_count) || 0,
    activeSeriesCount: toInteger(row.active_series_count) || 0,
  };
}

function hasActiveEntitySubscription(capacity) {
  const planKey = normalizeLabel(capacity?.planKey);
  const status = normalizeLabel(capacity?.subscriptionStatus);

  if (planKey === "internal") {
    return true;
  }

  return ["active", "trial"].includes(status);
}

function assertEntitySeriesCreationAllowed(capacity) {
  const hardEnforced = normalizeLabel(capacity?.enforcementMode) !== "advisory";

  if (!hasActiveEntitySubscription(capacity) && hardEnforced) {
    const error = new Error(
      "Managed cricket features are locked because the entity subscription is not active."
    );
    error.statusCode = 403;
    throw error;
  }

  if (
    capacity?.maxSeries !== null
    && capacity?.maxSeries !== undefined
    && hardEnforced
    && (capacity?.seriesCount || 0) >= capacity.maxSeries
  ) {
    const error = new Error(
      `Series allocation is at limit for this entity plan (${capacity.seriesCount}/${capacity.maxSeries}).`
    );
    error.statusCode = 409;
    throw error;
  }
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

function parseSeriesSourceReference(input) {
  const sourceSystem = normalizeLabel(input.sourceSystem) || "cricclubs";
  if (sourceSystem !== "cricclubs") {
    const error = new Error("Only CricClubs series setup is supported in the current admin phase.");
    error.statusCode = 400;
    throw error;
  }

  const rawUrl = normalizeText(input.seriesUrl);
  if (!rawUrl) {
    const error = new Error("Series source URL is required.");
    error.statusCode = 400;
    throw error;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    error.statusCode = 400;
    error.message = `Unable to parse seriesUrl: ${rawUrl}`;
    throw error;
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const fallbackLeagueName = nullableText(input.expectedLeagueName);
  const leagueName = normalizeText(pathParts[0]) || fallbackLeagueName;
  const sourceSeriesId = normalizeText(
    parsed.searchParams.get("league")
    || parsed.searchParams.get("seriesId")
    || parsed.searchParams.get("series")
    || parsed.pathname.match(/(\d+)(?:\/)?$/)?.[1]
  );

  if (!leagueName) {
    const error = new Error(
      "Series URL must contain the CricClubs league namespace or expectedLeagueName must be supplied."
    );
    error.statusCode = 400;
    throw error;
  }

  if (!sourceSeriesId) {
    const error = new Error(
      "Series URL must include the source series id, usually via the league query parameter."
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    sourceSystem,
    leagueName,
    sourceSeriesId,
    seriesUrl: parsed.toString(),
  };
}

async function findTemplateSeriesContext(client, input) {
  const row = await fetchOne(
    client,
    `
      select config_key
      from public.series_source_config
      where entity_id = $1
        and series_id <> $2
      order by is_active desc, updated_at desc nulls last, id desc
      limit 1
    `,
    [input.entityId, input.excludeSeriesId || 0]
  );

  if (!row?.config_key) {
    return null;
  }

  return resolveSeriesContext(client, normalizeText(row.config_key), {
    ensureReportProfile: false,
  });
}

async function copyScoringModelRows(client, sourceModelId, targetModelId, config) {
  await client.query(config.sql, [sourceModelId, targetModelId]);
}

async function cloneSeriesScoringModel(client, input) {
  let sourceModel = null;

  if (input.templateSeriesId) {
    sourceModel = await loadActiveScoringModel(client, input.templateSeriesId);
  }

  if (!sourceModel) {
    sourceModel = await fetchOne(
      client,
      `
        select sm.*
        from public.series_scoring_model ssm
        join public.scoring_model sm on sm.id = ssm.scoring_model_id
        where ssm.is_active = true
        order by ssm.assigned_at desc, ssm.id desc
        limit 1
      `
    );
  }

  const modelKey = await buildUniqueScoringModelKey(client, `${input.targetConfigKey}-v1`);
  const modelName = `${input.targetSeriesName} Default Model`;
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
      nullableText(sourceModel?.description) || `Default scoring model for ${input.targetSeriesName}.`,
      normalizeText(sourceModel?.version_label) || "v1",
      toInteger(sourceModel?.id),
    ]
  );

  await client.query(
    `
      update public.series_scoring_model
      set is_active = false
      where series_id = $1
    `,
    [input.targetSeriesId]
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
    [input.targetSeriesId, toInteger(model.id), input.actorUserId || "phase10-series-create"]
  );

  if (!sourceModel) {
    return model;
  }

  const copyConfigs = [
    {
      sql: `
        insert into public.scoring_model_points_formula (
          scoring_model_id,
          base_score,
          wins_weight,
          nrr_weight,
          rank_weight,
          min_weight,
          max_weight
        )
        select
          $2,
          base_score,
          wins_weight,
          nrr_weight,
          rank_weight,
          min_weight,
          max_weight
        from public.scoring_model_points_formula
        where scoring_model_id = $1
      `,
    },
    {
      sql: `
        insert into public.scoring_model_team_strength_rule (
          scoring_model_id,
          division_key,
          division_label,
          division_premium,
          display_order
        )
        select
          $2,
          division_key,
          division_label,
          division_premium,
          display_order
        from public.scoring_model_team_strength_rule
        where scoring_model_id = $1
      `,
    },
    {
      sql: `
        insert into public.scoring_model_player_tier_rule (
          scoring_model_id,
          discipline,
          tier_name,
          percentile_min,
          percentile_max,
          weight_multiplier,
          display_order
        )
        select
          $2,
          discipline,
          tier_name,
          percentile_min,
          percentile_max,
          weight_multiplier,
          display_order
        from public.scoring_model_player_tier_rule
        where scoring_model_id = $1
      `,
    },
    {
      sql: `
        insert into public.scoring_model_phase_weight (
          scoring_model_id,
          role_type,
          phase_name,
          weight_multiplier
        )
        select
          $2,
          role_type,
          phase_name,
          weight_multiplier
        from public.scoring_model_phase_weight
        where scoring_model_id = $1
      `,
    },
    {
      sql: `
        insert into public.scoring_model_leverage_weight (
          scoring_model_id,
          scenario_key,
          scenario_label,
          weight_multiplier,
          enabled,
          description
        )
        select
          $2,
          scenario_key,
          scenario_label,
          weight_multiplier,
          enabled,
          description
        from public.scoring_model_leverage_weight
        where scoring_model_id = $1
      `,
    },
    {
      sql: `
        insert into public.scoring_model_composite_weight (
          scoring_model_id,
          primary_role,
          component_key,
          component_label,
          weight_value,
          display_order
        )
        select
          $2,
          primary_role,
          component_key,
          component_label,
          weight_value,
          display_order
        from public.scoring_model_composite_weight
        where scoring_model_id = $1
      `,
    },
    {
      sql: `
        insert into public.scoring_model_quality_gate (
          scoring_model_id,
          gate_key,
          gate_label,
          numeric_value,
          text_value,
          bool_value
        )
        select
          $2,
          gate_key,
          gate_label,
          numeric_value,
          text_value,
          bool_value
        from public.scoring_model_quality_gate
        where scoring_model_id = $1
      `,
    },
  ];

  for (const config of copyConfigs) {
    await copyScoringModelRows(client, toInteger(sourceModel.id), toInteger(model.id), config);
  }

  return model;
}

function normalizeMatchUrl(rawUrl, expectedLeagueName) {
  const input = normalizeText(rawUrl);
  if (!input) {
    const error = new Error("matchUrl is required.");
    error.statusCode = 400;
    throw error;
  }

  const candidate = /^https?:\/\//i.test(input)
    ? input
    : input.startsWith("/")
      ? `https://cricclubs.com${input}`
      : `https://cricclubs.com/${input}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (error) {
    error.statusCode = 400;
    error.message = `Unable to parse matchUrl: ${input}`;
    throw error;
  }

  if (!parsed.hostname.includes("cricclubs.com")) {
    const error = new Error("Only CricClubs match URLs are supported.");
    error.statusCode = 400;
    throw error;
  }

  let leagueName = "";
  let sourceMatchId = "";

  const resultsMatch = parsed.pathname.match(/^\/([^/]+)\/results\/(\d+)(?:\/.*)?$/i);
  if (resultsMatch) {
    leagueName = normalizeText(resultsMatch[1]);
    sourceMatchId = normalizeText(resultsMatch[2]);
  } else {
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    leagueName = normalizeText(pathParts[0]);
    sourceMatchId = normalizeText(parsed.searchParams.get("matchId"));
  }

  if (!leagueName || !/^\d+$/.test(sourceMatchId)) {
    const error = new Error(
      "matchUrl must be a CricClubs match URL such as /results/{matchId}, viewScorecard.do?matchId=..., or ballbyball.do?matchId=...."
    );
    error.statusCode = 400;
    throw error;
  }

  if (expectedLeagueName && normalizeLabel(leagueName) !== normalizeLabel(expectedLeagueName)) {
    const error = new Error(
      `matchUrl league namespace ${leagueName} does not match expected ${expectedLeagueName}.`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    normalizedUrl: `${parsed.protocol}//${parsed.host}/${leagueName}/results/${sourceMatchId}`,
    sourceMatchId,
  };
}

function strengthRankFromTier(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "strongest") return 1;
  if (normalized === "strong") return 2;
  if (normalized === "developing") return 3;
  return null;
}

function booleanOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return toBoolean(value);
}

function nullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

module.exports = {
  createSeries,
  createManualRefreshRequest,
  getMatchOpsPayload,
  getSetupPayload,
  getTuningPayload,
  updateMatchSelectionOverride,
  updateSetup,
  updateTuning,
};

"use strict";

const { fetchOne, withClient, withTransaction } = require("./seriesService");
const { assertSubscriptionActionAllowed } = require("./subscriptionService");
const { normalizeText, toInteger } = require("../lib/utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIEWER_ACCESS_ROLES = new Set(["viewer", "analyst"]);

function normalizeUuid(value) {
  const normalized = normalizeText(value).toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function normalizeViewerAccessRole(value) {
  const normalized = normalizeText(value).toLowerCase();
  return VIEWER_ACCESS_ROLES.has(normalized) ? normalized : "";
}

function parseOptionalIsoTimestamp(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("expiresAt must be a valid ISO date-time string.");
    error.statusCode = 400;
    throw error;
  }

  return parsed.toISOString();
}

async function getPlatformAdminStatus(client, userId) {
  const readiness = await fetchOne(
    client,
    `
      select
        exists (
          select 1
          from information_schema.routines
          where routine_schema = 'public'
            and routine_name = 'is_platform_admin'
        ) as has_platform_admin_function,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'platform_admin_user'
        ) as has_platform_admin_user_table
    `
  );

  if (readiness?.has_platform_admin_function === true) {
    const row = await fetchOne(
      client,
      `
        select public.is_platform_admin($1) as is_platform_admin
      `,
      [userId]
    );

    return row?.is_platform_admin === true;
  }

  if (readiness?.has_platform_admin_user_table === true) {
    const row = await fetchOne(
      client,
      `
        select exists (
          select 1
          from public.platform_admin_user pau
          where pau.user_id = $1
        ) as is_platform_admin
      `,
      [userId]
    );

    return row?.is_platform_admin === true;
  }

  return false;
}

async function getEntityAccessReadiness(client) {
  const row = await fetchOne(
    client,
    `
      select
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'entity'
        ) as has_entity_table,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'entity_membership'
        ) as has_entity_membership_table,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'series_source_config'
            and column_name = 'entity_id'
        ) as has_series_source_config_entity_id
    `
  );

  return {
    hasEntityTable: row?.has_entity_table === true,
    hasEntityMembershipTable: row?.has_entity_membership_table === true,
    hasSeriesSourceConfigEntityId: row?.has_series_source_config_entity_id === true,
    isReady:
      row?.has_entity_table === true
      && row?.has_entity_membership_table === true
      && row?.has_series_source_config_entity_id === true,
  };
}

function mapSeriesRow(row) {
  const configKey = normalizeText(row.config_key);

  return {
    seriesSourceConfigId: toInteger(row.series_source_config_id),
    entityId: normalizeText(row.entity_id),
    entitySlug: normalizeText(row.entity_slug),
    entityName: normalizeText(row.entity_name),
    configKey,
    seriesName: normalizeText(row.series_name),
    targetAgeGroup: normalizeText(row.target_age_group),
    seasonYear: toInteger(row.season_year),
    sourceSystem: normalizeText(row.source_system),
    seriesUrl: normalizeText(row.series_url),
    isActive: row.is_active === true,
    accessRole: normalizeText(row.access_role),
    canManage: row.can_manage === true,
    matchCount: toInteger(row.match_count) || 0,
    computedMatches: toInteger(row.computed_matches) || 0,
    warningMatches: toInteger(row.warning_matches) || 0,
    playerCount: toInteger(row.player_count) || 0,
    setupApiPath: configKey ? `/api/series/${encodeURIComponent(configKey)}/admin/setup` : null,
    tuningApiPath: configKey ? `/api/series/${encodeURIComponent(configKey)}/admin/tuning` : null,
    matchesApiPath: configKey ? `/api/series/${encodeURIComponent(configKey)}/admin/matches` : null,
    viewersApiPath: configKey ? `/api/series/${encodeURIComponent(configKey)}/admin/viewers` : null,
  };
}

function mapViewerGrantRow(row) {
  return {
    grantId: normalizeText(row.id),
    entityId: normalizeText(row.entity_id),
    seriesSourceConfigId: toInteger(row.series_source_config_id),
    userId: normalizeText(row.user_id),
    accessRole: normalizeText(row.access_role),
    status: normalizeText(row.status),
    grantedByUserId: normalizeText(row.granted_by_user_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    expiresAt: row.expires_at || null,
    isExpired: row.is_expired === true,
  };
}

async function listManagedEntities(client, input) {
  const result = input.isPlatformAdmin
    ? await client.query(
        `
          select
            e.id as entity_id,
            e.slug as entity_slug,
            e.display_name as entity_name,
            'platform_admin'::text as access_role,
            count(distinct c.id)::int as series_count
          from public.entity e
          left join public.series_source_config c on c.entity_id = e.id
          group by e.id
          order by e.display_name, e.id
        `
      )
    : await client.query(
        `
          select
            e.id as entity_id,
            e.slug as entity_slug,
            e.display_name as entity_name,
            em.role as access_role,
            count(distinct c.id)::int as series_count
          from public.entity e
          join public.entity_membership em
            on em.entity_id = e.id
           and em.user_id = $1
           and em.status = 'active'
           and em.role in ('owner', 'admin')
          left join public.series_source_config c on c.entity_id = e.id
          group by e.id, em.role
          order by e.display_name, e.id
        `,
        [input.userId]
      );

  return result.rows.map((row) => ({
    entityId: normalizeText(row.entity_id),
    entitySlug: normalizeText(row.entity_slug),
    entityName: normalizeText(row.entity_name),
    accessRole: normalizeText(row.access_role),
    seriesCount: toInteger(row.series_count) || 0,
  }));
}

async function listManagedSeries(client, input) {
  const result = await client.query(
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.entity_id,
        c.target_age_group,
        c.series_url,
        c.source_system,
        c.is_active,
        coalesce(s.name, c.name) as series_name,
        coalesce(s.year, c.season_year)::int as season_year,
        e.slug as entity_slug,
        e.display_name as entity_name,
        true as can_manage,
        case
          when $2::boolean = true then 'platform_admin'
          else em.role
        end as access_role,
        count(distinct m.id)::int as match_count,
        count(distinct case when mrs.analytics_status = 'computed' then m.id end)::int as computed_matches,
        count(distinct case when mrs.reconciliation_status = 'warn' then m.id end)::int as warning_matches,
        count(distinct pcs.player_id)::int as player_count
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      join public.entity e on e.id = c.entity_id
      left join public.entity_membership em
        on em.entity_id = c.entity_id
       and em.user_id = $1
       and em.status = 'active'
       and em.role in ('owner', 'admin')
      left join public.match m on m.series_id = s.id
      left join public.match_refresh_state mrs on mrs.match_id = m.id
      left join public.player_composite_score pcs on pcs.series_id = s.id
      where $2::boolean = true or em.id is not null
      group by c.id, s.id, e.id, em.role
      order by c.is_active desc, e.display_name, coalesce(s.name, c.name), c.id
    `,
    [input.userId, input.isPlatformAdmin === true]
  );

  return result.rows.map(mapSeriesRow);
}

async function listViewableSeries(client, input) {
  const result = await client.query(
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.entity_id,
        c.target_age_group,
        c.series_url,
        c.source_system,
        c.is_active,
        coalesce(s.name, c.name) as series_name,
        coalesce(s.year, c.season_year)::int as season_year,
        e.slug as entity_slug,
        e.display_name as entity_name,
        ($2::boolean = true or em.id is not null) as can_manage,
        case
          when $2::boolean = true then 'platform_admin'
          when em.id is not null then em.role
          else sag.access_role
        end as access_role,
        count(distinct m.id)::int as match_count,
        count(distinct case when mrs.analytics_status = 'computed' then m.id end)::int as computed_matches,
        count(distinct case when mrs.reconciliation_status = 'warn' then m.id end)::int as warning_matches,
        count(distinct pcs.player_id)::int as player_count
      from public.series_source_config c
      join public.series s on s.id = c.series_id
      join public.entity e on e.id = c.entity_id
      left join public.entity_membership em
        on em.entity_id = c.entity_id
       and em.user_id = $1
       and em.status = 'active'
       and em.role in ('owner', 'admin')
      left join public.series_access_grant sag
        on sag.series_source_config_id = c.id
       and sag.user_id = $1
       and sag.status = 'active'
       and (sag.expires_at is null or sag.expires_at > now())
      left join public.match m on m.series_id = s.id
      left join public.match_refresh_state mrs on mrs.match_id = m.id
      left join public.player_composite_score pcs on pcs.series_id = s.id
      where $2::boolean = true or em.id is not null or sag.id is not null
      group by c.id, s.id, e.id, em.id, em.role, sag.id, sag.access_role
      order by c.is_active desc, e.display_name, coalesce(s.name, c.name), c.id
    `,
    [input.userId, input.isPlatformAdmin === true]
  );

  return result.rows.map(mapSeriesRow);
}

async function loadSeriesAccessSnapshot(client, input) {
  const readiness = await getEntityAccessReadiness(client);

  const seriesRow = await fetchOne(
    client,
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.entity_id,
        coalesce(s.name, c.name) as series_name
      from public.series_source_config c
      left join public.series s on s.id = c.series_id
      where c.config_key = $1
      limit 1
    `,
    [input.seriesConfigKey]
  );

  if (!seriesRow) {
    const error = new Error(`Series not found for config key: ${input.seriesConfigKey}`);
    error.statusCode = 404;
    throw error;
  }

  if (!readiness.isReady) {
    return {
      authFoundationReady: false,
      readiness,
      seriesConfigKey: normalizeText(seriesRow.config_key),
      seriesName: normalizeText(seriesRow.series_name),
      seriesSourceConfigId: toInteger(seriesRow.series_source_config_id),
      entityId: null,
      isPlatformAdmin: false,
      isEntityAdmin: false,
      canManage: false,
      canView: false,
      accessRole: null,
    };
  }

  const isPlatformAdmin = await getPlatformAdminStatus(client, input.userId);
  const accessRow = await fetchOne(
    client,
    `
      select
        em.role as entity_role,
        sag.id as grant_id,
        sag.access_role as viewer_access_role,
        sag.expires_at,
        (sag.expires_at is not null and sag.expires_at <= now()) as is_expired
      from public.series_source_config c
      left join public.entity_membership em
        on em.entity_id = c.entity_id
       and em.user_id = $1
       and em.status = 'active'
       and em.role in ('owner', 'admin')
      left join public.series_access_grant sag
        on sag.series_source_config_id = c.id
       and sag.user_id = $1
       and sag.status = 'active'
       and (sag.expires_at is null or sag.expires_at > now())
      where c.id = $2
      limit 1
    `,
    [input.userId, seriesRow.series_source_config_id]
  );

  const entityRole = normalizeText(accessRow?.entity_role);
  const viewerAccessRole = normalizeText(accessRow?.viewer_access_role);
  const isEntityAdmin = entityRole === "owner" || entityRole === "admin";
  const canManage = isPlatformAdmin || isEntityAdmin;
  const canView = canManage || Boolean(viewerAccessRole);

  return {
    authFoundationReady: true,
    readiness,
    seriesConfigKey: normalizeText(seriesRow.config_key),
    seriesName: normalizeText(seriesRow.series_name),
    seriesSourceConfigId: toInteger(seriesRow.series_source_config_id),
    entityId: normalizeText(seriesRow.entity_id),
    isPlatformAdmin,
    isEntityAdmin,
    canManage,
    canView,
    accessRole: isPlatformAdmin ? "platform_admin" : (entityRole || viewerAccessRole || null),
  };
}

async function getSeriesAdminAccess(input) {
  return withClient(async (client) => {
    return loadSeriesAccessSnapshot(client, {
      userId: input.userId,
      seriesConfigKey: input.seriesConfigKey,
    });
  });
}

async function getAdminSeriesCatalog(input) {
  return withClient(async (client) => {
    const readiness = await getEntityAccessReadiness(client);
    const isPlatformAdmin = await getPlatformAdminStatus(client, input.userId);
    const actor = {
      userId: normalizeText(input.userId),
      email: normalizeText(input.email),
      isPlatformAdmin,
      accessLabel: isPlatformAdmin ? "platform_admin" : "entity_admin",
    };

    if (!readiness.isReady) {
      return {
        authFoundationReady: false,
        readiness,
        actor,
        entityCount: 0,
        seriesCount: 0,
        entities: [],
        series: [],
      };
    }

    const [entities, series] = await Promise.all([
      listManagedEntities(client, {
        userId: input.userId,
        isPlatformAdmin,
      }),
      listManagedSeries(client, {
        userId: input.userId,
        isPlatformAdmin,
      }),
    ]);

    return {
      authFoundationReady: true,
      readiness,
      actor,
      entityCount: entities.length,
      seriesCount: series.length,
      defaultSeriesConfigKey:
        series.find((item) => item.isActive)?.configKey
        || series[0]?.configKey
        || null,
      entities,
      series,
    };
  });
}

async function getViewerSeriesCatalog(input) {
  return withClient(async (client) => {
    const readiness = await getEntityAccessReadiness(client);
    const isPlatformAdmin = await getPlatformAdminStatus(client, input.userId);
    const actor = {
      userId: normalizeText(input.userId),
      email: normalizeText(input.email),
      isPlatformAdmin,
      accessLabel: isPlatformAdmin ? "platform_admin" : "viewer",
    };

    if (!readiness.isReady) {
      return {
        authFoundationReady: false,
        readiness,
        actor,
        seriesCount: 0,
        defaultSeriesConfigKey: null,
        series: [],
      };
    }

    const series = await listViewableSeries(client, {
      userId: input.userId,
      isPlatformAdmin,
    });

    return {
      authFoundationReady: true,
      readiness,
      actor,
      seriesCount: series.length,
      defaultSeriesConfigKey:
        series.find((item) => item.isActive)?.configKey
        || series[0]?.configKey
        || null,
      series,
    };
  });
}

async function listSeriesViewerGrants(input) {
  return withClient(async (client) => {
    const access = await loadSeriesAccessSnapshot(client, {
      userId: input.userId,
      seriesConfigKey: input.seriesConfigKey,
    });

    if (!access.authFoundationReady) {
      const error = new Error(
        "Phase 10 entity auth foundation is not available in the database yet. Apply the tenant-foundation migration first."
      );
      error.statusCode = 503;
      throw error;
    }

    if (!access.entityId) {
      const error = new Error(
        `Series ${access.seriesConfigKey} is not attached to an owning entity yet.`
      );
      error.statusCode = 503;
      throw error;
    }

    if (!access.canManage) {
      const error = new Error("You do not have admin access to manage viewer grants for this series.");
      error.statusCode = 403;
      throw error;
    }

    const [subscription, result] = await Promise.all([
      fetchOne(
        client,
        `
          select
            plan_key,
            status,
            max_viewer_users
          from public.entity_subscription
          where entity_id = $1
          limit 1
        `,
        [access.entityId]
      ),
      client.query(
        `
          select
            sag.id,
            sag.entity_id,
            sag.series_source_config_id,
            sag.user_id,
            sag.access_role,
            sag.status,
            sag.granted_by_user_id,
            sag.created_at,
            sag.updated_at,
            sag.expires_at,
            (sag.expires_at is not null and sag.expires_at <= now()) as is_expired
          from public.series_access_grant sag
          where sag.series_source_config_id = $1
          order by
            case when sag.status = 'active' then 0 else 1 end,
            sag.created_at desc,
            sag.user_id
        `,
        [access.seriesSourceConfigId]
      ),
    ]);

    const grants = result.rows.map(mapViewerGrantRow);
    const activeGrants = grants.filter((grant) => grant.status === "active" && grant.isExpired !== true);

    return {
      actor: {
        userId: normalizeText(input.userId),
        isPlatformAdmin: access.isPlatformAdmin,
        isEntityAdmin: access.isEntityAdmin,
      },
      series: {
        configKey: access.seriesConfigKey,
        seriesName: access.seriesName,
        entityId: access.entityId,
        seriesSourceConfigId: access.seriesSourceConfigId,
      },
      subscription: {
        planKey: normalizeText(subscription?.plan_key),
        status: normalizeText(subscription?.status),
        maxViewerUsers: toInteger(subscription?.max_viewer_users),
      },
      totals: {
        totalGrants: grants.length,
        activeGrants: activeGrants.length,
        activeViewers: activeGrants.filter((grant) => grant.accessRole === "viewer").length,
        activeAnalysts: activeGrants.filter((grant) => grant.accessRole === "analyst").length,
        revokedGrants: grants.filter((grant) => grant.status === "revoked").length,
      },
      grants,
    };
  });
}

async function upsertSeriesViewerGrant(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const targetUserId = normalizeUuid(input.body?.userId);
  const accessRole = normalizeViewerAccessRole(input.body?.accessRole) || "viewer";
  const expiresAt = parseOptionalIsoTimestamp(input.body?.expiresAt);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to grant viewer access.");
    error.statusCode = 400;
    throw error;
  }

  if (!targetUserId) {
    const error = new Error("userId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(
    async (client) => {
      const access = await loadSeriesAccessSnapshot(client, {
        userId: actorUserId,
        seriesConfigKey: input.seriesConfigKey,
      });

      if (!access.authFoundationReady) {
        const error = new Error(
          "Phase 10 entity auth foundation is not available in the database yet. Apply the tenant-foundation migration first."
        );
        error.statusCode = 503;
        throw error;
      }

      if (!access.entityId) {
        const error = new Error(
          `Series ${access.seriesConfigKey} is not attached to an owning entity yet.`
        );
        error.statusCode = 503;
        throw error;
      }

      if (!access.canManage) {
        const error = new Error("You do not have admin access to manage viewer grants for this series.");
        error.statusCode = 403;
        throw error;
      }

      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey: input.seriesConfigKey,
        action: "viewer_grant",
        targetUserId,
      });

      const row = await fetchOne(
        client,
        `
          insert into public.series_access_grant (
            entity_id,
            series_source_config_id,
            user_id,
            access_role,
            status,
            granted_by_user_id,
            expires_at
          )
          values ($1, $2, $3, $4, 'active', $5, $6)
          on conflict (entity_id, series_source_config_id, user_id)
          do update set
            access_role = excluded.access_role,
            status = 'active',
            granted_by_user_id = excluded.granted_by_user_id,
            expires_at = excluded.expires_at,
            updated_at = now()
          returning
            id,
            entity_id,
            series_source_config_id,
            user_id,
            access_role,
            status,
            granted_by_user_id,
            created_at,
            updated_at,
            expires_at,
            (expires_at is not null and expires_at <= now()) as is_expired
        `,
        [
          access.entityId,
          access.seriesSourceConfigId,
          targetUserId,
          accessRole,
          actorUserId,
          expiresAt,
        ]
      );

      return {
        message: input.dryRun ? "Dry-run viewer access grant validated." : "Viewer access granted.",
        grant: mapViewerGrantRow(row),
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function revokeSeriesViewerGrant(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const grantId = normalizeUuid(input.grantId);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to revoke viewer access.");
    error.statusCode = 400;
    throw error;
  }

  if (!grantId) {
    const error = new Error("grantId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(
    async (client) => {
      const access = await loadSeriesAccessSnapshot(client, {
        userId: actorUserId,
        seriesConfigKey: input.seriesConfigKey,
      });

      if (!access.authFoundationReady) {
        const error = new Error(
          "Phase 10 entity auth foundation is not available in the database yet. Apply the tenant-foundation migration first."
        );
        error.statusCode = 503;
        throw error;
      }

      if (!access.entityId) {
        const error = new Error(
          `Series ${access.seriesConfigKey} is not attached to an owning entity yet.`
        );
        error.statusCode = 503;
        throw error;
      }

      if (!access.canManage) {
        const error = new Error("You do not have admin access to manage viewer grants for this series.");
        error.statusCode = 403;
        throw error;
      }

      const row = await fetchOne(
        client,
        `
          update public.series_access_grant
          set
            status = 'revoked',
            updated_at = now()
          where id = $1
            and series_source_config_id = $2
          returning
            id,
            entity_id,
            series_source_config_id,
            user_id,
            access_role,
            status,
            granted_by_user_id,
            created_at,
            updated_at,
            expires_at,
            (expires_at is not null and expires_at <= now()) as is_expired
        `,
        [grantId, access.seriesSourceConfigId]
      );

      if (!row) {
        const error = new Error("Viewer access grant not found for this series.");
        error.statusCode = 404;
        throw error;
      }

      return {
        message: input.dryRun ? "Dry-run viewer access revoke validated." : "Viewer access revoked.",
        grant: mapViewerGrantRow(row),
      };
    },
    { dryRun: input.dryRun === true }
  );
}

module.exports = {
  getAdminSeriesCatalog,
  getEntityAccessReadiness,
  getSeriesAdminAccess,
  getViewerSeriesCatalog,
  listSeriesViewerGrants,
  revokeSeriesViewerGrant,
  upsertSeriesViewerGrant,
};

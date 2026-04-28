"use strict";

const { fetchOne, withClient, withTransaction } = require("./seriesService");
const { assertSubscriptionActionAllowed } = require("./subscriptionService");
const { normalizeText, toInteger } = require("../lib/utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ACCESS_ROLES = new Set(["admin"]);
const VIEWER_ACCESS_ROLES = new Set(["viewer", "analyst"]);
const ACCESS_REQUEST_TYPES = new Set(["self_request", "admin_invite"]);
const ACCESS_REQUEST_STATUSES = new Set(["pending", "approved", "declined", "canceled"]);

function normalizeUuid(value) {
  const normalized = normalizeText(value).toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : "";
}

function normalizeViewerAccessRole(value) {
  const normalized = normalizeText(value).toLowerCase();
  return VIEWER_ACCESS_ROLES.has(normalized) ? normalized : "";
}

function normalizeAdminAccessRole(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ADMIN_ACCESS_ROLES.has(normalized) ? normalized : "";
}

function normalizeEmail(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized.includes("@") ? normalized : "";
}

function normalizeAccessRequestType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ACCESS_REQUEST_TYPES.has(normalized) ? normalized : "";
}

function normalizeAccessRequestStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ACCESS_REQUEST_STATUSES.has(normalized) ? normalized : "";
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

async function hasEntityAdminAccessRequestTable(client) {
  const row = await fetchOne(
    client,
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'entity_admin_access_request'
      ) as has_table
    `
  );

  return row?.has_table === true;
}

async function assertEntityAdminAccessRequestReady(client) {
  if (await hasEntityAdminAccessRequestTable(client)) {
    return;
  }

  const error = new Error(
    "Phase 10 series-admin access request storage is not available in the database yet. Apply the entity-admin access request migration first."
  );
  error.statusCode = 503;
  throw error;
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

function mapAccessRequestRow(row) {
  return {
    requestId: normalizeText(row.id),
    entityId: normalizeText(row.entity_id),
    seriesSourceConfigId: toInteger(row.series_source_config_id),
    requestedEmail: normalizeText(row.requested_email),
    requestedUserId: normalizeText(row.requested_user_id),
    requestedAccessRole: normalizeText(row.requested_access_role),
    requestType: normalizeText(row.request_type),
    requestStatus: normalizeText(row.request_status),
    requestNote: normalizeText(row.request_note),
    adminResponseNote: normalizeText(row.admin_response_note),
    requestedByUserId: normalizeText(row.requested_by_user_id),
    reviewedByUserId: normalizeText(row.reviewed_by_user_id),
    requestedExpiresAt: row.requested_expires_at || null,
    resolvedGrantId: normalizeText(row.resolved_grant_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    resolvedAt: row.resolved_at || null,
  };
}

function mapEntityAdminRequestRow(row) {
  return {
    requestId: normalizeText(row.id),
    entityId: normalizeText(row.entity_id),
    requestedEmail: normalizeText(row.requested_email),
    requestedUserId: normalizeText(row.requested_user_id),
    requestedRole: normalizeText(row.requested_role),
    requestType: normalizeText(row.request_type),
    requestStatus: normalizeText(row.request_status),
    requestNote: normalizeText(row.request_note),
    adminResponseNote: normalizeText(row.admin_response_note),
    requestedByUserId: normalizeText(row.requested_by_user_id),
    reviewedByUserId: normalizeText(row.reviewed_by_user_id),
    resolvedMembershipId: normalizeText(row.resolved_membership_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    resolvedAt: row.resolved_at || null,
  };
}

function mapEntityAdminMembershipRow(row) {
  const role = normalizeText(row.role);
  const status = normalizeText(row.status);
  const isOwner = row.is_owner === true || role === "owner";

  return {
    membershipId: normalizeText(row.membership_id || row.id),
    entityId: normalizeText(row.entity_id),
    userId: normalizeText(row.user_id),
    role,
    status,
    invitedByUserId: normalizeText(row.invited_by_user_id),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    isOwner,
    canRemove: isOwner !== true && status === "active",
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
            e.owner_user_id,
            'platform_admin'::text as access_role,
            count(distinct c.id)::int as series_count,
            count(
              distinct case
                when em_all.status = 'active' and em_all.role in ('owner', 'admin') then em_all.user_id
                else null
              end
            )::int as active_admin_user_count,
            es.plan_key as subscription_plan_key,
            es.status as subscription_status,
            es.max_admin_users
          from public.entity e
          left join public.series_source_config c on c.entity_id = e.id
          left join public.entity_membership em_all on em_all.entity_id = e.id
          left join public.entity_subscription es on es.entity_id = e.id
          group by e.id, es.plan_key, es.status, es.max_admin_users
          order by e.display_name, e.id
        `
      )
    : await client.query(
        `
          select
            e.id as entity_id,
            e.slug as entity_slug,
            e.display_name as entity_name,
            e.owner_user_id,
            em.role as access_role,
            count(distinct c.id)::int as series_count,
            count(
              distinct case
                when em_all.status = 'active' and em_all.role in ('owner', 'admin') then em_all.user_id
                else null
              end
            )::int as active_admin_user_count,
            es.plan_key as subscription_plan_key,
            es.status as subscription_status,
            es.max_admin_users
          from public.entity e
          join public.entity_membership em
            on em.entity_id = e.id
           and em.user_id = $1
           and em.status = 'active'
           and em.role in ('owner', 'admin')
          left join public.series_source_config c on c.entity_id = e.id
          left join public.entity_membership em_all on em_all.entity_id = e.id
          left join public.entity_subscription es on es.entity_id = e.id
          group by e.id, em.role, es.plan_key, es.status, es.max_admin_users
          order by e.display_name, e.id
        `,
        [input.userId]
      );

  return result.rows.map((row) => {
    const maxAdminUsers = toInteger(row.max_admin_users);
    const activeAdminUsers = toInteger(row.active_admin_user_count) || 0;

    return {
      entityId: normalizeText(row.entity_id),
      entitySlug: normalizeText(row.entity_slug),
      entityName: normalizeText(row.entity_name),
      ownerUserId: normalizeText(row.owner_user_id),
      accessRole: normalizeText(row.access_role),
      seriesCount: toInteger(row.series_count) || 0,
      subscriptionPlanKey: normalizeText(row.subscription_plan_key),
      subscriptionStatus: normalizeText(row.subscription_status),
      maxAdminUsers,
      activeAdminUsers,
      remainingAdminUsers:
        maxAdminUsers === null || maxAdminUsers === undefined
          ? null
          : Math.max(maxAdminUsers - activeAdminUsers, 0),
      admins: [],
      adminRequests: [],
    };
  });
}

async function listManagedEntityAdminMemberships(client, input) {
  const result = input.isPlatformAdmin
    ? await client.query(
        `
          select
            em.id as membership_id,
            em.entity_id,
            em.user_id,
            em.role,
            em.status,
            em.invited_by_user_id,
            em.created_at,
            em.updated_at,
            (e.owner_user_id = em.user_id) as is_owner
          from public.entity_membership em
          join public.entity e on e.id = em.entity_id
          where em.status = 'active'
            and em.role in ('owner', 'admin')
          order by e.display_name, case when em.role = 'owner' then 0 else 1 end, em.created_at, em.user_id
        `
      )
    : await client.query(
        `
          select
            em.id as membership_id,
            em.entity_id,
            em.user_id,
            em.role,
            em.status,
            em.invited_by_user_id,
            em.created_at,
            em.updated_at,
            (e.owner_user_id = em.user_id) as is_owner
          from public.entity_membership em
          join public.entity e on e.id = em.entity_id
          where em.status = 'active'
            and em.role in ('owner', 'admin')
            and exists (
              select 1
              from public.entity_membership em_access
              where em_access.entity_id = em.entity_id
                and em_access.user_id = $1
                and em_access.status = 'active'
                and em_access.role in ('owner', 'admin')
            )
          order by e.display_name, case when em.role = 'owner' then 0 else 1 end, em.created_at, em.user_id
        `,
        [input.userId]
      );

  return result.rows.map(mapEntityAdminMembershipRow);
}

async function listManagedEntityAdminRequests(client, input) {
  if (!(await hasEntityAdminAccessRequestTable(client))) {
    return [];
  }

  const result = input.isPlatformAdmin
    ? await client.query(
        `
          select
            ear.id,
            ear.entity_id,
            ear.requested_email,
            ear.requested_user_id,
            ear.requested_role,
            ear.request_type,
            ear.request_status,
            ear.request_note,
            ear.admin_response_note,
            ear.requested_by_user_id,
            ear.reviewed_by_user_id,
            ear.resolved_membership_id,
            ear.created_at,
            ear.updated_at,
            ear.resolved_at
          from public.entity_admin_access_request ear
          join public.entity e on e.id = ear.entity_id
          order by
            e.display_name,
            case when ear.request_status = 'pending' then 0 else 1 end,
            ear.created_at desc,
            ear.requested_email
        `
      )
    : await client.query(
        `
          select
            ear.id,
            ear.entity_id,
            ear.requested_email,
            ear.requested_user_id,
            ear.requested_role,
            ear.request_type,
            ear.request_status,
            ear.request_note,
            ear.admin_response_note,
            ear.requested_by_user_id,
            ear.reviewed_by_user_id,
            ear.resolved_membership_id,
            ear.created_at,
            ear.updated_at,
            ear.resolved_at
          from public.entity_admin_access_request ear
          join public.entity e on e.id = ear.entity_id
          where exists (
            select 1
            from public.entity_membership em_access
            where em_access.entity_id = ear.entity_id
              and em_access.user_id = $1
              and em_access.status = 'active'
              and em_access.role in ('owner', 'admin')
          )
          order by
            e.display_name,
            case when ear.request_status = 'pending' then 0 else 1 end,
            ear.created_at desc,
            ear.requested_email
        `,
        [input.userId]
      );

  return result.rows.map(mapEntityAdminRequestRow);
}

async function loadEntityManagementSnapshot(client, input) {
  const readiness = await getEntityAccessReadiness(client);
  const entityId = normalizeUuid(input.entityId);

  if (!entityId) {
    const error = new Error("entityId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  const entity = await fetchOne(
    client,
    `
      select
        e.id as entity_id,
        e.slug as entity_slug,
        e.display_name as entity_name
      from public.entity e
      where e.id = $1
      limit 1
    `,
    [entityId]
  );

  if (!entity) {
    const error = new Error(`Entity not found for id: ${entityId}`);
    error.statusCode = 404;
    throw error;
  }

  if (!readiness.isReady) {
    return {
      authFoundationReady: false,
      readiness,
      entityId: normalizeText(entity.entity_id),
      entitySlug: normalizeText(entity.entity_slug),
      entityName: normalizeText(entity.entity_name),
      isPlatformAdmin: false,
      isEntityAdmin: false,
      canManage: false,
      accessRole: null,
    };
  }

  const isPlatformAdmin = await getPlatformAdminStatus(client, input.userId);
  const membership = await fetchOne(
    client,
    `
      select role
      from public.entity_membership
      where entity_id = $1
        and user_id = $2
        and status = 'active'
        and role in ('owner', 'admin')
      limit 1
    `,
    [entityId, input.userId]
  );

  const entityRole = normalizeText(membership?.role);
  const isEntityAdmin = entityRole === "owner" || entityRole === "admin";

  return {
    authFoundationReady: true,
    readiness,
    entityId: normalizeText(entity.entity_id),
    entitySlug: normalizeText(entity.entity_slug),
    entityName: normalizeText(entity.entity_name),
    isPlatformAdmin,
    isEntityAdmin,
    canManage: isPlatformAdmin || isEntityAdmin,
    accessRole: isPlatformAdmin ? "platform_admin" : (entityRole || null),
  };
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

async function grantSeriesViewerAccess(client, input) {
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
      input.entityId,
      input.seriesSourceConfigId,
      input.targetUserId,
      input.accessRole,
      input.grantedByUserId || null,
      input.expiresAt || null,
    ]
  );

  return mapViewerGrantRow(row);
}

async function loadSeriesAccessRequests(client, seriesSourceConfigId) {
  const result = await client.query(
    `
      select
        sar.id,
        sar.entity_id,
        sar.series_source_config_id,
        sar.requested_email,
        sar.requested_user_id,
        sar.requested_access_role,
        sar.request_type,
        sar.request_status,
        sar.request_note,
        sar.admin_response_note,
        sar.requested_by_user_id,
        sar.reviewed_by_user_id,
        sar.requested_expires_at,
        sar.resolved_grant_id,
        sar.created_at,
        sar.updated_at,
        sar.resolved_at
      from public.series_access_request sar
      where sar.series_source_config_id = $1
      order by
        case when sar.request_status = 'pending' then 0 else 1 end,
        sar.created_at desc,
        sar.requested_email
    `,
    [seriesSourceConfigId]
  );

  return result.rows.map(mapAccessRequestRow);
}

async function upsertPendingSeriesAccessRequestRow(client, input) {
  const requestType = normalizeAccessRequestType(input.requestType) || "self_request";
  const requestedEmail = normalizeEmail(input.requestedEmail);
  const requestedAccessRole = normalizeViewerAccessRole(input.requestedAccessRole) || "viewer";

  if (!requestedEmail) {
    const error = new Error("A valid email address is required for series access requests.");
    error.statusCode = 400;
    throw error;
  }

  let existing = null;

  if (requestType === "admin_invite") {
    existing = await fetchOne(
      client,
      `
        select *
        from public.series_access_request
        where series_source_config_id = $1
          and lower(requested_email) = lower($2)
          and requested_access_role = $3
          and request_type = 'admin_invite'
          and request_status = 'pending'
        order by created_at desc, id desc
        limit 1
      `,
      [input.seriesSourceConfigId, requestedEmail, requestedAccessRole]
    );
  } else if (input.requestedUserId) {
    existing = await fetchOne(
      client,
      `
        select *
        from public.series_access_request
        where series_source_config_id = $1
          and requested_user_id = $2
          and requested_access_role = $3
          and request_type = 'self_request'
          and request_status = 'pending'
        order by created_at desc, id desc
        limit 1
      `,
      [input.seriesSourceConfigId, input.requestedUserId, requestedAccessRole]
    );
  }

  if (existing) {
    const updated = await fetchOne(
      client,
      `
        update public.series_access_request
        set
          requested_email = $2,
          requested_user_id = coalesce($3, requested_user_id),
          request_note = $4,
          requested_by_user_id = $5,
          requested_expires_at = $6,
          admin_response_note = case
            when request_status = 'pending' then null
            else admin_response_note
          end,
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        existing.id,
        requestedEmail,
        input.requestedUserId || null,
        normalizeText(input.requestNote) || null,
        input.requestedByUserId || null,
        input.requestedExpiresAt || null,
      ]
    );

    return mapAccessRequestRow(updated);
  }

  const inserted = await fetchOne(
    client,
    `
      insert into public.series_access_request (
        entity_id,
        series_source_config_id,
        requested_email,
        requested_user_id,
        requested_access_role,
        request_type,
        request_status,
        request_note,
        requested_by_user_id,
        requested_expires_at
      )
      values ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9)
      returning *
    `,
    [
      input.entityId,
      input.seriesSourceConfigId,
      requestedEmail,
      input.requestedUserId || null,
      requestedAccessRole,
      requestType,
      normalizeText(input.requestNote) || null,
      input.requestedByUserId || null,
      input.requestedExpiresAt || null,
    ]
  );

  return mapAccessRequestRow(inserted);
}

async function autoActivatePendingSeriesInvites(client, input) {
  const actorUserId = normalizeUuid(input.userId);
  const actorEmail = normalizeEmail(input.email);

  if (!actorUserId || !actorEmail) {
    return {
      activatedCount: 0,
    };
  }

  const result = await client.query(
    `
      select
        sar.*,
        c.config_key
      from public.series_access_request sar
      join public.series_source_config c on c.id = sar.series_source_config_id
      where lower(sar.requested_email) = lower($1)
        and sar.request_type = 'admin_invite'
        and sar.request_status = 'pending'
        and (sar.requested_user_id is null or sar.requested_user_id = $2)
      order by sar.created_at, sar.id
    `,
    [actorEmail, actorUserId]
  );

  let activatedCount = 0;

  for (const row of result.rows) {
    try {
      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey: normalizeText(row.config_key),
        action: "viewer_grant",
        targetUserId: actorUserId,
      });

      const grant = await grantSeriesViewerAccess(client, {
        entityId: normalizeText(row.entity_id),
        seriesSourceConfigId: toInteger(row.series_source_config_id),
        targetUserId: actorUserId,
        accessRole: normalizeViewerAccessRole(row.requested_access_role) || "viewer",
        grantedByUserId: normalizeUuid(row.requested_by_user_id) || null,
        expiresAt: row.requested_expires_at || null,
      });

      await client.query(
        `
          update public.series_access_request
          set
            requested_user_id = $2,
            request_status = 'approved',
            reviewed_by_user_id = coalesce(reviewed_by_user_id, requested_by_user_id),
            admin_response_note = coalesce(
              nullif(admin_response_note, ''),
              'Access auto-activated on first login from an admin-approved email invite.'
            ),
            resolved_grant_id = $3,
            resolved_at = coalesce(resolved_at, now()),
            updated_at = now()
          where id = $1
        `,
        [row.id, actorUserId, grant.grantId || null]
      );

      activatedCount += 1;
    } catch (error) {
      await client.query(
        `
          update public.series_access_request
          set
            admin_response_note = $2,
            updated_at = now()
          where id = $1
        `,
        [
          row.id,
          normalizeText(error?.message) || "Invite auto-activation failed. Review entity limits and series access rules.",
        ]
      );
    }
  }

  return {
    activatedCount,
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

async function getEntityManagementAccess(input) {
  return withClient(async (client) => {
    return loadEntityManagementSnapshot(client, {
      userId: input.userId,
      entityId: input.entityId,
    });
  });
}

async function loadEntityAdminGrantContext(client, entityIdInput) {
  const entityId = normalizeUuid(entityIdInput);
  if (!entityId) {
    const error = new Error("entityId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  const entity = await fetchOne(
    client,
    `
      select
        e.id as entity_id,
        e.slug as entity_slug,
        e.display_name as entity_name,
        e.owner_user_id,
        es.plan_key as subscription_plan_key,
        es.status as subscription_status,
        es.max_admin_users,
        count(
          distinct case
            when em.status = 'active' and em.role in ('owner', 'admin') then em.user_id
            else null
          end
        )::int as active_admin_user_count
      from public.entity e
      left join public.entity_subscription es on es.entity_id = e.id
      left join public.entity_membership em on em.entity_id = e.id
      where e.id = $1
      group by e.id, es.plan_key, es.status, es.max_admin_users
      limit 1
    `,
    [entityId]
  );

  if (!entity) {
    const error = new Error(`Entity not found for id: ${entityId}`);
    error.statusCode = 404;
    throw error;
  }

  return {
    entityId: normalizeText(entity.entity_id),
    entitySlug: normalizeText(entity.entity_slug),
    entityName: normalizeText(entity.entity_name),
    ownerUserId: normalizeText(entity.owner_user_id),
    subscriptionPlanKey: normalizeText(entity.subscription_plan_key),
    subscriptionStatus: normalizeText(entity.subscription_status),
    maxAdminUsers: toInteger(entity.max_admin_users),
    activeAdminUsers: toInteger(entity.active_admin_user_count) || 0,
  };
}

async function fetchEntityAdminMembershipRow(client, entityId, targetUserId) {
  return fetchOne(
    client,
    `
      select
        em.id as membership_id,
        em.entity_id,
        em.user_id,
        em.role,
        em.status,
        em.invited_by_user_id,
        em.created_at,
        em.updated_at,
        (e.owner_user_id = em.user_id) as is_owner
      from public.entity_membership em
      join public.entity e on e.id = em.entity_id
      where em.entity_id = $1
        and em.user_id = $2
      limit 1
    `,
    [entityId, targetUserId]
  );
}

async function resolvePendingEntityAdminRequestsForMembership(client, input) {
  const targetUserId = normalizeUuid(input.targetUserId);
  if (!targetUserId) {
    return;
  }

  await client.query(
    `
      update public.entity_admin_access_request
      set
        requested_user_id = coalesce(requested_user_id, $2),
        request_status = 'approved',
        reviewed_by_user_id = $3,
        admin_response_note = coalesce(
          nullif(admin_response_note, ''),
          $4
        ),
        resolved_membership_id = $5,
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
      where entity_id = $1
        and requested_user_id = $2
        and request_status = 'pending'
    `,
    [
      input.entityId,
      targetUserId,
      normalizeUuid(input.reviewedByUserId) || null,
      normalizeText(input.adminResponseNote) || "Approved while granting series-admin access directly.",
      normalizeUuid(input.resolvedMembershipId) || null,
    ]
  );
}

async function grantEntityAdminMembership(client, input) {
  const context = await loadEntityAdminGrantContext(client, input.entityId);
  const targetUserId = normalizeUuid(input.targetUserId);

  if (!targetUserId) {
    const error = new Error("userId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await fetchEntityAdminMembershipRow(client, context.entityId, targetUserId);
  const existingRole = normalizeText(existing?.role);
  const existingStatus = normalizeText(existing?.status);
  const isTargetEntityOwner = context.ownerUserId === targetUserId;
  const isExistingOwner = existing?.is_owner === true || existingRole === "owner" || isTargetEntityOwner;

  if (isExistingOwner && existingStatus === "active") {
    return {
      context,
      membership: existing ? mapEntityAdminMembershipRow(existing) : null,
      existingRole,
      existingStatus,
      isExistingOwner: true,
      wasAlreadyActive: true,
    };
  }

  const wouldConsumeSeat = !(existingStatus === "active" && (existingRole === "owner" || existingRole === "admin"));
  if (
    wouldConsumeSeat
    && context.maxAdminUsers !== null
    && context.activeAdminUsers >= context.maxAdminUsers
  ) {
    const error = new Error(
      `Admin allocation is at limit for this entity (${context.activeAdminUsers}/${context.maxAdminUsers}).`
    );
    error.statusCode = 409;
    throw error;
  }

  const roleToPersist = isTargetEntityOwner ? "owner" : "admin";
  const row = await fetchOne(
    client,
    `
      insert into public.entity_membership (
        entity_id,
        user_id,
        role,
        status,
        invited_by_user_id
      )
      values ($1, $2, $3, 'active', $4)
      on conflict (entity_id, user_id)
      do update set
        role = case
          when public.entity_membership.role = 'owner' then public.entity_membership.role
          else excluded.role
        end,
        status = 'active',
        invited_by_user_id = coalesce(public.entity_membership.invited_by_user_id, excluded.invited_by_user_id),
        updated_at = now()
      returning
        id as membership_id,
        entity_id,
        user_id,
        role,
        status,
        invited_by_user_id,
        created_at,
        updated_at,
        ($3 = 'owner') as is_owner
    `,
    [context.entityId, targetUserId, roleToPersist, normalizeUuid(input.invitedByUserId) || null]
  );

  await resolvePendingEntityAdminRequestsForMembership(client, {
    entityId: context.entityId,
    targetUserId,
    reviewedByUserId: input.reviewedByUserId || input.invitedByUserId || null,
    resolvedMembershipId: row?.membership_id || row?.id || null,
    adminResponseNote: input.adminResponseNote,
  });

  return {
    context,
    membership: mapEntityAdminMembershipRow(row),
    existingRole,
    existingStatus,
    isExistingOwner: roleToPersist === "owner",
    wasAlreadyActive: existingStatus === "active" && (existingRole === "owner" || existingRole === "admin"),
  };
}

async function upsertPendingEntityAdminRequestRow(client, input) {
  await assertEntityAdminAccessRequestReady(client);

  const requestType = normalizeAccessRequestType(input.requestType) || "self_request";
  const requestedEmail = normalizeEmail(input.requestedEmail);
  const requestedRole = normalizeAdminAccessRole(input.requestedRole) || "admin";

  if (!requestedEmail) {
    const error = new Error("A valid email address is required for series-admin access requests.");
    error.statusCode = 400;
    throw error;
  }

  let existing = null;

  if (requestType === "admin_invite") {
    existing = await fetchOne(
      client,
      `
        select *
        from public.entity_admin_access_request
        where entity_id = $1
          and lower(requested_email) = lower($2)
          and requested_role = $3
          and request_type = 'admin_invite'
          and request_status = 'pending'
        order by created_at desc, id desc
        limit 1
      `,
      [input.entityId, requestedEmail, requestedRole]
    );
  } else if (input.requestedUserId) {
    existing = await fetchOne(
      client,
      `
        select *
        from public.entity_admin_access_request
        where entity_id = $1
          and requested_user_id = $2
          and requested_role = $3
          and request_type = 'self_request'
          and request_status = 'pending'
        order by created_at desc, id desc
        limit 1
      `,
      [input.entityId, input.requestedUserId, requestedRole]
    );
  }

  if (existing) {
    const updated = await fetchOne(
      client,
      `
        update public.entity_admin_access_request
        set
          requested_email = $2,
          requested_user_id = coalesce($3, requested_user_id),
          request_note = case
            when $4 <> '' then $4
            when request_status = 'pending' then request_note
            else null
          end,
          requested_by_user_id = coalesce($5, requested_by_user_id),
          admin_response_note = case
            when request_status = 'pending' then null
            else admin_response_note
          end,
          reviewed_by_user_id = case
            when request_status = 'pending' then null
            else reviewed_by_user_id
          end,
          resolved_membership_id = case
            when request_status = 'pending' then null
            else resolved_membership_id
          end,
          resolved_at = case
            when request_status = 'pending' then null
            else resolved_at
          end,
          updated_at = now()
        where id = $1
        returning *
      `,
      [
        existing.id,
        requestedEmail,
        normalizeUuid(input.requestedUserId) || null,
        normalizeText(input.requestNote),
        normalizeUuid(input.requestedByUserId) || null,
      ]
    );

    return mapEntityAdminRequestRow(updated);
  }

  const inserted = await fetchOne(
    client,
    `
      insert into public.entity_admin_access_request (
        entity_id,
        requested_email,
        requested_user_id,
        requested_role,
        request_type,
        request_status,
        request_note,
        requested_by_user_id
      )
      values ($1, $2, $3, $4, $5, 'pending', $6, $7)
      returning *
    `,
    [
      input.entityId,
      requestedEmail,
      normalizeUuid(input.requestedUserId) || null,
      requestedRole,
      requestType,
      normalizeText(input.requestNote),
      normalizeUuid(input.requestedByUserId) || null,
    ]
  );

  return mapEntityAdminRequestRow(inserted);
}

async function loadManagedEntityAdminContext(client, input) {
  const readiness = await getEntityAccessReadiness(client);

  if (!readiness.isReady) {
    const error = new Error(
      "Phase 10 entity auth foundation is not available in the database yet. Apply the tenant-foundation migration first."
    );
    error.statusCode = 503;
    throw error;
  }

  const actorUserId = normalizeUuid(input.actorUserId);
  if (!actorUserId) {
    const error = new Error("A valid actor user id is required.");
    error.statusCode = 400;
    throw error;
  }

  const entityId = normalizeUuid(input.entityId);
  if (!entityId) {
    const error = new Error("entityId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  const entity = await fetchOne(
    client,
    `
      select
        e.id as entity_id,
        e.slug as entity_slug,
        e.display_name as entity_name,
        e.owner_user_id,
        es.plan_key as subscription_plan_key,
        es.status as subscription_status,
        es.max_admin_users,
        count(
          distinct case
            when em.status = 'active' and em.role in ('owner', 'admin') then em.user_id
            else null
          end
        )::int as active_admin_user_count
      from public.entity e
      left join public.entity_subscription es on es.entity_id = e.id
      left join public.entity_membership em on em.entity_id = e.id
      where e.id = $1
      group by e.id, es.plan_key, es.status, es.max_admin_users
      limit 1
    `,
    [entityId]
  );

  if (!entity) {
    const error = new Error(`Entity not found for id: ${entityId}`);
    error.statusCode = 404;
    throw error;
  }

  const isPlatformAdmin = await getPlatformAdminStatus(client, actorUserId);
  const membership = await fetchOne(
    client,
    `
      select role
      from public.entity_membership
      where entity_id = $1
        and user_id = $2
        and status = 'active'
        and role in ('owner', 'admin')
      limit 1
    `,
    [entityId, actorUserId]
  );
  const actorRole = normalizeText(membership?.role);
  const isEntityAdmin = actorRole === "owner" || actorRole === "admin";

  if (!isPlatformAdmin && !isEntityAdmin) {
    const error = new Error("Only platform admins or active series admins can manage series admin access.");
    error.statusCode = 403;
    throw error;
  }

  return {
    actorUserId,
    entityId: normalizeText(entity.entity_id),
    entitySlug: normalizeText(entity.entity_slug),
    entityName: normalizeText(entity.entity_name),
    ownerUserId: normalizeText(entity.owner_user_id),
    actorAccessRole: isPlatformAdmin ? "platform_admin" : actorRole,
    subscriptionPlanKey: normalizeText(entity.subscription_plan_key),
    subscriptionStatus: normalizeText(entity.subscription_status),
    maxAdminUsers: toInteger(entity.max_admin_users),
    activeAdminUsers: toInteger(entity.active_admin_user_count) || 0,
  };
}

async function upsertEntityAdminMembership(input) {
  return withTransaction(
    async (client) => {
      const context = await loadManagedEntityAdminContext(client, {
        actorUserId: input.actorUserId,
        entityId: input.entityId,
      });

      const targetUserId = normalizeUuid(input.body?.userId);
      const targetEmail = normalizeEmail(input.body?.email);

      const requestedRole = normalizeText(input.body?.role).toLowerCase() || "admin";
      if (requestedRole !== "admin") {
        const error = new Error("Only the series-admin role is supported in this phase.");
        error.statusCode = 400;
        throw error;
      }

      if (!targetUserId && !targetEmail) {
        const error = new Error("Provide either a valid userId or an email address.");
        error.statusCode = 400;
        throw error;
      }

      if (targetEmail && !targetUserId) {
        const request = await upsertPendingEntityAdminRequestRow(client, {
          entityId: context.entityId,
          requestedEmail: targetEmail,
          requestedUserId: null,
          requestedRole: "admin",
          requestType: "admin_invite",
          requestNote:
            "Pre-approved by a series admin. Access will activate automatically the first time this email signs in to request series-admin access.",
          requestedByUserId: context.actorUserId,
        });

        return {
          message: input.dryRun === true
            ? "Dry-run series-admin email invite validated."
            : "Series-admin email invite saved. Access will activate the first time this email signs in and requests it.",
          entity: {
            entityId: context.entityId,
            entityName: context.entityName,
            entitySlug: context.entitySlug,
            ownerUserId: context.ownerUserId,
          },
          membership: null,
          request,
        };
      }

      const granted = await grantEntityAdminMembership(client, {
        entityId: context.entityId,
        targetUserId,
        invitedByUserId: context.actorUserId,
        reviewedByUserId: context.actorUserId,
        adminResponseNote: "Approved while granting series-admin access directly.",
      });

      return {
        message: granted.isExistingOwner
          ? (
              input.dryRun === true
                ? "Dry-run confirmed. This user already has owner access for the entity."
                : "This user already has owner access for the entity."
            )
          : (
              input.dryRun === true
                ? "Dry-run entity admin assignment validated."
                : "Entity admin access granted."
            ),
        entity: {
          entityId: granted.context.entityId,
          entityName: granted.context.entityName,
          entitySlug: granted.context.entitySlug,
          ownerUserId: granted.context.ownerUserId,
        },
        membership: granted.membership,
        request: null,
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function createSeriesAdminAccessRequest(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const actorEmail = normalizeEmail(input.actorEmail);
  const requestNote = normalizeText(input.body?.requestNote);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to create a series-admin access request.");
    error.statusCode = 400;
    throw error;
  }

  if (!actorEmail) {
    const error = new Error("A signed-in user email is required before requesting series-admin access.");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(
    async (client) => {
      await assertEntityAdminAccessRequestReady(client);

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

      if (access.canManage) {
        return {
          message: input.dryRun
            ? "Dry-run series-admin access request validated. Access is already active."
            : "Series-admin access is already active for this user.",
          accessGranted: true,
          request: null,
          membership: null,
        };
      }

      const pendingInvite = await fetchOne(
        client,
        `
          select *
          from public.entity_admin_access_request
          where entity_id = $1
            and lower(requested_email) = lower($2)
            and request_type = 'admin_invite'
            and request_status = 'pending'
          order by created_at desc, id desc
          limit 1
        `,
        [access.entityId, actorEmail]
      );

      if (pendingInvite) {
        const granted = await grantEntityAdminMembership(client, {
          entityId: access.entityId,
          targetUserId: actorUserId,
          invitedByUserId: normalizeUuid(pendingInvite.requested_by_user_id) || null,
          reviewedByUserId: normalizeUuid(pendingInvite.requested_by_user_id) || null,
          adminResponseNote: "Series-admin access auto-activated when the approved email signed in.",
        });

        const resolvedRequest = await fetchOne(
          client,
          `
            update public.entity_admin_access_request
            set
              requested_user_id = $2,
              request_status = 'approved',
              reviewed_by_user_id = coalesce(reviewed_by_user_id, requested_by_user_id),
              admin_response_note = coalesce(
                nullif(admin_response_note, ''),
                'Series-admin access auto-activated when the approved email signed in.'
              ),
              resolved_membership_id = $3,
              resolved_at = coalesce(resolved_at, now()),
              updated_at = now()
            where id = $1
            returning *
          `,
          [pendingInvite.id, actorUserId, granted.membership?.membershipId || null]
        );

        return {
          message: input.dryRun
            ? "Dry-run series-admin request validated against an approved email invite."
            : "Series-admin access granted from the approved email invite.",
          accessGranted: true,
          request: mapEntityAdminRequestRow(resolvedRequest),
          membership: granted.membership,
        };
      }

      const request = await upsertPendingEntityAdminRequestRow(client, {
        entityId: access.entityId,
        requestedEmail: actorEmail,
        requestedUserId: actorUserId,
        requestedRole: "admin",
        requestType: "self_request",
        requestNote: requestNote || "User requested series-admin access from the analytics admin gateway.",
        requestedByUserId: actorUserId,
      });

      return {
        message: input.dryRun
          ? "Dry-run series-admin request validated."
          : "Series-admin request submitted for review.",
        accessGranted: false,
        request,
        membership: null,
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function applyEntityAdminAccessRequestDecision(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const requestId = normalizeUuid(input.requestId);
  const action = normalizeText(input.body?.action).toLowerCase();
  const adminResponseNote = normalizeText(input.body?.responseNote);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to review a series-admin request.");
    error.statusCode = 400;
    throw error;
  }

  if (!requestId) {
    const error = new Error("requestId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  if (!["approve", "decline"].includes(action)) {
    const error = new Error("action must be either approve or decline.");
    error.statusCode = 400;
    throw error;
  }

  return withTransaction(
    async (client) => {
      await assertEntityAdminAccessRequestReady(client);

      const context = await loadManagedEntityAdminContext(client, {
        actorUserId,
        entityId: input.entityId,
      });

      const request = await fetchOne(
        client,
        `
          select *
          from public.entity_admin_access_request
          where id = $1
            and entity_id = $2
          limit 1
        `,
        [requestId, context.entityId]
      );

      if (!request) {
        const error = new Error("Series-admin request not found for this entity.");
        error.statusCode = 404;
        throw error;
      }

      if (action === "decline") {
        const declined = await fetchOne(
          client,
          `
            update public.entity_admin_access_request
            set
              request_status = 'declined',
              reviewed_by_user_id = $2,
              admin_response_note = $3,
              resolved_at = coalesce(resolved_at, now()),
              updated_at = now()
            where id = $1
            returning *
          `,
          [requestId, actorUserId, adminResponseNote || "Request declined by a series admin."]
        );

        return {
          message: input.dryRun ? "Dry-run decline validated." : "Series-admin request declined.",
          entity: {
            entityId: context.entityId,
            entityName: context.entityName,
            entitySlug: context.entitySlug,
            ownerUserId: context.ownerUserId,
          },
          request: mapEntityAdminRequestRow(declined),
          membership: null,
        };
      }

      const targetUserId = normalizeUuid(request.requested_user_id);
      if (!targetUserId) {
        const error = new Error(
          "This request is waiting for the invited email to sign in. It will auto-activate once the invited user signs in and requests access."
        );
        error.statusCode = 409;
        throw error;
      }

      const granted = await grantEntityAdminMembership(client, {
        entityId: context.entityId,
        targetUserId,
        invitedByUserId: actorUserId,
        reviewedByUserId: actorUserId,
        adminResponseNote: adminResponseNote || "Approved by a series admin.",
      });

      const approved = await fetchOne(
        client,
        `
          update public.entity_admin_access_request
          set
            request_status = 'approved',
            reviewed_by_user_id = $2,
            admin_response_note = $3,
            resolved_membership_id = $4,
            resolved_at = coalesce(resolved_at, now()),
            updated_at = now()
          where id = $1
          returning *
        `,
        [
          requestId,
          actorUserId,
          adminResponseNote || "Approved by a series admin.",
          granted.membership?.membershipId || null,
        ]
      );

      return {
        message: input.dryRun ? "Dry-run approval validated." : "Series-admin request approved.",
        entity: {
          entityId: context.entityId,
          entityName: context.entityName,
          entitySlug: context.entitySlug,
          ownerUserId: context.ownerUserId,
        },
        request: mapEntityAdminRequestRow(approved),
        membership: granted.membership,
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function disableEntityAdminMembership(input) {
  return withTransaction(
    async (client) => {
      const context = await loadManagedEntityAdminContext(client, {
        actorUserId: input.actorUserId,
        entityId: input.entityId,
      });

      const targetUserId = normalizeUuid(input.targetUserId);
      if (!targetUserId) {
        const error = new Error("targetUserId must be a valid UUID.");
        error.statusCode = 400;
        throw error;
      }

      const existing = await fetchOne(
        client,
        `
          select
            em.id as membership_id,
            em.entity_id,
            em.user_id,
            em.role,
            em.status,
            em.invited_by_user_id,
            em.created_at,
            em.updated_at,
            (e.owner_user_id = em.user_id) as is_owner
          from public.entity_membership em
          join public.entity e on e.id = em.entity_id
          where em.entity_id = $1
            and em.user_id = $2
            and em.role in ('owner', 'admin')
          limit 1
        `,
        [context.entityId, targetUserId]
      );

      if (!existing) {
        const error = new Error("Entity admin membership not found.");
        error.statusCode = 404;
        throw error;
      }

      const existingRole = normalizeText(existing.role);
      const existingStatus = normalizeText(existing.status);
      const isOwner = existing.is_owner === true || existingRole === "owner" || context.ownerUserId === targetUserId;

      if (isOwner) {
        const error = new Error("Owner reassignment is not handled from this console yet.");
        error.statusCode = 409;
        throw error;
      }

      if (existingStatus !== "active") {
        return {
          message: input.dryRun === true
            ? "Dry-run confirmed. Entity admin access is already inactive."
            : "Entity admin access is already inactive.",
          entity: {
            entityId: context.entityId,
            entityName: context.entityName,
            entitySlug: context.entitySlug,
            ownerUserId: context.ownerUserId,
          },
          membership: mapEntityAdminMembershipRow(existing),
        };
      }

      const row = await fetchOne(
        client,
        `
          update public.entity_membership
          set
            status = 'disabled',
            updated_at = now()
          where entity_id = $1
            and user_id = $2
          returning
            id as membership_id,
            entity_id,
            user_id,
            role,
            status,
            invited_by_user_id,
            created_at,
            updated_at,
            false as is_owner
        `,
        [context.entityId, targetUserId]
      );

      return {
        message: input.dryRun === true
          ? "Dry-run entity admin removal validated."
          : "Entity admin access removed.",
        entity: {
          entityId: context.entityId,
          entityName: context.entityName,
          entitySlug: context.entitySlug,
          ownerUserId: context.ownerUserId,
        },
        membership: row ? mapEntityAdminMembershipRow(row) : null,
      };
    },
    { dryRun: input.dryRun === true }
  );
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

    const entities = await listManagedEntities(client, {
      userId: input.userId,
      isPlatformAdmin,
    });
    const series = await listManagedSeries(client, {
      userId: input.userId,
      isPlatformAdmin,
    });
    const adminMemberships = await listManagedEntityAdminMemberships(client, {
      userId: input.userId,
      isPlatformAdmin,
    });
    const adminRequests = await listManagedEntityAdminRequests(client, {
      userId: input.userId,
      isPlatformAdmin,
    });

    const membershipsByEntity = new Map();
    for (const membership of adminMemberships) {
      const entityId = normalizeText(membership.entityId);
      if (!entityId) {
        continue;
      }
      const bucket = membershipsByEntity.get(entityId) || [];
      bucket.push(membership);
      membershipsByEntity.set(entityId, bucket);
    }
    const requestsByEntity = new Map();
    for (const request of adminRequests) {
      const entityId = normalizeText(request.entityId);
      if (!entityId) {
        continue;
      }
      const bucket = requestsByEntity.get(entityId) || [];
      bucket.push(request);
      requestsByEntity.set(entityId, bucket);
    }

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
      entities: entities.map((entity) => ({
        ...entity,
        admins: membershipsByEntity.get(entity.entityId) || [],
        adminRequests: requestsByEntity.get(entity.entityId) || [],
      })),
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

    await autoActivatePendingSeriesInvites(client, {
      userId: input.userId,
      email: input.email,
    });

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

    const subscription = await fetchOne(
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
    );
    const result = await client.query(
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
    );
    const requests = await loadSeriesAccessRequests(client, access.seriesSourceConfigId);

    const grants = result.rows.map(mapViewerGrantRow);
    const activeGrants = grants.filter((grant) => grant.status === "active" && grant.isExpired !== true);
    const pendingRequests = requests.filter((request) => request.requestStatus === "pending");
    const approvedRequests = requests.filter((request) => request.requestStatus === "approved");
    const declinedRequests = requests.filter((request) => request.requestStatus === "declined");

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
        totalRequests: requests.length,
        pendingRequests: pendingRequests.length,
        approvedRequests: approvedRequests.length,
        declinedRequests: declinedRequests.length,
      },
      grants,
      requests,
    };
  });
}

async function upsertSeriesViewerGrant(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const targetUserId = normalizeUuid(input.body?.userId);
  const targetEmail = normalizeEmail(input.body?.email);
  const accessRole = normalizeViewerAccessRole(input.body?.accessRole) || "viewer";
  const expiresAt = parseOptionalIsoTimestamp(input.body?.expiresAt);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to grant viewer access.");
    error.statusCode = 400;
    throw error;
  }

  if (!targetUserId && !targetEmail) {
    const error = new Error("Provide either a valid userId or an email address.");
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

      if (targetUserId) {
        await assertSubscriptionActionAllowed(client, {
          seriesConfigKey: input.seriesConfigKey,
          action: "viewer_grant",
          targetUserId,
        });

        const grant = await grantSeriesViewerAccess(client, {
          entityId: access.entityId,
          seriesSourceConfigId: access.seriesSourceConfigId,
          targetUserId,
          accessRole,
          grantedByUserId: actorUserId,
          expiresAt,
        });

        return {
          message: input.dryRun ? "Dry-run viewer access grant validated." : "Viewer access granted.",
          grant,
        };
      }

      const request = await upsertPendingSeriesAccessRequestRow(client, {
        entityId: access.entityId,
        seriesSourceConfigId: access.seriesSourceConfigId,
        requestedEmail: targetEmail,
        requestedUserId: null,
        requestedAccessRole: accessRole,
        requestType: "admin_invite",
        requestNote:
          "Pre-approved by a series admin. Access will activate automatically the first time this email signs in to Game-Changrs.",
        requestedByUserId: actorUserId,
        requestedExpiresAt: expiresAt,
      });

      return {
        message: input.dryRun
          ? "Dry-run email invite validated."
          : "Email access invite saved. The grant will auto-activate the first time this email signs in.",
        request,
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function createSeriesAccessRequest(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const actorEmail = normalizeEmail(input.actorEmail);
  const accessRole = normalizeViewerAccessRole(input.body?.accessRole) || "viewer";
  const requestNote = normalizeText(input.body?.requestNote);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to create a series access request.");
    error.statusCode = 400;
    throw error;
  }

  if (!actorEmail) {
    const error = new Error("A signed-in user email is required before requesting series access.");
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

      if (access.canView) {
        return {
          message: input.dryRun
            ? "Dry-run access request validated. Access is already active."
            : "Access is already active for this user.",
          accessGranted: true,
          request: null,
          grant: null,
        };
      }

      const pendingInvite = await fetchOne(
        client,
        `
          select *
          from public.series_access_request
          where series_source_config_id = $1
            and lower(requested_email) = lower($2)
            and request_type = 'admin_invite'
            and request_status = 'pending'
          order by created_at desc, id desc
          limit 1
        `,
        [access.seriesSourceConfigId, actorEmail]
      );

      if (pendingInvite) {
        await assertSubscriptionActionAllowed(client, {
          seriesConfigKey: input.seriesConfigKey,
          action: "viewer_grant",
          targetUserId: actorUserId,
        });

        const grant = await grantSeriesViewerAccess(client, {
          entityId: access.entityId,
          seriesSourceConfigId: access.seriesSourceConfigId,
          targetUserId: actorUserId,
          accessRole: normalizeViewerAccessRole(pendingInvite.requested_access_role) || accessRole,
          grantedByUserId: normalizeUuid(pendingInvite.requested_by_user_id) || null,
          expiresAt: pendingInvite.requested_expires_at || null,
        });

        const resolvedRequest = await fetchOne(
          client,
          `
            update public.series_access_request
            set
              requested_user_id = $2,
              request_status = 'approved',
              reviewed_by_user_id = coalesce(reviewed_by_user_id, requested_by_user_id),
              admin_response_note = coalesce(
                nullif(admin_response_note, ''),
                'Access auto-activated when the approved email signed in.'
              ),
              resolved_grant_id = $3,
              resolved_at = coalesce(resolved_at, now()),
              updated_at = now()
            where id = $1
            returning *
          `,
          [pendingInvite.id, actorUserId, grant.grantId || null]
        );

        return {
          message: input.dryRun
            ? "Dry-run access request validated against an admin-approved email invite."
            : "Access granted from the admin-approved email invite.",
          accessGranted: true,
          request: mapAccessRequestRow(resolvedRequest),
          grant,
        };
      }

      const request = await upsertPendingSeriesAccessRequestRow(client, {
        entityId: access.entityId,
        seriesSourceConfigId: access.seriesSourceConfigId,
        requestedEmail: actorEmail,
        requestedUserId: actorUserId,
        requestedAccessRole: accessRole,
        requestType: "self_request",
        requestNote: requestNote || "Viewer requested access from the report route.",
        requestedByUserId: actorUserId,
        requestedExpiresAt: null,
      });

      return {
        message: input.dryRun
          ? "Dry-run access request validated."
          : "Access request submitted for admin review.",
        accessGranted: false,
        request,
        grant: null,
      };
    },
    { dryRun: input.dryRun === true }
  );
}

async function applySeriesAccessRequestDecision(input) {
  const actorUserId = normalizeUuid(input.actorUserId);
  const requestId = normalizeUuid(input.requestId);
  const action = normalizeText(input.body?.action).toLowerCase();
  const adminResponseNote = normalizeText(input.body?.responseNote);

  if (!actorUserId) {
    const error = new Error("A valid actor user id is required to review an access request.");
    error.statusCode = 400;
    throw error;
  }

  if (!requestId) {
    const error = new Error("requestId must be a valid UUID.");
    error.statusCode = 400;
    throw error;
  }

  if (!["approve", "decline"].includes(action)) {
    const error = new Error("action must be either approve or decline.");
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
        const error = new Error("You do not have admin access to review access requests for this series.");
        error.statusCode = 403;
        throw error;
      }

      const request = await fetchOne(
        client,
        `
          select *
          from public.series_access_request
          where id = $1
            and series_source_config_id = $2
          limit 1
        `,
        [requestId, access.seriesSourceConfigId]
      );

      if (!request) {
        const error = new Error("Series access request not found for this series.");
        error.statusCode = 404;
        throw error;
      }

      if (action === "decline") {
        const declined = await fetchOne(
          client,
          `
            update public.series_access_request
            set
              request_status = 'declined',
              reviewed_by_user_id = $2,
              admin_response_note = $3,
              resolved_at = coalesce(resolved_at, now()),
              updated_at = now()
            where id = $1
            returning *
          `,
          [requestId, actorUserId, adminResponseNote || "Request declined by a series admin."]
        );

        return {
          message: input.dryRun ? "Dry-run decline validated." : "Access request declined.",
          request: mapAccessRequestRow(declined),
          grant: null,
        };
      }

      const targetUserId = normalizeUuid(request.requested_user_id);
      if (!targetUserId) {
        const error = new Error(
          "This request is waiting for the invited email to sign in. It will auto-activate on first login or can be approved after a self-request links a user id."
        );
        error.statusCode = 409;
        throw error;
      }

      await assertSubscriptionActionAllowed(client, {
        seriesConfigKey: input.seriesConfigKey,
        action: "viewer_grant",
        targetUserId,
      });

      const grant = await grantSeriesViewerAccess(client, {
        entityId: access.entityId,
        seriesSourceConfigId: access.seriesSourceConfigId,
        targetUserId,
        accessRole: normalizeViewerAccessRole(request.requested_access_role) || "viewer",
        grantedByUserId: actorUserId,
        expiresAt: request.requested_expires_at || null,
      });

      const approved = await fetchOne(
        client,
        `
          update public.series_access_request
          set
            request_status = 'approved',
            reviewed_by_user_id = $2,
            admin_response_note = $3,
            resolved_grant_id = $4,
            resolved_at = coalesce(resolved_at, now()),
            updated_at = now()
          where id = $1
          returning *
        `,
        [
          requestId,
          actorUserId,
          adminResponseNote || "Approved by a series admin.",
          grant.grantId || null,
        ]
      );

      return {
        message: input.dryRun ? "Dry-run approval validated." : "Access request approved.",
        request: mapAccessRequestRow(approved),
        grant,
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
  applyEntityAdminAccessRequestDecision,
  applySeriesAccessRequestDecision,
  createSeriesAdminAccessRequest,
  createSeriesAccessRequest,
  disableEntityAdminMembership,
  getAdminSeriesCatalog,
  getEntityManagementAccess,
  getEntityAccessReadiness,
  getSeriesAdminAccess,
  getViewerSeriesCatalog,
  loadEntityManagementSnapshot,
  listSeriesViewerGrants,
  revokeSeriesViewerGrant,
  upsertEntityAdminMembership,
  upsertSeriesViewerGrant,
};

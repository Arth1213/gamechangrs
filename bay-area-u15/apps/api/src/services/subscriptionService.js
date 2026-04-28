"use strict";

const { fetchOne, withClient } = require("./seriesService");
const { normalizeText, toBoolean, toInteger } = require("../lib/utils");

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function hasActiveSubscription(summary) {
  const planKey = normalizeLower(summary?.subscription?.planKey);
  const status = normalizeLower(summary?.subscription?.status);

  if (planKey === "internal") {
    return true;
  }

  return ["active", "trial"].includes(status);
}

function remainingCapacity(maxValue, currentValue) {
  if (!Number.isFinite(maxValue)) {
    return null;
  }

  return Math.max(maxValue - (currentValue || 0), 0);
}

function buildWarnings(summary) {
  const warnings = [];

  if (!summary.subscription?.planKey) {
    warnings.push("Entity subscription is not configured.");
  }

  if (!summary.entitlements.hasActiveSubscription) {
    warnings.push("Entity subscription is not active for managed features.");
  }

  if (!summary.entitlements.manualRefreshEnabled) {
    warnings.push("Manual refresh is disabled for the current plan.");
  }

  if (!summary.entitlements.scheduledRefreshEnabled) {
    warnings.push("Scheduled refresh is disabled for the current plan.");
  }

  if (!summary.entitlements.weightTuningEnabled) {
    warnings.push("Weight tuning is disabled for the current plan.");
  }

  if (summary.limits.seriesLimitReached) {
    warnings.push(
      `Series allocation is at limit (${summary.usage.seriesCount}/${summary.limits.maxSeries}).`
    );
  }

  if (summary.limits.adminLimitReached) {
    warnings.push(
      `Admin allocation is at limit (${summary.usage.adminUserCount}/${summary.limits.maxAdminUsers}).`
    );
  }

  if (summary.limits.viewerLimitReached) {
    warnings.push(
      `Viewer allocation is at limit (${summary.usage.viewerUserCount}/${summary.limits.maxViewerUsers}).`
    );
  }

  return warnings;
}

async function getSeriesSubscriptionSummaryWithClient(client, seriesConfigKey) {
  const row = await fetchOne(
    client,
    `
      select
        c.id as series_source_config_id,
        c.config_key,
        c.entity_id,
        c.is_active,
        coalesce(s.name, c.name) as series_name,
        e.slug as entity_slug,
        e.display_name as entity_name,
        es.plan_key,
        es.plan_display_name,
        es.status as subscription_status,
        es.max_series,
        es.max_admin_users,
        es.max_viewer_users,
        es.allow_manual_refresh,
        es.allow_scheduled_refresh,
        es.allow_weight_tuning,
        es.billing_provider,
        es.billing_customer_ref,
        es.billing_subscription_ref,
        es.contract_owner_email,
        es.enforcement_mode,
        es.starts_at,
        es.ends_at
      from public.series_source_config c
      join public.entity e on e.id = c.entity_id
      left join public.series s on s.id = c.series_id
      left join public.entity_subscription es on es.entity_id = c.entity_id
      where c.config_key = $1
      limit 1
    `,
    [seriesConfigKey]
  );

  if (!row) {
    const error = new Error(`Series not found for config key: ${seriesConfigKey}`);
    error.statusCode = 404;
    throw error;
  }

  const usage = await fetchOne(
    client,
    `
      select
        count(distinct c.id)::int as series_count,
        count(distinct case when c.is_active = true then c.id end)::int as active_series_count,
        count(distinct case
          when em.status = 'active' and em.role in ('owner', 'admin') then em.user_id
          else null
        end)::int as admin_user_count,
        count(distinct case
          when sag.status = 'active' and (sag.expires_at is null or sag.expires_at > now()) then sag.user_id
          else null
        end)::int as viewer_user_count
      from public.entity e
      left join public.series_source_config c on c.entity_id = e.id
      left join public.entity_membership em on em.entity_id = e.id
      left join public.series_access_grant sag on sag.entity_id = e.id
      where e.id = $1
      group by e.id
    `,
    [row.entity_id]
  );

  const summary = {
    series: {
      configKey: normalizeText(row.config_key),
      seriesSourceConfigId: toInteger(row.series_source_config_id),
      seriesName: normalizeText(row.series_name),
      entityId: normalizeText(row.entity_id),
      entitySlug: normalizeText(row.entity_slug),
      entityName: normalizeText(row.entity_name),
      isActive: row.is_active === true,
    },
    subscription: {
      planKey: normalizeText(row.plan_key),
      planDisplayName: normalizeText(row.plan_display_name),
      status: normalizeText(row.subscription_status),
      billingProvider: normalizeText(row.billing_provider),
      billingCustomerRef: normalizeText(row.billing_customer_ref),
      billingSubscriptionRef: normalizeText(row.billing_subscription_ref),
      contractOwnerEmail: normalizeText(row.contract_owner_email),
      enforcementMode: normalizeText(row.enforcement_mode) || "hard",
      startsAt: row.starts_at || null,
      endsAt: row.ends_at || null,
    },
    usage: {
      seriesCount: toInteger(usage?.series_count) || 0,
      activeSeriesCount: toInteger(usage?.active_series_count) || 0,
      adminUserCount: toInteger(usage?.admin_user_count) || 0,
      viewerUserCount: toInteger(usage?.viewer_user_count) || 0,
    },
    limits: {
      maxSeries: toInteger(row.max_series),
      maxAdminUsers: toInteger(row.max_admin_users),
      maxViewerUsers: toInteger(row.max_viewer_users),
    },
    entitlements: {
      hasActiveSubscription: false,
      manualRefreshEnabled: false,
      scheduledRefreshEnabled: false,
      weightTuningEnabled: false,
      viewerGrantEnabled: false,
    },
    warnings: [],
  };

  summary.limits.seriesRemaining = remainingCapacity(summary.limits.maxSeries, summary.usage.seriesCount);
  summary.limits.adminRemaining = remainingCapacity(summary.limits.maxAdminUsers, summary.usage.adminUserCount);
  summary.limits.viewerRemaining = remainingCapacity(summary.limits.maxViewerUsers, summary.usage.viewerUserCount);
  summary.limits.seriesLimitReached =
    summary.limits.maxSeries !== null && summary.usage.seriesCount >= summary.limits.maxSeries;
  summary.limits.adminLimitReached =
    summary.limits.maxAdminUsers !== null && summary.usage.adminUserCount >= summary.limits.maxAdminUsers;
  summary.limits.viewerLimitReached =
    summary.limits.maxViewerUsers !== null && summary.usage.viewerUserCount >= summary.limits.maxViewerUsers;

  summary.entitlements.hasActiveSubscription = hasActiveSubscription(summary);
  summary.entitlements.manualRefreshEnabled =
    summary.entitlements.hasActiveSubscription && toBoolean(row.allow_manual_refresh);
  summary.entitlements.scheduledRefreshEnabled =
    summary.entitlements.hasActiveSubscription && toBoolean(row.allow_scheduled_refresh);
  summary.entitlements.weightTuningEnabled =
    summary.entitlements.hasActiveSubscription && toBoolean(row.allow_weight_tuning);
  summary.entitlements.viewerGrantEnabled = summary.entitlements.hasActiveSubscription;
  summary.warnings = buildWarnings(summary);

  return summary;
}

async function getSeriesSubscriptionSummary(input) {
  return withClient(async (client) => {
    return getSeriesSubscriptionSummaryWithClient(client, input.seriesConfigKey);
  });
}

async function countsTowardViewerLimit(client, entityId, targetUserId) {
  const row = await fetchOne(
    client,
    `
      select exists (
        select 1
        from public.series_access_grant sag
        where sag.entity_id = $1
          and sag.user_id = $2
          and sag.status = 'active'
          and (sag.expires_at is null or sag.expires_at > now())
      ) as already_counted
    `,
    [entityId, targetUserId]
  );

  return row?.already_counted !== true;
}

function buildEntitlementError(message, statusCode = 403) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function assertSubscriptionActionAllowed(client, input) {
  const summary = await getSeriesSubscriptionSummaryWithClient(client, input.seriesConfigKey);
  const enforcementMode = normalizeLower(summary.subscription?.enforcementMode) || "hard";
  const hardEnforced = enforcementMode !== "advisory";

  if (!summary.entitlements.hasActiveSubscription && hardEnforced) {
    throw buildEntitlementError(
      "Managed cricket features are locked because the entity subscription is not active."
    );
  }

  if (input.action === "manual_refresh" && !summary.entitlements.manualRefreshEnabled && hardEnforced) {
    throw buildEntitlementError("Manual refresh is disabled for the current entity plan.");
  }

  if (input.action === "scheduled_refresh" && !summary.entitlements.scheduledRefreshEnabled && hardEnforced) {
    throw buildEntitlementError("Scheduled refresh is disabled for the current entity plan.");
  }

  if (input.action === "weight_tuning" && !summary.entitlements.weightTuningEnabled && hardEnforced) {
    throw buildEntitlementError("Weight tuning is disabled for the current entity plan.");
  }

  if (input.action === "viewer_grant") {
    if (!summary.entitlements.viewerGrantEnabled && hardEnforced) {
      throw buildEntitlementError("Viewer access grants are disabled for the current entity plan.");
    }

    if (
      summary.limits.maxViewerUsers !== null
      && hardEnforced
      && input.targetUserId
      && await countsTowardViewerLimit(client, summary.series.entityId, input.targetUserId)
      && summary.usage.viewerUserCount >= summary.limits.maxViewerUsers
    ) {
      throw buildEntitlementError(
        `Viewer allocation is at limit for this entity plan (${summary.usage.viewerUserCount}/${summary.limits.maxViewerUsers}).`,
        409
      );
    }
  }

  if (input.action === "activate_series") {
    if (
      summary.limits.maxSeries !== null
      && hardEnforced
      && summary.usage.activeSeriesCount >= summary.limits.maxSeries
    ) {
      throw buildEntitlementError(
        `Active series allocation is at limit for this entity plan (${summary.usage.activeSeriesCount}/${summary.limits.maxSeries}).`,
        409
      );
    }
  }

  return summary;
}

module.exports = {
  assertSubscriptionActionAllowed,
  getSeriesSubscriptionSummary,
  getSeriesSubscriptionSummaryWithClient,
};

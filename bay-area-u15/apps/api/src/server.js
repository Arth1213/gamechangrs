"use strict";

const express = require("express");

const { requireAuthenticatedCricketUser, requireSeriesAdminAccess } = require("./lib/auth");
const { closePool, testConnection } = require("./lib/connection");
const { normalizeText, toBoolean, toInteger } = require("./lib/utils");
const {
  renderAdminMatchesPage,
  renderAdminSetupPage,
  renderAdminTuningPage,
  renderDashboardPage,
  renderErrorPage,
  renderPlayerReportPage,
  renderSeriesIndexPage,
} = require("./render/pages");
const {
  createSeries,
  createSeriesOperationRequest,
  createManualRefreshRequest,
  getMatchOpsPayload,
  getSetupPayload,
  getTuningPayload,
  updateMatchSelectionOverride,
  updateSetup,
  updateTuning,
} = require("./services/adminService");
const {
  applyEntityAdminAccessRequestDecision,
  applySeriesAccessRequestDecision,
  createSeriesAdminAccessRequest,
  createSeriesAccessRequest,
  disableEntityAdminMembership,
  getAdminSeriesCatalog,
  getViewerSeriesCatalog,
  listSeriesViewerGrants,
  revokeSeriesViewerGrant,
  upsertEntityAdminMembership,
  upsertSeriesViewerGrant,
} = require("./services/accessService");
const {
  getSeriesSubscriptionSummary,
} = require("./services/subscriptionService");
const {
  withClient,
} = require("./services/seriesService");
const {
  getDashboardOverview,
  getPlayerReport,
  searchPlayers,
} = require("./services/reportService");
const {
  getPlayerReportDefault,
  getPlayerSummaryDefault,
  searchPlayersDefault,
} = require("./services/playerApiService");

const app = express();
const API_CORS_ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const API_CORS_ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "Accept",
  "apikey",
  "x-client-info",
].join(", ");
const API_CORS_MAX_AGE_SECONDS = "86400";
const API_CORS_ORIGIN_PATTERNS = [
  /^https:\/\/game-changrs\.com$/i,
  /^https:\/\/www\.game-changrs\.com$/i,
  /^https:\/\/gamechangrs\.com$/i,
  /^https:\/\/www\.gamechangrs\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i,
  /^https:\/\/lovable\.dev$/i,
  /^http:\/\/localhost:\d+$/i,
  /^http:\/\/127\.0\.0\.1:\d+$/i,
  /^http:\/\/\[\:\:1\]:\d+$/i,
];

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function isAllowedCorsOrigin(origin) {
  if (!origin || typeof origin !== "string") {
    return false;
  }

  return API_CORS_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function applyApiCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedCorsOrigin(origin)) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", API_CORS_ALLOWED_METHODS);
  res.setHeader("Access-Control-Allow-Headers", API_CORS_ALLOWED_HEADERS);
  res.setHeader("Access-Control-Max-Age", API_CORS_MAX_AGE_SECONDS);
  res.append("Vary", "Origin");
  return true;
}

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  applyApiCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseDryRun(req) {
  const candidate = req.query.dryRun ?? req.body?.dryRun;
  if (candidate === undefined) {
    return false;
  }
  return toBoolean(candidate);
}

function isApiRequest(req) {
  return req.path.startsWith("/api/");
}

function sendHtml(res, html, statusCode = 200) {
  res.status(statusCode).type("html").send(html);
}

const requireSeriesAdmin = asyncHandler(async (req, res, next) => {
  await requireSeriesAdminAccess(req);
  next();
});

async function loadSeriesCards() {
  return withClient(async (client) => {
    const result = await client.query(
      `
        select
          c.config_key,
          coalesce(s.name, c.name) as series_name,
          c.target_age_group,
          c.is_active,
          count(distinct m.id)::int as match_count,
          count(distinct case when mrs.analytics_status = 'computed' then m.id end)::int as computed_matches,
          count(distinct pcs.player_id)::int as player_count
        from series_source_config c
        join series s on s.id = c.series_id
        left join match m on m.series_id = s.id
        left join match_refresh_state mrs on mrs.match_id = m.id
        left join player_composite_score pcs on pcs.series_id = s.id
        group by c.id, s.id
        order by c.is_active desc, c.updated_at desc nulls last, c.id desc
      `
    );

    return result.rows.map((row) => ({
      configKey: normalizeText(row.config_key),
      seriesName: normalizeText(row.series_name),
      targetAgeGroup: normalizeText(row.target_age_group),
      isActive: row.is_active === true,
      matchCount: toInteger(row.match_count) || 0,
      computedMatches: toInteger(row.computed_matches) || 0,
      playerCount: toInteger(row.player_count) || 0,
    }));
  });
}

function summarizeFreshness({ totalMatches, computedMatches, warningMatches, pendingOps }) {
  if (pendingOps > 0) {
    return {
      label: "Pending Ops",
      tone: "watch",
      note: `${pendingOps} tracked match operations still need refresh or recompute work.`,
    };
  }

  if (warningMatches > 0) {
    return {
      label: "Review Warnings",
      tone: "watch",
      note: `${warningMatches} computed matches are still flagged for reconciliation review.`,
    };
  }

  if (totalMatches > 0 && computedMatches === totalMatches) {
    return {
      label: "Current",
      tone: "good",
      note: "All tracked matches in the active series are computed.",
    };
  }

  if (computedMatches > 0) {
    return {
      label: "Partially Computed",
      tone: "watch",
      note: `${computedMatches} of ${totalMatches} tracked matches are currently computed.`,
    };
  }

  return {
    label: "Pending",
    tone: "watch",
    note: "Live series coverage is available, but computed match output is not populated yet.",
  };
}

app.get("/health", asyncHandler(async (req, res) => {
  const db = await testConnection();
  const summary = await withClient(async (client) => {
    const result = await client.query(
      `
        select
          count(*)::int as series_configs,
          count(*) filter (where is_active = true)::int as active_series_configs
        from series_source_config
      `
    );
    return result.rows[0] || {};
  });

  res.json({
    status: "ok",
    database: {
      databaseName: db.database_name,
      currentUser: db.current_user,
      serverTime: db.server_time,
    },
    seriesConfigs: {
      total: toInteger(summary.series_configs) || 0,
      active: toInteger(summary.active_series_configs) || 0,
    },
  });
}));

app.get("/api/dashboard/summary", asyncHandler(async (req, res) => {
  const seriesCards = await loadSeriesCards();
  const activeSeries = seriesCards.find((card) => card.isActive) || seriesCards[0] || null;

  if (!activeSeries?.configKey) {
    const error = new Error("No active series configuration is available.");
    error.statusCode = 404;
    throw error;
  }

  const overview = await getDashboardOverview({
    seriesConfigKey: activeSeries.configKey,
  });

  const divisionLabels = Array.from(
    new Set(
      [
        ...((overview.leaderboard || []).map((row) => normalizeText(row.divisionLabel))),
        ...((overview.recentMatches || []).map((row) => normalizeText(row.divisionLabel))),
      ].filter(Boolean)
    )
  );

  const qualitySummary = overview.qualitySummary || {};
  const totalMatches = toInteger(activeSeries.matchCount) || 0;
  const computedMatches = toInteger(activeSeries.computedMatches) || 0;
  const warningMatches = toInteger(qualitySummary.warningMatches) || 0;
  const pendingOps = toInteger(qualitySummary.pendingOps) || 0;
  const adminOverrides = toInteger(qualitySummary.adminOverrides) || 0;
  const latestMatch = Array.isArray(overview.recentMatches) && overview.recentMatches.length > 0
    ? overview.recentMatches[0]
    : null;

  res.json({
    series: {
      configKey: activeSeries.configKey,
      name: activeSeries.seriesName,
      targetAgeGroup: activeSeries.targetAgeGroup,
    },
    seriesCards,
    coverage: {
      playerCount: toInteger(activeSeries.playerCount) || 0,
      totalMatches,
      computedMatches,
      warningMatches,
      pendingOps,
      adminOverrides,
      divisionLabels,
    },
    freshness: summarizeFreshness({
      totalMatches,
      computedMatches,
      warningMatches,
      pendingOps,
    }),
    latestMatch: latestMatch
      ? {
          matchId: toInteger(latestMatch.matchId),
          sourceMatchId: normalizeText(latestMatch.sourceMatchId),
          matchDate: latestMatch.matchDate,
          matchDateLabel: normalizeText(latestMatch.matchDateLabel),
          matchTitle: normalizeText(latestMatch.matchTitle),
          divisionLabel: normalizeText(latestMatch.divisionLabel),
          analyticsStatus: normalizeText(latestMatch.analyticsStatus),
          reconciliationStatus: normalizeText(latestMatch.reconciliationStatus),
        }
      : null,
  });
}));

app.get("/api/admin/series", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await getAdminSeriesCatalog({
    userId: actor.userId,
    email: actor.email,
  });
  res.json(payload);
}));

app.post("/api/admin/series", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await createSeries({
    actorUserId: actor.userId,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.post("/api/admin/entities/:entityId/admins", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await upsertEntityAdminMembership({
    actorUserId: actor.userId,
    entityId: req.params.entityId,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.post("/api/admin/entities/:entityId/admin-access-requests/:requestId/decision", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await applyEntityAdminAccessRequestDecision({
    actorUserId: actor.userId,
    entityId: req.params.entityId,
    requestId: req.params.requestId,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.delete("/api/admin/entities/:entityId/admins/:userId", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await disableEntityAdminMembership({
    actorUserId: actor.userId,
    entityId: req.params.entityId,
    targetUserId: req.params.userId,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.get("/api/viewer/series", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await getViewerSeriesCatalog({
    userId: actor.userId,
    email: actor.email,
  });
  res.json(payload);
}));

app.get("/api/players/search", asyncHandler(async (req, res) => {
  const payload = await searchPlayersDefault({
    query: req.query.q ?? req.query.query ?? "",
    limit: req.query.limit,
  });
  res.json(payload);
}));

app.get("/api/players/:playerId/summary", asyncHandler(async (req, res) => {
  const payload = await getPlayerSummaryDefault({
    playerId: req.params.playerId,
    divisionId: req.query.divisionId,
  });
  res.json(payload);
}));

app.get("/api/players/:playerId/report", asyncHandler(async (req, res) => {
  const payload = await getPlayerReportDefault({
    playerId: req.params.playerId,
    divisionId: req.query.divisionId,
  });
  res.json(payload);
}));

app.get("/", asyncHandler(async (req, res) => {
  const seriesCards = await loadSeriesCards();
  const activeSeries = seriesCards.find((card) => card.isActive) || seriesCards[0] || null;
  const activeOverview = activeSeries?.configKey
    ? await getDashboardOverview({ seriesConfigKey: activeSeries.configKey })
    : null;
  sendHtml(res, renderSeriesIndexPage({ seriesCards, activeOverview }));
}));

app.get("/players/:playerId", asyncHandler(async (req, res) => {
  const payload = await getPlayerReportDefault({
    playerId: req.params.playerId,
    divisionId: req.query.divisionId,
  });
  sendHtml(res, renderPlayerReportPage(payload));
}));

app.get("/players/:playerId/report", asyncHandler(async (req, res) => {
  const payload = await getPlayerReportDefault({
    playerId: req.params.playerId,
    divisionId: req.query.divisionId,
  });
  sendHtml(res, renderPlayerReportPage(payload));
}));

app.get("/series/:seriesConfigKey/dashboard", asyncHandler(async (req, res) => {
  const payload = await getDashboardOverview({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  sendHtml(res, renderDashboardPage(payload));
}));

app.get("/api/series/:seriesConfigKey/dashboard/overview", asyncHandler(async (req, res) => {
  const payload = await getDashboardOverview({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  res.json(payload);
}));

app.get("/api/series/:seriesConfigKey/players/search", asyncHandler(async (req, res) => {
  const payload = await searchPlayers({
    seriesConfigKey: req.params.seriesConfigKey,
    query: req.query.query ?? req.query.q ?? "",
    limit: req.query.limit,
  });
  res.json(payload);
}));

app.post("/api/series/:seriesConfigKey/access-requests", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await createSeriesAccessRequest({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    seriesConfigKey: req.params.seriesConfigKey,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.post("/api/series/:seriesConfigKey/admin-access-requests", asyncHandler(async (req, res) => {
  const actor = await requireAuthenticatedCricketUser(req);
  const payload = await createSeriesAdminAccessRequest({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    seriesConfigKey: req.params.seriesConfigKey,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.get("/api/series/:seriesConfigKey/players/:playerId/report", asyncHandler(async (req, res) => {
  const payload = await getPlayerReport({
    seriesConfigKey: req.params.seriesConfigKey,
    playerId: req.params.playerId,
    divisionId: req.query.divisionId,
  });
  res.json(payload);
}));

app.get("/series/:seriesConfigKey/players/:playerId/report", asyncHandler(async (req, res) => {
  const payload = await getPlayerReport({
    seriesConfigKey: req.params.seriesConfigKey,
    playerId: req.params.playerId,
    divisionId: req.query.divisionId,
  });
  sendHtml(res, renderPlayerReportPage(payload));
}));

app.get("/api/series/:seriesConfigKey/admin/setup", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getSetupPayload({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  res.json(payload);
}));

app.get("/admin/series/:seriesConfigKey/setup", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getSetupPayload({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  sendHtml(res, renderAdminSetupPage(payload));
}));

app.put("/api/series/:seriesConfigKey/admin/setup", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await updateSetup({
    seriesConfigKey: req.params.seriesConfigKey,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.get("/api/series/:seriesConfigKey/admin/tuning", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getTuningPayload({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  res.json(payload);
}));

app.get("/admin/series/:seriesConfigKey/tuning", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getTuningPayload({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  sendHtml(res, renderAdminTuningPage(payload));
}));

app.put("/api/series/:seriesConfigKey/admin/tuning", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await updateTuning({
    seriesConfigKey: req.params.seriesConfigKey,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.get("/api/series/:seriesConfigKey/admin/matches", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getMatchOpsPayload({
    seriesConfigKey: req.params.seriesConfigKey,
    query: req.query.query,
    limit: req.query.limit,
  });
  res.json(payload);
}));

app.get("/admin/series/:seriesConfigKey/matches", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getMatchOpsPayload({
    seriesConfigKey: req.params.seriesConfigKey,
    query: req.query.query,
    limit: req.query.limit,
  });
  sendHtml(res, renderAdminMatchesPage(payload));
}));

app.post("/api/series/:seriesConfigKey/admin/matches/refresh-requests", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await createManualRefreshRequest({
    seriesConfigKey: req.params.seriesConfigKey,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.post("/api/series/:seriesConfigKey/admin/operations/requests", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await createSeriesOperationRequest({
    seriesConfigKey: req.params.seriesConfigKey,
    actorUserId: req.cricketActor?.userId,
    actorEmail: req.cricketActor?.email,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.post("/api/series/:seriesConfigKey/admin/matches/:matchId/selection-override", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await updateMatchSelectionOverride({
    seriesConfigKey: req.params.seriesConfigKey,
    matchId: req.params.matchId,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.get("/api/series/:seriesConfigKey/admin/viewers", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await listSeriesViewerGrants({
    seriesConfigKey: req.params.seriesConfigKey,
    userId: req.cricketActor.userId,
  });
  res.json(payload);
}));

app.post("/api/series/:seriesConfigKey/admin/viewers", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await upsertSeriesViewerGrant({
    actorUserId: req.cricketActor.userId,
    seriesConfigKey: req.params.seriesConfigKey,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.patch("/api/series/:seriesConfigKey/admin/viewer-requests/:requestId", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await applySeriesAccessRequestDecision({
    actorUserId: req.cricketActor.userId,
    seriesConfigKey: req.params.seriesConfigKey,
    requestId: req.params.requestId,
    body: req.body,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.delete("/api/series/:seriesConfigKey/admin/viewers/:grantId", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await revokeSeriesViewerGrant({
    actorUserId: req.cricketActor.userId,
    seriesConfigKey: req.params.seriesConfigKey,
    grantId: req.params.grantId,
    dryRun: parseDryRun(req),
  });
  res.json(payload);
}));

app.get("/api/series/:seriesConfigKey/admin/subscription", requireSeriesAdmin, asyncHandler(async (req, res) => {
  const payload = await getSeriesSubscriptionSummary({
    seriesConfigKey: req.params.seriesConfigKey,
  });
  res.json(payload);
}));

app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  if (isApiRequest(req) || req.accepts(["json", "html"]) === "json") {
    res.status(statusCode).json({
      error: error.message || "Unexpected request failure.",
      statusCode,
    });
    return;
  }

  sendHtml(
    res,
    renderErrorPage({
      title: statusCode === 404 ? "Route Not Found" : "Request Failed",
      message: error.message || "Unexpected request failure.",
      statusCode,
      seriesConfigKey: req.params?.seriesConfigKey,
    }),
    statusCode
  );
});

const port = toInteger(process.env.PORT) || 4010;
const server = app.listen(port, () => {
  console.log(`Phase 8 API listening on http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Closing API server.`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

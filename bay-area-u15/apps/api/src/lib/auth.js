"use strict";

const path = require("path");

const { loadEnvFile } = require("./env");
const { getSeriesAdminAccess } = require("../services/accessService");
const { normalizeText, toInteger } = require("./utils");

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), "../.env"));

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
}

function getSupabaseAuthConfig() {
  const supabaseUrl = [
    normalizeText(process.env.SUPABASE_URL),
    normalizeText(process.env.VITE_SUPABASE_URL),
  ].find((value) => isValidHttpUrl(value));
  const supabaseAnonKey = normalizeText(
    process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error(
      "Admin auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY for the cricket API runtime."
    );
    error.statusCode = 503;
    throw error;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseAnonKey,
    timeoutMs: toInteger(process.env.SUPABASE_AUTH_TIMEOUT_MS) || 5000,
  };
}

function extractBearerToken(req) {
  const header = normalizeText(req.get("authorization"));
  if (!header) {
    return "";
  }

  const [scheme, ...rest] = header.split(/\s+/);
  if (normalizeText(scheme).toLowerCase() !== "bearer" || !rest.length) {
    return "";
  }

  return normalizeText(rest.join(" "));
}

async function fetchSupabaseUser(accessToken) {
  const config = getSupabaseAuthConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const error = new Error(`Supabase auth lookup failed with status ${response.status}.`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  const userId = normalizeText(payload?.id);
  if (!userId) {
    return null;
  }

  return {
    id: userId,
    email: normalizeText(payload?.email),
  };
}

async function requireAuthenticatedCricketUser(req) {
  if (req.cricketActor?.userId) {
    return req.cricketActor;
  }

  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    const error = new Error("Authentication is required for cricket admin routes.");
    error.statusCode = 401;
    throw error;
  }

  const user = await fetchSupabaseUser(accessToken);
  if (!user?.id) {
    const error = new Error("The supplied access token is invalid or expired.");
    error.statusCode = 401;
    throw error;
  }

  req.cricketActor = {
    ...(req.cricketActor || {}),
    userId: user.id,
    email: user.email,
  };

  return req.cricketActor;
}

async function requireSeriesAdminAccess(req) {
  const actor = await requireAuthenticatedCricketUser(req);

  const access = await getSeriesAdminAccess({
    userId: actor.userId,
    seriesConfigKey: req.params.seriesConfigKey,
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

  if (!access.isPlatformAdmin && !access.isEntityAdmin) {
    const error = new Error("You do not have admin access to this series.");
    error.statusCode = 403;
    throw error;
  }

  req.cricketActor = {
    userId: actor.userId,
    email: actor.email,
    seriesConfigKey: access.seriesConfigKey,
    seriesName: access.seriesName,
    entityId: access.entityId,
    isPlatformAdmin: access.isPlatformAdmin,
    isEntityAdmin: access.isEntityAdmin,
  };

  return req.cricketActor;
}

module.exports = {
  extractBearerToken,
  fetchSupabaseUser,
  requireAuthenticatedCricketUser,
  requireSeriesAdminAccess,
};

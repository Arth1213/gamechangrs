const DEFAULT_ALLOWED_ORIGINS = [
  "https://game-changrs.com",
  "https://www.game-changrs.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const LOVABLE_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovable\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
];

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins() {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  const siteOrigin = normalizeOrigin(Deno.env.get("SITE_URL"));

  return new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...configured,
    ...(siteOrigin ? [siteOrigin] : []),
  ]);
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (configuredOrigins().has(normalizedOrigin)) {
    return true;
  }

  return LOVABLE_ORIGIN_PATTERNS.some((pattern) => pattern.test(normalizedOrigin));
}

function resolveOriginHeader(origin: string | null) {
  if (isAllowedOrigin(origin)) {
    return normalizeOrigin(origin);
  }

  return normalizeOrigin(Deno.env.get("SITE_URL")) || "https://game-changrs.com";
}

export function getCorsHeaders(req: Request, allowOrigin = true) {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = resolveOriginHeader(origin);
  }

  return headers;
}

export function handleCors(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: {
        ...getCorsHeaders(req, false),
        "Content-Type": "application/json",
      },
    });
  }

  if (req.method !== "OPTIONS") {
    return null;
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

type LocationLike = {
  pathname?: string;
  search?: string;
  hash?: string;
} | null | undefined;

export function normalizeAuthRedirect(candidate?: string | null, fallback = "/") {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  const normalized = `${candidate}`.trim();

  if (!normalized || normalized === "/auth" || normalized.startsWith("/auth?") || normalized.startsWith("/auth#")) {
    return fallback;
  }

  return normalized;
}

export function buildLocationRedirect(location?: LocationLike) {
  if (!location?.pathname) {
    return "/";
  }

  return normalizeAuthRedirect(`${location.pathname}${location.search || ""}${location.hash || ""}`, "/");
}

export function buildAuthRoute(redirectPath?: string | null) {
  const redirect = normalizeAuthRedirect(redirectPath, "/");

  if (redirect === "/") {
    return "/auth";
  }

  const params = new URLSearchParams();
  params.set("redirect", redirect);
  return `/auth?${params.toString()}`;
}

export function resolveAuthRedirect(search: string, stateLocation?: LocationLike) {
  const searchParams = new URLSearchParams(search);
  const queryRedirect = searchParams.get("redirect");

  if (queryRedirect) {
    return normalizeAuthRedirect(queryRedirect, "/");
  }

  return buildLocationRedirect(stateLocation);
}

export function buildAuthCallbackUrl(redirectPath?: string | null) {
  const url = new URL("/auth", window.location.origin);
  const redirect = normalizeAuthRedirect(redirectPath, "/");

  if (redirect !== "/") {
    url.searchParams.set("redirect", redirect);
  }

  return url.toString();
}

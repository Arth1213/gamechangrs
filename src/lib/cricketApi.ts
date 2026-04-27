const DEFAULT_CRICKET_API_BASE = "/cricket-api";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function joinBaseAndPath(base: string, path: string) {
  const normalizedBase = stripTrailingSlash(base);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export type CricketPlayerSearchResult = {
  playerId: number;
  divisionId: number | null;
  displayName: string;
  canonicalName: string;
  teamName: string;
  divisionLabel: string;
  roleType: string;
  roleLabel: string;
  compositeScore: number | null;
  percentileRank: number | null;
  confidenceScore: number | null;
  confidenceLabel: string;
  reportPath: string;
  apiPath: string;
};

export type CricketPlayerSearchResponse = {
  series: {
    configKey: string;
    name: string;
  };
  query: string;
  resultCount: number;
  results: CricketPlayerSearchResult[];
};

export type CricketSeriesCard = {
  configKey?: string;
  seriesName?: string;
  targetAgeGroup?: string;
  isActive?: boolean;
  matchCount?: number | null;
  computedMatches?: number | null;
  playerCount?: number | null;
};

export type CricketDashboardSummaryResponse = {
  series?: {
    configKey?: string;
    name?: string;
    targetAgeGroup?: string;
  };
  seriesCards?: CricketSeriesCard[];
  coverage?: {
    playerCount?: number | null;
    totalMatches?: number | null;
    computedMatches?: number | null;
    warningMatches?: number | null;
    pendingOps?: number | null;
    adminOverrides?: number | null;
    divisionLabels?: string[];
  };
  freshness?: {
    label?: string;
    tone?: CricketReportTone;
    note?: string;
  };
  latestMatch?: {
    matchId?: number | null;
    sourceMatchId?: string;
    matchDate?: string;
    matchDateLabel?: string;
    matchTitle?: string;
    divisionLabel?: string;
    analyticsStatus?: string;
    reconciliationStatus?: string;
  } | null;
};

export type CricketPlayerReportRouteState = {
  displayName?: string;
  teamName?: string;
  divisionLabel?: string;
  roleLabel?: string;
  searchQuery?: string;
  seriesConfigKey?: string;
  seriesName?: string;
};

export type CricketReportTone = "good" | "watch" | "risk" | string;

export type CricketPlayerReportMetric = {
  label?: string;
  value?: number | null;
  tone?: CricketReportTone;
  note?: string;
  badge?: string;
  primary?: boolean;
};

export type CricketPlayerStandardStat = {
  value?: number | string | null;
  detail?: string;
};

export type CricketPlayerReportResponse = {
  meta?: {
    generatedAt?: string;
    series?: {
      configKey?: string;
      name?: string;
      targetAgeGroup?: string;
    };
    reportProfile?: {
      key?: string;
      name?: string;
      themeName?: string;
      peerCount?: number | null;
    };
    scoringModel?: {
      modelKey?: string;
      name?: string;
      version?: string;
    };
    player?: {
      playerId?: number;
      divisionId?: number | null;
      playerName?: string;
      canonicalName?: string;
      teamName?: string;
      divisionOptions?: Array<{
        divisionId?: number | null;
        divisionLabel?: string;
        roleType?: string;
        compositeScore?: number | null;
      }>;
    };
  };
  header?: {
    playerName?: string;
    teamName?: string;
    primaryRole?: string;
    divisionLabel?: string;
    strengthSignal?: string;
    comparisonPool?: string;
    percentileRank?: number | null;
    confidenceScore?: number | null;
    confidenceLabel?: string;
    recommendation?: string;
    quickRead?: string;
  };
  scores?: {
    compositeScore?: number | null;
    tierLabel?: string;
    breakdown?: Array<{
      key?: string;
      label?: string;
      value?: number | null;
    }>;
  };
  assessmentSnapshot?: CricketPlayerReportMetric[];
  visualReadout?: CricketPlayerReportMetric[];
  contextPerformance?: CricketPlayerReportMetric[];
  selectorInterpretation?: CricketPlayerReportMetric[];
  selectorTakeaway?: string;
  standardStats?: {
    currentSeries?: {
      batting?: CricketPlayerStandardStat;
      bowling?: CricketPlayerStandardStat;
      fielding?: CricketPlayerStandardStat;
      wicketkeeping?: CricketPlayerStandardStat;
    };
    overall?: {
      batting?: CricketPlayerStandardStat;
      bowling?: CricketPlayerStandardStat;
      fielding?: CricketPlayerStandardStat;
      wicketkeeping?: CricketPlayerStandardStat;
    };
  };
  reportPayload?: {
    recommendationBadge?: {
      label?: string;
      tone?: CricketReportTone;
      confidenceLabel?: string;
      confidenceScore?: number | null;
      percentileRank?: number | null;
      quickRead?: string;
      selectorTakeaway?: string;
    };
  };
};

export function getCricketApiBase() {
  const configuredBase = import.meta.env.VITE_CRICKET_API_BASE?.trim();
  if (configuredBase) {
    return stripTrailingSlash(configuredBase);
  }

  return DEFAULT_CRICKET_API_BASE;
}

export function getCricketApiUrl(path: string) {
  return joinBaseAndPath(getCricketApiBase(), path);
}

type CricketPlayerTarget = Pick<CricketPlayerSearchResult, "playerId" | "divisionId">;

type CricketPlayerRouteOptions = {
  searchQuery?: string;
  seriesConfigKey?: string | null;
};

function appendPlayerQueryParams(result: CricketPlayerTarget, options?: CricketPlayerRouteOptions) {
  const query = new URLSearchParams();
  if (result.divisionId !== null && result.divisionId !== undefined) {
    query.set("divisionId", String(result.divisionId));
  }
  if (options?.searchQuery?.trim()) {
    query.set("q", options.searchQuery.trim());
  }
  if (options?.seriesConfigKey?.trim()) {
    query.set("series", options.seriesConfigKey.trim());
  }

  return query;
}

function getStandalonePlayerReportPath(result: CricketPlayerTarget, seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/series/${encodeURIComponent(seriesConfigKey.trim())}/players/${result.playerId}/report`;
  }

  return `/players/${result.playerId}`;
}

function getPlayerReportApiPath(result: CricketPlayerTarget, seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/api/series/${encodeURIComponent(seriesConfigKey.trim())}/players/${result.playerId}/report`;
  }

  return `/api/players/${result.playerId}/report`;
}

function getPlayerSearchApiPath(seriesConfigKey?: string | null) {
  if (seriesConfigKey?.trim()) {
    return `/api/series/${encodeURIComponent(seriesConfigKey.trim())}/players/search`;
  }

  return "/api/players/search";
}

export function getCricketPlayerReportUrl(
  result: CricketPlayerTarget,
  options?: Pick<CricketPlayerRouteOptions, "seriesConfigKey">
) {
  const query = appendPlayerQueryParams(result);
  const basePath = getCricketApiUrl(getStandalonePlayerReportPath(result, options?.seriesConfigKey));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getCricketPlayerReportApiUrl(
  result: CricketPlayerTarget,
  options?: Pick<CricketPlayerRouteOptions, "seriesConfigKey">
) {
  const query = appendPlayerQueryParams(result);
  const basePath = getCricketApiUrl(getPlayerReportApiPath(result, options?.seriesConfigKey));
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getRootCricketPlayerReportRoute(result: CricketPlayerTarget, options?: CricketPlayerRouteOptions) {
  const query = appendPlayerQueryParams(result, options);
  const search = query.toString();
  const basePath = `/analytics/reports/${result.playerId}`;
  return search ? `${basePath}?${search}` : basePath;
}

function getAnalyticsRoute(basePath: string, searchQuery?: string, seriesConfigKey?: string | null) {
  const query = new URLSearchParams();
  const trimmedQuery = searchQuery?.trim();
  const trimmedSeries = seriesConfigKey?.trim();

  if (trimmedQuery) {
    query.set("q", trimmedQuery);
  }
  if (trimmedSeries) {
    query.set("series", trimmedSeries);
  }

  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function getAnalyticsSearchRoute(searchQuery?: string, seriesConfigKey?: string | null) {
  return getAnalyticsRoute("/analytics", searchQuery, seriesConfigKey);
}

export function getAnalyticsWorkspaceRoute(searchQuery?: string, seriesConfigKey?: string | null) {
  return getAnalyticsRoute("/analytics/workspace", searchQuery, seriesConfigKey);
}

export async function searchCricketPlayers(
  query: string,
  options?: {
    seriesConfigKey?: string | null;
    signal?: AbortSignal;
  }
) {
  const url = new URL(getCricketApiUrl(getPlayerSearchApiPath(options?.seriesConfigKey)), window.location.origin);
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    let message = `Search request failed with status ${response.status}.`;

    try {
      const payload = await response.json();
      if (typeof payload?.error === "string" && payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep the fallback message when the response body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as CricketPlayerSearchResponse;
}

export async function fetchCricketDashboardSummary(signal?: AbortSignal) {
  const url = new URL(getCricketApiUrl("/api/dashboard/summary"), window.location.origin);
  const response = await fetch(url.toString(), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    let message = `Dashboard summary request failed with status ${response.status}.`;

    try {
      const payload = await response.json();
      if (typeof payload?.error === "string" && payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep the fallback message when the response body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as CricketDashboardSummaryResponse;
}

export async function fetchCricketPlayerReport(
  result: CricketPlayerTarget,
  options?: {
    seriesConfigKey?: string | null;
    signal?: AbortSignal;
  }
) {
  const url = new URL(getCricketPlayerReportApiUrl(result, { seriesConfigKey: options?.seriesConfigKey }), window.location.origin);
  const response = await fetch(url.toString(), {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    let message = `Report request failed with status ${response.status}.`;

    try {
      const payload = await response.json();
      if (typeof payload?.error === "string" && payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep the fallback message when the response body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as CricketPlayerReportResponse;
}

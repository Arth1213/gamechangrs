import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  CricketDashboardSummaryResponse,
  CricketPlayerSearchResponse,
  CricketPlayerReportRouteState,
  CricketPlayerSearchResult,
  CricketSeriesOverviewResponse,
  CricketSeriesCard,
  CricketViewerSeriesResponse,
  createCricketSeriesAccessRequest,
  createCricketSeriesAdminAccessRequest,
  fetchCricketDashboardSummary,
  fetchCricketSeriesOverview,
  fetchCricketViewerSeries,
  getAnalyticsAdminRoute,
  getAnalyticsPlatformAdminRoute,
  getRootCricketPlayerIntelligenceRoute,
  getAnalyticsSeriesAdminRoute,
  getAnalyticsWorkspaceRoute,
  getRootCricketPlayerReportRoute,
  searchCricketPlayers,
} from "@/lib/cricketApi";

type SearchStatus = "idle" | "searching" | "success" | "empty" | "error";
type SummaryStatus = "loading" | "success" | "error";
type ViewerStatus = "loading" | "success" | "error";
type SeriesDetailStatus = "idle" | "loading" | "success" | "error";
type AnalyticsView = "landing" | "workspace";
type SeriesRequestKind = "viewer" | "admin";

type CombinedCricketPlayerSearchResult = {
  playerId: number;
  displayName: string;
  canonicalName: string;
  teamNames: string[];
  divisionLabels: string[];
  roleLabels: string[];
  primaryResult: CricketPlayerSearchResult;
  combinedRecordCount: number;
};

type SeriesWorkspaceCard = {
  configKey: string;
  seriesName: string;
  targetAgeGroup: string | null;
  isActive: boolean;
  playerCount: number | null;
  totalMatches: number | null;
  computedMatches: number | null;
  divisionLabels: string[];
  warningMatches: number | null;
  pendingOps: number | null;
  adminOverrides: number | null;
  freshnessLabel: string | null;
  freshnessTone: string | null;
  freshnessNote: string | null;
  latestMatchTitle: string | null;
  latestMatchMeta: string | null;
};

type RequestableSeriesEntry = SeriesWorkspaceCard & {
  availableRequestKinds: SeriesRequestKind[];
  currentAccessLabel: string;
  currentAccessTone: "none" | "viewer" | "admin";
};

const EXAMPLE_SEARCHES = ["Shreyak Porecha", "Nikhil Natarajan"];
const LANDING_HERO_STRIP = [
  {
    label: "First Use Case",
    value: "Bay Area U15",
    description: "First proof point. Not the platform limit.",
  },
  {
    label: "Core Edge",
    value: "Ball-by-\nBall",
    description: "Pressure, control, matchup, and phase context.",
    valueClassName:
      "max-w-[7.1ch] whitespace-pre-line text-[1.24rem] leading-[0.96] tracking-tight md:text-[1.34rem] xl:text-[1.44rem]",
  },
  {
    label: "Decision Lens",
    value: "Opponent-Adjusted",
    description: "Strong opposition counts more.",
  },
  {
    label: "Connector Direction",
    value: "CricClubs First",
    description: "Built to extend later to ESPNcricinfo and Cricbuzz.",
  },
];
const LANDING_OUTCOMES = [
  {
    step: "01",
    title: "Trusted Player Intelligence",
    description: "Every key match, innings, and ball becomes structured, reusable data.",
  },
  {
    step: "02",
    title: "Fairer Evaluation",
    description: "Players are judged by opposition quality, phase, matchup, and match impact, not just totals.",
  },
  {
    step: "03",
    title: "Coach-Ready Reporting",
    description: "Search a player and get the full story in one decision-ready view.",
  },
];
const LANDING_FLOW = [
  {
    stage: "Stage 1",
    title: "Discover",
    description: "Find divisions, matches, scorecards, commentary, teams, and players.",
  },
  {
    stage: "Stage 2",
    title: "Validate",
    description: "Parse and reconcile before analytics are trusted.",
  },
  {
    stage: "Stage 3",
    title: "Interpret",
    description: "Compute matchup, opponent-adjusted, form, and consistency metrics.",
  },
  {
    stage: "Stage 4",
    title: "Decide",
    description: "Publish private dashboards and reports that explain the rating.",
  },
];
const LANDING_FOOTER_TAGS = [
  "Structured Data",
  "Opponent Context",
  "Peer Comparison",
  "Development Trends",
  "Private Reports",
  "Multi-Source Connectors",
];

function formatNumber(value: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

function getFreshnessBadgeClass(tone?: string) {
  if (tone === "good") {
    return "border-emerald-500/25 bg-emerald-500/12 text-emerald-700";
  }

  if (tone === "risk") {
    return "border-destructive/25 bg-destructive/10 text-destructive";
  }

  return "border-amber-500/25 bg-amber-500/12 text-amber-700";
}

function getAnalyticsProfileTone(role: "platform" | "series-admin" | "series-user") {
  if (role === "platform") {
    return {
      border: "border-cyan-400/25",
      panel: "bg-cyan-400/10",
      badge: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
      icon: "text-cyan-200",
    };
  }

  if (role === "series-admin") {
    return {
      border: "border-emerald-500/25",
      panel: "bg-emerald-500/10",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      icon: "text-emerald-300",
    };
  }

  return {
    border: "border-border/80",
    panel: "bg-background/40",
    badge: "border-border/80 bg-background/40 text-foreground",
    icon: "text-primary",
  };
}

function getRequestAccessBadgeClass(tone: RequestableSeriesEntry["currentAccessTone"]) {
  if (tone === "admin") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (tone === "viewer") {
    return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }

  return "border-border/80 bg-background/60 text-muted-foreground";
}

function getSeriesRequestKindLabel(kind: SeriesRequestKind) {
  return kind === "admin" ? "Series Admin" : "Series User";
}

function getScoreSortValue(value: number | null | undefined) {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function collectUniqueLabels(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function prioritizeLabel(values: string[], preferred?: string | null) {
  const normalizedPreferred = preferred?.trim();
  if (!normalizedPreferred || !values.includes(normalizedPreferred)) {
    return values;
  }

  return [normalizedPreferred, ...values.filter((value) => value !== normalizedPreferred)];
}

function joinCoverageLabels(values: string[], fallback = "-") {
  return values.length ? values.join(" · ") : fallback;
}

function getSeriesPreferenceStorageKey(userId?: string | null) {
  const normalizedUserId = userId?.trim();
  return normalizedUserId ? `gc.analytics.preferredSeries.${normalizedUserId}` : "gc.analytics.preferredSeries";
}

function summarizeSeriesFreshness(
  totalMatches: number | null,
  computedMatches: number | null,
  warningMatches: number | null,
  pendingOps: number | null
) {
  if ((pendingOps ?? 0) > 0) {
    return {
      label: "Pending Ops",
      tone: "watch",
      note: `${formatNumber(pendingOps)} tracked match operations still need refresh or recompute work.`,
    };
  }

  if ((warningMatches ?? 0) > 0) {
    return {
      label: "Review Warnings",
      tone: "watch",
      note: `${formatNumber(warningMatches)} computed matches are still flagged for reconciliation review.`,
    };
  }

  if ((totalMatches ?? 0) === 0) {
    return {
      label: "No Match Data",
      tone: "risk",
      note: "This series has not loaded any tracked matches yet.",
    };
  }

  if ((computedMatches ?? 0) < (totalMatches ?? 0)) {
    return {
      label: "Compute Pending",
      tone: "watch",
      note: `${formatNumber(computedMatches)} of ${formatNumber(totalMatches)} tracked matches have completed analytics.`,
    };
  }

  return {
    label: "Live and Computed",
    tone: "good",
    note: `${formatNumber(totalMatches)} tracked matches are available in the live analytics workspace.`,
  };
}

function mergeSeriesCardWithOverview(
  card: SeriesWorkspaceCard,
  overview: CricketSeriesOverviewResponse | null
): SeriesWorkspaceCard {
  if (!overview) {
    return card;
  }

  const totalMatches = overview.qualitySummary?.totalMatches ?? card.totalMatches;
  const computedMatches = overview.qualitySummary?.computedMatches ?? card.computedMatches;
  const warningMatches = overview.qualitySummary?.warningMatches ?? card.warningMatches;
  const pendingOps = overview.qualitySummary?.pendingOps ?? card.pendingOps;
  const adminOverrides = overview.qualitySummary?.adminOverrides ?? card.adminOverrides;
  const divisionLabels = collectUniqueLabels([
    ...(overview.leaderboard ?? []).map((row) => row.divisionLabel),
    ...(overview.recentMatches ?? []).map((row) => row.divisionLabel),
  ]);
  const latestMatch = overview.recentMatches?.[0];
  const freshness = summarizeSeriesFreshness(totalMatches, computedMatches, warningMatches, pendingOps);

  return {
    ...card,
    seriesName: overview.series?.name?.trim() || card.seriesName,
    targetAgeGroup: overview.series?.targetAgeGroup?.trim() || card.targetAgeGroup,
    totalMatches,
    computedMatches,
    warningMatches,
    pendingOps,
    adminOverrides,
    divisionLabels: divisionLabels.length > 0 ? divisionLabels : card.divisionLabels,
    freshnessLabel: freshness.label,
    freshnessTone: freshness.tone,
    freshnessNote: freshness.note,
    latestMatchTitle: latestMatch?.matchTitle?.trim() || card.latestMatchTitle,
    latestMatchMeta:
      joinCoverageLabels(
        [latestMatch?.matchDateLabel?.trim(), latestMatch?.divisionLabel?.trim()].filter(
          (value): value is string => Boolean(value)
        ),
        ""
      ) || card.latestMatchMeta,
  };
}

function buildAnalyticsSearchParams(searchQuery?: string, seriesConfigKey?: string | null) {
  const params = new URLSearchParams();
  const trimmedQuery = searchQuery?.trim();
  const trimmedSeries = seriesConfigKey?.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  if (trimmedSeries) {
    params.set("series", trimmedSeries);
  }

  return params;
}

function normalizeSeriesCards(summary: CricketDashboardSummaryResponse | null): SeriesWorkspaceCard[] {
  if (!summary) {
    return [];
  }

  const activeConfigKey = summary.series?.configKey?.trim() || "";
  const baseCards: CricketSeriesCard[] =
    summary.seriesCards && summary.seriesCards.length > 0
      ? summary.seriesCards
      : summary.series?.configKey
        ? [
            {
              configKey: summary.series.configKey,
              seriesName: summary.series.name,
              targetAgeGroup: summary.series.targetAgeGroup,
              isActive: true,
              playerCount: summary.coverage?.playerCount ?? null,
              matchCount: summary.coverage?.totalMatches ?? null,
              computedMatches: summary.coverage?.computedMatches ?? null,
            },
          ]
        : [];

  return baseCards
    .map((card) => {
      const configKey = card.configKey?.trim() || "";
      const isDetailedCard = Boolean(activeConfigKey && configKey === activeConfigKey);
      const latestMatchMeta = isDetailedCard
        ? [summary.latestMatch?.matchDateLabel, summary.latestMatch?.divisionLabel].filter(Boolean).join(" · ") || null
        : null;

      if (!configKey) {
        return null;
      }

      return {
        configKey,
        seriesName: card.seriesName?.trim() || configKey,
        targetAgeGroup: card.targetAgeGroup?.trim() || null,
        isActive: card.isActive === true || configKey === activeConfigKey,
        playerCount: card.playerCount ?? (isDetailedCard ? summary.coverage?.playerCount ?? null : null),
        totalMatches: card.matchCount ?? (isDetailedCard ? summary.coverage?.totalMatches ?? null : null),
        computedMatches: card.computedMatches ?? (isDetailedCard ? summary.coverage?.computedMatches ?? null : null),
        divisionLabels: isDetailedCard ? summary.coverage?.divisionLabels ?? [] : [],
        warningMatches: isDetailedCard ? summary.coverage?.warningMatches ?? null : null,
        pendingOps: isDetailedCard ? summary.coverage?.pendingOps ?? null : null,
        adminOverrides: isDetailedCard ? summary.coverage?.adminOverrides ?? null : null,
        freshnessLabel: isDetailedCard ? summary.freshness?.label ?? null : null,
        freshnessTone: isDetailedCard ? summary.freshness?.tone ?? null : null,
        freshnessNote: isDetailedCard ? summary.freshness?.note ?? null : null,
        latestMatchTitle: isDetailedCard ? summary.latestMatch?.matchTitle ?? null : null,
        latestMatchMeta,
      } satisfies SeriesWorkspaceCard;
    })
    .filter((card): card is SeriesWorkspaceCard => Boolean(card))
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.seriesName.localeCompare(right.seriesName));
}

function normalizeViewerSeriesCards(summary: CricketViewerSeriesResponse | null): SeriesWorkspaceCard[] {
  return (summary?.series ?? [])
    .map((card) => {
      const configKey = card.configKey?.trim() || "";
      if (!configKey) {
        return null;
      }

      return {
        configKey,
        seriesName: card.seriesName?.trim() || configKey,
        targetAgeGroup: card.targetAgeGroup?.trim() || null,
        isActive: card.isActive === true,
        playerCount: card.playerCount ?? null,
        totalMatches: card.matchCount ?? null,
        computedMatches: card.computedMatches ?? null,
        divisionLabels: [],
        warningMatches: card.warningMatches ?? null,
        pendingOps: null,
        adminOverrides: null,
        freshnessLabel: null,
        freshnessTone: null,
        freshnessNote: null,
        latestMatchTitle: null,
        latestMatchMeta: null,
      } satisfies SeriesWorkspaceCard;
    })
    .filter((card): card is SeriesWorkspaceCard => Boolean(card))
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.seriesName.localeCompare(right.seriesName));
}

function buildRequestableSeriesEntries(
  summary: CricketDashboardSummaryResponse | null,
  viewerCatalog: CricketViewerSeriesResponse | null
): RequestableSeriesEntry[] {
  if (viewerCatalog?.actor?.isPlatformAdmin === true) {
    return [];
  }

  const seriesCards = normalizeSeriesCards(summary);
  const accessibleSeries = new Map(
    (viewerCatalog?.series ?? [])
      .map((series) => {
        const configKey = series.configKey?.trim() || "";
        return configKey ? [configKey, series] as const : null;
      })
      .filter((entry): entry is readonly [string, NonNullable<CricketViewerSeriesResponse["series"]>[number]] => Boolean(entry))
  );

  return seriesCards
    .map((card) => {
      const accessRow = accessibleSeries.get(card.configKey);
      const hasAdminAccess = accessRow?.canManage === true;
      const hasViewerAccess = hasAdminAccess || Boolean(accessRow);
      const availableRequestKinds: SeriesRequestKind[] = [];

      if (!hasViewerAccess) {
        availableRequestKinds.push("viewer");
      }

      if (!hasAdminAccess) {
        availableRequestKinds.push("admin");
      }

      if (availableRequestKinds.length === 0) {
        return null;
      }

      return {
        ...card,
        availableRequestKinds,
        currentAccessLabel: hasAdminAccess
          ? "Series admin active"
          : hasViewerAccess
            ? "Series user active"
            : "No current access",
        currentAccessTone: hasAdminAccess ? "admin" : hasViewerAccess ? "viewer" : "none",
      } satisfies RequestableSeriesEntry;
    })
    .filter((entry): entry is RequestableSeriesEntry => Boolean(entry))
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.seriesName.localeCompare(right.seriesName));
}

function combineSearchResults(results: CricketPlayerSearchResult[]): CombinedCricketPlayerSearchResult[] {
  const grouped = new Map<number, CombinedCricketPlayerSearchResult>();

  for (const result of results) {
    const existing = grouped.get(result.playerId);

    if (!existing) {
      grouped.set(result.playerId, {
        playerId: result.playerId,
        displayName: result.displayName,
        canonicalName: result.canonicalName,
        teamNames: collectUniqueLabels([result.teamName]),
        divisionLabels: collectUniqueLabels([result.divisionLabel]),
        roleLabels: collectUniqueLabels([result.roleLabel]),
        primaryResult: result,
        combinedRecordCount: 1,
      });
      continue;
    }

    existing.teamNames = collectUniqueLabels([...existing.teamNames, result.teamName]);
    existing.divisionLabels = collectUniqueLabels([...existing.divisionLabels, result.divisionLabel]);
    existing.roleLabels = collectUniqueLabels([...existing.roleLabels, result.roleLabel]);
    existing.combinedRecordCount += 1;

    if (getScoreSortValue(result.compositeScore) > getScoreSortValue(existing.primaryResult.compositeScore)) {
      existing.primaryResult = result;
    }
  }

  return Array.from(grouped.values())
    .map((result) => ({
      ...result,
      teamNames: prioritizeLabel(result.teamNames, result.primaryResult.teamName),
      divisionLabels: prioritizeLabel(result.divisionLabels, result.primaryResult.divisionLabel),
      roleLabels: prioritizeLabel(result.roleLabels, result.primaryResult.roleLabel),
    }))
    .sort((left, right) => {
      const scoreDelta =
        getScoreSortValue(right.primaryResult.compositeScore) - getScoreSortValue(left.primaryResult.compositeScore);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.displayName.localeCompare(right.displayName);
    });
}

function SearchResultCard({
  result,
  searchQuery,
  seriesConfigKey,
  seriesName,
}: {
  result: CombinedCricketPlayerSearchResult;
  searchQuery: string;
  seriesConfigKey?: string | null;
  seriesName?: string | null;
}) {
  const combinedReportTarget = {
    playerId: result.playerId,
    divisionId: null,
  };
  const inAppReportUrl = getRootCricketPlayerReportRoute(combinedReportTarget, { searchQuery, seriesConfigKey });
  const intelligenceReportUrl = getRootCricketPlayerIntelligenceRoute(combinedReportTarget, { searchQuery, seriesConfigKey });
  const teamCoverage = joinCoverageLabels(result.teamNames, "Team not available");
  const divisionCoverage = joinCoverageLabels(result.divisionLabels);
  const roleCoverage = joinCoverageLabels(result.roleLabels, "Player");
  const routeState: CricketPlayerReportRouteState = {
    displayName: result.displayName,
    teamName: teamCoverage,
    divisionLabel: divisionCoverage !== "-" ? divisionCoverage : undefined,
    roleLabel: roleCoverage,
    searchQuery,
    seriesConfigKey: seriesConfigKey || undefined,
    seriesName: seriesName || undefined,
  };

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <CardTitle className="font-display text-2xl text-foreground">{result.displayName}</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {teamCoverage}
              {result.combinedRecordCount > 1 ? ` · ${result.combinedRecordCount} phase/division records combined` : ""}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{result.primaryResult.roleLabel || "Player"}</Badge>
            {result.roleLabels.length > 1 ? (
              <Badge variant="outline">{result.roleLabels.length} roles covered</Badge>
            ) : null}
            {result.primaryResult.confidenceLabel ? (
              <Badge variant="outline">{result.primaryResult.confidenceLabel} confidence</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 md:w-auto">
          <Button asChild className="w-full md:w-auto">
            <Link to={inAppReportUrl} state={routeState}>
              Executive Report
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full md:w-auto">
            <Link to={intelligenceReportUrl} state={routeState}>
              Player Intelligence
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
            Team · {teamCoverage}
          </Badge>
          <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
            Coverage · {divisionCoverage}
          </Badge>
          <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
            Roles · {roleCoverage}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Top Composite</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatNumber(result.primaryResult.compositeScore)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Best Percentile</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatNumber(result.primaryResult.percentileRank)}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/60 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Best Confidence</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.primaryResult.confidenceScore !== null && result.primaryResult.confidenceScore !== undefined
                ? formatNumber(result.primaryResult.confidenceScore)
                : result.primaryResult.confidenceLabel || "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SeriesPlayerSearchPanelProps = {
  selectedSeries: SeriesWorkspaceCard;
  query: string;
  setQuery: (value: string) => void;
  status: SearchStatus;
  lastQuery: string;
  errorMessage: string | null;
  combinedResults: CombinedCricketPlayerSearchResult[];
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onExampleSearch: (value: string) => void;
  onRetrySearch: () => void;
};

function SeriesPlayerSearchPanel({
  selectedSeries,
  query,
  setQuery,
  status,
  lastQuery,
  errorMessage,
  combinedResults,
  onSearch,
  onExampleSearch,
  onRetrySearch,
}: SeriesPlayerSearchPanelProps) {
  return (
    <div className="rounded-[28px] border border-border/80 bg-background/45 p-5">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/12 text-primary">
              Player Search
            </Badge>
            <h4 className="font-display text-2xl text-foreground md:text-3xl">
              Search within {selectedSeries.seriesName}
            </h4>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_SEARCHES.map((name) => (
              <Button key={name} type="button" variant="outline" size="sm" onClick={() => onExampleSearch(name)}>
                {name}
              </Button>
            ))}
          </div>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSearch}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${selectedSeries.seriesName} players`}
            className="h-12 border-border/80 bg-background/60 text-base"
          />
          <Button type="submit" size="lg" disabled={status === "searching"} className="sm:min-w-40">
            {status === "searching" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </form>

        {status === "searching" ? (
          <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/50 p-5 text-sm text-muted-foreground">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <p>
              Searching <span className="font-semibold text-foreground">{selectedSeries.seriesName}</span> for{" "}
              <span className="font-semibold text-foreground">{lastQuery || query.trim()}</span>.
            </p>
          </div>
        ) : null}

        {status === "error" && errorMessage ? (
          <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p>{errorMessage}</p>
                {lastQuery ? (
                  <p className="text-destructive/80">
                    Search: <span className="font-semibold">{lastQuery}</span>
                  </p>
                ) : null}
              </div>
            </div>
            {lastQuery.length >= 3 ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetrySearch}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Search
              </Button>
            ) : null}
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="rounded-xl border border-border/80 bg-background/50 p-6 text-sm text-muted-foreground">
            No live player matches were found for <span className="font-semibold text-foreground">{lastQuery}</span>.
          </div>
        ) : null}

        {status === "success" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 p-4">
              <p className="font-semibold text-foreground">
                {combinedResults.length} player{combinedResults.length === 1 ? "" : "s"} found
              </p>
              <p className="text-sm text-muted-foreground">
                Search: <span className="font-semibold text-foreground">{lastQuery}</span>
              </p>
            </div>

            <div className="space-y-4">
              {combinedResults.map((result) => (
                <SearchResultCard
                  key={result.playerId}
                  result={result}
                  searchQuery={lastQuery}
                  seriesConfigKey={selectedSeries.configKey}
                  seriesName={selectedSeries.seriesName}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type SeriesWorkspaceOverviewProps = {
  summaryStatus: SummaryStatus;
  summaryError: string | null;
  onRetrySummary: () => void;
  seriesCards: SeriesWorkspaceCard[];
  selectedSeriesKey: string;
  onSelectSeries: (seriesConfigKey: string) => void;
  query: string;
  setQuery: (value: string) => void;
  status: SearchStatus;
  lastQuery: string;
  errorMessage: string | null;
  combinedResults: CombinedCricketPlayerSearchResult[];
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onExampleSearch: (value: string) => void;
  onRetrySearch: () => void;
};

function SeriesWorkspaceOverview({
  summaryStatus,
  summaryError,
  onRetrySummary,
  seriesCards,
  selectedSeriesKey,
  onSelectSeries,
  query,
  setQuery,
  status,
  lastQuery,
  errorMessage,
  combinedResults,
  onSearch,
  onExampleSearch,
  onRetrySearch,
}: SeriesWorkspaceOverviewProps) {
  const hasSeriesCards = seriesCards.length > 0;

  if (summaryStatus === "loading" && !hasSeriesCards) {
    return (
      <Card className="border-border/80 bg-card/85 shadow-xl">
        <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          <p>Loading live series coverage.</p>
        </CardContent>
      </Card>
    );
  }

  if (summaryStatus === "error" && summaryError && !hasSeriesCards) {
    return (
      <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
        <CardContent className="flex flex-col gap-4 p-6 text-sm text-destructive sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>Live series coverage could not be loaded.</p>
              <p className="text-destructive/80">{summaryError}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRetrySummary}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Summary
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (seriesCards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {summaryStatus === "loading" ? (
        <Card className="border-border/80 bg-card/75 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <p>Refreshing live series coverage.</p>
          </CardContent>
        </Card>
      ) : null}

      {summaryStatus === "error" && summaryError ? (
        <Card className="border-amber-500/30 bg-amber-500/10 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 text-sm text-amber-200 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>Series detail refresh failed.</p>
              <p className="text-amber-100/80">{summaryError}</p>
            </div>
          </div>
            <Button type="button" variant="outline" size="sm" onClick={onRetrySummary}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Summary
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {seriesCards.map((seriesCard) => {
        const isSelected = seriesCard.configKey === selectedSeriesKey;

        return (
          <div
            key={seriesCard.configKey}
            className={`rounded-[32px] p-[1px] shadow-xl ${
              isSelected
                ? "bg-gradient-to-br from-primary/40 via-sky-400/25 to-emerald-400/25"
                : "bg-gradient-to-br from-border/90 via-sky-400/10 to-primary/10"
            }`}
          >
            <div
              className={`rounded-[31px] px-6 py-6 ${
                isSelected
                  ? "bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_24%),rgba(15,23,42,0.92)]"
                  : "bg-card/90"
              }`}
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={
                        isSelected
                          ? "border-primary/30 bg-primary/12 text-primary"
                          : "border-border/80 bg-background/50 text-muted-foreground"
                      }
                    >
                      {seriesCard.isActive ? "Active series" : "Series workspace"}
                    </Badge>
                    {isSelected ? (
                      <Badge variant="outline" className="border-sky-400/30 bg-sky-400/12 text-sky-300">
                        Selected
                      </Badge>
                    ) : null}
                    {seriesCard.freshnessLabel ? (
                      <Badge variant="outline" className={getFreshnessBadgeClass(seriesCard.freshnessTone || undefined)}>
                        {seriesCard.freshnessLabel}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-display text-3xl text-foreground">{seriesCard.seriesName}</h3>
                  </div>
                </div>

                {!isSelected ? (
                  <Button type="button" variant="outline" onClick={() => onSelectSeries(seriesCard.configKey)}>
                    Use This Series
                  </Button>
                ) : null}
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.22em]">Players</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{formatNumber(seriesCard.playerCount)}</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.22em]">Tracked Matches</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{formatNumber(seriesCard.totalMatches)}</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.22em]">Computed</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{formatNumber(seriesCard.computedMatches)}</p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers3 className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.22em]">Divisions</p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatNumber(seriesCard.divisionLabels.length || null)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-2xl border border-border/80 bg-background/50 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Coverage Boundary</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {seriesCard.divisionLabels.length > 0 ? (
                      seriesCard.divisionLabels.map((label) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                        Division coverage will appear here when live series detail is available.
                      </Badge>
                    )}
                    {(seriesCard.warningMatches ?? 0) > 0 ? (
                      <Badge variant="outline">{formatNumber(seriesCard.warningMatches ?? null)} warnings</Badge>
                    ) : null}
                    {(seriesCard.pendingOps ?? 0) > 0 ? (
                      <Badge variant="outline">{formatNumber(seriesCard.pendingOps ?? null)} pending ops</Badge>
                    ) : null}
                    {(seriesCard.adminOverrides ?? 0) > 0 ? (
                      <Badge variant="outline">{formatNumber(seriesCard.adminOverrides ?? null)} admin overrides</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/80 bg-background/50 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Latest Tracked Match</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-lg font-semibold text-foreground">
                      {seriesCard.latestMatchTitle || "Live match detail unavailable"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {seriesCard.latestMatchMeta || "Series is connected and ready for selector search."}
                    </p>
                  </div>
                </div>
              </div>

              {isSelected ? (
                <div className="mt-6">
                  <SeriesPlayerSearchPanel
                    selectedSeries={seriesCard}
                    query={query}
                    setQuery={setQuery}
                    status={status}
                    lastQuery={lastQuery}
                    errorMessage={errorMessage}
                    combinedResults={combinedResults}
                    onSearch={onSearch}
                    onExampleSearch={onExampleSearch}
                    onRetrySearch={onRetrySearch}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsSeriesPortfolio({
  seriesCards,
  preferredSeriesKey,
}: {
  seriesCards: SeriesWorkspaceCard[];
  preferredSeriesKey?: string | null;
}) {
  if (seriesCards.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/80 bg-card/85 shadow-xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Series Portfolio
          </Badge>
          <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
            {seriesCards.length} accessible
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="font-display text-2xl text-foreground">Choose a series workspace</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-7">
            Each series keeps its own workspace, search boundary, and report routes.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        {seriesCards.map((seriesCard) => {
          const isPreferred = preferredSeriesKey?.trim() === seriesCard.configKey;

          return (
            <div key={seriesCard.configKey} className="rounded-2xl border border-border/80 bg-background/45 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {seriesCard.isActive ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/12 text-primary">
                        Active series
                      </Badge>
                    ) : null}
                    {isPreferred ? (
                      <Badge variant="outline" className="border-sky-400/30 bg-sky-400/12 text-sky-300">
                        Preferred
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="font-display text-2xl text-foreground">{seriesCard.seriesName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {seriesCard.targetAgeGroup || "Series workspace"}
                  </p>
                </div>

                <Button asChild variant="outline">
                  <Link to={getAnalyticsWorkspaceRoute(undefined, seriesCard.configKey)}>
                    Open Workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Players</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(seriesCard.playerCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Matches</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(seriesCard.totalMatches)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Computed</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(seriesCard.computedMatches)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SeriesAccessRequestPanel({
  entries,
  preferredSeriesKey,
  accessToken,
  onAccessActivated,
}: {
  entries: RequestableSeriesEntry[];
  preferredSeriesKey?: string;
  accessToken: string;
  onAccessActivated?: (seriesConfigKey: string, requestKind: SeriesRequestKind) => void;
}) {
  const { toast } = useToast();
  const [requestSeriesKey, setRequestSeriesKey] = useState(preferredSeriesKey?.trim() || entries[0]?.configKey || "");
  const [requestKind, setRequestKind] = useState<SeriesRequestKind>(() => {
    const normalizedPreferred = preferredSeriesKey?.trim() || "";
    return (
      entries.find((entry) => entry.configKey === normalizedPreferred)?.availableRequestKinds[0]
      || entries[0]?.availableRequestKinds[0]
      || "viewer"
    );
  });
  const [requestStatus, setRequestStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    const validSeriesKeys = new Set(entries.map((entry) => entry.configKey));
    const normalizedPreferred = preferredSeriesKey?.trim() || "";
    const nextSeriesKey =
      (normalizedPreferred && validSeriesKeys.has(normalizedPreferred) ? normalizedPreferred : "")
      || (validSeriesKeys.has(requestSeriesKey) ? requestSeriesKey : "")
      || entries[0]?.configKey
      || "";

    if (nextSeriesKey !== requestSeriesKey) {
      setRequestSeriesKey(nextSeriesKey);
    }
  }, [entries, preferredSeriesKey, requestSeriesKey]);

  const selectedSeries = entries.find((entry) => entry.configKey === requestSeriesKey) || null;
  const selectedSeriesSummary = joinCoverageLabels(
    [
      selectedSeries?.targetAgeGroup || null,
      ...(selectedSeries?.divisionLabels ?? []),
    ].filter((value): value is string => Boolean(value)),
    "Series"
  );

  useEffect(() => {
    const nextRequestKind =
      selectedSeries?.availableRequestKinds.includes(requestKind)
        ? requestKind
        : selectedSeries?.availableRequestKinds[0] || "viewer";

    if (nextRequestKind !== requestKind) {
      setRequestKind(nextRequestKind);
    }
  }, [requestKind, selectedSeries]);

  async function handleSubmitRequest() {
    if (!accessToken) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "Your session is missing. Sign in again before requesting access.",
      });
      return;
    }

    if (!requestSeriesKey) {
      toast({
        variant: "destructive",
        title: "Select a series",
        description: "Choose the series you want to request access to first.",
      });
      return;
    }

    setRequestStatus("saving");

    try {
      if (requestKind === "admin") {
        const result = await createCricketSeriesAdminAccessRequest(requestSeriesKey, accessToken, {
          requestNote: "User requested series-admin access from the analytics access panel.",
        });

        toast({
          title: result.accessGranted ? "Series-admin access active" : "Series-admin request submitted",
          description:
            result.message
            || (result.accessGranted
              ? "Series-admin access is already active for this account."
              : "The current series-admin team must approve this request before access is granted."),
        });

        if (result.accessGranted) {
          onAccessActivated?.(requestSeriesKey, "admin");
        }
      } else {
        const result = await createCricketSeriesAccessRequest(requestSeriesKey, accessToken, {
          accessRole: "viewer",
          requestNote: "User requested series-user access from the analytics access panel.",
        });

        toast({
          title: result.accessGranted ? "Series-user access active" : "Series-user request submitted",
          description:
            result.message
            || (result.accessGranted
              ? "Series-user access is already active for this account."
              : "The current series admin must approve this request before reports unlock."),
        });

        if (result.accessGranted) {
          onAccessActivated?.(requestSeriesKey, "viewer");
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Request failed",
        description: error instanceof Error ? error.message : "The access request could not be submitted right now.",
      });
    } finally {
      setRequestStatus("idle");
    }
  }

  return (
    <Card className="border-border/80 bg-card/85 shadow-xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Request Access
          </Badge>
          <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
            Approval Required
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle className="font-display text-2xl text-foreground">Request series access</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-7">
            Only missing privileges are listed. Pick a series, then request series-user or series-admin access.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Available series requests</Label>
            <p className="text-xs text-muted-foreground">
              {entries.length} requestable series for this account.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {entries.map((entry) => {
              const isSelected = entry.configKey === requestSeriesKey;

              return (
                <button
                  key={entry.configKey}
                  type="button"
                  onClick={() => setRequestSeriesKey(entry.configKey)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-primary/40 bg-primary/10 shadow-sm"
                      : "border-border/80 bg-background/60 hover:border-primary/25 hover:bg-background/80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{entry.seriesName}</p>
                      <p className="text-sm text-muted-foreground">
                        {joinCoverageLabels(
                          [entry.targetAgeGroup || null, ...(entry.divisionLabels ?? [])].filter(
                            (value): value is string => Boolean(value)
                          ),
                          "Series"
                        )}
                      </p>
                    </div>
                    {isSelected ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        Selected
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className={getRequestAccessBadgeClass(entry.currentAccessTone)}>
                      {entry.currentAccessLabel}
                    </Badge>
                    {entry.availableRequestKinds.map((kind) => (
                      <Badge
                        key={`${entry.configKey}-${kind}`}
                        variant="outline"
                        className="border-border/80 bg-background/60 text-foreground"
                      >
                        {getSeriesRequestKindLabel(kind)} request
                      </Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="series-access-request-kind">Access type</Label>
            <Select value={requestKind} onValueChange={(value) => setRequestKind(value as SeriesRequestKind)}>
              <SelectTrigger id="series-access-request-kind">
                <SelectValue placeholder="Select access type" />
              </SelectTrigger>
              <SelectContent>
                {(selectedSeries?.availableRequestKinds ?? []).map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {getSeriesRequestKindLabel(kind)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Selected request</p>
          <p className="mt-2 font-semibold text-foreground">
            {selectedSeries?.seriesName || "No series selected"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedSeriesSummary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSeries ? (
              <Badge variant="outline" className={getRequestAccessBadgeClass(selectedSeries.currentAccessTone)}>
                {selectedSeries.currentAccessLabel}
              </Badge>
            ) : null}
            {selectedSeries ? (
              <Badge variant="outline" className="border-border/80 bg-background/70 text-foreground">
                Requesting {getSeriesRequestKindLabel(requestKind)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {requestKind === "admin"
              ? "Series-admin approval is handled by the owning entity."
              : "Series-user approval unlocks reports for the selected series."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void handleSubmitRequest()} disabled={requestStatus === "saving" || !requestSeriesKey}>
            {requestStatus === "saving"
              ? "Submitting request..."
              : requestKind === "admin"
                ? "Request series admin access"
                : "Request series user access"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsLandingSections() {
  return (
    <>
      <Card className="border-border/80 bg-card/85 shadow-xl">
        <CardContent className="space-y-8 p-8 lg:p-10">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-primary">What This App Really Is</p>
            <h1 className="max-w-6xl font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl lg:text-6xl">
              From raw cricket site data to{" "}
              <span className="text-primary">trusted analytics intelligence</span>, starting with{" "}
              <span className="text-sky-400">CricClubs</span>.
            </h1>
            <p className="max-w-4xl text-lg leading-8 text-muted-foreground">
              A private decision-support app that turns raw cricket data into{" "}
              <span className="font-semibold text-foreground">fairer player evaluation</span>.
            </p>
            <div className="max-w-4xl border-l-4 border-primary pl-4 text-lg leading-8 text-cyan-100/90">
              CricClubs shows <span className="font-semibold text-foreground">what happened</span>. This app shows{" "}
              <span className="font-semibold text-foreground">what matters</span>.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {LANDING_HERO_STRIP.map((item) => (
              <div
                key={item.label}
                className="flex h-full flex-col rounded-2xl border border-border/80 bg-background/40 p-4 shadow-sm backdrop-blur"
              >
                <p className="min-h-[2.2rem] text-[11px] uppercase leading-5 tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </p>
                <p
                  className={`mt-2 min-h-[3.2rem] font-display text-2xl leading-[1.02] text-primary md:min-h-[3.5rem] ${item.valueClassName ?? ""}`}
                >
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-3xl text-foreground md:text-4xl">Key Outcomes You Should Expect</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Faster understanding. Better trust. Fairer comparison.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {LANDING_OUTCOMES.map((item) => (
            <Card key={item.step} className="border-border/80 bg-card/80 shadow-sm">
              <CardContent className="space-y-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-sky-400 text-sm font-black text-slate-950">
                  {item.step}
                </div>
                <h3 className="font-display text-2xl text-foreground">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-3xl text-foreground md:text-4xl">How The App Creates Meaning</h2>
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Messy web pages in. Trusted decisions out.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {LANDING_FLOW.map((item) => (
            <Card key={item.stage} className="border-border/80 bg-card/80 shadow-sm">
              <CardContent className="space-y-3 p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-primary">{item.stage}</p>
                <h3 className="font-display text-2xl text-foreground">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-border/80 bg-gradient-to-r from-primary/15 to-sky-400/10 shadow-xl">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-3">
            <h2 className="font-display text-3xl text-foreground">The outcome you are really buying</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              A private internal system for{" "}
              <span className="font-semibold text-foreground">better, faster, fairer player judgments</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {LANDING_FOOTER_TAGS.map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="border-border/80 bg-background/40 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-foreground"
              >
                {item}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

const Analytics = ({ view = "landing" }: { view?: AnalyticsView }) => {
  const isWorkspaceView = view === "workspace";
  const { session, user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [lastQuery, setLastQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<CricketPlayerSearchResponse | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("loading");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<CricketDashboardSummaryResponse | null>(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [selectedSeriesDetailStatus, setSelectedSeriesDetailStatus] = useState<SeriesDetailStatus>("idle");
  const [selectedSeriesDetailError, setSelectedSeriesDetailError] = useState<string | null>(null);
  const [selectedSeriesOverview, setSelectedSeriesOverview] = useState<CricketSeriesOverviewResponse | null>(null);
  const [selectedSeriesDetailReloadKey, setSelectedSeriesDetailReloadKey] = useState(0);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerCatalog, setViewerCatalog] = useState<CricketViewerSeriesResponse | null>(null);
  const [viewerReloadKey, setViewerReloadKey] = useState(0);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [preferredSeriesKey, setPreferredSeriesKey] = useState("");
  const activeRequestRef = useRef<AbortController | null>(null);
  const accessToken = session?.access_token || "";
  const currentUrlQuery = searchParams.get("q")?.trim() ?? "";
  const currentUrlSeries = searchParams.get("series")?.trim() ?? "";
  const preferredSeriesStorageKey = useMemo(() => getSeriesPreferenceStorageKey(user?.id), [user?.id]);
  const accessibleFallbackCards = useMemo(() => normalizeViewerSeriesCards(viewerCatalog), [viewerCatalog]);
  const requestableSeriesEntries = useMemo(
    () => buildRequestableSeriesEntries(dashboardSummary, viewerCatalog),
    [dashboardSummary, viewerCatalog]
  );
  const seriesCards = useMemo(() => {
    const accessibleSeries = viewerCatalog?.series ?? [];
    if (!accessibleSeries.length) {
      return [];
    }

    const accessibleKeys = new Set(
      accessibleSeries
        .map((series) => series.configKey?.trim())
        .filter((value): value is string => Boolean(value))
    );
    const detailedCards = normalizeSeriesCards(dashboardSummary).filter((card) => accessibleKeys.has(card.configKey));
    return detailedCards.length > 0 ? detailedCards : accessibleFallbackCards;
  }, [accessibleFallbackCards, dashboardSummary, viewerCatalog]);
  const validPreferredSeriesKey =
    preferredSeriesKey && seriesCards.some((card) => card.configKey === preferredSeriesKey)
      ? preferredSeriesKey
      : "";
  const defaultSeriesKey =
    validPreferredSeriesKey
    || (seriesCards.length === 1 ? seriesCards[0]?.configKey || "" : "");
  const selectedSeriesKey =
    currentUrlSeries && seriesCards.some((card) => card.configKey === currentUrlSeries)
      ? currentUrlSeries
      : defaultSeriesKey;
  const workspaceSeriesCards = useMemo(() => {
    if (!selectedSeriesKey || !selectedSeriesOverview) {
      return seriesCards;
    }

    return seriesCards.map((card) =>
      card.configKey === selectedSeriesKey ? mergeSeriesCardWithOverview(card, selectedSeriesOverview) : card
    );
  }, [selectedSeriesKey, selectedSeriesOverview, seriesCards]);
  const displaySeriesCards = isWorkspaceView ? workspaceSeriesCards : seriesCards;
  const selectedSeries =
    displaySeriesCards.find((card) => card.configKey === selectedSeriesKey) || null;
  const combinedResults = payload ? combineSearchResults(payload.results) : [];
  const workspaceRoute = useMemo(
    () => getAnalyticsWorkspaceRoute(currentUrlQuery || undefined, selectedSeriesKey || undefined),
    [currentUrlQuery, selectedSeriesKey]
  );
  const platformAdminRoute = getAnalyticsPlatformAdminRoute();
  const analyticsRoute = "/analytics";
  const hasSeriesAccess = seriesCards.length > 0;
  const isPlatformAdminViewer = viewerCatalog?.actor?.isPlatformAdmin === true;
  const recommendedRequestSeriesKey =
    (currentUrlSeries && requestableSeriesEntries.some((entry) => entry.configKey === currentUrlSeries) ? currentUrlSeries : "")
    || requestableSeriesEntries.find((entry) => entry.isActive)?.configKey
    || requestableSeriesEntries[0]?.configKey
    || "";
  const seriesAdminRoute = useMemo(
    () => getAnalyticsSeriesAdminRoute(selectedSeriesKey || undefined),
    [selectedSeriesKey]
  );
  const adminRoute = useMemo(
    () => (isPlatformAdminViewer ? seriesAdminRoute : getAnalyticsAdminRoute(selectedSeriesKey || undefined)),
    [isPlatformAdminViewer, selectedSeriesKey, seriesAdminRoute]
  );
  const isAuthenticated = Boolean(user && accessToken);
  const hasMultipleSeries = seriesCards.length > 1;
  const userDisplayName =
    user?.user_metadata?.full_name?.trim()
    || user?.user_metadata?.name?.trim()
    || user?.email?.split("@")[0]
    || "User";
  const accessibleSeriesCount = viewerCatalog?.series?.length ?? 0;
  const manageableSeriesCount = viewerCatalog?.series?.filter((series) => series.canManage === true).length ?? 0;
  const analyticsProfiles = useMemo(() => {
    const profiles: Array<{
      key: "platform" | "series-admin" | "series-user";
      title: string;
      summary: string;
      href: string;
      actionLabel: string;
      meta: string;
    }> = [];

    if (isPlatformAdminViewer) {
      profiles.push({
        key: "platform",
        title: "Platform Admin",
        summary: "Global analytics access.",
        href: platformAdminRoute,
        actionLabel: "Open Platform Console",
        meta: "Full platform scope",
      });
    }

    if (isPlatformAdminViewer || manageableSeriesCount > 0) {
      profiles.push({
        key: "series-admin",
        title: "Series Admin",
        summary: "Manage series setup, access, and operations.",
        href: seriesAdminRoute,
        actionLabel: "Open Series Console",
        meta:
          manageableSeriesCount > 0
            ? `${manageableSeriesCount} admin ${manageableSeriesCount === 1 ? "series" : "series"}`
            : "Inherited from platform scope",
      });
    }

    if (hasSeriesAccess) {
      profiles.push({
        key: "series-user",
        title: "Series User",
        summary: "Search players and open reports.",
        href: workspaceRoute,
        actionLabel: "Open Series Workspace",
        meta:
          accessibleSeriesCount > 0
            ? `${accessibleSeriesCount} accessible ${accessibleSeriesCount === 1 ? "series" : "series"}`
            : "Series-user access active",
      });
    }

    return profiles;
  }, [
    accessibleSeriesCount,
    hasSeriesAccess,
    isPlatformAdminViewer,
    manageableSeriesCount,
    platformAdminRoute,
    seriesAdminRoute,
    workspaceRoute,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPreferredSeriesKey("");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      setPreferredSeriesKey(window.localStorage.getItem(preferredSeriesStorageKey)?.trim() || "");
    } catch {
      setPreferredSeriesKey("");
    }
  }, [isAuthenticated, preferredSeriesStorageKey]);

  useEffect(() => {
    if (!isAuthenticated || !preferredSeriesKey) {
      return;
    }

    if (seriesCards.some((card) => card.configKey === preferredSeriesKey)) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(preferredSeriesStorageKey);
      } catch {
        // Ignore storage cleanup failures.
      }
    }

    setPreferredSeriesKey("");
  }, [isAuthenticated, preferredSeriesKey, preferredSeriesStorageKey, seriesCards]);

  useEffect(() => {
    if (!isAuthenticated || !selectedSeriesKey) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(preferredSeriesStorageKey, selectedSeriesKey);
      } catch {
        // Ignore storage write failures.
      }
    }

    if (preferredSeriesKey !== selectedSeriesKey) {
      setPreferredSeriesKey(selectedSeriesKey);
    }
  }, [isAuthenticated, preferredSeriesKey, preferredSeriesStorageKey, selectedSeriesKey]);

  useEffect(() => {
    if (!hasSeriesAccess && !isPlatformAdminViewer) {
      setShowRequestPanel(true);
    }
  }, [hasSeriesAccess, isPlatformAdminViewer]);

  const handleAccessActivated = (seriesConfigKey: string) => {
    setViewerReloadKey((current) => current + 1);
    setSearchParams(buildAnalyticsSearchParams(currentUrlQuery || undefined, seriesConfigKey));
  };

  async function runSearch(trimmedQuery: string, seriesConfigKey: string) {
    if (!accessToken) {
      setErrorMessage("Your session expired. Sign in again before searching.");
      setStatus("error");
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setStatus("searching");
    setErrorMessage(null);
    setPayload(null);
    setLastQuery(trimmedQuery);

    try {
      const response = await searchCricketPlayers(trimmedQuery, {
        accessToken,
        seriesConfigKey,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }

      setPayload(response);
      setStatus(response.results.length > 0 ? "success" : "empty");
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message = error instanceof Error ? error.message : "Live cricket search is unavailable right now.";
      setErrorMessage(message);
      setStatus("error");
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  }

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!accessToken) {
      setViewerCatalog(null);
      if (!isAuthenticated && !isWorkspaceView) {
        setViewerStatus("success");
        setViewerError(null);
      } else {
        setViewerStatus("error");
        setViewerError("A signed-in session is required before analytics access can be checked.");
      }
      return;
    }

    const controller = new AbortController();
    setViewerStatus("loading");
    setViewerError(null);
    setViewerCatalog(null);

    fetchCricketViewerSeries(accessToken, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        setViewerCatalog(response);
        setViewerStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Viewer access could not be resolved right now.";
        setViewerCatalog(null);
        setViewerStatus("error");
        setViewerError(message);
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, isAuthenticated, isWorkspaceView, loading, viewerReloadKey]);

  useEffect(() => {
    if (!isAuthenticated && !isWorkspaceView) {
      setSummaryStatus("success");
      setSummaryError(null);
      setDashboardSummary(null);
      return;
    }

    const controller = new AbortController();

    setSummaryStatus("loading");
    setSummaryError(null);
    setDashboardSummary(null);

    fetchCricketDashboardSummary(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        setDashboardSummary(response);
        setSummaryStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Live series coverage is unavailable right now.";
        setSummaryError(message);
        setSummaryStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, isWorkspaceView, summaryReloadKey]);

  useEffect(() => {
    if (!isWorkspaceView || viewerStatus !== "success" || !hasSeriesAccess || !selectedSeriesKey) {
      setSelectedSeriesOverview(null);
      setSelectedSeriesDetailError(null);
      setSelectedSeriesDetailStatus("idle");
      return;
    }

    const controller = new AbortController();

    setSelectedSeriesDetailStatus("loading");
    setSelectedSeriesDetailError(null);
    setSelectedSeriesOverview(null);

    fetchCricketSeriesOverview(selectedSeriesKey, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        setSelectedSeriesOverview(response);
        setSelectedSeriesDetailStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Selected series detail could not be refreshed.";
        setSelectedSeriesOverview(null);
        setSelectedSeriesDetailError(message);
        setSelectedSeriesDetailStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [hasSeriesAccess, isWorkspaceView, selectedSeriesDetailReloadKey, selectedSeriesKey, viewerStatus]);

  useEffect(() => {
    if (!isWorkspaceView) {
      activeRequestRef.current?.abort();
      setPayload(null);
      setLastQuery("");
      setErrorMessage(null);
      setStatus("idle");
      setQuery("");
      return;
    }

    const trimmedQuery = currentUrlQuery.trim();
    setQuery((currentQuery) => (currentQuery === trimmedQuery ? currentQuery : trimmedQuery));

    if (!trimmedQuery) {
      activeRequestRef.current?.abort();
      setPayload(null);
      setLastQuery("");
      setErrorMessage(null);
      setStatus("idle");
      return;
    }

    if (trimmedQuery.length < 3) {
      activeRequestRef.current?.abort();
      setPayload(null);
      setLastQuery(trimmedQuery);
      setErrorMessage("Enter at least 3 characters to search the live cricket analytics dataset.");
      setStatus("error");
      return;
    }

    if (viewerStatus !== "success") {
      activeRequestRef.current?.abort();
      setPayload(null);
      setLastQuery(trimmedQuery);
      setErrorMessage(
        viewerStatus === "error"
          ? (viewerError || "Viewer access could not be resolved right now.")
          : "Checking your analytics access before running search."
      );
      setStatus(viewerStatus === "error" ? "error" : "idle");
      return;
    }

    if (!hasSeriesAccess) {
      activeRequestRef.current?.abort();
      setPayload(null);
      setLastQuery(trimmedQuery);
      setErrorMessage("You do not have series-user access to any analytics series yet.");
      setStatus("error");
      return;
    }

    if (!selectedSeriesKey) {
      activeRequestRef.current?.abort();
      setPayload(null);
      setLastQuery(trimmedQuery);
      setErrorMessage(
        summaryStatus === "error"
          ? "Live series context is unavailable right now."
          : "Waiting for the active series context before running live player search."
      );
      setStatus(summaryStatus === "error" ? "error" : "idle");
      return;
    }

    void runSearch(trimmedQuery, selectedSeriesKey);

    return () => {
      activeRequestRef.current?.abort();
    };
  }, [accessToken, currentUrlQuery, hasSeriesAccess, selectedSeriesKey, summaryStatus, viewerError, viewerStatus, isWorkspaceView]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      if (currentUrlQuery || currentUrlSeries) {
        setSearchParams(buildAnalyticsSearchParams(undefined, selectedSeriesKey));
      } else {
        setPayload(null);
        setLastQuery("");
        setErrorMessage(null);
        setStatus("idle");
      }
      return;
    }

    if (trimmedQuery.length < 3) {
      setErrorMessage("Enter at least 3 characters to search the live cricket analytics dataset.");
      setPayload(null);
      setLastQuery(trimmedQuery);
      setStatus("error");
      return;
    }

    if (trimmedQuery === currentUrlQuery) {
      if (!selectedSeriesKey) {
        setErrorMessage("Live series context is unavailable right now.");
        setStatus("error");
        return;
      }

      await runSearch(trimmedQuery, selectedSeriesKey);
      return;
    }

    setSearchParams(buildAnalyticsSearchParams(trimmedQuery, selectedSeriesKey));
  };

  const handleExampleSearch = (value: string) => {
    setQuery(value);

    if (value === currentUrlQuery) {
      if (!selectedSeriesKey) {
        setErrorMessage("Live series context is unavailable right now.");
        setStatus("error");
        return;
      }

      void runSearch(value, selectedSeriesKey);
      return;
    }

    setSearchParams(buildAnalyticsSearchParams(value, selectedSeriesKey));
  };

  const handleRetrySearch = () => {
    if (lastQuery.length >= 3 && selectedSeriesKey) {
      void runSearch(lastQuery, selectedSeriesKey);
    }
  };

  const handleRetrySummary = () => {
    setSummaryReloadKey((current) => current + 1);
  };

  const handleRetrySelectedSeriesDetail = () => {
    setSelectedSeriesDetailReloadKey((current) => current + 1);
  };

  const handleRetryViewerAccess = () => {
    setViewerReloadKey((current) => current + 1);
  };

  const handleSeriesSelection = (seriesConfigKey: string) => {
    setSearchParams(buildAnalyticsSearchParams(currentUrlQuery, seriesConfigKey));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <section className="bg-gradient-hero pb-20 pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  <p>Loading analytics.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  if (!isAuthenticated && !isWorkspaceView) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <section className="bg-gradient-hero pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl space-y-8">
              <AnalyticsLandingSections />
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  if (viewerStatus === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <section className="bg-gradient-hero pb-20 pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  <p>Checking your analytics access.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  if (viewerStatus === "error") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <section className="bg-gradient-hero pb-20 pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Analytics access could not be checked</CardTitle>
                  <CardDescription className="text-destructive/80">
                    {viewerError || "Viewer access is unavailable right now."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Access Check
                  </Button>
                  <Button type="button" variant="outline" onClick={handleRetrySummary}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Coverage Refresh
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  if (!hasSeriesAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <section className="bg-gradient-hero pb-20 pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader className="space-y-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="font-display text-4xl text-foreground">
                      {isPlatformAdminViewer ? "No series are configured yet" : "Analytics access is private"}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-7">
                      {isPlatformAdminViewer
                        ? "This platform-admin account can access every series automatically, but no series are visible yet."
                        : "Your account does not have series access yet. Request series-user or series-admin access here."}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                      {isPlatformAdminViewer ? "Platform-admin scope" : "Send this to your admin"}
                    </p>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                      {isPlatformAdminViewer ? (
                        "Platform admins automatically inherit series-admin and series-user access across every series."
                      ) : (
                        <>Use the request panel to request access for a specific series.</>
                      )}
                    </p>
                    <div className="mt-4 rounded-2xl border border-border/80 bg-background/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">User ID</p>
                      <p className="mt-2 break-all font-mono text-sm text-foreground">
                        {viewerCatalog?.actor?.userId || user?.id || "Unavailable"}
                      </p>
                    </div>
                    {!isPlatformAdminViewer ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Recheck Access
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {isPlatformAdminViewer ? "What happens next" : "Request against a series"}
                    </p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                      {isPlatformAdminViewer ? (
                        <>
                          <p>1. Use the platform admin console to create or inspect entities and series.</p>
                          <p>2. New series appear here automatically.</p>
                          <p>3. Open the workspace or console directly.</p>
                        </>
                      ) : (
                        <>
                          <p>1. Choose the series.</p>
                          <p>2. Choose series-user or series-admin.</p>
                          <p>3. Submit the request.</p>
                          <p>4. Wait for approval.</p>
                        </>
                      )}
                    </div>
                    {!isPlatformAdminViewer ? (
                      <div className="mt-5">
                        {requestableSeriesEntries.length > 0 ? (
                          <SeriesAccessRequestPanel
                            entries={requestableSeriesEntries}
                            preferredSeriesKey={recommendedRequestSeriesKey}
                            accessToken={accessToken}
                            onAccessActivated={handleAccessActivated}
                          />
                        ) : summaryStatus === "loading" ? (
                          <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/70 p-4">
                            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                            <p className="text-sm leading-6 text-muted-foreground">
                              Loading the series list.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border/80 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                            No requestable series are visible yet.
                          </div>
                        )}
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-3">
                      {isPlatformAdminViewer ? (
                        <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Recheck Access
                        </Button>
                      ) : null}
                      {isPlatformAdminViewer ? (
                        <Button asChild variant="outline">
                          <Link to={platformAdminRoute}>Open Platform Console</Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline">
                        <Link to={analyticsRoute}>Return to Analytics</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  if (isWorkspaceView) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />

        <section className="bg-gradient-hero pb-20 pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-border/80 bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground"
                    >
                      Analytics
                    </Badge>
                    {isPlatformAdminViewer ? (
                      <Badge
                        variant="outline"
                        className="border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200"
                      >
                        Platform Admin
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className="border-border/80 bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground"
                    >
                      Series Workspace
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl lg:text-6xl">
                      Series workspace
                    </h1>
                    <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                      {selectedSeries
                        ? `Review the live boundary and search within ${selectedSeries.seriesName}.`
                        : hasMultipleSeries
                          ? "Choose a series to load its live boundary and player search."
                          : "Review the live series boundary and search within it."}
                    </p>
                    {isPlatformAdminViewer ? (
                      <p className="max-w-3xl text-sm leading-7 text-cyan-100/85">
                        Platform-admin scope is global.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                  {isPlatformAdminViewer ? (
                    <Button asChild variant="outline" className="w-full md:w-auto">
                      <Link to={platformAdminRoute}>
                        Platform Console
                        <ShieldCheck className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {!isPlatformAdminViewer ? (
                    <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => setShowRequestPanel((current) => !current)}>
                      Request Access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" className="w-full md:w-auto">
                    <Link to={adminRoute}>
                      {isPlatformAdminViewer ? "Series Console" : "Admin Console"}
                      <ShieldCheck className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full md:w-auto">
                    <Link to={analyticsRoute}>Back to Analytics</Link>
                  </Button>
                </div>
              </div>

              {showRequestPanel && !isPlatformAdminViewer ? (
                requestableSeriesEntries.length > 0 ? (
                  <SeriesAccessRequestPanel
                    entries={requestableSeriesEntries}
                    preferredSeriesKey={selectedSeriesKey || recommendedRequestSeriesKey}
                    accessToken={accessToken}
                    onAccessActivated={handleAccessActivated}
                  />
                ) : (
                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      <p>Loading the series list.</p>
                    </CardContent>
                  </Card>
                )
              ) : null}

              {!selectedSeries && hasMultipleSeries ? (
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="flex flex-col gap-4 p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p>Select one series card below to load its live summary and search within that series only.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {selectedSeries && selectedSeriesDetailStatus === "loading" ? (
                <Card className="border-border/80 bg-card/75 shadow-sm">
                  <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                    <p>Refreshing live detail for {selectedSeries.seriesName}.</p>
                  </CardContent>
                </Card>
              ) : null}

              {selectedSeries && selectedSeriesDetailStatus === "error" && selectedSeriesDetailError ? (
                <Card className="border-amber-500/30 bg-amber-500/10 shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-5 text-sm text-amber-200 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-1">
                        <p>Selected series detail refresh failed.</p>
                        <p className="text-amber-100/80">{selectedSeriesDetailError}</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleRetrySelectedSeriesDetail}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Selected Series
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <SeriesWorkspaceOverview
                summaryStatus={summaryStatus}
                summaryError={summaryError}
                onRetrySummary={handleRetrySummary}
                seriesCards={displaySeriesCards}
                selectedSeriesKey={selectedSeriesKey}
                onSelectSeries={handleSeriesSelection}
                query={query}
                setQuery={setQuery}
                status={status}
                lastQuery={lastQuery}
                errorMessage={errorMessage}
                combinedResults={combinedResults}
                onSearch={handleSearch}
                onExampleSearch={handleExampleSearch}
                onRetrySearch={handleRetrySearch}
              />
            </div>
          </div>
        </section>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-8">
            <Card className="border-border/80 bg-card/85 shadow-xl">
              <CardContent className="space-y-8 p-8 lg:p-10">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">Analytics Home</p>
                    <div className="space-y-2">
                      <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl lg:text-6xl">
                        Welcome back, {userDisplayName}
                      </h1>
                      <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                        {accessibleSeriesCount > 0
                          ? selectedSeries
                            ? `${accessibleSeriesCount} accessible series. Preferred workspace: ${selectedSeries.seriesName}.`
                            : `${accessibleSeriesCount} accessible series. Choose one below to open its workspace.`
                          : `Signed in as ${user?.email || "this account"}.`}
                      </p>
                    </div>
                  </div>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link to={workspaceRoute}>
                        Series Workspace
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Accessible series</p>
                    <p className="mt-3 font-display text-3xl text-foreground">{formatNumber(accessibleSeriesCount)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Admin scope</p>
                    <p className="mt-3 font-display text-3xl text-foreground">
                      {isPlatformAdminViewer ? "Global" : formatNumber(manageableSeriesCount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/40 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Preferred series</p>
                    <p className="mt-3 font-display text-xl text-foreground">
                      {selectedSeries?.seriesName || (hasMultipleSeries ? "Choose in workspace" : "Analytics")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {analyticsProfiles.map((profile) => {
                    const tone = getAnalyticsProfileTone(profile.key);
                    const icon =
                      profile.key === "platform"
                        ? <ShieldCheck className={`h-5 w-5 ${tone.icon}`} />
                        : profile.key === "series-admin"
                          ? <Layers3 className={`h-5 w-5 ${tone.icon}`} />
                          : <Users className={`h-5 w-5 ${tone.icon}`} />;

                    return (
                      <div
                        key={profile.key}
                        className={`rounded-2xl border ${tone.border} ${tone.panel} p-5`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/60">
                              {icon}
                            </div>
                            <div>
                              <p className="font-display text-2xl text-foreground">{profile.title}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                {profile.meta}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className={tone.badge}>
                            Active
                          </Badge>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">{profile.summary}</p>
                        <div className="mt-5">
                          <Button asChild variant="outline">
                            <Link to={profile.href}>
                              {profile.actionLabel}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <AnalyticsSeriesPortfolio
              seriesCards={seriesCards}
              preferredSeriesKey={selectedSeriesKey || validPreferredSeriesKey || undefined}
            />

            {!isPlatformAdminViewer && requestableSeriesEntries.length > 0 ? (
                <SeriesAccessRequestPanel
                  entries={requestableSeriesEntries}
                  preferredSeriesKey={selectedSeriesKey || recommendedRequestSeriesKey}
                  accessToken={accessToken}
                  onAccessActivated={handleAccessActivated}
                />
            ) : null}

            <AnalyticsLandingSections />

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export function AnalyticsWorkspacePage() {
  return <Analytics view="workspace" />;
}

export default Analytics;

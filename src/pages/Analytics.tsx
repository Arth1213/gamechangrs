import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ExternalLink,
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
import { useAuth } from "@/contexts/AuthContext";
import {
  CricketDashboardSummaryResponse,
  CricketPlayerSearchResponse,
  CricketPlayerReportRouteState,
  CricketPlayerSearchResult,
  CricketSeriesCard,
  CricketViewerSeriesResponse,
  fetchCricketDashboardSummary,
  fetchCricketViewerSeries,
  getAnalyticsAdminRoute,
  getAnalyticsWorkspaceRoute,
  getCricketPlayerReportUrl,
  getRootCricketPlayerReportRoute,
  searchCricketPlayers,
} from "@/lib/cricketApi";

type SearchStatus = "idle" | "searching" | "success" | "empty" | "error";
type SummaryStatus = "loading" | "success" | "error";
type ViewerStatus = "loading" | "success" | "error";
type AnalyticsView = "landing" | "workspace";

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

const EXAMPLE_SEARCHES = ["Shreyak Porecha", "Nikhil Natarajan"];
const LANDING_PILLS = ["Private App", "Coach Intelligence", "Selector Ready", "Multi-Source Ready"];
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
const LANDING_GOALS = [
  "See beyond raw stats.",
  "Weight strong opposition correctly.",
  "See pressure performance.",
  "Compare peers fairly.",
  "Make faster, better calls.",
];
const LANDING_NON_NEGOTIABLES = [
  "Private access only.",
  "Trusted data first.",
  "Explainable scores.",
  "Portable into the private Git repo.",
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
const LANDING_FOUNDATION_TAGS = ["Multi-Series", "Private By Design", "Retrofit-Friendly", "Multi-Source Ready"];
const LANDING_FOUNDATION_MINIS = [
  {
    title: "Keep",
    badge: "In Place",
    toneClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    description: "Raw artifacts, versioned scoring, and admin setup make the model adaptable.",
  },
  {
    title: "Trust First",
    badge: "Critical",
    toneClass: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    description: "Reconciliation and player identity cleanup must stay ahead of scoring polish.",
  },
  {
    title: "First Win",
    badge: "Focused",
    toneClass: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    description: "One believable report matters more than a wide but shaky platform.",
  },
  {
    title: "User Simplicity",
    badge: "Keep",
    toneClass: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    description: "Basic setup should stay simple, while deeper tuning remains optional.",
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
  const reportUrl = getCricketPlayerReportUrl(combinedReportTarget, { seriesConfigKey });
  const inAppReportUrl = getRootCricketPlayerReportRoute(combinedReportTarget, { searchQuery, seriesConfigKey });
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
              View In App
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full md:w-auto">
            <a href={reportUrl} target="_blank" rel="noreferrer">
              Open Standalone
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
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
          <div className="space-y-1">
            <p>Loading live series coverage from the cricket analytics dataset.</p>
            <p className="text-xs text-muted-foreground/80">
              The workspace is resolving coverage boundaries, tracked matches, and current reconciliation state.
            </p>
          </div>
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
              <p>Live series coverage could not be loaded for the workspace view.</p>
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
            <div className="space-y-1">
              <p>Refreshing live series coverage detail.</p>
              <p className="text-xs text-muted-foreground/80">
                Accessible series are already loaded, so the workspace stays usable while detail metrics refresh.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summaryStatus === "error" && summaryError ? (
        <Card className="border-amber-500/30 bg-amber-500/10 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 text-sm text-amber-200 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p>Series detail refresh failed, but your accessible series workspace is still available.</p>
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
                        Division coverage will appear here when this series is the active computed workspace.
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

const Analytics = ({ view = "landing" }: { view?: AnalyticsView }) => {
  const isWorkspaceView = view === "workspace";
  const { session, user } = useAuth();
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
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerCatalog, setViewerCatalog] = useState<CricketViewerSeriesResponse | null>(null);
  const [viewerReloadKey, setViewerReloadKey] = useState(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const accessToken = session?.access_token || "";
  const currentUrlQuery = searchParams.get("q")?.trim() ?? "";
  const currentUrlSeries = searchParams.get("series")?.trim() ?? "";
  const accessibleFallbackCards = useMemo(() => normalizeViewerSeriesCards(viewerCatalog), [viewerCatalog]);
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
  const defaultSeriesKey =
    viewerCatalog?.defaultSeriesConfigKey?.trim()
    || seriesCards.find((card) => card.isActive)?.configKey
    || seriesCards[0]?.configKey
    || "";
  const selectedSeriesKey =
    currentUrlSeries && seriesCards.some((card) => card.configKey === currentUrlSeries)
      ? currentUrlSeries
      : defaultSeriesKey;
  const selectedSeries =
    seriesCards.find((card) => card.configKey === selectedSeriesKey) || seriesCards[0] || null;
  const combinedResults = payload ? combineSearchResults(payload.results) : [];
  const workspaceRoute = useMemo(
    () => getAnalyticsWorkspaceRoute(currentUrlQuery || undefined, selectedSeriesKey || undefined),
    [currentUrlQuery, selectedSeriesKey]
  );
  const adminRoute = useMemo(
    () => getAnalyticsAdminRoute(selectedSeriesKey || undefined),
    [selectedSeriesKey]
  );
  const analyticsRoute = "/analytics";
  const hasSeriesAccess = seriesCards.length > 0;

  async function runSearch(trimmedQuery: string, seriesConfigKey: string) {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setStatus("searching");
    setErrorMessage(null);
    setPayload(null);
    setLastQuery(trimmedQuery);

    try {
      const response = await searchCricketPlayers(trimmedQuery, {
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
    if (!accessToken) {
      setViewerCatalog(null);
      setViewerStatus("error");
      setViewerError("A signed-in session is required before analytics access can be checked.");
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
  }, [accessToken, viewerReloadKey]);

  useEffect(() => {
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
  }, [summaryReloadKey]);

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
      setErrorMessage("You do not have viewer access to any analytics series yet.");
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
  }, [currentUrlQuery, hasSeriesAccess, selectedSeriesKey, summaryStatus, viewerError, viewerStatus, isWorkspaceView]);

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

  const handleRetryViewerAccess = () => {
    setViewerReloadKey((current) => current + 1);
  };

  const handleSeriesSelection = (seriesConfigKey: string) => {
    setSearchParams(buildAnalyticsSearchParams(currentUrlQuery, seriesConfigKey));
  };

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
                  <div className="space-y-1">
                    <p>Checking your analytics access.</p>
                    <p className="text-xs text-muted-foreground/80">
                      Game-Changrs is resolving the series you are allowed to view before loading the selector workspace.
                    </p>
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
                    <CardTitle className="font-display text-4xl text-foreground">Analytics access is private</CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-7">
                      Your account is signed in, but it has not been granted access to any cricket analytics series yet.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Send this to your admin</p>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                      Ask the series admin to open <span className="font-mono text-foreground">/analytics/admin</span> and
                      grant viewer or analyst access to your user id below.
                    </p>
                    <div className="mt-4 rounded-2xl border border-border/80 bg-background/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">User ID</p>
                      <p className="mt-2 break-all font-mono text-sm text-foreground">
                        {viewerCatalog?.actor?.userId || user?.id || "Unavailable"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What happens next</p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                      <p>1. Sign in once to Game-Changrs.</p>
                      <p>2. Share your user id with the series admin.</p>
                      <p>3. The admin grants access inside the cricket admin shell.</p>
                      <p>4. Refresh this page to load your series workspace.</p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recheck Access
                      </Button>
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
                      Review each series boundary, tracked match volume, reconciliation load, and latest live match context
                      without crowding the selector landing page.
                    </p>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                  <Button asChild variant="outline" className="w-full md:w-auto">
                    <Link to={adminRoute}>
                      Admin Console
                      <ShieldCheck className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full md:w-auto">
                    <Link to={analyticsRoute}>Back to Analytics</Link>
                  </Button>
                </div>
              </div>

              <SeriesWorkspaceOverview
                summaryStatus={summaryStatus}
                summaryError={summaryError}
                onRetrySummary={handleRetrySummary}
                seriesCards={seriesCards}
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {LANDING_PILLS.map((pill) => (
                  <Badge
                    key={pill}
                    variant="outline"
                    className="border-border/80 bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground"
                  >
                    {pill}
                  </Badge>
                ))}
              </div>

              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link to={adminRoute}>
                    Admin Console
                    <ShieldCheck className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link to={workspaceRoute}>
                    Series Workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="space-y-6 p-8">
                  <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">What This App Really Is</p>
                    <h1 className="max-w-5xl font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl lg:text-6xl">
                      From raw cricket site data to{" "}
                      <span className="text-primary">trusted analytics intelligence</span>, starting with{" "}
                      <span className="text-sky-400">CricClubs</span>.
                    </h1>
                    <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                      A private decision-support app that turns raw cricket data into{" "}
                      <span className="font-semibold text-foreground">fairer player evaluation</span>.
                    </p>
                    <div className="border-l-4 border-primary pl-4 text-lg leading-8 text-cyan-100/90">
                      CricClubs shows <span className="font-semibold text-foreground">what happened</span>. This app
                      shows <span className="font-semibold text-foreground">what matters</span>.
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
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Success Definition
                    </p>
                    <div className="font-display text-7xl leading-none text-emerald-300">1</div>
                    <p className="text-base leading-7 text-muted-foreground">
                      <span className="font-semibold text-foreground">One coach-trusted player report</span> from real
                      match data.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sky-300">
                      What You Are Really Trying To Do
                    </p>
                    <div className="space-y-3">
                      {LANDING_GOALS.map((item) => (
                        <div key={item} className="text-sm leading-6 text-muted-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sky-300">Non-Negotiables</p>
                    <div className="space-y-3">
                      {LANDING_NON_NEGOTIABLES.map((item) => (
                        <div key={item} className="text-sm leading-6 text-muted-foreground">
                          {item}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-display text-3xl text-foreground md:text-4xl">
                    Key Outcomes You Should Expect
                  </h2>
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
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Messy web pages in. Trusted decisions out.
                </p>
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

            <div className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <h2 className="font-display text-3xl text-foreground md:text-4xl">Foundation Check</h2>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Strong base. Keep the first build disciplined.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="overflow-hidden border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-5 p-6">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-sky-300">Current Read</p>
                    <div className="font-display text-8xl leading-none text-emerald-300">86</div>
                    <h3 className="max-w-md font-display text-3xl text-foreground">Built the right way to scale.</h3>
                    <p className="max-w-md text-sm leading-7 text-muted-foreground">
                      The foundation already fits the real goal: trusted player intelligence, not just a scraping demo.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {LANDING_FOUNDATION_TAGS.map((item) => (
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

                <div className="grid gap-4 md:grid-cols-2">
                  {LANDING_FOUNDATION_MINIS.map((item) => (
                    <Card key={item.title} className="border-border/80 bg-card/80 shadow-sm">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                          <Badge variant="outline" className={item.toneClass}>
                            {item.badge}
                          </Badge>
                        </div>
                        <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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

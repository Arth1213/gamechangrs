import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  Crosshair,
  ExternalLink,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import AnalyticsReportModeSwitcher from "@/components/analytics/AnalyticsReportModeSwitcher";
import PlayerReportChat from "@/components/analytics/PlayerReportChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  CricketPlayerIntelligenceDismissalRow,
  CricketPlayerIntelligenceEvidenceItem,
  CricketPlayerIntelligenceMatchupRow,
  CricketPlayerIntelligenceResponse,
  CricketPlayerReportRouteState,
  createCricketSeriesAccessRequest,
  fetchCricketPlayerIntelligence,
  fetchCricketViewerSeries,
  getAnalyticsPlatformAdminRoute,
  getAnalyticsWorkspaceRoute,
  getRootCricketPlayerReportRoute,
} from "@/lib/cricketApi";

function getDivisionId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

function getToneClasses(tone: string | null | undefined) {
  switch (tone) {
    case "good":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "watch":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "risk":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-border/80 bg-background/60 text-foreground";
  }
}

function buildHeroStatement(report: CricketPlayerIntelligenceResponse | null) {
  const playerName = report?.header?.playerName || "This player";
  const recommendation = report?.header?.recommendationLabel?.toLowerCase();
  const scopeLabel = report?.meta?.scope?.scopeLabel || "current intelligence lens";
  const leadStrength = report?.tacticalSummary?.strengths?.[0]?.note;
  const leadWatchout = report?.tacticalSummary?.watchouts?.[0]?.note;

  const base = recommendation
    ? `${playerName} currently grades as ${recommendation} in the ${scopeLabel}.`
    : `${playerName} is live on the Game-Changrs player intelligence model.`;

  if (leadStrength) {
    return `${base} ${leadStrength}`;
  }

  if (leadWatchout) {
    return `${base} ${leadWatchout}`;
  }

  return base;
}

function getPhaseLabel(key: string) {
  switch (key) {
    case "powerplay":
      return "Powerplay";
    case "middle":
      return "Middle";
    case "death":
      return "Death";
    default:
      return key;
  }
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string | null;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${getToneClasses(tone)}`}>
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SignalColumn({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items?: Array<{
    label?: string;
    tone?: string;
    metricLabel?: string;
    metricValue?: number | null;
    note?: string;
  }>;
}) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items && items.length > 0 ? (
          items.map((item) => (
            <div key={`${title}-${item.label}-${item.metricLabel}`} className={`rounded-2xl border p-4 ${getToneClasses(item.tone)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{item.label || "Live signal"}</p>
                  {item.note ? <p className="text-sm leading-6 opacity-85">{item.note}</p> : null}
                </div>
                {item.metricLabel ? (
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] opacity-75">{item.metricLabel}</p>
                    <p className="text-xl font-semibold">{formatNumber(item.metricValue)}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No live signal is available in this section yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchupTable({
  title,
  description,
  rows,
  mode,
}: {
  title: string;
  description: string;
  rows?: CricketPlayerIntelligenceMatchupRow[];
  mode: "batting" | "bowling";
}) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows && rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${title}-${row.splitLabel}-${row.phaseBucket}`} className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">{row.splitLabel || "Unknown split"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatNumber(row.matchCount)} matches • {formatNumber(row.legalBalls)} balls
                  </p>
                </div>
                <Badge variant="outline" className="border-border/80 bg-background/70 text-muted-foreground">
                  {mode === "batting" ? "Batting split" : "Bowling split"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {mode === "batting" ? (
                  <>
                    <MetricPill label="Runs" value={formatNumber(row.runsScored)} />
                    <MetricPill label="Strike Rate" value={formatNumber(row.strikeRate)} tone="good" />
                    <MetricPill label="Dismissals" value={formatNumber(row.dismissals)} tone={row.dismissals && row.dismissals > 0 ? "watch" : "good"} />
                    <MetricPill label="Dot %" value={formatNumber(row.dotBallPct)} />
                  </>
                ) : (
                  <>
                    <MetricPill label="Wickets" value={formatNumber(row.wickets)} tone="good" />
                    <MetricPill label="Economy" value={formatNumber(row.economy)} tone="good" />
                    <MetricPill label="Dot %" value={formatNumber(row.dotBallPct)} />
                    <MetricPill label="Control Error %" value={formatNumber(row.controlErrorPct)} tone={row.controlErrorPct && row.controlErrorPct > 6 ? "watch" : "good"} />
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No split-level evidence is available yet in this lens.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DismissalTable({ rows }: { rows?: CricketPlayerIntelligenceDismissalRow[] }) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl text-foreground">Dismissal pattern</CardTitle>
        <CardDescription>Where the wicket pattern is clustering in the live intelligence model.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows && rows.length > 0 ? (
          rows.map((row) => (
            <div key={`${row.bowlerStyleLabel}-${row.dismissalType}`} className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-foreground">{row.bowlerStyleLabel || "Unknown style"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.dismissalType || "Dismissal"} • {formatNumber(row.matchCount)} matches</p>
                </div>
                <Badge className={getToneClasses("watch")}>{formatNumber(row.dismissalCount)} wickets</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MetricPill label="Avg runs at dismissal" value={formatNumber(row.averageRunsAtDismissal)} />
                <MetricPill label="Avg balls faced" value={formatNumber(row.averageBallsFacedAtDismissal)} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No dismissal concentration has been captured yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhaseCard({
  title,
  row,
  mode,
}: {
  title: string;
  row?: CricketPlayerIntelligenceMatchupRow | null;
  mode: "batting" | "bowling";
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {row ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {mode === "batting" ? "Strike Rate" : "Economy"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatNumber(mode === "batting" ? row.strikeRate : row.economy)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Balls</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(row.legalBalls)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No phase sample yet.</p>
      )}
    </div>
  );
}

function EvidenceColumn({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof BrainCircuit;
  items?: CricketPlayerIntelligenceEvidenceItem[];
}) {
  return (
    <Card className="border-border/80 bg-card/85">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="font-display text-2xl text-foreground">{title}</CardTitle>
            <CardDescription>Commentary-backed examples from the live dataset.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items && items.length > 0 ? (
          items.map((item) => (
            <div key={`${title}-${item.matchId}-${item.ballLabel}-${item.headline}`} className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">{item.headline || "Live evidence"}</p>
                  <p className="text-sm text-muted-foreground">
                    {[item.matchDateLabel, item.matchTitle, item.phase].filter(Boolean).join(" • ")}
                  </p>
                </div>
                {item.leverageScore !== null && item.leverageScore !== undefined ? (
                  <Badge variant="outline" className="border-border/80 bg-background/70 text-muted-foreground">
                    Leverage {formatNumber(item.leverageScore)}
                  </Badge>
                ) : null}
              </div>
              {item.commentaryText ? (
                <p className="mt-3 text-sm leading-7 text-foreground">{item.commentaryText}</p>
              ) : null}
              {item.matchPageUrl || item.scorecardUrl || item.ballByBallUrl ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {item.matchPageUrl ? (
                    <a
                      href={item.matchPageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                    >
                      Match page
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {item.scorecardUrl ? (
                    <a
                      href={item.scorecardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                    >
                      Scorecard
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {item.ballByBallUrl ? (
                    <a
                      href={item.ballByBallUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                    >
                      Ball by ball
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
            No commentary-backed evidence is available yet in this bucket.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type IntelligenceStatus = "idle" | "loading" | "success" | "error";
type ViewerStatus = "loading" | "success" | "error";
type AccessRequestStatus = "idle" | "saving" | "success" | "error";

const AnalyticsIntelligenceReport = () => {
  const { session, user } = useAuth();
  const { playerId } = useParams<{ playerId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const routeState = (location.state ?? {}) as CricketPlayerReportRouteState;
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerSeries, setViewerSeries] = useState<Array<{ configKey?: string; seriesName?: string }>>([]);
  const [viewerUserId, setViewerUserId] = useState<string>("");
  const [viewerIsPlatformAdmin, setViewerIsPlatformAdmin] = useState(false);
  const [viewerReloadKey, setViewerReloadKey] = useState(0);
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceStatus>("idle");
  const [intelligenceError, setIntelligenceError] = useState<string | null>(null);
  const [intelligenceReport, setIntelligenceReport] = useState<CricketPlayerIntelligenceResponse | null>(null);
  const [intelligenceReloadKey, setIntelligenceReloadKey] = useState(0);
  const [accessRequestStatus, setAccessRequestStatus] = useState<AccessRequestStatus>("idle");
  const [accessRequestMessage, setAccessRequestMessage] = useState<string | null>(null);

  const accessToken = session?.access_token || "";
  const numericPlayerId = Number.parseInt(playerId ?? "", 10);
  const divisionId = getDivisionId(searchParams.get("divisionId"));
  const currentSeriesKey = searchParams.get("series")?.trim() || routeState.seriesConfigKey?.trim() || "";
  const defaultSeriesKey = viewerSeries[0]?.configKey?.trim() || "";
  const effectiveSeriesKey = currentSeriesKey || defaultSeriesKey;
  const currentSearchQuery = searchParams.get("q")?.trim() || routeState.searchQuery?.trim() || "";
  const intelligenceRoute = `${location.pathname}${location.search}`;
  const backToSearchUrl = useMemo(
    () => getAnalyticsWorkspaceRoute(currentSearchQuery, effectiveSeriesKey || undefined),
    [currentSearchQuery, effectiveSeriesKey]
  );
  const executiveReportUrl = useMemo(() => {
    if (!Number.isFinite(numericPlayerId)) {
      return backToSearchUrl;
    }
    return getRootCricketPlayerReportRoute(
      {
        playerId: numericPlayerId,
        divisionId,
      },
      {
        searchQuery: currentSearchQuery,
        seriesConfigKey: effectiveSeriesKey || undefined,
      }
    );
  }, [backToSearchUrl, currentSearchQuery, divisionId, effectiveSeriesKey, numericPlayerId]);
  const platformAdminRoute = getAnalyticsPlatformAdminRoute();
  const hasViewerAccess = viewerSeries.some((series) => series.configKey?.trim() === effectiveSeriesKey);

  useEffect(() => {
    if (!accessToken) {
      setViewerSeries([]);
      setViewerUserId("");
      setViewerIsPlatformAdmin(false);
      setViewerStatus("error");
      setViewerError("A signed-in session is required before report access can be checked.");
      return;
    }

    const controller = new AbortController();
    setViewerStatus("loading");
    setViewerError(null);
    setViewerSeries([]);
    setViewerUserId("");
    setViewerIsPlatformAdmin(false);

    fetchCricketViewerSeries(accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        setViewerSeries(payload.series ?? []);
        setViewerUserId(payload.actor?.userId?.trim() || "");
        setViewerIsPlatformAdmin(payload.actor?.isPlatformAdmin === true);
        setViewerStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Viewer access could not be resolved right now.";
        setViewerSeries([]);
        setViewerUserId("");
        setViewerIsPlatformAdmin(false);
        setViewerStatus("error");
        setViewerError(message);
      });

    return () => controller.abort();
  }, [accessToken, viewerReloadKey]);

  useEffect(() => {
    setAccessRequestStatus("idle");
    setAccessRequestMessage(null);
  }, [effectiveSeriesKey, numericPlayerId]);

  useEffect(() => {
    if (viewerStatus !== "success" || !hasViewerAccess) {
      setIntelligenceReport(null);
      setIntelligenceError(null);
      setIntelligenceStatus("idle");
      return;
    }

    if (!Number.isFinite(numericPlayerId)) {
      setIntelligenceReport(null);
      setIntelligenceError(null);
      setIntelligenceStatus("idle");
      return;
    }

    const controller = new AbortController();
    setIntelligenceStatus("loading");
    setIntelligenceError(null);
    setIntelligenceReport(null);

    fetchCricketPlayerIntelligence(
      {
        playerId: numericPlayerId,
        divisionId,
      },
      {
        accessToken,
        seriesConfigKey: effectiveSeriesKey || undefined,
        signal: controller.signal,
      }
    )
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }
        setIntelligenceReport(payload);
        setIntelligenceStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "Player intelligence is unavailable right now.";
        setIntelligenceReport(null);
        setIntelligenceError(message);
        setIntelligenceStatus("error");
      });

    return () => controller.abort();
  }, [accessToken, divisionId, effectiveSeriesKey, hasViewerAccess, intelligenceReloadKey, numericPlayerId, viewerStatus]);

  const handleRetryViewerAccess = () => setViewerReloadKey((value) => value + 1);
  const handleRetryIntelligence = () => setIntelligenceReloadKey((value) => value + 1);

  const handleRequestReportAccess = async () => {
    if (!accessToken || !effectiveSeriesKey) {
      return;
    }

    setAccessRequestStatus("saving");
    setAccessRequestMessage(null);

    try {
      const response = await createCricketSeriesAccessRequest(effectiveSeriesKey, accessToken, {
        accessRole: "viewer",
        requestNote: "Root player intelligence request from Game-Changrs front end.",
      });

      setAccessRequestStatus("success");
      setAccessRequestMessage(
        response.message || "Access request submitted. Recheck access after the series admin approves it."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Access request could not be submitted.";
      setAccessRequestStatus("error");
      setAccessRequestMessage(message);
    }
  };

  const title =
    intelligenceReport?.header?.playerName ||
    routeState.displayName ||
    (Number.isFinite(numericPlayerId) ? `Player ${numericPlayerId}` : "Player intelligence");
  const subtitleParts = [
    intelligenceReport?.meta?.series?.name || routeState.seriesName || null,
    intelligenceReport?.meta?.series?.targetAgeGroup || null,
    intelligenceReport?.meta?.scope?.scopeLabel || routeState.divisionLabel || null,
    intelligenceReport?.header?.teamName || routeState.teamName || null,
    intelligenceReport?.header?.roleLabel || routeState.roleLabel || null,
  ].filter((part): part is string => Boolean(part));
  const heroStatement = buildHeroStatement(intelligenceReport);
  const scopeLabel = intelligenceReport?.meta?.scope?.scopeLabel || "Series intelligence";
  const scopeFallbackReason = intelligenceReport?.meta?.scope?.fallbackReason || null;
  const focusedLens = intelligenceReport?.focusedLens || null;
  const seriesLens = intelligenceReport?.seriesLens || null;
  const phaseKeys: Array<"powerplay" | "middle" | "death"> = ["powerplay", "middle", "death"];

  if (viewerStatus === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl space-y-6">
              <Skeleton className="h-16 w-48 rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-3xl" />
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
              </div>
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
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Intelligence access could not be checked</CardTitle>
                  <CardDescription className="text-destructive/80">
                    {viewerError || "Viewer access is unavailable right now."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Access Check
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={backToSearchUrl}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Search
                    </Link>
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

  if (!hasViewerAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader className="space-y-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="font-display text-4xl text-foreground">
                      {viewerIsPlatformAdmin ? "This intelligence route needs a valid live series context" : "You do not have access to this intelligence report"}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-7">
                      {viewerIsPlatformAdmin
                        ? "Platform admins already have global analytics access. This route is failing because the series context could not be resolved from the current URL."
                        : "This intelligence route is limited to series viewers, analysts, and admins who were granted access in the cricket admin shell."}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                      {viewerIsPlatformAdmin ? "Platform-admin scope" : "Send this user id to your admin"}
                    </p>
                    <div className="mt-4 rounded-2xl border border-border/80 bg-background/70 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">User ID</p>
                      <p className="mt-2 break-all font-mono text-sm text-foreground">
                        {viewerUserId || user?.id || "Unavailable"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-5">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What to do</p>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                      <p>1. Recheck access once to reload the live series catalog.</p>
                      <p>2. If this URL was opened without the right series key, go back to search and reopen from there.</p>
                      <p>3. If needed, submit a request so the series admin can approve viewer access.</p>
                    </div>
                    {accessRequestMessage ? (
                      <div
                        className={`mt-5 rounded-2xl border p-4 text-sm leading-7 ${
                          accessRequestStatus === "error"
                            ? "border-destructive/30 bg-destructive/5 text-destructive"
                            : "border-cyan-400/20 bg-cyan-400/5 text-cyan-100"
                        }`}
                      >
                        {accessRequestMessage}
                      </div>
                    ) : null}
                    <div className="mt-5 flex flex-wrap gap-3">
                      {!viewerIsPlatformAdmin ? (
                        <Button
                          type="button"
                          onClick={() => void handleRequestReportAccess()}
                          disabled={accessRequestStatus === "saving" || !effectiveSeriesKey}
                        >
                          {accessRequestStatus === "saving" ? "Submitting request..." : "Request access"}
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" onClick={handleRetryViewerAccess}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recheck Access
                      </Button>
                      {viewerIsPlatformAdmin ? (
                        <Button asChild variant="outline">
                          <Link to={platformAdminRoute}>
                            Platform Console
                            <ShieldCheck className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline">
                        <Link to={backToSearchUrl}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back to Search
                        </Link>
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

  if (!Number.isFinite(numericPlayerId)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Invalid player intelligence route</CardTitle>
                  <CardDescription>
                    A valid player id is required to load the front-end intelligence report.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to={backToSearchUrl}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Search
                    </Link>
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-7xl space-y-8">
            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-2 border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Player Intelligence
                  </Badge>
                  <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                    {scopeLabel}
                  </Badge>
                  {viewerIsPlatformAdmin ? (
                    <Badge variant="outline" className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                      Platform Admin Access
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
                  <p className="max-w-4xl text-lg text-muted-foreground">{heroStatement}</p>
                  {subtitleParts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {subtitleParts.map((part) => (
                        <Badge key={part} variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                          {part}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {scopeFallbackReason ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      {scopeFallbackReason}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" asChild>
                      <Link to={backToSearchUrl}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Search
                      </Link>
                    </Button>
                    <AnalyticsReportModeSwitcher
                      activeMode="intelligence"
                      executiveHref={executiveReportUrl}
                      intelligenceHref={intelligenceRoute}
                      linkState={routeState}
                    />
                    {viewerIsPlatformAdmin ? (
                      <Button variant="outline" asChild>
                        <Link to={platformAdminRoute}>
                          Platform Console
                          <ShieldCheck className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <Card className="border-border/80 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%),rgba(15,23,42,0.92)] shadow-xl">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Recommendation</p>
                      {intelligenceReport?.header?.recommendationLabel ? (
                        <Badge className={`border px-4 py-1.5 text-sm ${getToneClasses("good")}`}>
                          {intelligenceReport.header.recommendationLabel}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                          Recommendation pending
                        </Badge>
                      )}
                    </div>
                    {intelligenceReport?.header?.confidenceLabel ? (
                      <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
                        {intelligenceReport.header.confidenceLabel}
                        {intelligenceReport.header.confidenceScore !== null && intelligenceReport.header.confidenceScore !== undefined
                          ? ` · ${formatNumber(intelligenceReport.header.confidenceScore)}`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricPill label="Composite" value={formatNumber(intelligenceReport?.header?.compositeScore)} tone="good" />
                    <MetricPill label="Percentile" value={formatNumber(intelligenceReport?.header?.percentileRank)} tone="good" />
                    <MetricPill label="Team" value={intelligenceReport?.header?.teamName || "-"} />
                    <MetricPill label="Role" value={intelligenceReport?.header?.roleLabel || "-"} />
                    <MetricPill label="Batting Style" value={intelligenceReport?.header?.battingStyle || "-"} />
                    <MetricPill label="Bowling Style" value={intelligenceReport?.header?.bowlingStyle || "-"} />
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sample context</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Batting sample</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">
                          {formatNumber(focusedLens?.sample?.battingLegalBalls)} balls
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(focusedLens?.sample?.battingMatchCount)} matches
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Bowling sample</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">
                          {formatNumber(focusedLens?.sample?.bowlingLegalBalls)} balls
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(focusedLens?.sample?.bowlingMatchCount)} matches
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {intelligenceStatus === "loading" ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
                <Skeleton className="h-72 w-full rounded-3xl" />
              </div>
            ) : null}

            {intelligenceStatus === "error" ? (
              <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Player intelligence could not be loaded</CardTitle>
                  <CardDescription className="text-destructive/80">
                    {intelligenceError || "The live intelligence payload is unavailable right now."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={handleRetryIntelligence}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Intelligence
                  </Button>
                  <AnalyticsReportModeSwitcher
                    activeMode="intelligence"
                    executiveHref={executiveReportUrl}
                    intelligenceHref={intelligenceRoute}
                    linkState={routeState}
                  />
                </CardContent>
              </Card>
            ) : null}

            {intelligenceStatus === "success" && intelligenceReport ? (
              <>
                <div className="grid gap-6 xl:grid-cols-3">
                  <SignalColumn
                    title="Strengths"
                    description="Live splits and context where the player is creating positive value."
                    items={intelligenceReport.tacticalSummary?.strengths}
                  />
                  <SignalColumn
                    title="Watchouts"
                    description="Where the current model says pressure or wicket risk is concentrating."
                    items={intelligenceReport.tacticalSummary?.watchouts}
                  />
                  <SignalColumn
                    title="Pressure signals"
                    description="What happens when the sequence tightens or leverage climbs."
                    items={intelligenceReport.tacticalSummary?.pressureSignals}
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <MatchupTable
                    title="Batting vs bowler type"
                    description="How this batter is scoring, surviving, and absorbing dot-ball pressure by bowling profile."
                    rows={focusedLens?.batting?.byBowlerType}
                    mode="batting"
                  />
                  <MatchupTable
                    title="Bowling vs batter hand"
                    description="How this bowler is controlling right-hand and left-hand batters in the chosen lens."
                    rows={focusedLens?.bowling?.byBatterHand}
                    mode="bowling"
                  />
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <Card className="border-border/80 bg-card/85">
                    <CardHeader className="space-y-2">
                      <CardTitle className="font-display text-2xl text-foreground">Phase lens</CardTitle>
                      <CardDescription>Quick phase-level read on batting and bowling control.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-cyan-200" />
                          <p className="text-sm font-medium text-foreground">Batting</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {phaseKeys.map((phaseKey) => (
                            <PhaseCard
                              key={`batting-${phaseKey}`}
                              title={getPhaseLabel(phaseKey)}
                              row={focusedLens?.batting?.byPhase?.[phaseKey]}
                              mode="batting"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Radar className="h-4 w-4 text-cyan-200" />
                          <p className="text-sm font-medium text-foreground">Bowling</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {phaseKeys.map((phaseKey) => (
                            <PhaseCard
                              key={`bowling-${phaseKey}`}
                              title={getPhaseLabel(phaseKey)}
                              row={focusedLens?.bowling?.byPhase?.[phaseKey]}
                              mode="bowling"
                            />
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <DismissalTable rows={focusedLens?.dismissals} />
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                  <Card className="border-border/80 bg-card/85">
                    <CardHeader className="space-y-2">
                      <CardTitle className="font-display text-2xl text-foreground">Tactical plan</CardTitle>
                      <CardDescription>Direct planning lines from the live intelligence payload.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Crosshair className="h-4 w-4 text-cyan-200" />
                          <p className="text-sm font-medium text-foreground">Batting plan</p>
                        </div>
                        {intelligenceReport.tacticalPlan?.battingPlan?.length ? (
                          <div className="space-y-3">
                            {intelligenceReport.tacticalPlan.battingPlan.map((item) => (
                              <div key={`batting-plan-${item}`} className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm leading-7 text-foreground">
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
                            No batting plan lines are available yet.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Radar className="h-4 w-4 text-cyan-200" />
                          <p className="text-sm font-medium text-foreground">Bowling plan</p>
                        </div>
                        {intelligenceReport.tacticalPlan?.bowlingPlan?.length ? (
                          <div className="space-y-3">
                            {intelligenceReport.tacticalPlan.bowlingPlan.map((item) => (
                              <div key={`bowling-plan-${item}`} className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm leading-7 text-foreground">
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
                            No bowling plan lines are available yet.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-card/85">
                    <CardHeader className="space-y-2">
                      <CardTitle className="font-display text-2xl text-foreground">Pressure profile</CardTitle>
                      <CardDescription>The live pressure markers currently available for this player.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <MetricPill label="Rotation ratio" value={formatNumber(focusedLens?.pressureProfile?.battingRotationRatio)} />
                      <MetricPill label="High-leverage batting SR" value={formatNumber(focusedLens?.pressureProfile?.battingHighLeverageStrikeRate)} tone="good" />
                      <MetricPill label="High-leverage bowling economy" value={formatNumber(focusedLens?.pressureProfile?.bowlingHighLeverageEconomy)} tone="good" />
                      <MetricPill label="Bowling control error %" value={formatNumber(focusedLens?.pressureProfile?.bowlingPressureControlErrorPct)} tone="watch" />
                      <MetricPill label="Boundary after 3 dots %" value={formatNumber(focusedLens?.pressureProfile?.boundaryAfterThreeDotsPct)} />
                      <MetricPill label="Dismissal after 3 dots %" value={formatNumber(focusedLens?.pressureProfile?.dismissalAfterThreeDotsPct)} tone="watch" />
                    </CardContent>
                  </Card>
                </div>

                {seriesLens ? (
                  <Card className="border-border/80 bg-card/85">
                    <CardHeader className="space-y-2">
                      <CardTitle className="font-display text-2xl text-foreground">Series baseline</CardTitle>
                      <CardDescription>
                        Division lens is shown above. This card keeps the all-series baseline visible for comparison.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-4">
                      <MetricPill label="Series batting sample" value={formatNumber(seriesLens.sample?.battingLegalBalls)} />
                      <MetricPill label="Series bowling sample" value={formatNumber(seriesLens.sample?.bowlingLegalBalls)} />
                      <MetricPill label="Top batting split SR" value={formatNumber(seriesLens.batting?.byBowlerType?.[0]?.strikeRate)} tone="good" />
                      <MetricPill label="Top bowling split economy" value={formatNumber(seriesLens.bowling?.byBatterHand?.[0]?.economy)} tone="good" />
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-3">
                  <EvidenceColumn title="Batting evidence" icon={Target} items={intelligenceReport.commentaryEvidence?.batting} />
                  <EvidenceColumn title="Bowling evidence" icon={Radar} items={intelligenceReport.commentaryEvidence?.bowling} />
                  <EvidenceColumn title="Dismissal evidence" icon={BrainCircuit} items={intelligenceReport.commentaryEvidence?.dismissals} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <PlayerReportChat
        report={null}
        mode="intelligence"
        playerName={title}
        playerId={numericPlayerId}
        seriesConfigKey={effectiveSeriesKey}
        seriesName={intelligenceReport?.meta?.series?.name || routeState.seriesName || null}
        divisionId={divisionId}
        divisionLabel={intelligenceReport?.meta?.scope?.scopeLabel || routeState.divisionLabel || null}
      />

      <Footer />
    </div>
  );
};

export default AnalyticsIntelligenceReport;

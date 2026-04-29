import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, ExternalLink, FileSearch, Loader2, Radar, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import PlayerReportChat from "@/components/analytics/PlayerReportChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  CricketPlayerReportMetric,
  CricketPlayerReportResponse,
  CricketPlayerReportRouteState,
  createCricketSeriesAccessRequest,
  fetchCricketViewerSeries,
  fetchCricketPlayerReport,
  getAnalyticsPlatformAdminRoute,
  getAnalyticsWorkspaceRoute,
  getCricketPlayerReportDocumentUrl,
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

function formatStatValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return typeof value === "number" ? formatNumber(value) : String(value);
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

function includesLabel(value: string | undefined, label: string) {
  return value?.toLowerCase().includes(label.toLowerCase()) ?? false;
}

type ReportSummaryStatus = "idle" | "loading" | "success" | "error";
type ReportDocumentStatus = "idle" | "loading" | "success" | "error";
type ViewerStatus = "loading" | "success" | "error";
type AccessRequestStatus = "idle" | "saving" | "success" | "error";

const AnalyticsReport = () => {
  const { session, user } = useAuth();
  const { playerId } = useParams<{ playerId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const routeState = (location.state ?? {}) as CricketPlayerReportRouteState;
  const [isFrameLoading, setIsFrameLoading] = useState(true);
  const [summaryStatus, setSummaryStatus] = useState<ReportSummaryStatus>("idle");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<CricketPlayerReportResponse | null>(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);
  const [reportDocumentStatus, setReportDocumentStatus] = useState<ReportDocumentStatus>("idle");
  const [reportDocumentError, setReportDocumentError] = useState<string | null>(null);
  const [reportDocumentHtml, setReportDocumentHtml] = useState<string | null>(null);
  const [reportDocumentReloadKey, setReportDocumentReloadKey] = useState(0);
  const [standaloneReportBlobUrl, setStandaloneReportBlobUrl] = useState<string | null>(null);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("loading");
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerSeries, setViewerSeries] = useState<Array<{ configKey?: string; seriesName?: string }>>([]);
  const [viewerUserId, setViewerUserId] = useState<string>("");
  const [viewerIsPlatformAdmin, setViewerIsPlatformAdmin] = useState(false);
  const [viewerReloadKey, setViewerReloadKey] = useState(0);
  const [accessRequestStatus, setAccessRequestStatus] = useState<AccessRequestStatus>("idle");
  const [accessRequestMessage, setAccessRequestMessage] = useState<string | null>(null);

  const numericPlayerId = Number.parseInt(playerId ?? "", 10);
  const divisionId = getDivisionId(searchParams.get("divisionId"));
  const accessToken = session?.access_token || "";
  const currentSeriesKey = searchParams.get("series")?.trim() || routeState.seriesConfigKey?.trim() || "";
  const defaultSeriesKey = viewerSeries[0]?.configKey?.trim() || "";
  const effectiveSeriesKey = currentSeriesKey || defaultSeriesKey;
  const currentSearchQuery = searchParams.get("q")?.trim() || routeState.searchQuery?.trim() || "";
  const backToSearchUrl = useMemo(
    () => getAnalyticsWorkspaceRoute(currentSearchQuery, effectiveSeriesKey || undefined),
    [currentSearchQuery, effectiveSeriesKey]
  );
  const platformAdminRoute = getAnalyticsPlatformAdminRoute();
  const hasViewerAccess = viewerSeries.some((series) => series.configKey?.trim() === effectiveSeriesKey);
  const reportUrl = useMemo(() => {
    if (!Number.isFinite(numericPlayerId)) {
      return null;
    }

    return getCricketPlayerReportDocumentUrl(
      {
        playerId: numericPlayerId,
        divisionId,
      },
      { seriesConfigKey: effectiveSeriesKey || undefined }
    );
  }, [divisionId, effectiveSeriesKey, numericPlayerId]);

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

    return () => {
      controller.abort();
    };
  }, [accessToken, viewerReloadKey]);

  useEffect(() => {
    setIsFrameLoading(true);
  }, [reportDocumentHtml]);

  useEffect(() => {
    setAccessRequestStatus("idle");
    setAccessRequestMessage(null);
  }, [effectiveSeriesKey, numericPlayerId]);

  useEffect(() => {
    if (viewerStatus !== "success" || !hasViewerAccess) {
      setReportSummary(null);
      setSummaryError(null);
      setSummaryStatus("idle");
      return;
    }

    if (!Number.isFinite(numericPlayerId)) {
      setReportSummary(null);
      setSummaryError(null);
      setSummaryStatus("idle");
      return;
    }

    const controller = new AbortController();
    setSummaryStatus("loading");
    setSummaryError(null);
    setReportSummary(null);

    fetchCricketPlayerReport(
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

        setReportSummary(payload);
        setSummaryStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Live report summary is unavailable right now.";
        setReportSummary(null);
        setSummaryError(message);
        setSummaryStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, divisionId, effectiveSeriesKey, hasViewerAccess, numericPlayerId, summaryReloadKey, viewerStatus]);

  useEffect(() => {
    if (viewerStatus !== "success" || !hasViewerAccess || !reportUrl || !accessToken) {
      setReportDocumentStatus("idle");
      setReportDocumentError(null);
      setReportDocumentHtml(null);
      return;
    }

    const controller = new AbortController();
    setReportDocumentStatus("loading");
    setReportDocumentError(null);
    setReportDocumentHtml(null);

    fetch(reportUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Protected report request failed with status ${response.status}.`);
        }

        const html = await response.text();
        if (controller.signal.aborted) {
          return;
        }

        setReportDocumentHtml(html);
        setReportDocumentStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "The protected report could not be loaded right now.";
        setReportDocumentError(message);
        setReportDocumentHtml(null);
        setReportDocumentStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, hasViewerAccess, reportDocumentReloadKey, reportUrl, viewerStatus]);

  useEffect(() => {
    if (!reportDocumentHtml) {
      setStandaloneReportBlobUrl(null);
      return;
    }

    const blobUrl = URL.createObjectURL(new Blob([reportDocumentHtml], { type: "text/html" }));
    setStandaloneReportBlobUrl(blobUrl);

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [reportDocumentHtml]);

  const title =
    reportSummary?.header?.playerName ||
    reportSummary?.meta?.player?.playerName ||
    routeState.displayName ||
    (Number.isFinite(numericPlayerId) ? `Player ${numericPlayerId}` : "Player report");
  const teamName = reportSummary?.header?.teamName || reportSummary?.meta?.player?.teamName || routeState.teamName || null;
  const divisionOptions = reportSummary?.meta?.player?.divisionOptions ?? [];
  const divisionCoverageLabel = useMemo(() => {
    const divisionLabels = Array.from(
      new Set(
        divisionOptions
          .map((option) => option.divisionLabel?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );

    if (divisionLabels.length > 1) {
      return `${divisionLabels.length} phase/division records combined`;
    }

    if (divisionLabels.length === 1) {
      return divisionLabels[0];
    }

    return routeState.divisionLabel || (divisionId !== null ? `Division ${divisionId}` : null);
  }, [divisionId, divisionOptions, routeState.divisionLabel]);
  const roleLabel = reportSummary?.header?.primaryRole || routeState.roleLabel || null;
  const seriesName =
    reportSummary?.meta?.series?.name ||
    viewerSeries.find((series) => series.configKey?.trim() === effectiveSeriesKey)?.seriesName ||
    routeState.seriesName ||
    null;
  const ageGroupLabel = reportSummary?.meta?.series?.targetAgeGroup || null;
  const recommendationLabel =
    reportSummary?.reportPayload?.recommendationBadge?.label || reportSummary?.header?.recommendation || null;
  const recommendationTone = reportSummary?.reportPayload?.recommendationBadge?.tone || null;
  const confidenceLabel =
    reportSummary?.header?.confidenceLabel || reportSummary?.reportPayload?.recommendationBadge?.confidenceLabel || null;
  const confidenceScore =
    reportSummary?.header?.confidenceScore ?? reportSummary?.reportPayload?.recommendationBadge?.confidenceScore ?? null;
  const quickRead =
    reportSummary?.header?.quickRead ||
    reportSummary?.reportPayload?.recommendationBadge?.quickRead ||
    "Live selector summary from the verified cricket report.";
  const selectorTakeaway =
    reportSummary?.selectorTakeaway || reportSummary?.reportPayload?.recommendationBadge?.selectorTakeaway || null;
  const subtitleParts = [
    seriesName || null,
    ageGroupLabel || null,
    divisionCoverageLabel,
    teamName,
    roleLabel,
  ].filter((part): part is string => Boolean(part));
  const primarySkillMetric = useMemo(() => {
    const preferredVisual = reportSummary?.visualReadout?.find((item) => includesLabel(item.label, "primary skill"));
    if (preferredVisual) {
      return preferredVisual;
    }

    return reportSummary?.assessmentSnapshot?.find((item) => item.primary) || null;
  }, [reportSummary]);
  const strongTeamsMetric = useMemo(() => {
    return (
      reportSummary?.contextPerformance?.find((item) => includesLabel(item.label, "vs strong teams")) ||
      reportSummary?.visualReadout?.find((item) => includesLabel(item.label, "strong-opposition")) ||
      null
    );
  }, [reportSummary]);
  const confidenceMetric = useMemo<CricketPlayerReportMetric | null>(() => {
    if (confidenceScore === null || confidenceScore === undefined) {
      return null;
    }

    return {
      label: confidenceLabel ? `${confidenceLabel} Confidence` : "Confidence",
      value: confidenceScore,
      tone: recommendationTone,
      note: recommendationLabel ? `${recommendationLabel} recommendation` : "Evidence quality from the live report payload.",
    };
  }, [confidenceLabel, confidenceScore, recommendationLabel, recommendationTone]);
  const summaryCards = useMemo(() => {
    return [
      {
        key: "composite",
        title: "Composite Selector Score",
        value: formatNumber(reportSummary?.scores?.compositeScore),
        note: reportSummary?.scores?.tierLabel || "Role-scoped selector profile",
      },
      {
        key: "primary-skill",
        title: primarySkillMetric?.label || "Primary Skill Read",
        value: formatNumber(primarySkillMetric?.value),
        note: primarySkillMetric?.note || reportSummary?.header?.strengthSignal || "Primary impact signal from the live report.",
      },
      {
        key: "vs-strong-teams",
        title: strongTeamsMetric?.label || "Vs Strong Teams",
        value: formatNumber(strongTeamsMetric?.value),
        note: strongTeamsMetric?.note || "Opponent-adjusted value when team quality rises.",
      },
      {
        key: "confidence",
        title: confidenceMetric?.label || "Confidence",
        value: formatNumber(confidenceMetric?.value),
        note: confidenceMetric?.note || "Evidence quality from the live report payload.",
      },
    ];
  }, [confidenceMetric, primarySkillMetric, reportSummary?.header?.strengthSignal, reportSummary?.scores?.compositeScore, reportSummary?.scores?.tierLabel, strongTeamsMetric]);
  const seriesAndOverallStats = useMemo(() => {
    const groups = [
      {
        key: "current-series",
        title: "Current Series",
        stats: reportSummary?.standardStats?.currentSeries,
      },
      {
        key: "overall",
        title: "Overall CricClubs",
        stats: reportSummary?.standardStats?.overall,
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: [
          { key: "batting", title: "Batting", data: group.stats?.batting },
          { key: "bowling", title: "Bowling", data: group.stats?.bowling },
          { key: "fielding", title: "Fielding", data: group.stats?.fielding },
        ].filter((item) => item.data && ((item.data.value !== null && item.data.value !== undefined) || item.data.detail)),
      }))
      .filter((group) => group.items.length > 0);
  }, [reportSummary?.standardStats]);

  const handleRetryViewerAccess = () => {
    setViewerReloadKey((current) => current + 1);
  };

  const handleRequestReportAccess = async () => {
    if (!accessToken || !effectiveSeriesKey) {
      return;
    }

    setAccessRequestStatus("saving");
    setAccessRequestMessage(null);

    try {
      const response = await createCricketSeriesAccessRequest(
        effectiveSeriesKey,
        accessToken,
        {
          accessRole: "viewer",
          requestNote: "Requested from the root report access wall.",
        }
      );

      setAccessRequestStatus("success");
      setAccessRequestMessage(response.message || "Access request submitted.");
      setViewerReloadKey((current) => current + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Access request failed unexpectedly.";
      setAccessRequestStatus("error");
      setAccessRequestMessage(message);
    }
  };

  if (viewerStatus === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="flex items-start gap-3 p-6 text-sm text-muted-foreground">
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  <div className="space-y-1">
                    <p>Checking your report access.</p>
                    <p className="text-xs text-muted-foreground/80">
                      Game-Changrs is resolving the series you are allowed to open before loading the player report shell.
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
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-destructive/30 bg-destructive/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Report access could not be checked</CardTitle>
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
                      {viewerIsPlatformAdmin ? "This report route needs a valid live series context" : "You do not have access to this report"}
                    </CardTitle>
                    <CardDescription className="max-w-2xl text-sm leading-7">
                      {viewerIsPlatformAdmin
                        ? "Platform admins already have global report access. This route is failing because the series context or player-to-series path could not be resolved from the current URL."
                        : "This root report route is now limited to series viewers, analysts, and admins who were granted access in the cricket admin shell."}
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
                      {viewerIsPlatformAdmin ? (
                        <>
                          <p>1. Recheck access once to reload the live series catalog.</p>
                          <p>2. If this URL was opened without the correct series key, go back to the series workspace and reopen the report from there.</p>
                          <p>3. Platform admins do not need approval and do not consume viewer seats.</p>
                        </>
                      ) : (
                        <>
                          <p>1. If the admin already pre-approved your email, click Recheck Access after you sign in.</p>
                          <p>2. If not, submit a request below so the series admin can approve you.</p>
                          <p>3. Once approved, the existing standalone report will load inside this Game-Changrs shell.</p>
                        </>
                      )}
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

  if (!reportUrl) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader>
                  <CardTitle className="font-display text-3xl text-foreground">Invalid player report route</CardTitle>
                  <CardDescription>
                    A valid player id is required to load the embedded cricket report shell.
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
            <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="gap-2 border border-cyan-400/20 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/10">
                    <FileSearch className="h-3.5 w-3.5" />
                    Selector Report Shell
                  </Badge>
                  {viewerIsPlatformAdmin ? (
                    <Badge variant="outline" className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">
                      Platform Admin Access
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
                  <p className="max-w-4xl text-lg text-muted-foreground">{quickRead}</p>
                  {viewerIsPlatformAdmin ? (
                    <p className="max-w-4xl text-sm leading-7 text-cyan-100/85">
                      Platform-admin scope is global. This report is available without a series-user grant and does not
                      count against viewer allocation.
                    </p>
                  ) : null}
                  {subtitleParts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {subtitleParts.map((part) => (
                        <Badge key={part} variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                          {part}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    {viewerIsPlatformAdmin ? (
                      <Button variant="outline" asChild>
                        <Link to={platformAdminRoute}>
                          Platform Console
                          <ShieldCheck className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                    <Button variant="outline" asChild>
                      <Link to={backToSearchUrl}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Search
                      </Link>
                    </Button>
                    {standaloneReportBlobUrl ? (
                      <Button asChild>
                        <a href={standaloneReportBlobUrl} target="_blank" rel="noreferrer">
                          Open Standalone Report
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <Button type="button" disabled>
                        {reportDocumentStatus === "loading" ? "Loading Report..." : "Standalone Report Unavailable"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Card className="border-border/80 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%),rgba(15,23,42,0.92)] shadow-xl">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Recommendation</p>
                      {recommendationLabel ? (
                        <Badge className={`border px-4 py-1.5 text-sm ${getToneClasses(recommendationTone)}`}>
                          {recommendationLabel}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                          Recommendation pending
                        </Badge>
                      )}
                    </div>
                    {confidenceLabel ? (
                      <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
                        {confidenceLabel}
                        {confidenceScore !== null && confidenceScore !== undefined ? ` · ${formatNumber(confidenceScore)}` : ""}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Selector Take</p>
                    <p className="text-base leading-7 text-foreground">
                      {selectorTakeaway || "Live selector recommendation text will appear here when the report payload is available."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Composite</p>
                      <p className="mt-2 text-3xl font-semibold text-foreground">
                        {formatNumber(reportSummary?.scores?.compositeScore)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Comparison Pool</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {reportSummary?.header?.comparisonPool || "Current cohort context unavailable"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {viewerIsPlatformAdmin ? (
                      <Badge variant="outline" className="border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
                        Global superuser access
                      </Badge>
                    ) : null}
                    {currentSeriesKey ? (
                      <Badge variant="outline" className="border-sky-400/25 bg-sky-400/10 text-sky-200">
                        Series-scoped route
                      </Badge>
                    ) : null}
                    {currentSearchQuery ? (
                      <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                        Search context · {currentSearchQuery}
                      </Badge>
                    ) : null}
                    {reportSummary?.header?.comparisonPool ? (
                      <Badge variant="outline" className="border-border/80 bg-background/60 text-muted-foreground">
                        {reportSummary.header.comparisonPool}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            {summaryStatus === "error" && summaryError ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Live shell metadata could not be loaded from the report endpoint. The protected report document below is still available.
                      <span className="block text-amber-100/80">{summaryError}</span>
                    </p>
                  </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setSummaryReloadKey((current) => current + 1)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Summary
                </Button>
              </div>
            ) : null}

              <Card className="border-border/80 bg-card/85 shadow-xl">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Summary
                  </div>
                </div>
                <div className="space-y-2">
                  <CardTitle className="font-display text-2xl text-foreground">Live player readout from the report payload</CardTitle>
                  <CardDescription className="text-base leading-7">
                    The in-app shell stays concise, uses the live report JSON as its source of truth, and hands off to the full verified report below.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {summaryStatus === "loading" ? (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      <div className="space-y-1">
                        <p>Loading live summary metadata for this player report.</p>
                        <p className="text-xs text-muted-foreground/80">
                          The Game-Changrs shell is reading the live report JSON while the protected report document loads below.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-2xl" />
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-24 rounded-2xl" />
                      ))}
                    </div>
                  </div>
                ) : reportSummary ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {summaryCards.map((card, index) => {
                        const Icon = index === 0 ? ShieldCheck : index === 1 ? Radar : index === 2 ? TrendingUp : FileSearch;

                        return (
                          <div key={card.key} className="rounded-2xl border border-border/80 bg-background/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{card.title}</p>
                                <p className="text-3xl font-semibold text-foreground">{card.value}</p>
                              </div>
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/10 text-cyan-200">
                                <Icon className="h-5 w-5" />
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.note}</p>
                          </div>
                        );
                      })}
                    </div>

                    {seriesAndOverallStats.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-display text-xl text-foreground">Series and overall CricClubs snapshot</h3>
                          {selectorTakeaway ? (
                            <p className="max-w-3xl text-right text-sm text-muted-foreground">{selectorTakeaway}</p>
                          ) : null}
                        </div>
                        <div className="grid gap-4 xl:grid-cols-2">
                          {seriesAndOverallStats.map((group) => (
                            <div key={group.key} className="rounded-2xl border border-border/80 bg-background/60 p-4">
                              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{group.title}</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                {group.items.map((item) => (
                                  <div key={item.key} className="rounded-xl border border-border/70 bg-background/70 p-4">
                                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.title}</p>
                                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatStatValue(item.data?.value)}</p>
                                    {item.data?.detail ? (
                                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.data.detail}</p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-background/60 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <p>Live summary metadata is not available yet. The protected report document below remains the source of truth.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSummaryReloadKey((current) => current + 1)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Summary
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/85 shadow-xl">
              <CardHeader>
                <CardTitle className="font-display text-2xl text-foreground">Embedded report</CardTitle>
                <CardDescription>
                  Protected source route: <span className="font-mono text-foreground">{reportUrl}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(reportDocumentStatus === "loading" || (reportDocumentStatus === "success" && isFrameLoading)) ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading the protected report inside the Game-Changrs shell.
                    </div>
                    <Skeleton className="h-[70vh] w-full rounded-2xl" />
                  </div>
                ) : null}

                {reportDocumentStatus === "error" && reportDocumentError ? (
                  <div className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-1">
                        <p>The protected report could not be loaded.</p>
                        <p className="text-destructive/80">{reportDocumentError}</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setReportDocumentReloadKey((current) => current + 1)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Report
                    </Button>
                  </div>
                ) : null}

                {reportDocumentStatus === "success" && reportDocumentHtml ? (
                  <iframe
                    key={reportUrl}
                    title={`${title} report`}
                    srcDoc={reportDocumentHtml}
                    onLoad={() => setIsFrameLoading(false)}
                    className={`w-full rounded-2xl border border-border/80 bg-white ${isFrameLoading ? "hidden" : "block"} h-[80vh]`}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <PlayerReportChat
        report={reportSummary}
        playerName={title}
        playerId={numericPlayerId}
        seriesConfigKey={effectiveSeriesKey}
        seriesName={seriesName}
        divisionId={divisionId}
        divisionLabel={divisionCoverageLabel}
      />

      <Footer />
    </div>
  );
};

export default AnalyticsReport;

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Globe2,
  ListChecks,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  createCricketAdminRefreshRequest,
  createCricketAdminViewerGrant,
  CricketAdminMatchOpsMatch,
  CricketAdminMatchOpsResponse,
  CricketAdminMatchSelectionOverride,
  CricketAdminSeriesItem,
  CricketAdminSeriesResponse,
  CricketAdminSetupResponse,
  CricketAdminSetupUpdatePayload,
  CricketAdminSubscriptionSummaryResponse,
  CricketAdminViewerGrant,
  CricketAdminViewerGrantsResponse,
  fetchCricketAdminSeries,
  fetchCricketAdminMatchOps,
  fetchCricketAdminSubscriptionSummary,
  fetchCricketAdminSetup,
  fetchCricketAdminViewerGrants,
  getAnalyticsAdminRoute,
  revokeCricketAdminViewerGrant,
  updateCricketAdminSelectionOverride,
  updateCricketAdminSetup,
} from "@/lib/cricketApi";

type CatalogStatus = "loading" | "success" | "error";
type SetupStatus = "idle" | "loading" | "success" | "error";
type MutationStatus = "idle" | "saving" | "success" | "error";
type MatchOpsStatus = "idle" | "loading" | "success" | "error";
type ViewerAccessStatus = "idle" | "loading" | "success" | "error";
type SubscriptionStatus = "idle" | "loading" | "success" | "error";

type RefreshRequestFormState = {
  matchUrl: string;
  reason: string;
};

type MatchOverrideDraft = {
  override: CricketAdminMatchSelectionOverride;
  reason: string;
};

type ViewerGrantFormState = {
  userId: string;
  accessRole: "viewer" | "analyst";
  expiresAt: string;
};

type SetupFormState = {
  sourceSetup: {
    name: string;
    sourceSystem: string;
    seriesUrl: string;
    expectedLeagueName: string;
    expectedSeriesName: string;
    seasonYear: string;
    targetAgeGroup: string;
    scrapeCompletedOnly: boolean;
    includeBallByBall: boolean;
    includePlayerProfiles: boolean;
    enableAutoDiscovery: boolean;
    isActive: boolean;
    notes: string;
  };
  reportProfileKey: string;
  divisions: Array<{
    id: number | null;
    targetLabel: string;
    phaseNo: string;
    divisionNo: string;
    strengthTier: string;
    includeFlag: boolean;
    notes: string;
    aliases: string[];
    sourceLabel: string;
    sourceDivisionId: string;
  }>;
};

const REPORT_PROFILE_NONE = "__none__";

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(1);
}

function getAccessTone(accessRole?: string) {
  if (accessRole === "platform_admin") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-200";
  }

  if (accessRole === "owner") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

function getReadinessItems(summary: CricketAdminSeriesResponse | null) {
  return [
    {
      label: "Entity table",
      ready: summary?.readiness?.hasEntityTable === true,
    },
    {
      label: "Entity membership table",
      ready: summary?.readiness?.hasEntityMembershipTable === true,
    },
    {
      label: "Series entity ownership column",
      ready: summary?.readiness?.hasSeriesSourceConfigEntityId === true,
    },
  ];
}

function toStringValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function parseIntegerOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function cloneFormState(value: SetupFormState) {
  return JSON.parse(JSON.stringify(value)) as SetupFormState;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getStatusBadgeClass(status?: string | null) {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) {
    return "border-border/80 bg-card/70 text-foreground";
  }

  if (["computed", "complete", "completed", "ok", "ready", "success", "active"].includes(normalized)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (["warn", "warning", "pending", "queued", "review", "watch"].includes(normalized)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }

  if (["error", "failed", "invalid", "blocked", "risk"].includes(normalized)) {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border/80 bg-card/70 text-foreground";
}

function getOverrideBadgeClass(override?: string | null) {
  const normalized = override?.trim().toLowerCase();

  if (normalized === "force_include") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  if (normalized === "force_exclude") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  return "border-border/80 bg-card/70 text-foreground";
}

function getOverrideLabel(override?: string | null) {
  const normalized = override?.trim().toLowerCase();

  if (normalized === "force_include") {
    return "Force include";
  }

  if (normalized === "force_exclude") {
    return "Force exclude";
  }

  return "Auto";
}

function getViewerAccessRoleBadgeClass(role?: string | null) {
  const normalized = role?.trim().toLowerCase();

  if (normalized === "analyst") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-200";
  }

  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function getPendingOpsCount(match?: CricketAdminMatchOpsMatch | null) {
  if (!match) {
    return 0;
  }

  return [match.needsRescrape, match.needsReparse, match.needsRecompute].filter(Boolean).length;
}

function createSetupForm(setup: CricketAdminSetupResponse): SetupFormState {
  return {
    sourceSetup: {
      name: setup.sourceSetup?.name ?? "",
      sourceSystem: setup.sourceSetup?.sourceSystem ?? "",
      seriesUrl: setup.sourceSetup?.seriesUrl ?? "",
      expectedLeagueName: setup.sourceSetup?.expectedLeagueName ?? "",
      expectedSeriesName: setup.sourceSetup?.expectedSeriesName ?? "",
      seasonYear: toStringValue(setup.sourceSetup?.seasonYear),
      targetAgeGroup: setup.sourceSetup?.targetAgeGroup ?? "",
      scrapeCompletedOnly: setup.sourceSetup?.scrapeCompletedOnly === true,
      includeBallByBall: setup.sourceSetup?.includeBallByBall === true,
      includePlayerProfiles: setup.sourceSetup?.includePlayerProfiles === true,
      enableAutoDiscovery: setup.sourceSetup?.enableAutoDiscovery === true,
      isActive: setup.sourceSetup?.isActive === true,
      notes: setup.sourceSetup?.notes ?? "",
    },
    reportProfileKey: setup.reportProfile?.activeProfileKey ?? "",
    divisions: (setup.divisions ?? []).map((division) => ({
      id: division.id ?? null,
      targetLabel: division.targetLabel ?? "",
      phaseNo: toStringValue(division.phaseNo),
      divisionNo: toStringValue(division.divisionNo),
      strengthTier: division.strengthTier ?? "",
      includeFlag: division.includeFlag === true,
      notes: division.notes ?? "",
      aliases: division.aliases ?? [],
      sourceLabel: division.sourceLabel ?? "",
      sourceDivisionId: division.sourceDivisionId ?? "",
    })),
  };
}

function buildSetupUpdatePayload(formState: SetupFormState): CricketAdminSetupUpdatePayload {
  return {
    sourceSetup: {
      name: formState.sourceSetup.name,
      seriesUrl: formState.sourceSetup.seriesUrl,
      expectedLeagueName: formState.sourceSetup.expectedLeagueName,
      expectedSeriesName: formState.sourceSetup.expectedSeriesName,
      seasonYear: parseIntegerOrNull(formState.sourceSetup.seasonYear),
      targetAgeGroup: formState.sourceSetup.targetAgeGroup,
      scrapeCompletedOnly: formState.sourceSetup.scrapeCompletedOnly,
      includeBallByBall: formState.sourceSetup.includeBallByBall,
      includePlayerProfiles: formState.sourceSetup.includePlayerProfiles,
      enableAutoDiscovery: formState.sourceSetup.enableAutoDiscovery,
      isActive: formState.sourceSetup.isActive,
      notes: formState.sourceSetup.notes,
    },
    reportProfileKey: formState.reportProfileKey || undefined,
    divisions: formState.divisions.map((division) => ({
      id: division.id ?? undefined,
      targetLabel: division.targetLabel,
      phaseNo: parseIntegerOrNull(division.phaseNo),
      divisionNo: parseIntegerOrNull(division.divisionNo),
      strengthTier: division.strengthTier,
      includeFlag: division.includeFlag,
      notes: division.notes,
    })),
  };
}

const AnalyticsAdmin = () => {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CricketAdminSeriesResponse | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>("idle");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setup, setSetup] = useState<CricketAdminSetupResponse | null>(null);
  const [formState, setFormState] = useState<SetupFormState | null>(null);
  const [initialFormState, setInitialFormState] = useState<SetupFormState | null>(null);
  const [mutationStatus, setMutationStatus] = useState<MutationStatus>("idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [setupReloadKey, setSetupReloadKey] = useState(0);
  const [matchOpsStatus, setMatchOpsStatus] = useState<MatchOpsStatus>("idle");
  const [matchOpsError, setMatchOpsError] = useState<string | null>(null);
  const [matchOps, setMatchOps] = useState<CricketAdminMatchOpsResponse | null>(null);
  const [matchOpsReloadKey, setMatchOpsReloadKey] = useState(0);
  const [viewerAccessStatus, setViewerAccessStatus] = useState<ViewerAccessStatus>("idle");
  const [viewerAccessError, setViewerAccessError] = useState<string | null>(null);
  const [viewerAccess, setViewerAccess] = useState<CricketAdminViewerGrantsResponse | null>(null);
  const [viewerAccessReloadKey, setViewerAccessReloadKey] = useState(0);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("idle");
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<CricketAdminSubscriptionSummaryResponse | null>(null);
  const [subscriptionReloadKey, setSubscriptionReloadKey] = useState(0);
  const [matchQueryInput, setMatchQueryInput] = useState("");
  const [matchQuery, setMatchQuery] = useState("");
  const [matchLimit, setMatchLimit] = useState(25);
  const [refreshForm, setRefreshForm] = useState<RefreshRequestFormState>({
    matchUrl: "",
    reason: "",
  });
  const [refreshStatus, setRefreshStatus] = useState<MutationStatus>("idle");
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<number, MatchOverrideDraft>>({});
  const [overrideMutationStatusByMatch, setOverrideMutationStatusByMatch] = useState<
    Record<number, MutationStatus>
  >({});
  const [overrideMessageByMatch, setOverrideMessageByMatch] = useState<Record<number, string>>({});
  const [overrideErrorByMatch, setOverrideErrorByMatch] = useState<Record<number, string>>({});
  const [viewerGrantForm, setViewerGrantForm] = useState<ViewerGrantFormState>({
    userId: "",
    accessRole: "viewer",
    expiresAt: "",
  });
  const [viewerGrantMutationStatus, setViewerGrantMutationStatus] = useState<MutationStatus>("idle");
  const [viewerGrantMutationMessage, setViewerGrantMutationMessage] = useState<string | null>(null);
  const [viewerGrantMutationError, setViewerGrantMutationError] = useState<string | null>(null);
  const [viewerRevokeStatusByGrant, setViewerRevokeStatusByGrant] = useState<Record<string, MutationStatus>>({});

  const accessToken = session?.access_token || "";
  const selectedSeriesKey = searchParams.get("series")?.trim() || "";
  const series = catalog?.series ?? [];
  const selectedSeries =
    series.find((item) => item.configKey === selectedSeriesKey) || series[0] || null;
  const readinessItems = getReadinessItems(catalog);
  const currentAdminRoute = selectedSeries?.configKey
    ? getAnalyticsAdminRoute(selectedSeries.configKey)
    : "/analytics/admin";
  const currentSetupApiPath = selectedSeries?.setupApiPath || null;
  const currentMatchesApiPath = selectedSeries?.matchesApiPath || null;
  const currentViewersApiPath = selectedSeries?.viewersApiPath || null;
  const currentSubscriptionApiPath = selectedSeries?.configKey
    ? `/api/series/${encodeURIComponent(selectedSeries.configKey)}/admin/subscription`
    : null;
  const currentFormSignature = formState ? JSON.stringify(formState) : "";
  const initialFormSignature = initialFormState ? JSON.stringify(initialFormState) : "";
  const isDirty = Boolean(formState && initialFormState && currentFormSignature !== initialFormSignature);
  const divisionCount = formState?.divisions.length ?? setup?.divisions?.length ?? 0;
  const subscriptionReady = subscriptionStatus === "success" && Boolean(subscriptionSummary);
  const isHardSubscriptionEnforcement =
    (subscriptionSummary?.subscription?.enforcementMode || "hard").toLowerCase() !== "advisory";
  const manualRefreshAllowed = subscriptionReady
    ? (subscriptionSummary?.entitlements?.manualRefreshEnabled !== false || !isHardSubscriptionEnforcement)
    : false;
  const viewerGrantAllowed = subscriptionReady
    ? (
        subscriptionSummary?.entitlements?.viewerGrantEnabled !== false
        && (
          !subscriptionSummary?.limits?.viewerLimitReached
          || !isHardSubscriptionEnforcement
        )
      )
    : false;

  useEffect(() => {
    if (!accessToken) {
      setCatalog(null);
      setCatalogStatus("error");
      setCatalogError("A signed-in session is required before the admin shell can load.");
      return;
    }

    const controller = new AbortController();
    setCatalogStatus("loading");
    setCatalogError(null);

    fetchCricketAdminSeries(accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setCatalog(payload);
        setCatalogStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setCatalog(null);
        setCatalogStatus("error");
        setCatalogError(error instanceof Error ? error.message : "Admin series access could not be loaded.");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, catalogReloadKey]);

  useEffect(() => {
    if (!catalog?.series?.length) {
      return;
    }

    const nextSeriesKey =
      selectedSeriesKey && catalog.series.some((item) => item.configKey === selectedSeriesKey)
        ? selectedSeriesKey
        : catalog.series[0]?.configKey?.trim();

    if (!nextSeriesKey || nextSeriesKey === selectedSeriesKey) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("series", nextSeriesKey);
    setSearchParams(nextParams, { replace: true });
  }, [catalog?.series, searchParams, selectedSeriesKey, setSearchParams]);

  useEffect(() => {
    const currentSeriesKey = selectedSeries?.configKey?.trim();
    if (!accessToken || !currentSeriesKey || catalog?.authFoundationReady !== true) {
      setSetup(null);
      setSetupStatus("idle");
      setSetupError(null);
      return;
    }

    const controller = new AbortController();
    setSetupStatus("loading");
    setSetupError(null);

    fetchCricketAdminSetup(currentSeriesKey, accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setSetup(payload);
        setSetupStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setSetup(null);
        setSetupStatus("error");
        setSetupError(error instanceof Error ? error.message : "Live admin setup is unavailable right now.");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, catalog?.authFoundationReady, selectedSeries?.configKey, setupReloadKey]);

  useEffect(() => {
    if (setupStatus === "success" && setup) {
      const nextForm = createSetupForm(setup);
      setFormState(nextForm);
      setInitialFormState(cloneFormState(nextForm));
      setMutationStatus("idle");
      setMutationError(null);
      setMutationMessage(null);
      return;
    }

    if (setupStatus === "error" || setupStatus === "idle") {
      setFormState(null);
      setInitialFormState(null);
    }
  }, [setup, setupStatus]);

  useEffect(() => {
    const currentSeriesKey = selectedSeries?.configKey?.trim();
    if (!accessToken || !currentSeriesKey || catalog?.authFoundationReady !== true) {
      setMatchOps(null);
      setMatchOpsStatus("idle");
      setMatchOpsError(null);
      return;
    }

    const controller = new AbortController();
    setMatchOpsStatus("loading");
    setMatchOpsError(null);

    fetchCricketAdminMatchOps(currentSeriesKey, accessToken, {
      query: matchQuery,
      limit: matchLimit,
      signal: controller.signal,
    })
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setMatchOps(payload);
        setMatchOpsStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setMatchOps(null);
        setMatchOpsStatus("error");
        setMatchOpsError(error instanceof Error ? error.message : "Live match operations are unavailable right now.");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, catalog?.authFoundationReady, matchLimit, matchOpsReloadKey, matchQuery, selectedSeries?.configKey]);

  useEffect(() => {
    const currentSeriesKey = selectedSeries?.configKey?.trim();
    if (!accessToken || !currentSeriesKey || catalog?.authFoundationReady !== true) {
      setViewerAccess(null);
      setViewerAccessStatus("idle");
      setViewerAccessError(null);
      return;
    }

    const controller = new AbortController();
    setViewerAccessStatus("loading");
    setViewerAccessError(null);

    fetchCricketAdminViewerGrants(currentSeriesKey, accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setViewerAccess(payload);
        setViewerAccessStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setViewerAccess(null);
        setViewerAccessStatus("error");
        setViewerAccessError(error instanceof Error ? error.message : "Viewer access grants are unavailable right now.");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, catalog?.authFoundationReady, selectedSeries?.configKey, viewerAccessReloadKey]);

  useEffect(() => {
    const currentSeriesKey = selectedSeries?.configKey?.trim();
    if (!accessToken || !currentSeriesKey || catalog?.authFoundationReady !== true) {
      setSubscriptionSummary(null);
      setSubscriptionStatus("idle");
      setSubscriptionError(null);
      return;
    }

    const controller = new AbortController();
    setSubscriptionStatus("loading");
    setSubscriptionError(null);

    fetchCricketAdminSubscriptionSummary(currentSeriesKey, accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setSubscriptionSummary(payload);
        setSubscriptionStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setSubscriptionSummary(null);
        setSubscriptionStatus("error");
        setSubscriptionError(
          error instanceof Error ? error.message : "Subscription summary is unavailable right now."
        );
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, catalog?.authFoundationReady, selectedSeries?.configKey, subscriptionReloadKey]);

  useEffect(() => {
    const nextDrafts: Record<number, MatchOverrideDraft> = {};

    for (const match of matchOps?.matches ?? []) {
      if (!match.matchId) {
        continue;
      }

      nextDrafts[match.matchId] = {
        override: (match.adminSelectionOverride as CricketAdminMatchSelectionOverride) || "auto",
        reason: match.adminOverrideReason || "",
      };
    }

    setOverrideDrafts(nextDrafts);
    setOverrideMutationStatusByMatch({});
    setOverrideMessageByMatch({});
    setOverrideErrorByMatch({});
  }, [matchOps]);

  useEffect(() => {
    setRefreshStatus("idle");
    setRefreshMessage(null);
    setRefreshError(null);
    setRefreshForm({
      matchUrl: "",
      reason: "",
    });
    setMatchQueryInput(matchQuery);
  }, [matchQuery, selectedSeries?.configKey]);

  useEffect(() => {
    setViewerGrantForm({
      userId: "",
      accessRole: "viewer",
      expiresAt: "",
    });
    setViewerGrantMutationStatus("idle");
    setViewerGrantMutationMessage(null);
    setViewerGrantMutationError(null);
    setViewerRevokeStatusByGrant({});
  }, [selectedSeries?.configKey]);

  const handleSelectSeries = (configKey?: string) => {
    const normalizedKey = configKey?.trim();
    if (isDirty && !window.confirm("Unsaved setup changes will be lost. Continue?")) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (normalizedKey) {
      nextParams.set("series", normalizedKey);
    } else {
      nextParams.delete("series");
    }

    setSearchParams(nextParams);
  };

  const handleSourceFieldChange = (
    field: keyof SetupFormState["sourceSetup"],
    value: string | boolean,
  ) => {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sourceSetup: {
          ...current.sourceSetup,
          [field]: value,
        },
      };
    });
  };

  const handleDivisionFieldChange = (
    divisionIndex: number,
    field: keyof SetupFormState["divisions"][number],
    value: string | boolean,
  ) => {
    setFormState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        divisions: current.divisions.map((division, index) =>
          index === divisionIndex
            ? {
                ...division,
                [field]: value,
              }
            : division,
        ),
      };
    });
  };

  const handleResetChanges = () => {
    if (!initialFormState) {
      return;
    }

    setFormState(cloneFormState(initialFormState));
    setMutationStatus("idle");
    setMutationError(null);
    setMutationMessage(null);
  };

  const handleSave = async (dryRun = false) => {
    if (!selectedSeries?.configKey || !accessToken || !formState) {
      return;
    }

    setMutationStatus("saving");
    setMutationError(null);
    setMutationMessage(null);

    try {
      const response = await updateCricketAdminSetup(
        selectedSeries.configKey,
        accessToken,
        buildSetupUpdatePayload(formState),
        { dryRun },
      );

      if (!dryRun && response.payload) {
        const nextForm = createSetupForm(response.payload);
        setSetup(response.payload);
        setFormState(nextForm);
        setInitialFormState(cloneFormState(nextForm));
      }

      const message = response.message || (dryRun ? "Dry-run validated." : "Series setup updated.");
      setMutationStatus("success");
      setMutationMessage(message);

      toast({
        title: dryRun ? "Dry-run setup validated" : "Series setup saved",
        description: message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Series setup update failed unexpectedly.";
      setMutationStatus("error");
      setMutationError(message);

      toast({
        title: "Series setup update failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleMatchSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMatchQuery(matchQueryInput.trim());
  };

  const handleRefreshFormChange = (field: keyof RefreshRequestFormState, value: string) => {
    setRefreshForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateRefreshRequest = async () => {
    if (!selectedSeries?.configKey || !accessToken) {
      return;
    }

    if (!manualRefreshAllowed) {
      const message = "Manual refresh is disabled by the current entity plan.";
      setRefreshStatus("error");
      setRefreshError(message);
      toast({
        title: "Refresh request blocked",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const matchUrl = refreshForm.matchUrl.trim();
    if (!matchUrl) {
      const message = "Enter a CricClubs match URL before creating a refresh request.";
      setRefreshStatus("error");
      setRefreshError(message);
      toast({
        title: "Refresh request failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setRefreshStatus("saving");
    setRefreshError(null);
    setRefreshMessage(null);

    try {
      const response = await createCricketAdminRefreshRequest(
        selectedSeries.configKey,
        accessToken,
        {
          matchUrl,
          reason: refreshForm.reason.trim() || undefined,
          requestedBy: user?.email || user?.id || "gamechangrs-root-admin",
        },
      );

      const message = response.message || "Manual refresh request created.";
      setRefreshStatus("success");
      setRefreshMessage(message);
      setRefreshForm({
        matchUrl: "",
        reason: "",
      });
      setMatchOpsReloadKey((current) => current + 1);

      toast({
        title: "Refresh request created",
        description: message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Manual refresh request failed unexpectedly.";
      setRefreshStatus("error");
      setRefreshError(message);

      toast({
        title: "Refresh request failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleOverrideDraftChange = (
    matchId: number,
    field: keyof MatchOverrideDraft,
    value: string,
  ) => {
    setOverrideDrafts((current) => {
      const existing = current[matchId] || {
        override: "auto",
        reason: "",
      };

      if (field === "override") {
        const nextOverride = value as CricketAdminMatchSelectionOverride;
        return {
          ...current,
          [matchId]: {
            ...existing,
            override: nextOverride,
            reason: nextOverride === "auto" ? "" : existing.reason,
          },
        };
      }

      return {
        ...current,
        [matchId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleSaveSelectionOverride = async (matchId: number) => {
    if (!selectedSeries?.configKey || !accessToken) {
      return;
    }

    const draft = overrideDrafts[matchId];
    if (!draft) {
      return;
    }

    if (draft.override !== "auto" && !draft.reason.trim()) {
      const message = "A reason is required when forcing a match include or exclude decision.";
      setOverrideMutationStatusByMatch((current) => ({
        ...current,
        [matchId]: "error",
      }));
      setOverrideErrorByMatch((current) => ({
        ...current,
        [matchId]: message,
      }));
      setOverrideMessageByMatch((current) => ({
        ...current,
        [matchId]: "",
      }));
      toast({
        title: "Override update failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setOverrideMutationStatusByMatch((current) => ({
      ...current,
      [matchId]: "saving",
    }));
    setOverrideErrorByMatch((current) => ({
      ...current,
      [matchId]: "",
    }));
    setOverrideMessageByMatch((current) => ({
      ...current,
      [matchId]: "",
    }));

    try {
      const response = await updateCricketAdminSelectionOverride(
        selectedSeries.configKey,
        matchId,
        accessToken,
        {
          override: draft.override,
          reason: draft.override === "auto" ? undefined : draft.reason.trim(),
          requestedBy: user?.email || user?.id || "gamechangrs-root-admin",
        },
      );

      const message = response.message || "Selection override updated.";
      setOverrideMutationStatusByMatch((current) => ({
        ...current,
        [matchId]: "success",
      }));
      setOverrideMessageByMatch((current) => ({
        ...current,
        [matchId]: message,
      }));
      setMatchOpsReloadKey((current) => current + 1);

      toast({
        title: "Selection override updated",
        description: message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Selection override update failed unexpectedly.";
      setOverrideMutationStatusByMatch((current) => ({
        ...current,
        [matchId]: "error",
      }));
      setOverrideErrorByMatch((current) => ({
        ...current,
        [matchId]: message,
      }));

      toast({
        title: "Selection override update failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleViewerGrantFieldChange = (field: keyof ViewerGrantFormState, value: string) => {
    setViewerGrantForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleGrantViewerAccess = async () => {
    if (!selectedSeries?.configKey || !accessToken) {
      return;
    }

    if (!viewerGrantAllowed) {
      const message = "New viewer grants are blocked by the current entity plan or viewer allocation limit.";
      setViewerGrantMutationStatus("error");
      setViewerGrantMutationError(message);
      setViewerGrantMutationMessage(null);
      toast({
        title: "Viewer access grant blocked",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const userId = viewerGrantForm.userId.trim();
    if (!userId) {
      const message = "A viewer user id is required.";
      setViewerGrantMutationStatus("error");
      setViewerGrantMutationError(message);
      setViewerGrantMutationMessage(null);
      toast({
        title: "Viewer access grant failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setViewerGrantMutationStatus("saving");
    setViewerGrantMutationError(null);
    setViewerGrantMutationMessage(null);

    try {
      const response = await createCricketAdminViewerGrant(
        selectedSeries.configKey,
        accessToken,
        {
          userId,
          accessRole: viewerGrantForm.accessRole,
          expiresAt: viewerGrantForm.expiresAt.trim() || undefined,
        }
      );

      const message = response.message || "Viewer access granted.";
      setViewerGrantMutationStatus("success");
      setViewerGrantMutationMessage(message);
      setViewerGrantForm({
        userId: "",
        accessRole: "viewer",
        expiresAt: "",
      });
      setViewerAccessReloadKey((current) => current + 1);

      toast({
        title: "Viewer access granted",
        description: message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Viewer access grant failed unexpectedly.";
      setViewerGrantMutationStatus("error");
      setViewerGrantMutationError(message);

      toast({
        title: "Viewer access grant failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRevokeViewerGrant = async (grant: CricketAdminViewerGrant) => {
    const grantId = grant.grantId?.trim();
    if (!selectedSeries?.configKey || !accessToken || !grantId) {
      return;
    }

    setViewerRevokeStatusByGrant((current) => ({
      ...current,
      [grantId]: "saving",
    }));

    try {
      const response = await revokeCricketAdminViewerGrant(
        selectedSeries.configKey,
        grantId,
        accessToken
      );

      setViewerRevokeStatusByGrant((current) => ({
        ...current,
        [grantId]: "success",
      }));
      setViewerAccessReloadKey((current) => current + 1);

      toast({
        title: "Viewer access revoked",
        description: response.message || "Viewer access revoked.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Viewer access revoke failed unexpectedly.";
      setViewerRevokeStatusByGrant((current) => ({
        ...current,
        [grantId]: "error",
      }));

      toast({
        title: "Viewer access revoke failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pb-20 pt-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-7xl space-y-8">
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
                    className="border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200"
                  >
                    Admin Shell
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300"
                  >
                    Setup + Access Controls
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl">
                    Series administration
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    Manage live series setup and first-pass match operations from inside Game-Changrs while keeping the
                    Render cricket API as the authoritative runtime.
                  </p>
                </div>
              </div>

              <Button asChild variant="outline" className="w-full md:w-auto">
                <Link to="/analytics">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Analytics
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Authenticated scope</p>
                      <div className="font-display text-2xl text-foreground">
                        {catalog?.actor?.email || user?.email || "Signed-in user"}
                      </div>
                      {catalog?.actor?.userId ? (
                        <p className="text-xs leading-6 text-muted-foreground">
                          User ID: <span className="font-mono text-foreground">{catalog.actor.userId}</span>
                        </p>
                      ) : null}
                      <p className="text-sm leading-6 text-muted-foreground">
                        The root app uses the signed-in Supabase session to read and update protected cricket admin
                        endpoints.
                      </p>
                    </div>

                    <Badge className={getAccessTone(catalog?.actor?.accessLabel)}>
                      {catalog?.actor?.isPlatformAdmin ? "Platform admin" : "Entity-scoped admin"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Entities</p>
                      <div className="mt-3 font-display text-4xl text-foreground">
                        {formatNumber(catalog?.entityCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Managed series</p>
                      <div className="mt-3 font-display text-4xl text-foreground">
                        {formatNumber(catalog?.seriesCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Current route</p>
                      <div className="mt-3 text-sm leading-6 text-foreground">/analytics/admin</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">This slice</p>
                      <p className="font-display text-2xl text-foreground">Subscription gates + plan checks</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm leading-7 text-muted-foreground">
                    <p>1. Discover manageable series for the signed-in admin.</p>
                    <p>2. Load the existing setup JSON for the selected series.</p>
                    <p>3. Surface the current entity plan, usage, and billing contract points.</p>
                    <p>4. Gate viewer grants and manual refresh with live entitlement checks.</p>
                    <p>5. Keep the verified cricket runtime unchanged while future paid controls take shape.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {selectedSeries ? (
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-cyan-200" />
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Subscription Enforcement
                        </p>
                      </div>
                      <div>
                        <h2 className="font-display text-2xl text-foreground">
                          {subscriptionSummary?.subscription?.planDisplayName || "Entity plan summary"}
                        </h2>
                        <p className="text-sm leading-7 text-muted-foreground">
                          Entitlements and capacity checks that gate viewer grants, manual refresh, and future paid series
                          management.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className={getStatusBadgeClass(subscriptionSummary?.subscription?.status)}>
                        {subscriptionSummary?.subscription?.status || "unconfigured"}
                      </Badge>
                      <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                        {subscriptionSummary?.subscription?.billingProvider || "internal"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          isHardSubscriptionEnforcement
                            ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                            : "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                        }
                      >
                        {subscriptionSummary?.subscription?.enforcementMode || "hard"} enforcement
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSubscriptionReloadKey((current) => current + 1)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh plan
                      </Button>
                    </div>
                  </div>

                  {subscriptionStatus === "loading" ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : null}

                  {subscriptionStatus === "error" ? (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                        <div className="space-y-3">
                          <p className="font-semibold text-destructive">Subscription summary could not be loaded</p>
                          <p className="text-sm leading-6 text-destructive/80">{subscriptionError}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {subscriptionStatus === "success" && subscriptionSummary ? (
                    <>
                      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Series usage</p>
                            <p className="mt-3 text-2xl font-semibold text-foreground">
                              {formatNumber(subscriptionSummary.usage?.seriesCount ?? 0)}
                              {subscriptionSummary.limits?.maxSeries !== null && subscriptionSummary.limits?.maxSeries !== undefined
                                ? ` / ${formatNumber(subscriptionSummary.limits?.maxSeries)}`
                                : ""}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Admin usage</p>
                            <p className="mt-3 text-2xl font-semibold text-foreground">
                              {formatNumber(subscriptionSummary.usage?.adminUserCount ?? 0)}
                              {subscriptionSummary.limits?.maxAdminUsers !== null && subscriptionSummary.limits?.maxAdminUsers !== undefined
                                ? ` / ${formatNumber(subscriptionSummary.limits?.maxAdminUsers)}`
                                : ""}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Viewer usage</p>
                            <p className="mt-3 text-2xl font-semibold text-foreground">
                              {formatNumber(subscriptionSummary.usage?.viewerUserCount ?? 0)}
                              {subscriptionSummary.limits?.maxViewerUsers !== null && subscriptionSummary.limits?.maxViewerUsers !== undefined
                                ? ` / ${formatNumber(subscriptionSummary.limits?.maxViewerUsers)}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Feature gates</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {[
                              {
                                label: "Manual refresh",
                                enabled: subscriptionSummary.entitlements?.manualRefreshEnabled === true,
                              },
                              {
                                label: "Scheduled refresh",
                                enabled: subscriptionSummary.entitlements?.scheduledRefreshEnabled === true,
                              },
                              {
                                label: "Weight tuning",
                                enabled: subscriptionSummary.entitlements?.weightTuningEnabled === true,
                              },
                              {
                                label: "Viewer grants",
                                enabled: subscriptionSummary.entitlements?.viewerGrantEnabled === true,
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3"
                              >
                                <p className="text-sm text-foreground">{item.label}</p>
                                <Badge
                                  className={
                                    item.enabled
                                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                      : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                  }
                                >
                                  {item.enabled ? "Enabled" : "Locked"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                        <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Billing contract points
                          </p>
                          <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                            <p>
                              <span className="font-semibold text-foreground">Plan key:</span>{" "}
                              {subscriptionSummary.subscription?.planKey || "-"}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Billing provider:</span>{" "}
                              {subscriptionSummary.subscription?.billingProvider || "-"}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Contract owner:</span>{" "}
                              {subscriptionSummary.subscription?.contractOwnerEmail || "-"}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Customer ref:</span>{" "}
                              {subscriptionSummary.subscription?.billingCustomerRef || "-"}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Subscription ref:</span>{" "}
                              {subscriptionSummary.subscription?.billingSubscriptionRef || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Enforcement warnings
                          </p>
                          <div className="mt-4 space-y-3">
                            {(subscriptionSummary.warnings ?? []).length ? (
                              (subscriptionSummary.warnings ?? []).map((warning) => (
                                <div
                                  key={warning}
                                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm leading-6 text-amber-200"
                                >
                                  {warning}
                                </div>
                              ))
                            ) : (
                              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm leading-6 text-emerald-200">
                                No subscription warnings are currently active for this entity.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {currentSubscriptionApiPath ? `API route: ${currentSubscriptionApiPath}` : ""}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {catalogStatus === "loading" ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.08fr]">
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-36 w-full" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {catalogStatus === "error" ? (
              <Card className="border-destructive/30 bg-destructive/5 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Admin shell could not load
                  </CardTitle>
                  <CardDescription className="text-destructive/80">{catalogError}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => setCatalogReloadKey((current) => current + 1)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry admin load
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {catalogStatus === "success" && catalog?.authFoundationReady !== true ? (
              <Card className="border-amber-500/30 bg-amber-500/8 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-200">
                    <Database className="h-5 w-5" />
                    Tenant foundation is not applied in the database yet
                  </CardTitle>
                  <CardDescription className="text-amber-100/80">
                    The admin shell is wired, but entity-scoped management will not resolve until the Phase 10 Step 1
                    migration is applied to the shared Supabase project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  {readinessItems.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-amber-500/20 bg-background/40 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-amber-100/70">{item.label}</p>
                      <p className="mt-3 font-semibold text-foreground">{item.ready ? "Ready" : "Missing"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {catalogStatus === "success" && catalog?.authFoundationReady === true && !series.length ? (
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader>
                  <CardTitle>No manageable series found</CardTitle>
                  <CardDescription>
                    This account is authenticated, but it does not currently map to any entity-owned cricket series.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {catalogStatus === "success" && catalog?.authFoundationReady === true && series.length ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
                  <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-3xl text-foreground">Managed series</CardTitle>
                    <CardDescription>
                      Select a series to load and edit its setup profile through the authenticated cricket admin API.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {series.map((item) => {
                      const isSelected = item.configKey === selectedSeries?.configKey;

                      return (
                        <button
                          key={item.configKey}
                          type="button"
                          onClick={() => handleSelectSeries(item.configKey)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-primary/40 bg-primary/10 shadow-lg"
                              : "border-border/80 bg-background/45 hover:border-primary/25 hover:bg-background/70"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-display text-2xl text-foreground">
                                {item.seriesName || item.configKey}
                              </p>
                              <p className="text-sm leading-6 text-muted-foreground">
                                {item.entityName || "Unassigned entity"}
                                {item.targetAgeGroup ? ` · ${item.targetAgeGroup}` : ""}
                                {item.seasonYear ? ` · ${item.seasonYear}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className={getAccessTone(item.accessRole)}>{item.accessRole || "admin"}</Badge>
                              {item.isActive ? (
                                <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                                  Active
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Players</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">{formatNumber(item.playerCount)}</p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Matches</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatNumber(item.computedMatches)} / {formatNumber(item.matchCount)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Warnings</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">{formatNumber(item.warningMatches)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardHeader>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="font-display text-3xl text-foreground">Live setup editor</CardTitle>
                        <CardDescription>
                          Existing setup data is loaded from the protected Render API and edited in place through the
                          same setup route.
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setSetupReloadKey((current) => current + 1)}
                          disabled={mutationStatus === "saving"}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reload
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void handleSave(true)}
                          disabled={!isDirty || mutationStatus === "saving" || !formState}
                        >
                          <SlidersHorizontal className="mr-2 h-4 w-4" />
                          Dry run
                        </Button>
                        <Button
                          onClick={() => void handleSave(false)}
                          disabled={!isDirty || mutationStatus === "saving" || !formState}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save setup
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-display text-2xl text-foreground">
                            {selectedSeries?.seriesName || selectedSeries?.configKey}
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {selectedSeries?.entityName || "Unassigned entity"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {selectedSeries?.sourceSystem ? (
                            <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                              {selectedSeries.sourceSystem}
                            </Badge>
                          ) : null}
                          {selectedSeries?.targetAgeGroup ? (
                            <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                              {selectedSeries.targetAgeGroup}
                            </Badge>
                          ) : null}
                          {isDirty ? (
                            <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">Unsaved changes</Badge>
                          ) : (
                            <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">In sync</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Players</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {formatNumber(selectedSeries?.playerCount)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Matches</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {formatNumber(setup?.liveSummary?.computedMatches)} / {formatNumber(setup?.liveSummary?.totalMatches)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Warnings</p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {formatNumber(setup?.liveSummary?.warningMatches)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {mutationMessage ? (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                        {mutationMessage}
                      </div>
                    ) : null}

                    {mutationError ? (
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                        {mutationError}
                      </div>
                    ) : null}

                    {setupStatus === "loading" ? (
                      <div className="space-y-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-44 w-full" />
                        <Skeleton className="h-56 w-full" />
                      </div>
                    ) : null}

                    {setupStatus === "error" ? (
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                          <div className="space-y-3">
                            <p className="font-semibold text-destructive">Live setup could not be loaded</p>
                            <p className="text-sm leading-6 text-destructive/80">{setupError}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {setupStatus === "success" && formState ? (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
                            <div className="flex items-center gap-2">
                              <Globe2 className="h-4 w-4 text-cyan-200" />
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Source setup
                              </p>
                            </div>

                            <div className="grid gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="series-name">Series display name</Label>
                                <Input
                                  id="series-name"
                                  value={formState.sourceSetup.name}
                                  onChange={(event) =>
                                    handleSourceFieldChange("name", event.target.value)
                                  }
                                />
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor="target-age-group">Target age group</Label>
                                  <Input
                                    id="target-age-group"
                                    value={formState.sourceSetup.targetAgeGroup}
                                    onChange={(event) =>
                                      handleSourceFieldChange("targetAgeGroup", event.target.value)
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="season-year">Season year</Label>
                                  <Input
                                    id="season-year"
                                    inputMode="numeric"
                                    value={formState.sourceSetup.seasonYear}
                                    onChange={(event) =>
                                      handleSourceFieldChange("seasonYear", event.target.value)
                                    }
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="series-url">Series source URL</Label>
                                <Input
                                  id="series-url"
                                  value={formState.sourceSetup.seriesUrl}
                                  onChange={(event) =>
                                    handleSourceFieldChange("seriesUrl", event.target.value)
                                  }
                                />
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor="expected-league-name">Expected league name</Label>
                                  <Input
                                    id="expected-league-name"
                                    value={formState.sourceSetup.expectedLeagueName}
                                    onChange={(event) =>
                                      handleSourceFieldChange("expectedLeagueName", event.target.value)
                                    }
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="expected-series-name">Expected series name</Label>
                                  <Input
                                    id="expected-series-name"
                                    value={formState.sourceSetup.expectedSeriesName}
                                    onChange={(event) =>
                                      handleSourceFieldChange("expectedSeriesName", event.target.value)
                                    }
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="series-notes">Series notes</Label>
                                <Textarea
                                  id="series-notes"
                                  className="min-h-[112px]"
                                  value={formState.sourceSetup.notes}
                                  onChange={(event) =>
                                    handleSourceFieldChange("notes", event.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
                            <div className="flex items-center gap-2">
                              <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Flags + profile
                              </p>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-background/60 p-3 text-sm leading-6 text-muted-foreground">
                              <span className="font-semibold text-foreground">Source system:</span>{" "}
                              {formState.sourceSetup.sourceSystem || selectedSeries?.sourceSystem || "-"}
                            </div>

                            <div className="grid gap-3">
                              <div className="space-y-2">
                                <Label>Active report profile</Label>
                                <Select
                                  value={formState.reportProfileKey || REPORT_PROFILE_NONE}
                                  onValueChange={(value) =>
                                    setFormState((current) =>
                                      current
                                        ? {
                                            ...current,
                                            reportProfileKey: value === REPORT_PROFILE_NONE ? "" : value,
                                          }
                                        : current,
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a report profile" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={REPORT_PROFILE_NONE}>Keep current assignment</SelectItem>
                                    {(setup?.reportProfile?.options ?? []).map((option) => (
                                      <SelectItem
                                        key={option.profileKey || option.name}
                                        value={option.profileKey || option.name || REPORT_PROFILE_NONE}
                                      >
                                        {option.name || option.profileKey}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {setup?.reportProfile?.options?.length ? (
                                  <p className="text-xs leading-6 text-muted-foreground">
                                    {setup.reportProfile.options.find(
                                      (option) => option.profileKey === formState.reportProfileKey,
                                    )?.description || "Report layout used for the player-facing executive report."}
                                  </p>
                                ) : null}
                              </div>

                              {[
                                {
                                  key: "scrapeCompletedOnly",
                                  label: "Scrape completed matches only",
                                },
                                {
                                  key: "includeBallByBall",
                                  label: "Include ball-by-ball commentary",
                                },
                                {
                                  key: "includePlayerProfiles",
                                  label: "Include player profile scraping",
                                },
                                {
                                  key: "enableAutoDiscovery",
                                  label: "Enable auto discovery",
                                },
                                {
                                  key: "isActive",
                                  label: "Mark this series active",
                                },
                              ].map((item) => (
                                <div
                                  key={item.key}
                                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3"
                                >
                                  <div>
                                    <p className="font-medium text-foreground">{item.label}</p>
                                  </div>
                                  <Switch
                                    checked={Boolean(formState.sourceSetup[item.key as keyof SetupFormState["sourceSetup"]])}
                                    onCheckedChange={(checked) =>
                                      handleSourceFieldChange(
                                        item.key as keyof SetupFormState["sourceSetup"],
                                        checked,
                                      )
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-cyan-200" />
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                  Division mappings
                                </p>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Update phase/division boundaries and inclusion flags for this series.
                              </p>
                            </div>

                            <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                              {formatNumber(divisionCount)} mapped divisions
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {formState.divisions.map((division, index) => (
                              <div
                                key={division.id ?? `${division.targetLabel}-${index}`}
                                className="rounded-2xl border border-border/70 bg-background/60 p-4"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-foreground">
                                      {division.targetLabel || `Division ${index + 1}`}
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {division.sourceLabel || "No linked source division label"}
                                      {division.sourceDivisionId ? ` · source ${division.sourceDivisionId}` : ""}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {division.aliases.map((alias) => (
                                      <Badge
                                        key={alias}
                                        variant="outline"
                                        className="border-border/80 bg-card/70 text-foreground"
                                      >
                                        {alias}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`division-target-${index}`}>Target label</Label>
                                    <Input
                                      id={`division-target-${index}`}
                                      value={division.targetLabel}
                                      onChange={(event) =>
                                        handleDivisionFieldChange(index, "targetLabel", event.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`division-phase-${index}`}>Phase</Label>
                                    <Input
                                      id={`division-phase-${index}`}
                                      inputMode="numeric"
                                      value={division.phaseNo}
                                      onChange={(event) =>
                                        handleDivisionFieldChange(index, "phaseNo", event.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`division-number-${index}`}>Division</Label>
                                    <Input
                                      id={`division-number-${index}`}
                                      inputMode="numeric"
                                      value={division.divisionNo}
                                      onChange={(event) =>
                                        handleDivisionFieldChange(index, "divisionNo", event.target.value)
                                      }
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`division-tier-${index}`}>Strength tier</Label>
                                    <Input
                                      id={`division-tier-${index}`}
                                      value={division.strengthTier}
                                      onChange={(event) =>
                                        handleDivisionFieldChange(index, "strengthTier", event.target.value)
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-[0.3fr_0.7fr]">
                                  <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="font-medium text-foreground">Include in scoring model</p>
                                        <p className="text-xs leading-6 text-muted-foreground">
                                          Toggle this division on or off for the active series setup.
                                        </p>
                                      </div>
                                      <Switch
                                        checked={division.includeFlag}
                                        onCheckedChange={(checked) =>
                                          handleDivisionFieldChange(index, "includeFlag", checked)
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`division-notes-${index}`}>Division notes</Label>
                                    <Textarea
                                      id={`division-notes-${index}`}
                                      className="min-h-[88px]"
                                      value={division.notes}
                                      onChange={(event) =>
                                        handleDivisionFieldChange(index, "notes", event.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {setup?.validationAnchors?.length ? (
                          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              Validation anchors
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                              {setup.validationAnchors.map((anchor) => (
                                <div
                                  key={anchor.id || `${anchor.entityType}-${anchor.entityName}`}
                                  className="rounded-xl border border-border/70 bg-background/60 p-3"
                                >
                                  <p className="font-semibold text-foreground">{anchor.entityName || anchor.entityType}</p>
                                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {anchor.expectationText || "No validation note recorded."}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1 text-sm leading-7 text-muted-foreground">
                            <p>
                              Setup writes go to the existing protected setup endpoint and keep the public selector/report
                              routes unchanged.
                            </p>
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              Root route: {currentAdminRoute}
                            </p>
                            {currentSetupApiPath ? (
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                API route: {currentSetupApiPath}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={handleResetChanges} disabled={!isDirty || mutationStatus === "saving"}>
                              Reset changes
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleSave(true)}
                              disabled={!isDirty || mutationStatus === "saving"}
                            >
                              Dry run
                            </Button>
                            <Button onClick={() => void handleSave(false)} disabled={!isDirty || mutationStatus === "saving"}>
                              {mutationStatus === "saving" ? "Saving..." : "Save setup"}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                  </Card>
                </div>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardHeader>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="font-display text-3xl text-foreground">
                          Job control plane
                        </CardTitle>
                        <CardDescription>
                          Use the existing protected cricket admin endpoints to create manual refresh requests, review
                          recent match operations, and force include or exclude decisions at the match level.
                        </CardDescription>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => setMatchOpsReloadKey((current) => current + 1)}
                        disabled={matchOpsStatus === "loading"}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reload jobs
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Total matches
                        </p>
                        <div className="mt-3 font-display text-4xl text-foreground">
                          {formatNumber(matchOps?.summary?.totalMatches)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Computed matches
                        </p>
                        <div className="mt-3 font-display text-4xl text-foreground">
                          {formatNumber(matchOps?.summary?.computedMatches)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Warning matches
                        </p>
                        <div className="mt-3 font-display text-4xl text-foreground">
                          {formatNumber(matchOps?.summary?.warningMatches)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Overrides
                        </p>
                        <div className="mt-3 font-display text-4xl text-foreground">
                          {formatNumber(matchOps?.summary?.overriddenMatches)}
                        </div>
                      </div>
                    </div>

                    {matchOpsStatus === "loading" ? (
                      <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-72 w-full" />
                      </div>
                    ) : null}

                    {matchOpsStatus === "error" ? (
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                          <div className="space-y-3">
                            <p className="font-semibold text-destructive">Live job controls could not be loaded</p>
                            <p className="text-sm leading-6 text-destructive/80">{matchOpsError}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[0.44fr_0.56fr]">
                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Manual refresh request
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="manual-refresh-url">CricClubs match URL</Label>
                            <Input
                              id="manual-refresh-url"
                              placeholder="https://cricclubs.com/.../results/7574"
                              value={refreshForm.matchUrl}
                              onChange={(event) =>
                                handleRefreshFormChange("matchUrl", event.target.value)
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="manual-refresh-reason">Reason</Label>
                            <Textarea
                              id="manual-refresh-reason"
                              className="min-h-[112px]"
                              placeholder="Explain why this match needs a manual refresh or recompute."
                              value={refreshForm.reason}
                              onChange={(event) =>
                                handleRefreshFormChange("reason", event.target.value)
                              }
                            />
                          </div>
                        </div>

                        {refreshMessage ? (
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                            {refreshMessage}
                          </div>
                        ) : null}

                        {refreshError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                            {refreshError}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => void handleCreateRefreshRequest()}
                            disabled={refreshStatus === "saving" || !manualRefreshAllowed}
                          >
                            {refreshStatus === "saving" ? "Creating request..." : "Create refresh request"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setRefreshForm({ matchUrl: "", reason: "" });
                              setRefreshStatus("idle");
                              setRefreshMessage(null);
                              setRefreshError(null);
                            }}
                            disabled={refreshStatus === "saving"}
                          >
                            Clear
                          </Button>
                        </div>

                        {!manualRefreshAllowed ? (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-200">
                            Manual refresh is disabled by the current entity plan.
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-7 text-muted-foreground">
                          This slice keeps orchestration small: manual refresh requests and per-match overrides are live
                          here, while full-series extract triggers, weekly schedules, and worker run history remain
                          deferred until the worker boundary is exposed safely.
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-cyan-200" />
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Recent requests
                              </p>
                            </div>
                            <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                              Latest {(matchOps?.recentRequests ?? []).length}
                            </Badge>
                          </div>

                          {(matchOps?.recentRequests ?? []).length ? (
                            <div className="space-y-3">
                              {(matchOps?.recentRequests ?? []).map((request) => (
                                <div
                                  key={request.requestId || `${request.requestSourceMatchId}-${request.requestedAt}`}
                                  className="rounded-2xl border border-border/70 bg-background/60 p-4"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-foreground">
                                        Match {request.linkedSourceMatchId || request.requestSourceMatchId || "-"}
                                      </p>
                                      <p className="text-sm leading-6 text-muted-foreground">
                                        Requested {formatDateTime(request.requestedAt)}
                                      </p>
                                    </div>
                                    <Badge className={getStatusBadgeClass(request.status)}>
                                      {request.status || "pending"}
                                    </Badge>
                                  </div>

                                  {request.reason ? (
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{request.reason}</p>
                                  ) : null}

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {request.requestMatchUrl ? (
                                      <a
                                        href={request.requestMatchUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                                      >
                                        Open source URL
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : null}
                                    {request.resolutionNote ? (
                                      <span className="text-xs text-muted-foreground">
                                        Resolution: {request.resolutionNote}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm leading-7 text-muted-foreground">
                              No manual refresh requests have been recorded for this series yet.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <ListChecks className="h-4 w-4 text-cyan-200" />
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Match operations
                              </p>
                            </div>
                            <p className="text-sm leading-6 text-muted-foreground">
                              Search loaded matches, inspect parse and analytics status, then force include or exclude
                              decisions when selector review requires it.
                            </p>
                          </div>

                          <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                            {(matchOps?.matches ?? []).length} loaded
                          </Badge>
                        </div>

                        <form
                          className="grid gap-3 md:grid-cols-[1fr_160px_auto]"
                          onSubmit={handleMatchSearchSubmit}
                        >
                          <div className="space-y-2">
                            <Label htmlFor="match-query">Search matches</Label>
                            <Input
                              id="match-query"
                              placeholder="Team, division, or source match ID"
                              value={matchQueryInput}
                              onChange={(event) => setMatchQueryInput(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Row limit</Label>
                            <Select
                              value={String(matchLimit)}
                              onValueChange={(value) => setMatchLimit(Number.parseInt(value, 10))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="25" />
                              </SelectTrigger>
                              <SelectContent>
                                {[10, 25, 50, 100].map((value) => (
                                  <SelectItem key={value} value={String(value)}>
                                    {value} rows
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-end">
                            <Button type="submit" variant="outline" className="w-full">
                              <Search className="mr-2 h-4 w-4" />
                              Apply
                            </Button>
                          </div>
                        </form>

                        {(matchOps?.matches ?? []).length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[260px]">Match</TableHead>
                                <TableHead className="min-w-[220px]">Status</TableHead>
                                <TableHead className="min-w-[180px]">Pending ops</TableHead>
                                <TableHead className="min-w-[280px]">Selection override</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(matchOps?.matches ?? []).map((match) => {
                                const matchId = match.matchId;
                                const draft = matchId ? overrideDrafts[matchId] : undefined;
                                const overrideStatus = matchId ? overrideMutationStatusByMatch[matchId] : undefined;
                                const overrideMessage = matchId ? overrideMessageByMatch[matchId] : "";
                                const overrideError = matchId ? overrideErrorByMatch[matchId] : "";
                                const pendingOpsCount = getPendingOpsCount(match);

                                return (
                                  <TableRow key={match.matchId || `${match.sourceMatchId}-${match.matchDate}`}>
                                    <TableCell className="align-top">
                                      <div className="space-y-2">
                                        <div>
                                          <p className="font-semibold text-foreground">
                                            {match.matchTitle || `Match ${match.matchId || "-"}`}
                                          </p>
                                          <p className="text-sm leading-6 text-muted-foreground">
                                            {match.divisionLabel || "Division unavailable"}
                                            {match.matchDateLabel ? ` · ${match.matchDateLabel}` : ""}
                                            {match.sourceMatchId ? ` · source ${match.sourceMatchId}` : ""}
                                          </p>
                                        </div>

                                        {match.resultText ? (
                                          <p className="text-sm leading-6 text-muted-foreground">{match.resultText}</p>
                                        ) : null}

                                        <div className="flex flex-wrap gap-3">
                                          {match.matchPageUrl ? (
                                            <a
                                              href={match.matchPageUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                                            >
                                              Match page
                                              <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                          ) : null}
                                          {match.scorecardUrl ? (
                                            <a
                                              href={match.scorecardUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                                            >
                                              Scorecard
                                              <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                          ) : null}
                                          {match.ballByBallUrl ? (
                                            <a
                                              href={match.ballByBallUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                                            >
                                              Ball by ball
                                              <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                          ) : null}
                                        </div>
                                      </div>
                                    </TableCell>

                                    <TableCell className="align-top">
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                          <Badge className={getStatusBadgeClass(match.analyticsStatus)}>
                                            Analytics {match.analyticsStatus || "pending"}
                                          </Badge>
                                          <Badge className={getStatusBadgeClass(match.parseStatus)}>
                                            Parse {match.parseStatus || "pending"}
                                          </Badge>
                                          <Badge className={getStatusBadgeClass(match.reconciliationStatus)}>
                                            Recon {match.reconciliationStatus || "pending"}
                                          </Badge>
                                        </div>

                                        {match.lastErrorMessage ? (
                                          <p className="text-xs leading-6 text-destructive">
                                            {match.lastErrorMessage}
                                          </p>
                                        ) : null}
                                      </div>
                                    </TableCell>

                                    <TableCell className="align-top">
                                      <div className="space-y-2">
                                        {pendingOpsCount ? (
                                          <div className="flex flex-wrap gap-2">
                                            {match.needsRescrape ? (
                                              <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                                                Rescrape
                                              </Badge>
                                            ) : null}
                                            {match.needsReparse ? (
                                              <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                                                Reparse
                                              </Badge>
                                            ) : null}
                                            {match.needsRecompute ? (
                                              <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                                                Recompute
                                              </Badge>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="inline-flex items-center gap-2 text-sm text-emerald-300">
                                            <CheckCircle2 className="h-4 w-4" />
                                            No pending flags
                                          </div>
                                        )}

                                        {match.lastChangeReason ? (
                                          <p className="text-xs leading-6 text-muted-foreground">
                                            Last change: {match.lastChangeReason}
                                          </p>
                                        ) : null}
                                      </div>
                                    </TableCell>

                                    <TableCell className="align-top">
                                      {matchId && draft ? (
                                        <div className="space-y-3">
                                          <Badge className={getOverrideBadgeClass(match.adminSelectionOverride)}>
                                            {getOverrideLabel(match.adminSelectionOverride)}
                                          </Badge>

                                          <Select
                                            value={draft.override}
                                            onValueChange={(value) =>
                                              handleOverrideDraftChange(matchId, "override", value)
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select override" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="auto">Auto</SelectItem>
                                              <SelectItem value="force_include">Force include</SelectItem>
                                              <SelectItem value="force_exclude">Force exclude</SelectItem>
                                            </SelectContent>
                                          </Select>

                                          <Input
                                            placeholder="Reason required for force include or exclude"
                                            value={draft.reason}
                                            disabled={draft.override === "auto"}
                                            onChange={(event) =>
                                              handleOverrideDraftChange(matchId, "reason", event.target.value)
                                            }
                                          />

                                          {overrideMessage ? (
                                            <p className="text-xs leading-6 text-emerald-300">{overrideMessage}</p>
                                          ) : null}

                                          {overrideError ? (
                                            <p className="text-xs leading-6 text-destructive">{overrideError}</p>
                                          ) : null}

                                          <Button
                                            variant="outline"
                                            onClick={() => void handleSaveSelectionOverride(matchId)}
                                            disabled={overrideStatus === "saving"}
                                          >
                                            {overrideStatus === "saving" ? "Saving..." : "Save override"}
                                          </Button>
                                        </div>
                                      ) : (
                                        <p className="text-sm leading-6 text-muted-foreground">
                                          Match override controls are unavailable for this row.
                                        </p>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm leading-7 text-muted-foreground">
                            No matches matched the current filter. Adjust the search or row limit and reload the live
                            match operations.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1 text-sm leading-7 text-muted-foreground">
                        <p>
                          Job-control actions continue to use the verified cricket API as the source of truth and keep
                          the public analytics landing, player search, and player report routes unchanged.
                        </p>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Root route: {currentAdminRoute}
                        </p>
                        {currentMatchesApiPath ? (
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            API route: {currentMatchesApiPath}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Manual refresh requests</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Per-match selection overrides</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Deferred
                          </p>
                          <p className="mt-2 text-sm text-foreground">Scheduler and run history</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Viewer Access And Sharing
                          </p>
                        </div>
                        <div>
                          <h2 className="font-display text-2xl text-foreground">Series report access</h2>
                          <p className="text-sm leading-7 text-muted-foreground">
                            Grant or revoke viewer and analyst access for the currently selected series without changing the
                            verified cricket report runtime.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Active viewers</p>
                          <p className="mt-2 text-sm text-foreground">
                            {formatNumber(viewerAccess?.totals?.activeViewers ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Active analysts</p>
                          <p className="mt-2 text-sm text-foreground">
                            {formatNumber(viewerAccess?.totals?.activeAnalysts ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Viewer plan cap</p>
                          <p className="mt-2 text-sm text-foreground">
                            {formatNumber(viewerAccess?.subscription?.maxViewerUsers ?? null)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Grant access
                          </p>
                          <p className="text-sm leading-7 text-muted-foreground">
                            Users must sign in once to Game-Changrs before you can grant access. Use their root-app user id,
                            not a CricClubs player id.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="viewer-access-user-id">Viewer user id</Label>
                          <Input
                            id="viewer-access-user-id"
                            placeholder="5ffa7fd5-37b9-4505-b819-8357be68de8f"
                            value={viewerGrantForm.userId}
                            onChange={(event) => handleViewerGrantFieldChange("userId", event.target.value)}
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="viewer-access-role">Access role</Label>
                            <Select
                              value={viewerGrantForm.accessRole}
                              onValueChange={(value) =>
                                handleViewerGrantFieldChange("accessRole", value as ViewerGrantFormState["accessRole"])
                              }
                            >
                              <SelectTrigger id="viewer-access-role">
                                <SelectValue placeholder="Viewer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="analyst">Analyst</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="viewer-access-expires-at">Expires at (optional)</Label>
                            <Input
                              id="viewer-access-expires-at"
                              type="datetime-local"
                              value={viewerGrantForm.expiresAt}
                              onChange={(event) => handleViewerGrantFieldChange("expiresAt", event.target.value)}
                            />
                          </div>
                        </div>

                        {viewerGrantMutationMessage ? (
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                            {viewerGrantMutationMessage}
                          </div>
                        ) : null}

                        {viewerGrantMutationError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                            {viewerGrantMutationError}
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleGrantViewerAccess()}
                            disabled={viewerGrantMutationStatus === "saving" || !viewerGrantAllowed}
                          >
                            {viewerGrantMutationStatus === "saving" ? "Granting..." : "Grant access"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setViewerGrantForm({
                                userId: "",
                                accessRole: "viewer",
                                expiresAt: "",
                              })
                            }
                            disabled={viewerGrantMutationStatus === "saving"}
                          >
                            Clear
                          </Button>
                        </div>

                        {!viewerGrantAllowed ? (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-200">
                            New viewer grants are blocked by the current entity plan or viewer allocation limit.
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-7 text-muted-foreground">
                          If a user hits an access wall on <span className="font-mono text-foreground">/analytics</span> or a
                          root report route, tell them to copy the displayed <span className="font-mono text-foreground">User ID</span>
                          {" "}and send it to the series admin.
                        </div>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              Current grants
                            </p>
                            <p className="text-sm leading-7 text-muted-foreground">
                              Active and revoked access rows for this specific series.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setViewerAccessReloadKey((current) => current + 1)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                          </Button>
                        </div>

                        {viewerAccessStatus === "loading" ? (
                          <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                          </div>
                        ) : null}

                        {viewerAccessStatus === "error" && viewerAccessError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                              <div className="space-y-3">
                                <p className="font-semibold text-destructive">Viewer access grants could not be loaded</p>
                                <p className="text-sm leading-6 text-destructive/80">{viewerAccessError}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {viewerAccessStatus === "success" ? (
                          (viewerAccess?.grants ?? []).length ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[220px]">User</TableHead>
                                  <TableHead className="min-w-[150px]">Role</TableHead>
                                  <TableHead className="min-w-[180px]">Status</TableHead>
                                  <TableHead className="min-w-[200px]">Expiry</TableHead>
                                  <TableHead className="min-w-[160px]">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(viewerAccess?.grants ?? []).map((grant) => {
                                  const grantId = grant.grantId || "";
                                  const revokeStatus = grantId ? viewerRevokeStatusByGrant[grantId] : undefined;

                                  return (
                                    <TableRow key={grant.grantId || `${grant.userId}-${grant.createdAt}`}>
                                      <TableCell className="align-top">
                                        <div className="space-y-1">
                                          <p className="break-all font-mono text-xs text-foreground">
                                            {grant.userId || "-"}
                                          </p>
                                          <p className="text-xs leading-6 text-muted-foreground">
                                            Granted by {grant.grantedByUserId || "-"}
                                          </p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="align-top">
                                        <Badge className={getViewerAccessRoleBadgeClass(grant.accessRole)}>
                                          {grant.accessRole || "viewer"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="align-top">
                                        <div className="space-y-2">
                                          <Badge className={getStatusBadgeClass(grant.isExpired ? "warning" : grant.status)}>
                                            {grant.isExpired ? "expired" : grant.status || "active"}
                                          </Badge>
                                          <p className="text-xs leading-6 text-muted-foreground">
                                            Updated {formatDateTime(grant.updatedAt)}
                                          </p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="align-top">
                                        <p className="text-sm leading-6 text-foreground">
                                          {grant.expiresAt ? formatDateTime(grant.expiresAt) : "No expiry"}
                                        </p>
                                      </TableCell>
                                      <TableCell className="align-top">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={grant.status === "revoked" || revokeStatus === "saving" || !grantId}
                                          onClick={() => void handleRevokeViewerGrant(grant)}
                                        >
                                          {revokeStatus === "saving" ? "Revoking..." : "Revoke"}
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm leading-7 text-muted-foreground">
                              No viewer or analyst grants exist for this series yet.
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1 text-sm leading-7 text-muted-foreground">
                        <p>
                          This slice begins enforcing viewer access in the root Game-Changrs analytics flow while leaving the
                          existing standalone Render report runtime unchanged for now.
                        </p>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Root route: {currentAdminRoute}
                        </p>
                        {currentViewersApiPath ? (
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            API route: {currentViewersApiPath}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Series viewer grants</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Root-app access checks</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Deferred
                          </p>
                          <p className="mt-2 text-sm text-foreground">Invite-by-email and hard backend lock</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AnalyticsAdmin;

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
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
  assignCricketAdminEntityMembership,
  createCricketAdminSeries,
  createCricketAdminRefreshRequest,
  createCricketSeriesAdminAccessRequest,
  createCricketAdminViewerGrant,
  CricketAdminEntityAccessRequest,
  CricketAdminEntityMembership,
  CricketAdminCreateSeriesPayload,
  CricketAdminMatchOpsMatch,
  CricketAdminMatchOpsResponse,
  CricketAdminMatchSelectionOverride,
  CricketAdminSeriesAccessRequest,
  CricketAdminSeriesItem,
  CricketAdminSeriesResponse,
  CricketAdminSetupResponse,
  CricketAdminSetupUpdatePayload,
  CricketAdminSubscriptionSummaryResponse,
  CricketAdminViewerGrant,
  CricketAdminViewerGrantsResponse,
  decideCricketAdminEntityAccessRequest,
  decideCricketAdminAccessRequest,
  fetchCricketAdminSeries,
  fetchCricketAdminMatchOps,
  fetchCricketAdminSubscriptionSummary,
  fetchCricketAdminSetup,
  fetchCricketAdminViewerGrants,
  getAnalyticsPlatformAdminRoute,
  removeCricketAdminEntityMembership,
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
type SeriesEntryMode = "edit" | "create";
type PendingRequestFilter = "all" | "ready" | "waiting";

type RefreshRequestFormState = {
  matchUrl: string;
  reason: string;
};

type MatchOverrideDraft = {
  override: CricketAdminMatchSelectionOverride;
  reason: string;
};

type ViewerInviteFormState = {
  email: string;
  accessRole: "viewer" | "analyst";
  expiresAt: string;
};

type ViewerDirectGrantFormState = {
  userId: string;
  accessRole: "viewer" | "analyst";
  expiresAt: string;
};

type SeriesAdminInviteFormState = {
  email: string;
};

type SeriesCreationFormState = {
  entityId: string;
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

function getEntityAdminMembershipTone(membership: CricketAdminEntityMembership) {
  if (membership.isOwner) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

function getPendingRequestReadiness(requestType?: string | null, requestedUserId?: string | null) {
  return requestType === "self_request" && Boolean(requestedUserId) ? "ready" : "waiting";
}

function matchesPendingRequestFilter(
  filter: PendingRequestFilter,
  requestType?: string | null,
  requestedUserId?: string | null,
) {
  if (filter === "all") {
    return true;
  }

  return getPendingRequestReadiness(requestType, requestedUserId) === filter;
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

function createSeriesCreationForm(entityId = ""): SeriesCreationFormState {
  return {
    entityId,
    sourceSetup: {
      name: "",
      sourceSystem: "cricclubs",
      seriesUrl: "",
      expectedLeagueName: "",
      expectedSeriesName: "",
      seasonYear: String(new Date().getFullYear()),
      targetAgeGroup: "",
      scrapeCompletedOnly: true,
      includeBallByBall: true,
      includePlayerProfiles: true,
      enableAutoDiscovery: true,
      isActive: false,
      notes: "",
    },
  };
}

const mandatoryCaptureSwitches = [
  {
    key: "scrapeCompletedOnly" as const,
    label: "Completed matches only",
    body: "Ignore fixtures that are still live or incomplete until the final scorecard is stable.",
  },
  {
    key: "includeBallByBall" as const,
    label: "Include ball-by-ball",
    body: "Store commentary and delivery-level events so the series can support deeper analytics and evidence.",
  },
  {
    key: "includePlayerProfiles" as const,
    label: "Include player profiles",
    body: "Pull available public player-profile details from the source when they exist.",
  },
  {
    key: "enableAutoDiscovery" as const,
    label: "Auto-discover linked pages",
    body: "Let the extractor follow the main source page to find linked results, divisions, and scorecards.",
  },
  {
    key: "isActive" as const,
    label: "Active in live analytics",
    body: "Show this series in the live analytics workspace as soon as the source setup is ready.",
  },
];

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
  const [seriesEntryMode, setSeriesEntryMode] = useState<SeriesEntryMode>("edit");
  const [createSeriesForm, setCreateSeriesForm] = useState<SeriesCreationFormState>(createSeriesCreationForm());
  const [createSeriesStatus, setCreateSeriesStatus] = useState<MutationStatus>("idle");
  const [createSeriesMessage, setCreateSeriesMessage] = useState<string | null>(null);
  const [createSeriesError, setCreateSeriesError] = useState<string | null>(null);
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
  const [viewerInviteForm, setViewerInviteForm] = useState<ViewerInviteFormState>({
    email: "",
    accessRole: "viewer",
    expiresAt: "",
  });
  const [viewerInviteMutationStatus, setViewerInviteMutationStatus] = useState<MutationStatus>("idle");
  const [viewerInviteMutationMessage, setViewerInviteMutationMessage] = useState<string | null>(null);
  const [viewerInviteMutationError, setViewerInviteMutationError] = useState<string | null>(null);
  const [viewerDirectGrantForm, setViewerDirectGrantForm] = useState<ViewerDirectGrantFormState>({
    userId: "",
    accessRole: "viewer",
    expiresAt: "",
  });
  const [viewerDirectGrantMutationStatus, setViewerDirectGrantMutationStatus] = useState<MutationStatus>("idle");
  const [viewerDirectGrantMutationMessage, setViewerDirectGrantMutationMessage] = useState<string | null>(null);
  const [viewerDirectGrantMutationError, setViewerDirectGrantMutationError] = useState<string | null>(null);
  const [viewerRevokeStatusByGrant, setViewerRevokeStatusByGrant] = useState<Record<string, MutationStatus>>({});
  const [accessRequestDecisionStatusByRequest, setAccessRequestDecisionStatusByRequest] = useState<Record<string, MutationStatus>>({});
  const [entityAdminDrafts, setEntityAdminDrafts] = useState<Record<string, string>>({});
  const [entityAdminMessages, setEntityAdminMessages] = useState<Record<string, string>>({});
  const [entityAdminErrors, setEntityAdminErrors] = useState<Record<string, string>>({});
  const [activeEntityAdminMutationKey, setActiveEntityAdminMutationKey] = useState<string | null>(null);
  const [seriesAdminInviteForm, setSeriesAdminInviteForm] = useState<SeriesAdminInviteFormState>({
    email: "",
  });
  const [seriesAdminInviteMutationStatus, setSeriesAdminInviteMutationStatus] = useState<MutationStatus>("idle");
  const [seriesAdminInviteMutationMessage, setSeriesAdminInviteMutationMessage] = useState<string | null>(null);
  const [seriesAdminInviteMutationError, setSeriesAdminInviteMutationError] = useState<string | null>(null);
  const [entityAdminRequestDecisionStatusByRequest, setEntityAdminRequestDecisionStatusByRequest] = useState<Record<string, MutationStatus>>({});
  const [entityAdminRequestFilter, setEntityAdminRequestFilter] = useState<PendingRequestFilter>("all");
  const [entityAdminRequestQuery, setEntityAdminRequestQuery] = useState("");
  const [viewerRequestFilter, setViewerRequestFilter] = useState<PendingRequestFilter>("all");
  const [viewerRequestQuery, setViewerRequestQuery] = useState("");
  const [seriesAdminSelfRequestStatus, setSeriesAdminSelfRequestStatus] = useState<MutationStatus>("idle");
  const [seriesAdminSelfRequestMessage, setSeriesAdminSelfRequestMessage] = useState<string | null>(null);

  const accessToken = session?.access_token || "";
  const selectedSeriesKey = searchParams.get("series")?.trim() || "";
  const series = catalog?.series ?? [];
  const entities = catalog?.entities ?? [];
  const isPlatformAdminActor = catalog?.actor?.isPlatformAdmin === true;
  const hasSeriesAdminConsoleAccess = isPlatformAdminActor || entities.length > 0;
  const selectedSeries =
    series.find((item) => item.configKey === selectedSeriesKey) || series[0] || null;
  const selectedEntityId = seriesEntryMode === "create"
    ? (createSeriesForm.entityId || selectedSeries?.entityId || entities[0]?.entityId || "")
    : (selectedSeries?.entityId || createSeriesForm.entityId || entities[0]?.entityId || "");
  const selectedEntity =
    entities.find((item) => item.entityId === selectedEntityId)
    || entities.find((item) => item.entityId === selectedSeries?.entityId)
    || entities[0]
    || null;
  const readinessItems = getReadinessItems(catalog);
  const selectedSeriesDisplayName = selectedSeries?.seriesName || selectedSeries?.configKey || "No series selected";
  const selectedSeriesContext = [
    selectedSeries?.entityName,
    selectedSeries?.targetAgeGroup,
    selectedSeries?.seasonYear ? String(selectedSeries.seasonYear) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const currentFormSignature = formState ? JSON.stringify(formState) : "";
  const initialFormSignature = initialFormState ? JSON.stringify(initialFormState) : "";
  const isDirty = Boolean(formState && initialFormState && currentFormSignature !== initialFormSignature);
  const divisionCount = formState?.divisions.length ?? setup?.divisions?.length ?? 0;
  const subscriptionReady = subscriptionStatus === "success" && Boolean(subscriptionSummary);
  const isHardSubscriptionEnforcement =
    (subscriptionSummary?.subscription?.enforcementMode || "hard").toLowerCase() !== "advisory";
  const planSummaryLabel =
    subscriptionStatus === "loading"
      ? "Loading plan"
      : subscriptionSummary?.subscription?.planDisplayName
        || subscriptionSummary?.subscription?.planKey
        || "Plan not loaded";
  const planStatusLabel =
    subscriptionStatus === "loading"
      ? "Loading"
      : subscriptionSummary?.subscription?.status || "Unknown";
  const manualRefreshAllowed = subscriptionReady
    ? (subscriptionSummary?.entitlements?.manualRefreshEnabled !== false || !isHardSubscriptionEnforcement)
    : false;
  const viewerGrantEnabledByPlan = subscriptionReady
    ? (subscriptionSummary?.entitlements?.viewerGrantEnabled !== false || !isHardSubscriptionEnforcement)
    : false;
  const viewerImmediateGrantAllowed = viewerGrantEnabledByPlan
    ? (
        !subscriptionSummary?.limits?.viewerLimitReached
        || !isHardSubscriptionEnforcement
      )
    : false;
  const pendingViewerAccessRequests = viewerAccess?.requests?.filter((request) => request.requestStatus === "pending") ?? [];
  const pendingEntityAdminRequests =
    (selectedEntity?.adminRequests ?? []).filter((request) => request.requestStatus === "pending");
  const filteredPendingEntityAdminRequests = useMemo(() => {
    const normalizedQuery = entityAdminRequestQuery.trim().toLowerCase();
    return pendingEntityAdminRequests.filter((request) => {
      if (!matchesPendingRequestFilter(entityAdminRequestFilter, request.requestType, request.requestedUserId)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        request.requestedEmail,
        request.requestedUserId,
        request.requestNote,
        request.requestType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [entityAdminRequestFilter, entityAdminRequestQuery, pendingEntityAdminRequests]);
  const filteredPendingViewerAccessRequests = useMemo(() => {
    const normalizedQuery = viewerRequestQuery.trim().toLowerCase();
    return pendingViewerAccessRequests.filter((request) => {
      if (!matchesPendingRequestFilter(viewerRequestFilter, request.requestType, request.requestedUserId)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        request.requestedEmail,
        request.requestedUserId,
        request.requestNote,
        request.requestType,
        request.requestedAccessRole,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [pendingViewerAccessRequests, viewerRequestFilter, viewerRequestQuery]);
  const readyEntityAdminRequestCount = useMemo(
    () => pendingEntityAdminRequests.filter((request) => getPendingRequestReadiness(request.requestType, request.requestedUserId) === "ready").length,
    [pendingEntityAdminRequests]
  );
  const waitingEntityAdminRequestCount = useMemo(
    () => pendingEntityAdminRequests.filter((request) => getPendingRequestReadiness(request.requestType, request.requestedUserId) === "waiting").length,
    [pendingEntityAdminRequests]
  );
  const readyViewerRequestCount = useMemo(
    () => pendingViewerAccessRequests.filter((request) => getPendingRequestReadiness(request.requestType, request.requestedUserId) === "ready").length,
    [pendingViewerAccessRequests]
  );
  const waitingViewerRequestCount = useMemo(
    () => pendingViewerAccessRequests.filter((request) => getPendingRequestReadiness(request.requestType, request.requestedUserId) === "waiting").length,
    [pendingViewerAccessRequests]
  );
  const totalSeriesMatches = matchOps?.summary?.totalMatches ?? 0;
  const computedSeriesMatches = matchOps?.summary?.computedMatches ?? 0;
  const warningSeriesMatches = matchOps?.summary?.warningMatches ?? 0;
  const overriddenSeriesMatches = matchOps?.summary?.overriddenMatches ?? 0;
  const pendingSeriesOps = matchOps?.summary?.pendingOps ?? 0;
  const loadedMatchCount = matchOps?.matches?.length ?? 0;
  const recentRefreshCount = matchOps?.recentRequests?.length ?? 0;
  const latestRefreshRequest = matchOps?.recentRequests?.[0] ?? null;
  const computedCoveragePercent = totalSeriesMatches > 0
    ? Math.round((computedSeriesMatches / totalSeriesMatches) * 100)
    : 0;
  const operationsHealthLabel = pendingSeriesOps > 0
    ? "Action needed"
    : warningSeriesMatches > 0
      ? "Review warnings"
      : totalSeriesMatches > 0 && computedSeriesMatches === totalSeriesMatches
        ? "Current"
        : computedSeriesMatches > 0
          ? "Partially computed"
          : "Pending";
  const operationsHealthTone = pendingSeriesOps > 0
    ? "watch"
    : warningSeriesMatches > 0
      ? "watch"
      : totalSeriesMatches > 0 && computedSeriesMatches === totalSeriesMatches
        ? "good"
        : "risk";
  const reviewQueueMatches = useMemo(
    () => (matchOps?.matches ?? [])
      .filter((match) => {
        const pendingOpsCount = getPendingOpsCount(match);
        return (
          pendingOpsCount > 0
          || match.reconciliationStatus === "warn"
          || Boolean(match.lastErrorMessage)
          || (match.adminSelectionOverride && match.adminSelectionOverride !== "auto")
        );
      })
      .slice(0, 3),
    [matchOps]
  );

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
    const fallbackEntityId = selectedSeries?.entityId || entities[0]?.entityId || "";
    setCreateSeriesForm((current) => {
      if (current.entityId || !fallbackEntityId) {
        return current;
      }

      return {
        ...current,
        entityId: fallbackEntityId,
      };
    });
  }, [entities, selectedSeries?.entityId]);

  useEffect(() => {
    if (catalogStatus !== "success" || catalog?.authFoundationReady !== true) {
      return;
    }

    if (!series.length) {
      setSeriesEntryMode("create");
    } else if (seriesEntryMode !== "create") {
      setSeriesEntryMode("edit");
    }
  }, [catalog?.authFoundationReady, catalogStatus, series.length, seriesEntryMode]);

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
    setViewerInviteForm({
      email: "",
      accessRole: "viewer",
      expiresAt: "",
    });
    setViewerInviteMutationStatus("idle");
    setViewerInviteMutationMessage(null);
    setViewerInviteMutationError(null);
    setViewerDirectGrantForm({
      userId: "",
      accessRole: "viewer",
      expiresAt: "",
    });
    setViewerDirectGrantMutationStatus("idle");
    setViewerDirectGrantMutationMessage(null);
    setViewerDirectGrantMutationError(null);
    setViewerRevokeStatusByGrant({});
    setAccessRequestDecisionStatusByRequest({});
    setSeriesAdminInviteForm({
      email: "",
    });
    setSeriesAdminInviteMutationStatus("idle");
    setSeriesAdminInviteMutationMessage(null);
    setSeriesAdminInviteMutationError(null);
    setEntityAdminRequestDecisionStatusByRequest({});
    setEntityAdminRequestFilter("all");
    setEntityAdminRequestQuery("");
    setViewerRequestFilter("all");
    setViewerRequestQuery("");
    setSeriesAdminSelfRequestStatus("idle");
    setSeriesAdminSelfRequestMessage(null);
  }, [selectedSeries?.configKey]);

  async function refreshAdminCatalogSnapshot() {
    if (!accessToken) {
      return;
    }

    try {
      const payload = await fetchCricketAdminSeries(accessToken);
      setCatalog(payload);
      setCatalogStatus("success");
      setCatalogError(null);
    } catch (error) {
      setCatalogStatus("error");
      setCatalogError(error instanceof Error ? error.message : "Admin series access could not be loaded.");
    }
  }

  const handleSeriesAdminInviteFieldChange = (field: keyof SeriesAdminInviteFormState, value: string) => {
    setSeriesAdminInviteForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleInviteEntityAdmin = async () => {
    if (!accessToken || !selectedEntity?.entityId) {
      return;
    }

    const email = seriesAdminInviteForm.email.trim();
    if (!email) {
      const message = "Enter the email address that should be pre-approved for series-admin access.";
      setSeriesAdminInviteMutationStatus("error");
      setSeriesAdminInviteMutationError(message);
      setSeriesAdminInviteMutationMessage(null);
      toast({
        title: "Series-admin invite failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setSeriesAdminInviteMutationStatus("saving");
    setSeriesAdminInviteMutationError(null);
    setSeriesAdminInviteMutationMessage(null);

    try {
      const result = await assignCricketAdminEntityMembership(selectedEntity.entityId, accessToken, {
        email,
        role: "admin",
      });

      await refreshAdminCatalogSnapshot();
      setSeriesAdminInviteForm({ email: "" });
      setSeriesAdminInviteMutationStatus("success");
      setSeriesAdminInviteMutationMessage(
        result.message || "Series-admin email invite saved."
      );

      toast({
        title: "Series-admin invite saved",
        description: result.message || "Series-admin email invite saved.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Series-admin invite failed unexpectedly.";
      setSeriesAdminInviteMutationStatus("error");
      setSeriesAdminInviteMutationError(message);
      setSeriesAdminInviteMutationMessage(null);
      toast({
        title: "Series-admin invite failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleEntityAdminRequestDecision = async (
    request: CricketAdminEntityAccessRequest,
    action: "approve" | "decline",
  ) => {
    if (!accessToken || !selectedEntity?.entityId) {
      return;
    }

    const requestId = request.requestId || "";
    if (!requestId) {
      return;
    }

    setEntityAdminRequestDecisionStatusByRequest((current) => ({
      ...current,
      [requestId]: "saving",
    }));

    try {
      const result = await decideCricketAdminEntityAccessRequest(
        selectedEntity.entityId,
        requestId,
        accessToken,
        {
          action,
        },
      );

      await refreshAdminCatalogSnapshot();
      setEntityAdminRequestDecisionStatusByRequest((current) => ({
        ...current,
        [requestId]: "success",
      }));

      toast({
        title: action === "approve" ? "Series-admin request approved" : "Series-admin request declined",
        description:
          result.message
          || (action === "approve" ? "Series-admin request approved." : "Series-admin request declined."),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Series-admin request decision failed unexpectedly.";
      setEntityAdminRequestDecisionStatusByRequest((current) => ({
        ...current,
        [requestId]: "error",
      }));
      toast({
        title: "Series-admin request decision failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRequestSeriesAdminAccess = async () => {
    if (!accessToken || !selectedSeriesKey) {
      const message = "Open the series admin console from a specific series so the request can be routed correctly.";
      setSeriesAdminSelfRequestStatus("error");
      setSeriesAdminSelfRequestMessage(message);
      return;
    }

    setSeriesAdminSelfRequestStatus("saving");
    setSeriesAdminSelfRequestMessage(null);

    try {
      const result = await createCricketSeriesAdminAccessRequest(selectedSeriesKey, accessToken, {
        requestNote: "User requested series-admin access from the series admin console.",
      });

      if (result.accessGranted) {
        setCatalogReloadKey((current) => current + 1);
        setSeriesAdminSelfRequestStatus("success");
        setSeriesAdminSelfRequestMessage(result.message || "Series-admin access is now active.");
        return;
      }

      setSeriesAdminSelfRequestStatus("success");
      setSeriesAdminSelfRequestMessage(result.message || "Series-admin request submitted for review.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Series-admin request could not be submitted.";
      setSeriesAdminSelfRequestStatus("error");
      setSeriesAdminSelfRequestMessage(message);
    }
  };

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

  const handleCreateSeriesSourceFieldChange = (
    field: keyof SeriesCreationFormState["sourceSetup"],
    value: string | boolean,
  ) => {
    setCreateSeriesForm((current) => ({
      ...current,
      sourceSetup: {
        ...current.sourceSetup,
        [field]: value,
      },
    }));
  };

  const handleResetCreateSeriesForm = () => {
    setCreateSeriesForm(createSeriesCreationForm(selectedSeries?.entityId || entities[0]?.entityId || ""));
    setCreateSeriesStatus("idle");
    setCreateSeriesMessage(null);
    setCreateSeriesError(null);
  };

  const handleStartCreateSeries = () => {
    if (isDirty && !window.confirm("Unsaved setup changes in the selected series will be lost. Continue?")) {
      return;
    }

    handleResetCreateSeriesForm();
    setSeriesEntryMode("create");
  };

  const handleStartEditSeries = () => {
    setSeriesEntryMode("edit");
    setCreateSeriesStatus("idle");
    setCreateSeriesMessage(null);
    setCreateSeriesError(null);
  };

  const handleCreateSeries = async (dryRun = false) => {
    if (!accessToken) {
      return;
    }

    if (!createSeriesForm.entityId.trim()) {
      const message = "Choose the entity that will own this series.";
      setCreateSeriesStatus("error");
      setCreateSeriesError(message);
      setCreateSeriesMessage(null);
      toast({
        title: "Series creation failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const body: CricketAdminCreateSeriesPayload = {
      entityId: createSeriesForm.entityId,
      sourceSetup: {
        name: createSeriesForm.sourceSetup.name,
        sourceSystem: createSeriesForm.sourceSetup.sourceSystem,
        seriesUrl: createSeriesForm.sourceSetup.seriesUrl,
        expectedLeagueName: createSeriesForm.sourceSetup.expectedLeagueName,
        expectedSeriesName: createSeriesForm.sourceSetup.expectedSeriesName,
        seasonYear: parseIntegerOrNull(createSeriesForm.sourceSetup.seasonYear),
        targetAgeGroup: createSeriesForm.sourceSetup.targetAgeGroup,
        scrapeCompletedOnly: createSeriesForm.sourceSetup.scrapeCompletedOnly,
        includeBallByBall: createSeriesForm.sourceSetup.includeBallByBall,
        includePlayerProfiles: createSeriesForm.sourceSetup.includePlayerProfiles,
        enableAutoDiscovery: createSeriesForm.sourceSetup.enableAutoDiscovery,
        isActive: createSeriesForm.sourceSetup.isActive,
        notes: createSeriesForm.sourceSetup.notes,
      },
    };

    setCreateSeriesStatus("saving");
    setCreateSeriesError(null);
    setCreateSeriesMessage(null);

    try {
      const response = await createCricketAdminSeries(accessToken, body, { dryRun });
      const message = response.message || (dryRun ? "Dry-run validated." : "Series created.");

      setCreateSeriesStatus("success");
      setCreateSeriesMessage(message);

      toast({
        title: dryRun ? "Series dry run complete" : "Series created",
        description: message,
      });

      if (!dryRun && response.series?.configKey) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("series", response.series.configKey);
        setSearchParams(nextParams, { replace: true });
        setSeriesEntryMode("edit");
        setCatalogReloadKey((current) => current + 1);
        setSetupReloadKey((current) => current + 1);
        setSubscriptionReloadKey((current) => current + 1);
        setViewerAccessReloadKey((current) => current + 1);
        handleResetCreateSeriesForm();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Series creation failed unexpectedly.";
      setCreateSeriesStatus("error");
      setCreateSeriesError(message);
      setCreateSeriesMessage(null);
      toast({
        title: "Series creation failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleAssignEntityAdmin = async (event: FormEvent<HTMLFormElement>, entityId: string) => {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    const targetUserId = entityAdminDrafts[entityId]?.trim() || "";
    if (!targetUserId) {
      setEntityAdminErrors((current) => ({
        ...current,
        [entityId]: "Enter the user ID that should become a series admin for this entity.",
      }));
      setEntityAdminMessages((current) => ({
        ...current,
        [entityId]: "",
      }));
      return;
    }

    setActiveEntityAdminMutationKey(`assign:${entityId}`);
    setEntityAdminErrors((current) => ({
      ...current,
      [entityId]: "",
    }));
    setEntityAdminMessages((current) => ({
      ...current,
      [entityId]: "",
    }));

    try {
      const result = await assignCricketAdminEntityMembership(entityId, accessToken, {
        userId: targetUserId,
        role: "admin",
      });

      await refreshAdminCatalogSnapshot();
      setEntityAdminDrafts((current) => ({
        ...current,
        [entityId]: "",
      }));
      setEntityAdminMessages((current) => ({
        ...current,
        [entityId]: result.message || "Series admin access granted.",
      }));

      toast({
        title: "Series admin access granted",
        description: result.message || "Series admin access granted.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Series admin access could not be granted.";
      setEntityAdminErrors((current) => ({
        ...current,
        [entityId]: message,
      }));

      toast({
        title: "Series admin access failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActiveEntityAdminMutationKey(null);
    }
  };

  const handleRemoveEntityAdmin = async (entityId: string, targetUserId: string) => {
    if (!accessToken) {
      return;
    }

    setActiveEntityAdminMutationKey(`remove:${entityId}:${targetUserId}`);
    setEntityAdminErrors((current) => ({
      ...current,
      [entityId]: "",
    }));
    setEntityAdminMessages((current) => ({
      ...current,
      [entityId]: "",
    }));

    try {
      const result = await removeCricketAdminEntityMembership(entityId, targetUserId, accessToken);
      await refreshAdminCatalogSnapshot();
      setEntityAdminMessages((current) => ({
        ...current,
        [entityId]: result.message || "Series admin access removed.",
      }));

      toast({
        title: "Series admin access removed",
        description: result.message || "Series admin access removed.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Series admin access could not be removed.";
      setEntityAdminErrors((current) => ({
        ...current,
        [entityId]: message,
      }));

      toast({
        title: "Series admin removal failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActiveEntityAdminMutationKey(null);
    }
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

  const handleViewerInviteFieldChange = (field: keyof ViewerInviteFormState, value: string) => {
    setViewerInviteForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleViewerDirectGrantFieldChange = (field: keyof ViewerDirectGrantFormState, value: string) => {
    setViewerDirectGrantForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleGrantViewerInvite = async () => {
    if (!selectedSeries?.configKey || !accessToken) {
      return;
    }

    if (!viewerGrantEnabledByPlan) {
      const message = "New viewer access is blocked by the current entity plan.";
      setViewerInviteMutationStatus("error");
      setViewerInviteMutationError(message);
      setViewerInviteMutationMessage(null);
      toast({
        title: "Email pre-approval blocked",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const email = viewerInviteForm.email.trim();
    if (!email) {
      const message = "Enter the email address that should be pre-approved for this series.";
      setViewerInviteMutationStatus("error");
      setViewerInviteMutationError(message);
      setViewerInviteMutationMessage(null);
      toast({
        title: "Email pre-approval failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setViewerInviteMutationStatus("saving");
    setViewerInviteMutationError(null);
    setViewerInviteMutationMessage(null);

    try {
      const response = await createCricketAdminViewerGrant(
        selectedSeries.configKey,
        accessToken,
        {
          email,
          accessRole: viewerInviteForm.accessRole,
          expiresAt: viewerInviteForm.expiresAt.trim() || undefined,
        }
      );

      const message = response.message || "Email pre-approval saved.";
      setViewerInviteMutationStatus("success");
      setViewerInviteMutationMessage(message);
      setViewerInviteForm({
        email: "",
        accessRole: "viewer",
        expiresAt: "",
      });
      setViewerAccessReloadKey((current) => current + 1);
      setSubscriptionReloadKey((current) => current + 1);

      toast({
        title: "Email pre-approval saved",
        description: message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email pre-approval failed unexpectedly.";
      setViewerInviteMutationStatus("error");
      setViewerInviteMutationError(message);

      toast({
        title: "Email pre-approval failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleGrantViewerDirectAccess = async () => {
    if (!selectedSeries?.configKey || !accessToken) {
      return;
    }

    if (!viewerGrantEnabledByPlan) {
      const message = "New viewer access is blocked by the current entity plan.";
      setViewerDirectGrantMutationStatus("error");
      setViewerDirectGrantMutationError(message);
      setViewerDirectGrantMutationMessage(null);
      toast({
        title: "Direct viewer grant blocked",
        description: message,
        variant: "destructive",
      });
      return;
    }

    const userId = viewerDirectGrantForm.userId.trim();
    if (!userId) {
      const message = "Enter the Game-Changrs user id for the person who should get immediate access.";
      setViewerDirectGrantMutationStatus("error");
      setViewerDirectGrantMutationError(message);
      setViewerDirectGrantMutationMessage(null);
      toast({
        title: "Direct viewer grant failed",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (!viewerImmediateGrantAllowed) {
      const message =
        "Direct user-id grants are at the current viewer limit. Use email pre-approval instead, or free an existing viewer seat.";
      setViewerDirectGrantMutationStatus("error");
      setViewerDirectGrantMutationError(message);
      setViewerDirectGrantMutationMessage(null);
      toast({
        title: "Direct viewer grant blocked",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setViewerDirectGrantMutationStatus("saving");
    setViewerDirectGrantMutationError(null);
    setViewerDirectGrantMutationMessage(null);

    try {
      const response = await createCricketAdminViewerGrant(
        selectedSeries.configKey,
        accessToken,
        {
          userId,
          accessRole: viewerDirectGrantForm.accessRole,
          expiresAt: viewerDirectGrantForm.expiresAt.trim() || undefined,
        }
      );

      const message = response.message || "Viewer access granted.";
      setViewerDirectGrantMutationStatus("success");
      setViewerDirectGrantMutationMessage(message);
      setViewerDirectGrantForm({
        userId: "",
        accessRole: "viewer",
        expiresAt: "",
      });
      setViewerAccessReloadKey((current) => current + 1);
      setSubscriptionReloadKey((current) => current + 1);

      toast({
        title: "Viewer access granted",
        description: message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Direct viewer grant failed unexpectedly.";
      setViewerDirectGrantMutationStatus("error");
      setViewerDirectGrantMutationError(message);

      toast({
        title: "Direct viewer grant failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleAccessRequestDecision = async (
    request: CricketAdminSeriesAccessRequest,
    action: "approve" | "decline",
  ) => {
    const requestId = request.requestId?.trim();
    if (!selectedSeries?.configKey || !accessToken || !requestId) {
      return;
    }

    setAccessRequestDecisionStatusByRequest((current) => ({
      ...current,
      [requestId]: "saving",
    }));

    try {
      const response = await decideCricketAdminAccessRequest(
        selectedSeries.configKey,
        requestId,
        accessToken,
        { action }
      );

      setAccessRequestDecisionStatusByRequest((current) => ({
        ...current,
        [requestId]: "success",
      }));
      setViewerAccessReloadKey((current) => current + 1);
      setSubscriptionReloadKey((current) => current + 1);

      toast({
        title: action === "approve" ? "Access request approved" : "Access request declined",
        description: response.message || "Access request updated.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Access request update failed unexpectedly.";
      setAccessRequestDecisionStatusByRequest((current) => ({
        ...current,
        [requestId]: "error",
      }));

      toast({
        title: "Access request update failed",
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
                    className="border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200"
                  >
                    Series Admin Console
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300"
                  >
                    Required + Optional Controls
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl">
                    Series administration
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    Run one series in order: required setup first, series admin team next, series users after that,
                    then optional tuning and match operations.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                {isPlatformAdminActor ? (
                  <Button asChild variant="outline" className="w-full md:w-auto">
                    <Link to={getAnalyticsPlatformAdminRoute()}>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Platform Console
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link to="/analytics">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Analytics
                  </Link>
                </Button>
              </div>
            </div>

            <div id="access-overview">
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Control overview</p>
                      <div className="font-display text-2xl text-foreground">
                        {catalog?.actor?.email || user?.email || "Signed-in user"}
                      </div>
                      {catalog?.actor?.userId ? (
                        <p className="text-xs leading-6 text-muted-foreground">
                          User ID: <span className="font-mono text-foreground">{catalog.actor.userId}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className={getAccessTone(catalog?.actor?.accessLabel)}>
                        {catalog?.actor?.isPlatformAdmin ? "Platform admin in series console" : "Series admin"}
                      </Badge>
                      <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                        {selectedSeriesDisplayName}
                      </Badge>
                      <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                        {planStatusLabel}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Selected series</p>
                      <div className="mt-3 text-base font-semibold leading-6 text-foreground">
                        {selectedSeriesDisplayName}
                      </div>
                      {selectedSeriesContext ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedSeriesContext}</p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Plan</p>
                      <div className="mt-3 text-base font-semibold leading-6 text-foreground">{planSummaryLabel}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{planStatusLabel}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        title: "1. Required setup",
                        body: "Source URL, series identity, and capture behavior come first.",
                      },
                      {
                        title: "2. Series admins",
                        body: "Grant operational admin access for the entity that owns this series.",
                      },
                      {
                        title: "3. Series users",
                        body: "Approve viewer or analyst access after the admin team is set.",
                      },
                      {
                        title: "4. Optional controls",
                        body: "Tuning and match operations stay lower on the page.",
                      },
                    ].map((item) => (
                      <div key={item.title} className="rounded-2xl border border-border/70 bg-background/55 p-4">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { href: "#access-overview", label: "Overview" },
                { href: "#series-entry", label: "Mandatory setup" },
                { href: "#series-admins", label: "Series admins" },
                { href: "#series-users", label: "Series users" },
                { href: "#plan-controls", label: "Plan + gates" },
                { href: "#series-switcher", label: "Series switcher" },
                { href: "#series-setup", label: "Optional tuning" },
                { href: "#match-ops", label: "Optional match ops" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center rounded-full border border-border/80 bg-card/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>

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

            {catalogStatus === "success" && catalog?.authFoundationReady === true && hasSeriesAdminConsoleAccess && !series.length ? (
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardHeader>
                  <CardTitle>No series exist for this entity yet</CardTitle>
                  <CardDescription>
                    Start with the mandatory setup below. The access and optional-control sections will attach after
                    the first series is created.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {catalogStatus === "success" && catalog?.authFoundationReady === true && !hasSeriesAdminConsoleAccess ? (
              <Card className="border-amber-500/30 bg-amber-500/8 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-200">
                    <ShieldCheck className="h-5 w-5" />
                    Series admin access required
                  </CardTitle>
                  <CardDescription className="text-amber-100/80">
                    This route is reserved for platform admins and series admins. Series users do not receive an admin
                    console and should use the analytics workspace instead.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">User ID</p>
                    <p className="mt-2 break-all font-mono text-sm text-foreground">
                      {catalog?.actor?.userId || user?.id || "Unavailable"}
                    </p>
                  </div>

                  {seriesAdminSelfRequestMessage ? (
                    <div
                      className={`rounded-2xl border p-4 text-sm leading-7 ${
                        seriesAdminSelfRequestStatus === "error"
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-cyan-400/20 bg-cyan-400/5 text-cyan-100"
                      }`}
                    >
                      {seriesAdminSelfRequestMessage}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleRequestSeriesAdminAccess()}
                      disabled={seriesAdminSelfRequestStatus === "saving" || !selectedSeriesKey}
                    >
                      {seriesAdminSelfRequestStatus === "saving" ? "Submitting request..." : "Request series admin access"}
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/analytics">
                        Back to Analytics
                      </Link>
                    </Button>
                  </div>
                  {!selectedSeriesKey ? (
                    <p className="text-sm leading-6 text-amber-100/80">
                      Open this route from a specific series so the request can be sent to the correct series-admin team.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {catalogStatus === "success" && catalog?.authFoundationReady === true && hasSeriesAdminConsoleAccess && entities.length ? (
              <div className="flex flex-col gap-4">
                <Card className="order-1 border-border/80 bg-card/85 shadow-xl" id="series-entry">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Mandatory setup
                          </p>
                        </div>
                        <div>
                          <h2 className="font-display text-2xl text-foreground">Create or update the required series setup</h2>
                          <p className="text-sm leading-7 text-muted-foreground">
                            Enter the source URL, series identity, and capture switches needed to run the series.
                            Series-user access and optional controls stay below.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={seriesEntryMode === "create" ? "default" : "outline"}
                          onClick={handleStartCreateSeries}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          New series
                        </Button>
                        <Button
                          type="button"
                          variant={seriesEntryMode === "edit" ? "default" : "outline"}
                          onClick={handleStartEditSeries}
                          disabled={!selectedSeries}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Update selected
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <div
                        key={seriesEntryMode}
                        className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5"
                      >
                        {seriesEntryMode === "create" ? (
                          <>
                            <div className="space-y-5">
                              <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                    1. Series identity
                                  </p>
                                  <p className="text-sm leading-7 text-muted-foreground">
                                    Define who owns the series and what coaches should see as the series label.
                                  </p>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Owning entity</Label>
                                    <Select
                                      value={createSeriesForm.entityId || "__none__"}
                                      onValueChange={(value) =>
                                        setCreateSeriesForm((current) => ({
                                          ...current,
                                          entityId: value === "__none__" ? "" : value,
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select the entity that owns this series" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Select entity</SelectItem>
                                        {entities.map((entity) => (
                                          <SelectItem key={entity.entityId || entity.entityName} value={entity.entityId || ""}>
                                            {entity.entityName || entity.entitySlug || entity.entityId}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs leading-6 text-muted-foreground">
                                      This decides which admin team owns the series and which package limits apply.
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="create-series-name">Series display name</Label>
                                    <Input
                                      id="create-series-name"
                                      value={createSeriesForm.sourceSetup.name}
                                      onChange={(event) =>
                                        handleCreateSeriesSourceFieldChange("name", event.target.value)
                                      }
                                      placeholder="2026 Bay Area USAC Hub"
                                    />
                                    <p className="text-xs leading-6 text-muted-foreground">
                                      Coach-facing label used in dashboards, reports, and admin lists.
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="create-season-year">Season year</Label>
                                    <Input
                                      id="create-season-year"
                                      inputMode="numeric"
                                      value={createSeriesForm.sourceSetup.seasonYear}
                                      onChange={(event) =>
                                        handleCreateSeriesSourceFieldChange("seasonYear", event.target.value)
                                      }
                                    />
                                    <p className="text-xs leading-6 text-muted-foreground">
                                      Used for naming, report context, and grouping the correct season data.
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="create-target-age-group">Target age group</Label>
                                    <Input
                                      id="create-target-age-group"
                                      value={createSeriesForm.sourceSetup.targetAgeGroup}
                                      onChange={(event) =>
                                        handleCreateSeriesSourceFieldChange("targetAgeGroup", event.target.value)
                                      }
                                      placeholder="U15"
                                    />
                                    <p className="text-xs leading-6 text-muted-foreground">
                                      Keeps age groups separated and appears directly in reports and workspace labels.
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                    2. Source capture
                                  </p>
                                  <p className="text-sm leading-7 text-muted-foreground">
                                    Enter the source page and the validation labels the extractor should match.
                                  </p>
                                </div>

                                <div className="mt-4 space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="create-series-url">Primary source URL</Label>
                                    <Input
                                      id="create-series-url"
                                      value={createSeriesForm.sourceSetup.seriesUrl}
                                      onChange={(event) =>
                                        handleCreateSeriesSourceFieldChange("seriesUrl", event.target.value)
                                      }
                                      placeholder="https://cricclubs.com/USACricketJunior/viewLeague.do?league=434&clubId=40319"
                                    />
                                    <p className="text-xs leading-6 text-muted-foreground">
                                      Paste the main CricClubs league page. This is the anchor used to discover results,
                                      scorecards, and ball-by-ball coverage.
                                    </p>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label htmlFor="create-expected-league-name">League namespace</Label>
                                      <Input
                                        id="create-expected-league-name"
                                        value={createSeriesForm.sourceSetup.expectedLeagueName}
                                        onChange={(event) =>
                                          handleCreateSeriesSourceFieldChange("expectedLeagueName", event.target.value)
                                        }
                                        placeholder="USACricketJunior"
                                      />
                                      <p className="text-xs leading-6 text-muted-foreground">
                                        Usually the path segment in the source URL. It helps validate results and match links.
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="create-expected-series-name">Expected source series name</Label>
                                      <Input
                                        id="create-expected-series-name"
                                        value={createSeriesForm.sourceSetup.expectedSeriesName}
                                        onChange={(event) =>
                                          handleCreateSeriesSourceFieldChange("expectedSeriesName", event.target.value)
                                        }
                                        placeholder="Bay Area USAC Hub"
                                      />
                                      <p className="text-xs leading-6 text-muted-foreground">
                                        Use the source-site label you expect the extractor and validators to match.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                    3. Extraction behavior
                                  </p>
                                  <p className="text-sm leading-7 text-muted-foreground">
                                    Control what gets pulled, stored, and exposed in the live analytics workspace.
                                  </p>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  {mandatoryCaptureSwitches.map((item) => (
                                    <div key={item.key} className="rounded-2xl border border-border/70 bg-background/55 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                          <p className="font-medium text-foreground">{item.label}</p>
                                          <p className="text-xs leading-6 text-muted-foreground">{item.body}</p>
                                        </div>
                                        <Switch
                                          checked={createSeriesForm.sourceSetup[item.key]}
                                          onCheckedChange={(checked) =>
                                            handleCreateSeriesSourceFieldChange(item.key, checked)
                                          }
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                <div className="space-y-1">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                    4. Admin notes
                                  </p>
                                  <p className="text-sm leading-7 text-muted-foreground">
                                    Internal-only notes for source caveats, reminders, or manual follow-up.
                                  </p>
                                </div>

                                <div className="mt-4 space-y-2">
                                  <Label htmlFor="create-series-notes">Operator notes</Label>
                                  <Textarea
                                    id="create-series-notes"
                                    className="min-h-[104px]"
                                    value={createSeriesForm.sourceSetup.notes}
                                    onChange={(event) =>
                                      handleCreateSeriesSourceFieldChange("notes", event.target.value)
                                    }
                                    placeholder="Internal notes for the admin team"
                                  />
                                  <p className="text-xs leading-6 text-muted-foreground">
                                    These notes do not appear in player-facing or viewer-facing reports.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {createSeriesMessage ? (
                              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                                {createSeriesMessage}
                              </div>
                            ) : null}

                            {createSeriesError ? (
                              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                                {createSeriesError}
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handleCreateSeries(true)}
                                disabled={createSeriesStatus === "saving"}
                              >
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                Dry run
                              </Button>
                              <Button
                                type="button"
                                onClick={() => void handleCreateSeries(false)}
                                disabled={createSeriesStatus === "saving"}
                              >
                                {createSeriesStatus === "saving" ? "Creating..." : "Create series"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleResetCreateSeriesForm}
                                disabled={createSeriesStatus === "saving"}
                              >
                                Reset
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Update selected series
                              </p>
                              <p className="text-sm leading-7 text-muted-foreground">
                                Use this first-pass editor for the mandatory identity and source fields. Deeper mapping,
                                report-profile, and tuning controls remain below.
                              </p>
                            </div>

                            {setupStatus === "success" && formState ? (
                              <>
                                <div className="space-y-5">
                                  <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                    <div className="space-y-1">
                                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                        1. Series identity
                                      </p>
                                      <p className="text-sm leading-7 text-muted-foreground">
                                        Keep the working series label, season, and age bracket aligned with what coaches see.
                                      </p>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Owning entity</Label>
                                        <div className="rounded-xl border border-border/70 bg-background/55 px-4 py-3 text-sm text-foreground">
                                          {selectedEntity?.entityName || "No entity selected"}
                                        </div>
                                        <p className="text-xs leading-6 text-muted-foreground">
                                          Entity ownership is managed above this page and controls access and billing scope.
                                        </p>
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="entry-series-name">Series display name</Label>
                                        <Input
                                          id="entry-series-name"
                                          value={formState.sourceSetup.name}
                                          onChange={(event) => handleSourceFieldChange("name", event.target.value)}
                                        />
                                        <p className="text-xs leading-6 text-muted-foreground">
                                          Coach-facing label for this series and the default report heading.
                                        </p>
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="entry-season-year">Season year</Label>
                                        <Input
                                          id="entry-season-year"
                                          inputMode="numeric"
                                          value={formState.sourceSetup.seasonYear}
                                          onChange={(event) => handleSourceFieldChange("seasonYear", event.target.value)}
                                        />
                                        <p className="text-xs leading-6 text-muted-foreground">
                                          Groups the series into the correct season and keeps naming consistent.
                                        </p>
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="entry-target-age-group">Target age group</Label>
                                        <Input
                                          id="entry-target-age-group"
                                          value={formState.sourceSetup.targetAgeGroup}
                                          onChange={(event) => handleSourceFieldChange("targetAgeGroup", event.target.value)}
                                        />
                                        <p className="text-xs leading-6 text-muted-foreground">
                                          Keeps the workspace aligned to the right age bracket and report label.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                    <div className="space-y-1">
                                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                        2. Source capture
                                      </p>
                                      <p className="text-sm leading-7 text-muted-foreground">
                                        Update the main source page and the validation labels that keep extraction inside
                                        the correct CricClubs namespace.
                                      </p>
                                    </div>

                                    <div className="mt-4 space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="entry-series-url">Primary source URL</Label>
                                        <Input
                                          id="entry-series-url"
                                          value={formState.sourceSetup.seriesUrl}
                                          onChange={(event) => handleSourceFieldChange("seriesUrl", event.target.value)}
                                        />
                                        <p className="text-xs leading-6 text-muted-foreground">
                                          Main source URL used to discover results, scorecards, and linked CricClubs pages.
                                        </p>
                                      </div>

                                      <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                          <Label htmlFor="entry-league-name">League namespace</Label>
                                          <Input
                                            id="entry-league-name"
                                            value={formState.sourceSetup.expectedLeagueName}
                                            onChange={(event) =>
                                              handleSourceFieldChange("expectedLeagueName", event.target.value)
                                            }
                                          />
                                          <p className="text-xs leading-6 text-muted-foreground">
                                            Validates that extracted match links stay inside the expected CricClubs namespace.
                                          </p>
                                        </div>

                                        <div className="space-y-2">
                                          <Label htmlFor="entry-expected-series-name">Expected source series name</Label>
                                          <Input
                                            id="entry-expected-series-name"
                                            value={formState.sourceSetup.expectedSeriesName}
                                            onChange={(event) =>
                                              handleSourceFieldChange("expectedSeriesName", event.target.value)
                                            }
                                          />
                                          <p className="text-xs leading-6 text-muted-foreground">
                                            Source-side label you expect the extractor and validators to match.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                    <div className="space-y-1">
                                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                        3. Extraction behavior
                                      </p>
                                      <p className="text-sm leading-7 text-muted-foreground">
                                        Control what gets pulled, stored, and shown in the live analytics workspace.
                                      </p>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                      {mandatoryCaptureSwitches.map((item) => (
                                        <div key={item.key} className="rounded-2xl border border-border/70 bg-background/55 p-4">
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                              <p className="font-medium text-foreground">{item.label}</p>
                                              <p className="text-xs leading-6 text-muted-foreground">{item.body}</p>
                                            </div>
                                            <Switch
                                              checked={formState.sourceSetup[item.key]}
                                              onCheckedChange={(checked) => handleSourceFieldChange(item.key, checked)}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
                                    <div className="space-y-1">
                                      <p className="text-[11px] uppercase tracking-[0.16em] text-primary">
                                        4. Admin notes
                                      </p>
                                      <p className="text-sm leading-7 text-muted-foreground">
                                        Keep internal notes here for source caveats, reminders, or follow-up actions.
                                      </p>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                      <Label htmlFor="entry-notes">Operator notes</Label>
                                      <Textarea
                                        id="entry-notes"
                                        className="min-h-[104px]"
                                        value={formState.sourceSetup.notes}
                                        onChange={(event) => handleSourceFieldChange("notes", event.target.value)}
                                      />
                                      <p className="text-xs leading-6 text-muted-foreground">
                                        These notes stay internal and do not appear in player-facing or viewer-facing reports.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => void handleSave(true)}
                                      disabled={!isDirty || mutationStatus === "saving"}
                                    >
                                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                                      Dry run
                                    </Button>
                                    <Button
                                      onClick={() => void handleSave(false)}
                                      disabled={!isDirty || mutationStatus === "saving"}
                                    >
                                      <Save className="mr-2 h-4 w-4" />
                                      Save setup
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={handleResetChanges}
                                      disabled={!isDirty || mutationStatus === "saving"}
                                    >
                                      Reset changes
                                    </Button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="rounded-2xl border border-border/70 bg-background/60 p-5 text-sm leading-7 text-muted-foreground">
                                Select a series to edit its mandatory setup fields.
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border/80 bg-background/55 p-5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Package guardrails</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Series allocation</p>
                              <p className="mt-2 text-2xl font-semibold text-foreground">
                                {formatNumber(subscriptionSummary?.usage?.seriesCount ?? selectedEntity?.seriesCount ?? 0)}
                                {subscriptionSummary?.limits?.maxSeries !== null && subscriptionSummary?.limits?.maxSeries !== undefined
                                  ? ` / ${formatNumber(subscriptionSummary.limits.maxSeries)}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                                The base package is set to five managed series before premium expansion kicks in.
                              </p>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Owning entity</p>
                              <p className="mt-2 text-base font-semibold text-foreground">
                                {selectedEntity?.entityName || "No entity selected"}
                              </p>
                              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                                Viewer access, billing limits, and future paid controls all scope to this entity.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/80 bg-background/55 p-5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Required now</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {[
                              {
                                title: "Series identity",
                                body: "Name, season, and age group used in reports and selector views.",
                              },
                              {
                                title: "Source capture",
                                body: "Primary league URL plus the expected CricClubs namespace and source series label.",
                              },
                              {
                                title: "Coverage switches",
                                body: "Completed-only ingest, ball-by-ball, player profiles, and auto-discovery.",
                              },
                              {
                                title: "Activation",
                                body: "Whether the series should appear immediately in live analytics.",
                              },
                            ].map((item) => (
                              <div key={item.title} className="rounded-xl border border-border/70 bg-background/60 p-4">
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.body}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">After required setup</p>
                          <div className="mt-4 grid gap-3">
                            {[
                              {
                                title: "Series admin team",
                                body: "Add or remove additional series admins for the entity that owns this series.",
                              },
                              {
                                title: "Series users",
                                body: "Grant access by email or user id, then approve pending view requests for this series.",
                              },
                              {
                                title: "Optional tuning",
                                body: "Choose the report profile and tune division mappings after the source setup is stable.",
                              },
                              {
                                title: "Optional operations",
                                body: "Request a manual refresh or override a specific match only when the automated flow needs help.",
                              },
                            ].map((item) => (
                              <div key={item.title} className="rounded-xl border border-cyan-400/15 bg-background/55 p-4">
                                <p className="font-medium text-foreground">{item.title}</p>
                                <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.body}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {series.length ? (
                  <>
                {selectedSeries ? (
                  <Card className="order-2 border-border/80 bg-card/85 shadow-xl" id="series-admins">
                    <CardContent className="space-y-6 p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-cyan-200" />
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              Series admins
                            </p>
                          </div>
                          <div>
                            <h2 className="font-display text-2xl text-foreground">Series admin team</h2>
                            <p className="text-sm leading-7 text-muted-foreground">
                              Grant or remove series-admin access for the entity that owns this series. Admin access
                              applies across every series under this entity.
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Owning entity</p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {selectedEntity?.entityName || "No entity selected"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                          <div className="space-y-3">
                            <Badge variant="outline" className="w-fit border-border/80 bg-card/70 text-foreground">
                              Step 1
                            </Badge>
                            <div>
                              <p className="font-display text-xl text-foreground">Pre-approve by email</p>
                              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                Best when the future series admin has not signed in yet. The request will stay pending
                                until that email signs in and requests admin access.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="series-admin-invite-email">Series admin email</Label>
                            <Input
                              id="series-admin-invite-email"
                              type="email"
                              placeholder="admin@example.com"
                              value={seriesAdminInviteForm.email}
                              onChange={(event) => handleSeriesAdminInviteFieldChange("email", event.target.value)}
                            />
                          </div>

                          {seriesAdminInviteMutationMessage ? (
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                              {seriesAdminInviteMutationMessage}
                            </div>
                          ) : null}

                          {seriesAdminInviteMutationError ? (
                            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                              {seriesAdminInviteMutationError}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={() => void handleInviteEntityAdmin()}
                              disabled={seriesAdminInviteMutationStatus === "saving" || !selectedEntity?.entityId}
                            >
                              {seriesAdminInviteMutationStatus === "saving" ? "Saving..." : "Save pre-approval"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setSeriesAdminInviteForm({ email: "" })}
                              disabled={seriesAdminInviteMutationStatus === "saving"}
                            >
                              Clear
                            </Button>
                          </div>
                        </div>

                        <form
                          className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5"
                          onSubmit={(event) =>
                            selectedEntity?.entityId ? void handleAssignEntityAdmin(event, selectedEntity.entityId) : undefined
                          }
                        >
                          <div className="space-y-3">
                            <Badge variant="outline" className="w-fit border-border/80 bg-card/70 text-foreground">
                              Step 2
                            </Badge>
                            <div>
                              <p className="font-display text-xl text-foreground">Grant immediately by user ID</p>
                              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                Use when the person already has a Game-Changrs account. This grants series-admin access
                                across every series owned by {selectedEntity?.entityName || "the selected entity"}.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`entity-admin-user-${selectedEntity?.entityId || "selected"}`}>
                              Series admin user ID
                            </Label>
                            <Input
                              id={`entity-admin-user-${selectedEntity?.entityId || "selected"}`}
                              value={selectedEntity?.entityId ? entityAdminDrafts[selectedEntity.entityId] || "" : ""}
                              onChange={(event) => {
                                const entityId = selectedEntity?.entityId || "";
                                setEntityAdminDrafts((current) => ({
                                  ...current,
                                  [entityId]: event.target.value,
                                }));
                                setEntityAdminErrors((current) => ({
                                  ...current,
                                  [entityId]: "",
                                }));
                              }}
                              placeholder="Supabase auth user ID"
                              className="font-mono text-xs"
                              autoComplete="off"
                              disabled={!selectedEntity?.entityId}
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="submit"
                              disabled={Boolean(activeEntityAdminMutationKey) || !selectedEntity?.entityId}
                              className="md:min-w-[14rem]"
                            >
                              {activeEntityAdminMutationKey === `assign:${selectedEntity?.entityId}` ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                              )}
                              Grant series admin
                            </Button>
                          </div>

                          {selectedEntity?.entityId && entityAdminMessages[selectedEntity.entityId] ? (
                            <p className="text-sm leading-6 text-emerald-300">
                              {entityAdminMessages[selectedEntity.entityId]}
                            </p>
                          ) : null}

                          {selectedEntity?.entityId && entityAdminErrors[selectedEntity.entityId] ? (
                            <p className="text-sm leading-6 text-destructive">
                              {entityAdminErrors[selectedEntity.entityId]}
                            </p>
                          ) : null}
                        </form>

                        <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                          <div className="space-y-3">
                            <Badge variant="outline" className="w-fit border-border/80 bg-card/70 text-foreground">
                              Step 3
                            </Badge>
                            <div>
                              <p className="font-display text-xl text-foreground">Review pending requests</p>
                              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                Approve self-service admin requests or manage email invites that are still waiting for
                                first login.
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="space-y-2">
                              <Label htmlFor="entity-admin-request-search">Search requests</Label>
                              <Input
                                id="entity-admin-request-search"
                                value={entityAdminRequestQuery}
                                onChange={(event) => setEntityAdminRequestQuery(event.target.value)}
                                placeholder="Search by email, user ID, or note"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Show</Label>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { value: "all", label: `All (${formatNumber(pendingEntityAdminRequests.length)})` },
                                  { value: "ready", label: `Ready (${formatNumber(readyEntityAdminRequestCount)})` },
                                  { value: "waiting", label: `Waiting (${formatNumber(waitingEntityAdminRequestCount)})` },
                                ].map((item) => (
                                  <Button
                                    key={item.value}
                                    type="button"
                                    size="sm"
                                    variant={entityAdminRequestFilter === item.value ? "default" : "outline"}
                                    onClick={() => setEntityAdminRequestFilter(item.value as PendingRequestFilter)}
                                  >
                                    {item.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {filteredPendingEntityAdminRequests.length ? (
                            <div className="space-y-3">
                              {filteredPendingEntityAdminRequests.map((request) => {
                                const requestId = request.requestId || "";
                                const decisionStatus = requestId
                                  ? entityAdminRequestDecisionStatusByRequest[requestId]
                                  : undefined;
                                const canApprove = request.requestType === "self_request" && Boolean(request.requestedUserId);
                                const requestStatusLabel =
                                  request.requestType === "admin_invite" && !request.requestedUserId
                                    ? "Waiting for first login"
                                    : request.requestStatus || "pending";

                                return (
                                  <div
                                    key={request.requestId || `${request.requestedEmail}-${request.createdAt}`}
                                    className="rounded-2xl border border-border/70 bg-background/60 p-5"
                                  >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                          <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                                            {request.requestType === "admin_invite" ? "Email pre-approval" : "User request"}
                                          </Badge>
                                          <Badge className={getStatusBadgeClass(request.requestStatus)}>
                                            {requestStatusLabel}
                                          </Badge>
                                        </div>

                                        <div className="space-y-1">
                                          <p className="break-all text-base font-semibold text-foreground">
                                            {request.requestedEmail || "-"}
                                          </p>
                                          <p className="break-all font-mono text-xs leading-6 text-muted-foreground">
                                            {request.requestedUserId || "No user ID linked yet"}
                                          </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                              Requested
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-foreground">
                                              {formatDateTime(request.createdAt)}
                                            </p>
                                          </div>
                                          <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                              Approval state
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-foreground">
                                              {canApprove ? "Ready for decision" : "Waiting for user link"}
                                            </p>
                                          </div>
                                        </div>

                                        {request.requestNote ? (
                                          <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                              Request note
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                              {request.requestNote}
                                            </p>
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={!canApprove || decisionStatus === "saving" || !requestId}
                                          onClick={() => void handleEntityAdminRequestDecision(request, "approve")}
                                        >
                                          {decisionStatus === "saving" && canApprove ? "Approving..." : "Approve"}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={decisionStatus === "saving" || !requestId}
                                          onClick={() => void handleEntityAdminRequestDecision(request, "decline")}
                                        >
                                          Decline
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm leading-7 text-muted-foreground">
                              No pending series-admin requests match the current filter.
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">Current series admins</p>
                            <p className="text-xs leading-6 text-muted-foreground">
                              Owner transfer stays locked. Additional admins inherit access across this entity.
                            </p>
                          </div>

                          {(selectedEntity?.admins ?? []).length ? (
                            <div className="space-y-3">
                              {(selectedEntity?.admins ?? []).map((membership) => {
                                const removeKey = `remove:${selectedEntity?.entityId}:${membership.userId}`;
                                const isRemoving = activeEntityAdminMutationKey === removeKey;

                                return (
                                  <div
                                    key={`${membership.userId}-${membership.role}`}
                                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/55 p-4 md:flex-row md:items-center md:justify-between"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-foreground">
                                          {membership.isOwner ? "Entity owner" : "Series admin"}
                                        </p>
                                        <Badge className={getEntityAdminMembershipTone(membership)}>
                                          {membership.isOwner ? "owner" : membership.role || "admin"}
                                        </Badge>
                                      </div>
                                      <p className="break-all font-mono text-xs leading-6 text-muted-foreground">
                                        {membership.userId || "No user ID"}
                                      </p>
                                    </div>

                                    {membership.canRemove ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={Boolean(activeEntityAdminMutationKey) || !selectedEntity?.entityId}
                                        onClick={() =>
                                          selectedEntity?.entityId && membership.userId
                                            ? void handleRemoveEntityAdmin(selectedEntity.entityId, membership.userId)
                                            : undefined
                                        }
                                        className="border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        {isRemoving ? (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        Remove
                                      </Button>
                                    ) : (
                                      <div className="text-xs leading-6 text-muted-foreground">Locked</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-border/70 bg-background/55 p-4 text-sm leading-7 text-muted-foreground">
                              No entity-admin assignments are active yet for this series owner.
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {selectedSeries ? (
                  <Card className="order-4 border-border/80 bg-card/85 shadow-xl" id="plan-controls">
                    <CardContent className="space-y-5 p-6">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-cyan-200" />
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              Plan + enforcement
                            </p>
                          </div>
                          <div>
                            <h2 className="font-display text-2xl text-foreground">{planSummaryLabel}</h2>
                            <p className="text-sm leading-7 text-muted-foreground">
                              Current plan gates viewer grants, manual refresh, and future paid-series controls for this entity.
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
                          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
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
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                                    {selectedSeriesDisplayName}
                                  </Badge>
                                  {selectedSeriesContext ? (
                                    <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                                      {selectedSeriesContext}
                                    </Badge>
                                  ) : null}
                                  <Badge
                                    variant="outline"
                                    className={
                                      isHardSubscriptionEnforcement
                                        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                        : "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
                                    }
                                  >
                                    {isHardSubscriptionEnforcement ? "Hard enforcement" : "Advisory mode"}
                                  </Badge>
                                </div>

                                <p className="text-sm leading-6 text-muted-foreground">
                                  Platform admins remain outside seat limits. Series-admin actions below still respect the current entity plan.
                                </p>
                              </div>

                              <div className="mt-4">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Feature gates</p>
                              </div>
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

                          <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                            <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Billing refs</p>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {[
                                  {
                                    label: "Plan key",
                                    value: subscriptionSummary.subscription?.planKey || "-",
                                  },
                                  {
                                    label: "Billing provider",
                                    value: subscriptionSummary.subscription?.billingProvider || "-",
                                  },
                                  {
                                    label: "Contract owner",
                                    value: subscriptionSummary.subscription?.contractOwnerEmail || "-",
                                  },
                                  {
                                    label: "Customer ref",
                                    value: subscriptionSummary.subscription?.billingCustomerRef || "-",
                                  },
                                  {
                                    label: "Subscription ref",
                                    value: subscriptionSummary.subscription?.billingSubscriptionRef || "-",
                                  },
                                ].map((item) => (
                                  <div key={item.label} className="rounded-xl border border-border/70 bg-background/60 p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                      {item.label}
                                    </p>
                                    <p className="mt-2 break-all text-sm leading-6 text-foreground">{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Warnings</p>
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
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="order-5 border-border/80 bg-card/85 shadow-xl" id="series-switcher">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-foreground">Series switcher</CardTitle>
                    <CardDescription>Select which series drives the admin sections on this page.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedSeries ? (
                      <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              Current selection
                            </p>
                            <p className="font-semibold text-foreground">
                              {selectedSeries.seriesName || selectedSeries.configKey}
                            </p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {selectedSeries.entityName || "Unassigned entity"}
                              {selectedSeries.targetAgeGroup ? ` · ${selectedSeries.targetAgeGroup}` : ""}
                              {selectedSeries.seasonYear ? ` · ${selectedSeries.seasonYear}` : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                              Current series
                            </Badge>
                            {selectedSeries.isActive ? (
                              <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                                Active
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {series.map((item) => {
                      const isSelected = item.configKey === selectedSeries?.configKey;

                      return (
                        <button
                          key={item.configKey}
                          type="button"
                          onClick={() => handleSelectSeries(item.configKey)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/80 bg-background/45 hover:border-primary/25 hover:bg-background/70"
                          }`}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {isSelected ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                                ) : null}
                                <p className="text-lg font-semibold text-foreground">
                                  {item.seriesName || item.configKey}
                                </p>
                              </div>
                              <p className="text-sm leading-6 text-muted-foreground">
                                {item.entityName || "Unassigned entity"}
                                {item.targetAgeGroup ? ` · ${item.targetAgeGroup}` : ""}
                                {item.seasonYear ? ` · ${item.seasonYear}` : ""}
                              </p>

                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
                                  {formatNumber(item.playerCount)} players
                                </Badge>
                                <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
                                  {formatNumber(item.computedMatches)} / {formatNumber(item.matchCount)} matches
                                </Badge>
                                <Badge variant="outline" className="border-border/80 bg-background/60 text-foreground">
                                  {formatNumber(item.warningMatches)} warnings
                                </Badge>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 md:justify-end">
                              {isSelected ? (
                                <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                                  Selected
                                </Badge>
                              ) : null}
                              <Badge className={getAccessTone(item.accessRole)}>{item.accessRole || "admin"}</Badge>
                              {item.isActive ? (
                                <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                                  Active
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="order-6 border-border/80 bg-card/85 shadow-xl" id="series-setup">
                  <CardHeader>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="font-display text-2xl text-foreground">Optional tuning and detail controls</CardTitle>
                        <CardDescription>
                          Use this after required setup is stable. This section covers report profile, division
                          mapping, and validation references.
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
                        <div className="grid gap-4">
                          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
                            <div className="flex items-center gap-2">
                              <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                1. Report profile and reference
                              </p>
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
                                <p className="text-xs leading-6 text-muted-foreground">
                                  Presentation only. Match data stays unchanged.
                                </p>
                                {setup?.reportProfile?.options?.length ? (
                                  <p className="text-xs leading-6 text-muted-foreground">
                                    {setup.reportProfile.options.find(
                                      (option) => option.profileKey === formState.reportProfileKey,
                                    )?.description || "Report layout used for the player-facing executive report."}
                                  </p>
                                ) : null}
                              </div>

                              <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                  Current source reference
                                </p>
                                <div className="mt-3 space-y-3 text-sm">
                                  <div>
                                    <p className="font-medium text-foreground">Source system</p>
                                    <p className="text-xs leading-6 text-muted-foreground">
                                      {formState.sourceSetup.sourceSystem || selectedSeries?.sourceSystem || "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">Primary source URL</p>
                                    <p className="break-all text-xs leading-6 text-muted-foreground">
                                      {formState.sourceSetup.seriesUrl || "-"}
                                    </p>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <p className="font-medium text-foreground">League namespace</p>
                                      <p className="text-xs leading-6 text-muted-foreground">
                                        {formState.sourceSetup.expectedLeagueName || "-"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-medium text-foreground">Expected source name</p>
                                      <p className="text-xs leading-6 text-muted-foreground">
                                        {formState.sourceSetup.expectedSeriesName || "-"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                  Current capture settings
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {[
                                    {
                                      key: "scrapeCompletedOnly",
                                      label: "Completed only",
                                    },
                                    {
                                      key: "includeBallByBall",
                                      label: "Ball-by-ball",
                                    },
                                    {
                                      key: "includePlayerProfiles",
                                      label: "Player profiles",
                                    },
                                    {
                                      key: "enableAutoDiscovery",
                                      label: "Auto discovery",
                                    },
                                    {
                                      key: "isActive",
                                      label: "Active",
                                    },
                                  ].map((item) => {
                                    const enabled = Boolean(
                                      formState.sourceSetup[item.key as keyof SetupFormState["sourceSetup"]],
                                    );

                                    return (
                                      <Badge
                                        key={item.key}
                                        className={
                                          enabled
                                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                            : "border-border/80 bg-card/70 text-muted-foreground"
                                        }
                                      >
                                        {item.label}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-cyan-200" />
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                    2. Division mappings
                                  </p>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Adjust division labels, weights, and inclusion rules.
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
                        </div>

                        {setup?.validationAnchors?.length ? (
                          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                              3. Validation anchors
                            </p>
                            <div className="space-y-3">
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
                              Setup changes save directly into the protected series runtime and do not alter the public
                              analytics entry experience.
                            </p>
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

                <Card className="order-7 border-border/80 bg-card/85 shadow-xl" id="match-ops">
                  <CardHeader>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="font-display text-2xl text-foreground">Series operations</CardTitle>
                        <CardDescription>
                          Live operating view for refresh activity, review queues, and match-level selector overrides.
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getStatusBadgeClass(operationsHealthTone)}>
                          {operationsHealthLabel}
                        </Badge>
                        <Button
                          variant="outline"
                          onClick={() => setMatchOpsReloadKey((current) => current + 1)}
                          disabled={matchOpsStatus === "loading"}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reload operations
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Coverage
                        </p>
                        <div className="mt-3 font-display text-3xl text-foreground">
                          {matchOps ? `${formatNumber(computedSeriesMatches)} / ${formatNumber(totalSeriesMatches)}` : "-"}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {matchOps
                            ? `${formatNumber(computedCoveragePercent)}% of tracked matches are currently computed.`
                            : "Loading live series coverage."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Pending ops
                        </p>
                        <div className="mt-3 font-display text-3xl text-foreground">
                          {matchOps ? formatNumber(pendingSeriesOps) : "-"}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Matches currently flagged for rescrape, reparse, or recompute.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Warning matches
                        </p>
                        <div className="mt-3 font-display text-3xl text-foreground">
                          {matchOps ? formatNumber(warningSeriesMatches) : "-"}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Computed rows still carrying reconciliation warnings.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Selector overrides
                        </p>
                        <div className="mt-3 font-display text-3xl text-foreground">
                          {matchOps ? formatNumber(overriddenSeriesMatches) : "-"}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Matches with a force-include or force-exclude decision applied.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/80 bg-background/55 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          Recent refreshes
                        </p>
                        <div className="mt-3 font-display text-3xl text-foreground">
                          {matchOps ? formatNumber(recentRefreshCount) : "-"}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {latestRefreshRequest?.requestedAt
                            ? `Latest request ${formatDateTime(latestRefreshRequest.requestedAt)}.`
                            : "No manual refresh activity recorded yet."}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Operations control center
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Manual refresh</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Single-match refresh requests are live in this console.
                                </p>
                              </div>
                              <Badge className={getStatusBadgeClass(manualRefreshAllowed ? "active" : "blocked")}>
                                {manualRefreshAllowed ? "Enabled" : "Plan locked"}
                              </Badge>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Scheduled refresh</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Entitlement is visible here, but the trigger surface is still deferred.
                                </p>
                              </div>
                              <Badge className={getStatusBadgeClass(subscriptionSummary?.entitlements?.scheduledRefreshEnabled ? "active" : "pending")}>
                                {subscriptionSummary?.entitlements?.scheduledRefreshEnabled ? "Entitled" : "Not included"}
                              </Badge>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Full-series pull</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Intentionally deferred until the protected worker control plane is hardened.
                                </p>
                              </div>
                              <Badge className={getStatusBadgeClass("pending")}>
                                Deferred
                              </Badge>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Loaded review queue</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Current page snapshot of the live queue after the active search and row limit.
                                </p>
                              </div>
                              <Badge className={getStatusBadgeClass(reviewQueueMatches.length > 0 ? "warning" : "active")}>
                                {loadedMatchCount} loaded
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Latest activity
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Latest refresh
                            </p>
                            <p className="mt-3 text-sm font-semibold text-foreground">
                              {latestRefreshRequest
                                ? `Match ${latestRefreshRequest.linkedSourceMatchId || latestRefreshRequest.requestSourceMatchId || "-"}`
                                : "No refresh requests yet"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {latestRefreshRequest?.requestedAt
                                ? formatDateTime(latestRefreshRequest.requestedAt)
                                : "Create the first request from the control below."}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Review queue focus
                            </p>
                            <p className="mt-3 text-sm font-semibold text-foreground">
                              {reviewQueueMatches.length
                                ? `${reviewQueueMatches.length} flagged matches in the loaded queue`
                                : "No flagged matches in the loaded queue"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              Warnings, pending ops, row errors, and selector overrides surface here first.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">Recent refresh requests</p>
                            <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                              Latest {matchOps ? formatNumber(recentRefreshCount) : "-"}
                            </Badge>
                          </div>

                          {(matchOps?.recentRequests ?? []).length ? (
                            <div className="space-y-3">
                              {(matchOps?.recentRequests ?? []).slice(0, 5).map((request) => (
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
                                      <>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setRefreshForm({
                                              matchUrl: request.requestMatchUrl || "",
                                              reason: request.reason || "",
                                            });
                                            setRefreshStatus("idle");
                                            setRefreshMessage(null);
                                            setRefreshError(null);
                                          }}
                                        >
                                          Reuse URL
                                        </Button>
                                        <a
                                          href={request.requestMatchUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-cyan-100"
                                        >
                                          Open source URL
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      </>
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
                              No manual refresh requests yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {matchOpsStatus === "loading" ? (
                      <div className="space-y-4">
                        <Skeleton className="h-40 w-full" />
                        <div className="grid gap-4 xl:grid-cols-2">
                          <Skeleton className="h-80 w-full" />
                          <Skeleton className="h-80 w-full" />
                        </div>
                        <Skeleton className="h-72 w-full" />
                      </div>
                    ) : null}

                    {matchOpsStatus === "error" ? (
                      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                          <div className="space-y-3">
                            <p className="font-semibold text-destructive">Series operations could not be loaded</p>
                            <p className="text-sm leading-6 text-destructive/80">{matchOpsError}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Manual refresh request
                          </p>
                        </div>

                        <p className="text-sm leading-6 text-muted-foreground">
                          Use this when one specific match is missing, stale, or needs recompute help. The series-wide
                          pull button is intentionally deferred to the next control-plane slice.
                        </p>

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
                      </div>

                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <ListChecks className="h-4 w-4 text-cyan-200" />
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Match review queue
                              </p>
                            </div>
                            <p className="text-sm leading-6 text-muted-foreground">
                              Search matches, inspect live statuses, and apply include or exclude overrides.
                            </p>
                          </div>

                          <Badge variant="outline" className="border-border/80 bg-card/70 text-foreground">
                            {loadedMatchCount} loaded
                          </Badge>
                        </div>

                        {reviewQueueMatches.length ? (
                          <div className="grid gap-3 md:grid-cols-3">
                            {reviewQueueMatches.map((match) => {
                              const pendingOpsCount = getPendingOpsCount(match);
                              return (
                                <div
                                  key={match.matchId || `${match.sourceMatchId}-${match.matchDate}-review`}
                                  className="rounded-2xl border border-border/70 bg-background/60 p-4"
                                >
                                  <p className="text-sm font-semibold text-foreground">
                                    {match.matchTitle || `Match ${match.matchId || "-"}`}
                                  </p>
                                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                                    {match.divisionLabel || "Division unavailable"}
                                    {match.sourceMatchId ? ` · source ${match.sourceMatchId}` : ""}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {pendingOpsCount ? (
                                      <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                                        {pendingOpsCount} pending op{pendingOpsCount === 1 ? "" : "s"}
                                      </Badge>
                                    ) : null}
                                    {match.reconciliationStatus === "warn" ? (
                                      <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                                        Reconciliation warning
                                      </Badge>
                                    ) : null}
                                    {match.adminSelectionOverride && match.adminSelectionOverride !== "auto" ? (
                                      <Badge className={getOverrideBadgeClass(match.adminSelectionOverride)}>
                                        {getOverrideLabel(match.adminSelectionOverride)}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

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
                          This page is the live operations surface for single-match refresh and review. Series-wide
                          pull controls, scheduler actions, and durable worker audit history stay in the next
                          control-plane slice.
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Single-match refresh</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Review queue visibility</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Live now
                          </p>
                          <p className="mt-2 text-sm text-foreground">Per-match overrides</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            Next slice
                          </p>
                          <p className="mt-2 text-sm text-foreground">Series-wide pull and scheduler</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="order-3 border-border/80 bg-card/85 shadow-xl" id="series-users">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-cyan-200" />
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Series users
                          </p>
                        </div>
                        <div>
                          <h2 className="font-display text-2xl text-foreground">Series user access</h2>
                          <p className="text-sm leading-7 text-muted-foreground">
                            Use one path at a time: pre-approve by email, grant by user ID, or review pending requests.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-4">
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
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pending requests</p>
                          <p className="mt-2 text-sm text-foreground">
                            {formatNumber(viewerAccess?.totals?.pendingRequests ?? 0)}
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

                    <div className="grid gap-4">
                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                        <div className="space-y-3">
                          <Badge variant="outline" className="w-fit border-border/80 bg-card/70 text-foreground">
                            Step 1
                          </Badge>
                          <div>
                            <p className="font-display text-xl text-foreground">Pre-approve by email</p>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                              Best before the person signs in for the first time.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="viewer-invite-email">Viewer email</Label>
                          <Input
                            id="viewer-invite-email"
                            type="email"
                            placeholder="viewer@example.com"
                            value={viewerInviteForm.email}
                            onChange={(event) => handleViewerInviteFieldChange("email", event.target.value)}
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="viewer-invite-role">Access role</Label>
                            <Select
                              value={viewerInviteForm.accessRole}
                              onValueChange={(value) =>
                                handleViewerInviteFieldChange("accessRole", value as ViewerInviteFormState["accessRole"])
                              }
                            >
                              <SelectTrigger id="viewer-invite-role">
                                <SelectValue placeholder="Viewer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="analyst">Analyst</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="viewer-invite-expires-at">Expires at (optional)</Label>
                            <Input
                              id="viewer-invite-expires-at"
                              type="datetime-local"
                              value={viewerInviteForm.expiresAt}
                              onChange={(event) => handleViewerInviteFieldChange("expiresAt", event.target.value)}
                            />
                          </div>
                        </div>

                        {viewerInviteMutationMessage ? (
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                            {viewerInviteMutationMessage}
                          </div>
                        ) : null}

                        {viewerInviteMutationError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                            {viewerInviteMutationError}
                          </div>
                        ) : null}

                        {!viewerGrantEnabledByPlan ? (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-200">
                            New viewer access is blocked by the current entity plan.
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleGrantViewerInvite()}
                            disabled={viewerInviteMutationStatus === "saving" || !viewerGrantEnabledByPlan}
                          >
                            {viewerInviteMutationStatus === "saving" ? "Saving..." : "Save pre-approval"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setViewerInviteForm({
                                email: "",
                                accessRole: "viewer",
                                expiresAt: "",
                              })
                            }
                            disabled={viewerInviteMutationStatus === "saving"}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                        <div className="space-y-3">
                          <Badge variant="outline" className="w-fit border-border/80 bg-card/70 text-foreground">
                            Step 2
                          </Badge>
                          <div>
                            <p className="font-display text-xl text-foreground">Grant immediately by user ID</p>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                              Use when the person already has a Game-Changrs account.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="viewer-direct-user-id">Viewer user id</Label>
                          <Input
                            id="viewer-direct-user-id"
                            placeholder="5ffa7fd5-37b9-4505-b819-8357be68de8f"
                            value={viewerDirectGrantForm.userId}
                            onChange={(event) => handleViewerDirectGrantFieldChange("userId", event.target.value)}
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="viewer-direct-role">Access role</Label>
                            <Select
                              value={viewerDirectGrantForm.accessRole}
                              onValueChange={(value) =>
                                handleViewerDirectGrantFieldChange("accessRole", value as ViewerDirectGrantFormState["accessRole"])
                              }
                            >
                              <SelectTrigger id="viewer-direct-role">
                                <SelectValue placeholder="Viewer" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="analyst">Analyst</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="viewer-direct-expires-at">Expires at (optional)</Label>
                            <Input
                              id="viewer-direct-expires-at"
                              type="datetime-local"
                              value={viewerDirectGrantForm.expiresAt}
                              onChange={(event) => handleViewerDirectGrantFieldChange("expiresAt", event.target.value)}
                            />
                          </div>
                        </div>

                        {viewerDirectGrantMutationMessage ? (
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-emerald-200">
                            {viewerDirectGrantMutationMessage}
                          </div>
                        ) : null}

                        {viewerDirectGrantMutationError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">
                            {viewerDirectGrantMutationError}
                          </div>
                        ) : null}

                        {!viewerGrantEnabledByPlan ? (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-200">
                            New viewer access is blocked by the current entity plan.
                          </div>
                        ) : null}

                        {viewerGrantEnabledByPlan && !viewerImmediateGrantAllowed ? (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-200">
                            Direct user-id grants are at the current viewer cap. Use the email pre-approval path instead,
                            or free an existing viewer seat.
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => void handleGrantViewerDirectAccess()}
                            disabled={
                              viewerDirectGrantMutationStatus === "saving"
                              || !viewerGrantEnabledByPlan
                              || !viewerImmediateGrantAllowed
                            }
                          >
                            {viewerDirectGrantMutationStatus === "saving" ? "Granting..." : "Grant now"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setViewerDirectGrantForm({
                                userId: "",
                                accessRole: "viewer",
                                expiresAt: "",
                              })
                            }
                            disabled={viewerDirectGrantMutationStatus === "saving"}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                        <div className="space-y-3">
                          <Badge variant="outline" className="w-fit border-border/80 bg-card/70 text-foreground">
                            Step 3
                          </Badge>
                          <div>
                            <p className="font-display text-xl text-foreground">Review pending requests</p>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                              Approve self-service requests or check invites waiting for first login.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="space-y-2">
                            <Label htmlFor="viewer-request-search">Search requests</Label>
                            <Input
                              id="viewer-request-search"
                              value={viewerRequestQuery}
                              onChange={(event) => setViewerRequestQuery(event.target.value)}
                              placeholder="Search by email, user ID, role, or note"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Show</Label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { value: "all", label: `All (${formatNumber(pendingViewerAccessRequests.length)})` },
                                { value: "ready", label: `Ready (${formatNumber(readyViewerRequestCount)})` },
                                { value: "waiting", label: `Waiting (${formatNumber(waitingViewerRequestCount)})` },
                              ].map((item) => (
                                <Button
                                  key={item.value}
                                  type="button"
                                  size="sm"
                                  variant={viewerRequestFilter === item.value ? "default" : "outline"}
                                  onClick={() => setViewerRequestFilter(item.value as PendingRequestFilter)}
                                >
                                  {item.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {viewerAccessStatus === "loading" ? (
                          <div className="space-y-3">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                          </div>
                        ) : null}

                        {viewerAccessStatus === "error" && viewerAccessError ? (
                          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                              <div className="space-y-3">
                                <p className="font-semibold text-destructive">Requests could not be loaded</p>
                                <p className="text-sm leading-6 text-destructive/80">{viewerAccessError}</p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {viewerAccessStatus === "success" ? (
                          filteredPendingViewerAccessRequests.length ? (
                            <div className="space-y-3">
                              {filteredPendingViewerAccessRequests.map((request) => {
                                const requestId = request.requestId || "";
                                const decisionStatus = requestId
                                  ? accessRequestDecisionStatusByRequest[requestId]
                                  : undefined;
                                const canApprove = request.requestType === "self_request" && Boolean(request.requestedUserId);
                                const requestStatusLabel =
                                  request.requestType === "admin_invite" && !request.requestedUserId
                                    ? "Waiting for first login"
                                    : request.requestStatus || "pending";

                                return (
                                  <div
                                    key={request.requestId || `${request.requestedEmail}-${request.createdAt}`}
                                    className="rounded-2xl border border-border/70 bg-background/60 p-5"
                                  >
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                          <Badge className={getStatusBadgeClass(request.requestType)}>
                                            {request.requestType === "admin_invite" ? "Email pre-approval" : "User request"}
                                          </Badge>
                                          <Badge className={getViewerAccessRoleBadgeClass(request.requestedAccessRole)}>
                                            {request.requestedAccessRole || "viewer"}
                                          </Badge>
                                          <Badge className={getStatusBadgeClass(request.requestStatus)}>
                                            {requestStatusLabel}
                                          </Badge>
                                        </div>

                                        <div className="space-y-1">
                                          <p className="break-all text-base font-semibold text-foreground">
                                            {request.requestedEmail || "-"}
                                          </p>
                                          <p className="break-all font-mono text-xs leading-6 text-muted-foreground">
                                            {request.requestedUserId || "No user ID linked yet"}
                                          </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                          <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                              Requested
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-foreground">
                                              {formatDateTime(request.createdAt)}
                                            </p>
                                          </div>
                                          <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                              Approval state
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-foreground">
                                              {canApprove ? "Ready for decision" : "Waiting for user link"}
                                            </p>
                                          </div>
                                        </div>

                                        {request.requestNote ? (
                                          <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                              Request note
                                            </p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                              {request.requestNote}
                                            </p>
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={!canApprove || decisionStatus === "saving" || !requestId}
                                          onClick={() => void handleAccessRequestDecision(request, "approve")}
                                        >
                                          {decisionStatus === "saving" && canApprove ? "Approving..." : "Approve"}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={decisionStatus === "saving" || !requestId}
                                          onClick={() => void handleAccessRequestDecision(request, "decline")}
                                        >
                                          Decline
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm leading-7 text-muted-foreground">
                              No pending viewer requests match the current filter.
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-border/80 bg-background/55 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Current grants
                          </p>
                          <p className="text-sm leading-7 text-muted-foreground">
                            Viewer and analyst access for this series.
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
                          <div className="space-y-3">
                            {(viewerAccess?.grants ?? []).map((grant) => {
                              const grantId = grant.grantId || "";
                              const revokeStatus = grantId ? viewerRevokeStatusByGrant[grantId] : undefined;

                              return (
                                <div
                                  key={grant.grantId || `${grant.userId}-${grant.createdAt}`}
                                  className="rounded-2xl border border-border/70 bg-background/60 p-5"
                                >
                                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-4">
                                      <div className="flex flex-wrap gap-2">
                                        <Badge className={getViewerAccessRoleBadgeClass(grant.accessRole)}>
                                          {grant.accessRole || "viewer"}
                                        </Badge>
                                        <Badge className={getStatusBadgeClass(grant.isExpired ? "warning" : grant.status)}>
                                          {grant.isExpired ? "expired" : grant.status || "active"}
                                        </Badge>
                                      </div>

                                      <div className="space-y-1">
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                          User ID
                                        </p>
                                        <p className="break-all font-mono text-xs leading-6 text-foreground">
                                          {grant.userId || "-"}
                                        </p>
                                      </div>

                                      <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            Granted by
                                          </p>
                                          <p className="mt-2 break-all text-sm leading-6 text-foreground">
                                            {grant.grantedByUserId || "-"}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            Updated
                                          </p>
                                          <p className="mt-2 text-sm leading-6 text-foreground">
                                            {formatDateTime(grant.updatedAt)}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                            Expiry
                                          </p>
                                          <p className="mt-2 text-sm leading-6 text-foreground">
                                            {grant.expiresAt ? formatDateTime(grant.expiresAt) : "No expiry"}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={grant.status === "revoked" || revokeStatus === "saving" || !grantId}
                                        onClick={() => void handleRevokeViewerGrant(grant)}
                                      >
                                        {revokeStatus === "saving" ? "Revoking..." : "Revoke"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm leading-7 text-muted-foreground">
                            No viewer or analyst grants exist for this series yet.
                          </div>
                        )
                      ) : null}
                    </div>

                  </CardContent>
                </Card>
                  </>
                ) : null}
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

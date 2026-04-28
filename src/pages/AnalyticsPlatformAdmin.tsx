import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  assignCricketAdminEntityMembership,
  CricketAdminEntityMembership,
  CricketAdminSeriesItem,
  CricketAdminSeriesResponse,
  fetchCricketAdminSeries,
  getAnalyticsSeriesAdminRoute,
  removeCricketAdminEntityMembership,
} from "@/lib/cricketApi";

type PlatformStatus = "loading" | "success" | "error";

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

function getMembershipTone(membership: CricketAdminEntityMembership) {
  if (membership.isOwner) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  return "border-amber-500/25 bg-amber-500/10 text-amber-300";
}

const AnalyticsPlatformAdmin = () => {
  const { session, user } = useAuth();
  const [status, setStatus] = useState<PlatformStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CricketAdminSeriesResponse | null>(null);
  const [grantDrafts, setGrantDrafts] = useState<Record<string, string>>({});
  const [entityMessages, setEntityMessages] = useState<Record<string, string>>({});
  const [entityErrors, setEntityErrors] = useState<Record<string, string>>({});
  const [activeMutationKey, setActiveMutationKey] = useState<string | null>(null);
  const accessToken = session?.access_token || "";

  async function loadCatalog(options?: {
    signal?: AbortSignal;
    silent?: boolean;
  }) {
    if (!accessToken) {
      setStatus("error");
      setErrorMessage("A signed-in session is required before the platform admin console can load.");
      return;
    }

    if (!options?.silent) {
      setStatus("loading");
    }
    setErrorMessage(null);

    try {
      const payload = await fetchCricketAdminSeries(accessToken, options?.signal);
      if (options?.signal?.aborted) {
        return;
      }

      setCatalog(payload);
      setStatus("success");
    } catch (error) {
      if (options?.signal?.aborted) {
        return;
      }

      setCatalog(null);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Platform admin scope could not be loaded.");
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setStatus("error");
      setErrorMessage("A signed-in session is required before the platform admin console can load.");
      return;
    }

    const controller = new AbortController();
    void loadCatalog({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const series = catalog?.series ?? [];
  const entities = catalog?.entities ?? [];
  const activeSeriesCount = useMemo(
    () => series.filter((item) => item.isActive).length,
    [series]
  );
  const warningSeriesCount = useMemo(
    () => series.filter((item) => (item.warningMatches ?? 0) > 0).length,
    [series]
  );
  const seriesByEntity = useMemo(() => {
    const mapping = new Map<string, CricketAdminSeriesItem[]>();

    for (const item of series) {
      const entityId = item.entityId?.trim() || "__unassigned__";
      const bucket = mapping.get(entityId) ?? [];
      bucket.push(item);
      mapping.set(entityId, bucket);
    }

    return mapping;
  }, [series]);

  const isPlatformAdmin = catalog?.actor?.isPlatformAdmin === true;

  async function handleAssignEntityAdmin(event: FormEvent<HTMLFormElement>, entityId: string) {
    event.preventDefault();

    const targetUserId = grantDrafts[entityId]?.trim() || "";
    if (!targetUserId) {
      setEntityErrors((current) => ({
        ...current,
        [entityId]: "Enter the user ID that should become a series admin for this entity.",
      }));
      setEntityMessages((current) => ({
        ...current,
        [entityId]: "",
      }));
      return;
    }

    setActiveMutationKey(`assign:${entityId}`);
    setEntityErrors((current) => ({
      ...current,
      [entityId]: "",
    }));
    setEntityMessages((current) => ({
      ...current,
      [entityId]: "",
    }));

    try {
      const result = await assignCricketAdminEntityMembership(entityId, accessToken, {
        userId: targetUserId,
        role: "admin",
      });

      await loadCatalog({ silent: true });
      setGrantDrafts((current) => ({
        ...current,
        [entityId]: "",
      }));
      setEntityMessages((current) => ({
        ...current,
        [entityId]: result.message || "Entity admin access granted.",
      }));
    } catch (error) {
      setEntityErrors((current) => ({
        ...current,
        [entityId]: error instanceof Error ? error.message : "Entity admin access could not be granted.",
      }));
    } finally {
      setActiveMutationKey(null);
    }
  }

  async function handleRemoveEntityAdmin(entityId: string, targetUserId: string) {
    setActiveMutationKey(`remove:${entityId}:${targetUserId}`);
    setEntityErrors((current) => ({
      ...current,
      [entityId]: "",
    }));
    setEntityMessages((current) => ({
      ...current,
      [entityId]: "",
    }));

    try {
      const result = await removeCricketAdminEntityMembership(entityId, targetUserId, accessToken);
      await loadCatalog({ silent: true });
      setEntityMessages((current) => ({
        ...current,
        [entityId]: result.message || "Entity admin access removed.",
      }));
    } catch (error) {
      setEntityErrors((current) => ({
        ...current,
        [entityId]: error instanceof Error ? error.message : "Entity admin access could not be removed.",
      }));
    } finally {
      setActiveMutationKey(null);
    }
  }

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
                    Platform Admin Console
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-300"
                  >
                    Global Governance
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl">
                    Platform administration
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    Govern entity boundaries, series-admin assignment, and cross-series access from one superuser
                    console.
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

            {status === "loading" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <Skeleton className="h-10 w-56" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <Skeleton className="h-10 w-56" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {status === "error" ? (
              <Card className="border-destructive/30 bg-destructive/5 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Platform admin console could not load
                  </CardTitle>
                  <CardDescription className="text-destructive/80">
                    {errorMessage || "Platform admin scope could not be loaded."}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {status === "success" && catalog?.authFoundationReady !== true ? (
              <Card className="border-amber-500/30 bg-amber-500/8 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-200">
                    <ShieldCheck className="h-5 w-5" />
                    Tenant foundation is not applied yet
                  </CardTitle>
                  <CardDescription className="text-amber-100/80">
                    The platform console route is in place, but entity and admin governance still depends on the tenant
                    foundation tables in the cricket analytics database.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            {status === "success" && catalog?.authFoundationReady === true && !isPlatformAdmin ? (
              <Card className="border-amber-500/30 bg-amber-500/8 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-200">
                    <ShieldCheck className="h-5 w-5" />
                    Platform admin access required
                  </CardTitle>
                  <CardDescription className="text-amber-100/80">
                    Signed in as {catalog?.actor?.email || user?.email || "the current user"}. This route is reserved
                    for platform admins only. Series admins should use the series admin console instead.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link to={series[0]?.configKey ? getAnalyticsSeriesAdminRoute(series[0].configKey) : "/analytics"}>
                      Open series console
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {status === "success" && catalog?.authFoundationReady === true && isPlatformAdmin ? (
              <>
                <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardContent className="space-y-6 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-primary">Global scope</p>
                          <div className="font-display text-2xl text-foreground">
                            {catalog?.actor?.email || user?.email || "Signed-in user"}
                          </div>
                          {catalog?.actor?.userId ? (
                            <p className="text-xs leading-6 text-muted-foreground">
                              User ID: <span className="font-mono text-foreground">{catalog.actor.userId}</span>
                            </p>
                          ) : null}
                          <p className="text-sm leading-6 text-muted-foreground">
                            Superuser scope across every entity, every series console, and every player-report route.
                          </p>
                        </div>

                        <Badge className={getAccessTone(catalog?.actor?.accessLabel)}>
                          Platform admin
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Entities</p>
                          <div className="mt-3 font-display text-4xl text-foreground">
                            {formatNumber(entities.length)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Total series</p>
                          <div className="mt-3 font-display text-4xl text-foreground">
                            {formatNumber(series.length)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Active series</p>
                          <div className="mt-3 font-display text-4xl text-foreground">
                            {formatNumber(activeSeriesCount)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Series with warnings</p>
                          <div className="mt-3 font-display text-4xl text-foreground">
                            {formatNumber(warningSeriesCount)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardContent className="space-y-5 p-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200">Operating boundary</p>
                          <p className="font-display text-2xl text-foreground">This console governs access layers</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {[
                          {
                            title: "Platform admin",
                            body: "Creates entity boundaries and can enter any series console.",
                          },
                          {
                            title: "Series admin",
                            body: "Runs setup, access, refresh controls, and tuning inside one entity scope.",
                          },
                          {
                            title: "Series user",
                            body: "Has no admin console. They only view approved reports and request access when blocked.",
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

                <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-2xl text-foreground">Entity admin access</CardTitle>
                      <CardDescription>
                        Grant or remove series-admin access at the entity boundary.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {entities.length ? (
                        entities.map((entity) => (
                          <div
                            key={entity.entityId || entity.entitySlug || entity.entityName}
                            className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="font-semibold text-foreground">
                                  {entity.entityName || entity.entitySlug || "Unnamed entity"}
                                </p>
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {entity.entitySlug || entity.entityId || "No slug recorded"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Badge className={getAccessTone(entity.accessRole)}>
                                  {entity.accessRole || "platform_admin"}
                                </Badge>
                                <Badge className="border-border/80 bg-background/60 text-foreground">
                                  Plan {entity.subscriptionPlanKey || "unconfigured"}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Series</p>
                                <div className="mt-2 font-display text-2xl text-foreground">
                                  {formatNumber(entity.seriesCount ?? 0)}
                                </div>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Admin seats</p>
                                <div className="mt-2 font-display text-2xl text-foreground">
                                  {formatNumber(entity.activeAdminUsers ?? 0)}
                                  <span className="text-base text-muted-foreground">
                                    {" "}
                                    / {formatNumber(entity.maxAdminUsers ?? null)}
                                  </span>
                                </div>
                              </div>
                              <div className="rounded-xl border border-border/70 bg-background/55 p-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                  Entity owner
                                </p>
                                <div className="mt-2 break-all font-mono text-xs leading-6 text-foreground">
                                  {entity.ownerUserId || "Not recorded"}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-foreground">Current entity admins</p>
                                <p className="text-xs leading-6 text-muted-foreground">
                                  Owner transfer stays locked out of this step.
                                </p>
                              </div>

                              {(entity.admins ?? []).length ? (
                                (entity.admins ?? []).map((membership) => {
                                  const removeKey = `remove:${entity.entityId}:${membership.userId}`;
                                  const isRemoving = activeMutationKey === removeKey;

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
                                          <Badge className={getMembershipTone(membership)}>
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
                                          disabled={Boolean(activeMutationKey)}
                                          onClick={() =>
                                            entity.entityId
                                              ? handleRemoveEntityAdmin(entity.entityId, membership.userId || "")
                                              : undefined
                                          }
                                          className="border-destructive/25 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        >
                                          {isRemoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                          Remove
                                        </Button>
                                      ) : (
                                        <div className="text-xs leading-6 text-muted-foreground">Locked</div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="rounded-xl border border-border/70 bg-background/55 p-4 text-sm leading-7 text-muted-foreground">
                                  No entity-admin assignments are active yet.
                                </div>
                              )}
                            </div>

                            <form
                              className="rounded-xl border border-border/70 bg-background/55 p-4"
                              onSubmit={(event) => entity.entityId && handleAssignEntityAdmin(event, entity.entityId)}
                            >
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`entity-admin-user-${entity.entityId}`}
                                  className="text-sm font-semibold text-foreground"
                                >
                                  Grant series-admin access by user ID
                                </Label>
                                <p className="text-xs leading-6 text-muted-foreground">
                                  Enter the Game-Changrs auth user ID. This grants entity-scoped series-admin access
                                  across every series owned by this entity.
                                </p>
                              </div>

                              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                                <Input
                                  id={`entity-admin-user-${entity.entityId}`}
                                  value={grantDrafts[entity.entityId || ""] || ""}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    const key = entity.entityId || "";
                                    setGrantDrafts((current) => ({
                                      ...current,
                                      [key]: nextValue,
                                    }));
                                    setEntityErrors((current) => ({
                                      ...current,
                                      [key]: "",
                                    }));
                                  }}
                                  placeholder="Supabase auth user ID"
                                  className="font-mono text-xs"
                                  autoComplete="off"
                                />
                                <Button
                                  type="submit"
                                  disabled={Boolean(activeMutationKey) || !entity.entityId}
                                  className="md:min-w-[12rem]"
                                >
                                  {activeMutationKey === `assign:${entity.entityId}` ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <UserPlus className="mr-2 h-4 w-4" />
                                  )}
                                  Grant admin access
                                </Button>
                              </div>

                              {entityMessages[entity.entityId || ""] ? (
                                <p className="mt-3 text-sm leading-6 text-emerald-300">
                                  {entityMessages[entity.entityId || ""]}
                                </p>
                              ) : null}

                              {entityErrors[entity.entityId || ""] ? (
                                <p className="mt-3 text-sm leading-6 text-destructive">
                                  {entityErrors[entity.entityId || ""]}
                                </p>
                              ) : null}
                            </form>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-border/70 bg-background/60 p-5 text-sm leading-7 text-muted-foreground">
                          No entities are visible yet in this platform-admin scope.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-2xl text-foreground">Series portfolio</CardTitle>
                      <CardDescription>
                        Open any entity-owned series console from the governance layer.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {entities.length ? (
                        entities.map((entity) => {
                          const entitySeries = seriesByEntity.get(entity.entityId?.trim() || "__unassigned__") ?? [];

                          return (
                            <div
                              key={entity.entityId || entity.entitySlug || entity.entityName}
                              className="rounded-2xl border border-border/70 bg-background/60 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-semibold text-foreground">
                                    {entity.entityName || entity.entitySlug || "Unnamed entity"}
                                  </p>
                                  <p className="text-sm leading-6 text-muted-foreground">
                                    {formatNumber(entitySeries.length)} series in this entity scope
                                  </p>
                                </div>
                                <Badge className={getAccessTone(entity.accessRole)}>
                                  {entity.accessRole || "platform_admin"}
                                </Badge>
                              </div>

                              <div className="mt-4 space-y-3">
                                {entitySeries.length ? (
                                  entitySeries.map((item) => (
                                    <div
                                      key={item.configKey || `${item.entityId}-${item.seriesName}`}
                                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/55 p-4 md:flex-row md:items-center md:justify-between"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">
                                          {item.seriesName || item.configKey || "Unnamed series"}
                                        </p>
                                        <p className="text-sm leading-6 text-muted-foreground">
                                          {item.targetAgeGroup ? `${item.targetAgeGroup} · ` : ""}
                                          {item.seasonYear ? `${item.seasonYear} · ` : ""}
                                          {formatNumber(item.computedMatches)} / {formatNumber(item.matchCount)} matches computed
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        {item.isActive ? (
                                          <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                                            Active
                                          </Badge>
                                        ) : null}
                                        <Button asChild variant="outline" size="sm">
                                          <Link to={getAnalyticsSeriesAdminRoute(item.configKey || undefined)}>
                                            Open series console
                                            <ExternalLink className="ml-2 h-4 w-4" />
                                          </Link>
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-xl border border-border/70 bg-background/55 p-4 text-sm leading-7 text-muted-foreground">
                                    No series are attached to this entity yet.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-border/70 bg-background/60 p-5 text-sm leading-7 text-muted-foreground">
                          No series are visible yet in this platform-admin scope.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

              </>
            ) : null}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AnalyticsPlatformAdmin;

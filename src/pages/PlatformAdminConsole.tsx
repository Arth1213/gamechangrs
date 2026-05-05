import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  PlayCircle,
  ShieldCheck,
  TableProperties,
  Users,
  Workflow,
} from "lucide-react";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { CricketAdminSeriesResponse, fetchCricketAdminSeries } from "@/lib/cricketApi";

type ConsoleStatus = "loading" | "ready" | "error";

const LOCAL_OPS_URL = "http://127.0.0.1:4012/local-ops";

const PlatformAdminConsole = () => {
  const { session, user } = useAuth();
  const [status, setStatus] = useState<ConsoleStatus>("loading");
  const [catalog, setCatalog] = useState<CricketAdminSeriesResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const accessToken = session?.access_token || "";

  useEffect(() => {
    if (!accessToken) {
      setStatus("error");
      setCatalog(null);
      setErrorMessage("A signed-in session is required before the platform console can load.");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage(null);

    fetchCricketAdminSeries(accessToken, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) {
          return;
        }

        setCatalog(payload);
        setStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setCatalog(null);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Platform console could not be loaded.");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken]);

  const isPlatformAdmin = catalog?.actor?.isPlatformAdmin === true;
  const entityCount = catalog?.entities?.length ?? 0;
  const seriesCount = catalog?.series?.length ?? 0;
  const activeSeriesCount = useMemo(
    () => (catalog?.series ?? []).filter((item) => item.isActive).length,
    [catalog?.series]
  );
  const warningSeriesCount = useMemo(
    () => (catalog?.series ?? []).filter((item) => (item.warningMatches ?? 0) > 0).length,
    [catalog?.series]
  );

  const surfaces = [
    {
      title: "Platform governance",
      description: "Manage entity ownership, approve series-admin requests, and open any owned series console.",
      href: "/analytics/admin/platform",
      icon: ShieldCheck,
      external: false,
    },
    {
      title: "Series admin shell",
      description: "Drop into the active series-admin workflow for setup, access, viewers, subscription, and match ops.",
      href: "/analytics/admin/series",
      icon: Users,
      external: false,
    },
    {
      title: "Analytics workspace",
      description: "Open the live analytics entry point as the platform-level operator surface for reports and access routing.",
      href: "/analytics",
      icon: Workflow,
      external: false,
    },
    {
      title: "Local-ops console",
      description: "Open localhost local-ops in a separate tab for validate, publish, queue, run triage, and run comparison.",
      href: LOCAL_OPS_URL,
      icon: ExternalLink,
      external: true,
    },
  ] as const;

  const controlledOps = [
    {
      title: "Safe DB workflow",
      copy: "Use target-specific status and apply wrappers only. Root-level supabase db push stays blocked.",
      lines: [
        "npm run db:status:main-app",
        "npm run db:status:analytics",
        "npm run db:apply:main-app -- --dry-run",
        "npm run db:apply:analytics -- --dry-run",
      ],
      icon: TableProperties,
    },
    {
      title: "Series onboarding intake",
      copy: "Users without analytics access can now request a brand-new series onboarding from the analytics workspace.",
      lines: [
        "Request includes requester email and phone number.",
        "Platform admin receives the intake by email for offline follow-up.",
        "Structured copy is also written into contact_submissions.",
      ],
      icon: Users,
    },
    {
      title: "Operator launch policy",
      copy: "Platform admin can open and supervise cross-app tools, but destructive actions still require explicit confirmation and target selection.",
      lines: [
        "Local-ops live publish is local-only and opens separately.",
        "DB apply stays split between main-app and analytics.",
        "Backups and restore remain documented, not one-click.",
      ],
      icon: PlayCircle,
    },
  ] as const;

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
                    className="border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200"
                  >
                    Platform Admin
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-border/80 bg-card/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground"
                  >
                    Signed in as {user?.email || "current user"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl">
                    Platform Console
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    This is the private launchpad for platform-level governance, controlled analytics administration,
                    local-ops entry, and safe database workflow guidance.
                  </p>
                </div>
              </div>

              <Button asChild variant="outline" className="w-full md:w-auto">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
            </div>

            {status === "loading" ? (
              <Card className="border-border/80 bg-card/85 shadow-xl">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold text-foreground">Resolving platform-admin scope</p>
                    <p className="text-sm leading-7 text-muted-foreground">
                      Verifying that this signed-in account should see the platform console.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {status === "error" ? (
              <Card className="border-destructive/30 bg-destructive/5 shadow-xl">
                <CardContent className="space-y-4 p-6">
                  <p className="font-semibold text-destructive">Platform console could not be loaded</p>
                  <p className="text-sm leading-7 text-destructive/80">
                    {errorMessage || "Platform scope could not be resolved right now."}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {status === "ready" && !isPlatformAdmin ? (
              <Card className="border-amber-500/20 bg-amber-500/5 shadow-xl">
                <CardContent className="space-y-4 p-6">
                  <p className="font-semibold text-amber-100">Platform-admin access required</p>
                  <p className="text-sm leading-7 text-amber-100/80">
                    This route is intentionally hidden from standard users and series admins. Only platform-admin accounts
                    should be able to open it.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                      <Link to="/analytics/admin">Open analytics admin gateway</Link>
                    </Button>
                    <Button asChild>
                      <Link to="/">Return home</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {status === "ready" && isPlatformAdmin ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Entities", value: entityCount },
                    { label: "Series", value: seriesCount },
                    { label: "Active series", value: activeSeriesCount },
                    { label: "Series with warnings", value: warningSeriesCount },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[28px] border border-border/80 bg-card/85 p-5 shadow-card">
                      <p className="font-display text-4xl font-bold text-foreground">{item.value}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>

                <Card className="border-border/80 bg-card/85 shadow-xl">
                  <CardHeader>
                    <CardTitle className="font-display text-2xl text-foreground">Launch surfaces</CardTitle>
                    <CardDescription>
                      These are the first-class operator entry points that a platform admin should own.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {surfaces.map((item) => (
                      <div key={item.title} className="rounded-3xl border border-border/80 bg-background/55 p-5">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10">
                          <item.icon className="h-5 w-5 text-cyan-200" />
                        </div>
                        <h2 className="mt-4 font-display text-2xl font-bold text-foreground">{item.title}</h2>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p>
                        <div className="mt-5">
                          <Button asChild variant={item.external ? "outline" : "hero"}>
                            {item.external ? (
                              <a href={item.href} target="_blank" rel="noreferrer">
                                Open
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <Link to={item.href}>
                                Open
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-2xl text-foreground">Controlled operations</CardTitle>
                      <CardDescription>
                        These stay separated from normal user flows even for platform admins.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      {controlledOps.map((item) => (
                        <div key={item.title} className="rounded-3xl border border-border/80 bg-background/55 p-5">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                          <h2 className="mt-4 font-display text-2xl font-bold text-foreground">{item.title}</h2>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.copy}</p>
                          <div className="mt-4 rounded-2xl border border-border/80 bg-card/70 p-4">
                            {item.lines.map((line) => (
                              <p key={line} className="font-mono text-xs leading-6 text-foreground/85">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-border/80 bg-card/85 shadow-xl">
                    <CardHeader>
                      <CardTitle className="font-display text-2xl text-foreground">Access model</CardTitle>
                      <CardDescription>
                        Keep the console boundaries clear so platform admin does not become a generic superuser shortcut.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          title: "Platform admin",
                          body: "Sees this console, can cross entity boundaries, can open any series-admin surface, and supervises global governance.",
                        },
                        {
                          title: "Series admin",
                          body: "Uses the series console for one owned entity or entity-scoped series set. Does not see this platform console.",
                        },
                        {
                          title: "Series user",
                          body: "Gets approved report access only. No admin console and no operator controls.",
                        },
                      ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-border/80 bg-background/55 p-4">
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
                        </div>
                      ))}
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

export default PlatformAdminConsole;

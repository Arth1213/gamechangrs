import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCricketAdminSeries,
  getAnalyticsPlatformAdminRoute,
  getAnalyticsSeriesAdminRoute,
} from "@/lib/cricketApi";

type GatewayStatus = "loading" | "redirecting" | "error" | "no_access";

const AnalyticsAdminGateway = () => {
  const { session, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<GatewayStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const accessToken = session?.access_token || "";
  const requestedSeriesKey = searchParams.get("series")?.trim() || "";

  useEffect(() => {
    if (!accessToken) {
      setStatus("error");
      setErrorMessage("A signed-in session is required before the admin console can resolve.");
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

        const fallbackSeriesKey =
          requestedSeriesKey
          || payload.defaultSeriesConfigKey?.trim()
          || payload.series?.[0]?.configKey?.trim()
          || "";

        setStatus("redirecting");

        if (payload.actor?.isPlatformAdmin) {
          navigate(getAnalyticsPlatformAdminRoute(), { replace: true });
          return;
        }

        if (payload.authFoundationReady !== true || (payload.entities?.length ?? 0) > 0 || (payload.series?.length ?? 0) > 0) {
          navigate(getAnalyticsSeriesAdminRoute(fallbackSeriesKey || undefined), { replace: true });
          return;
        }

        setStatus("no_access");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Admin access could not be resolved right now.");
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, navigate, requestedSeriesKey]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pb-20 pt-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8">
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
                    Admin Gateway
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h1 className="font-display text-4xl font-bold leading-[0.96] text-foreground md:text-5xl">
                    Resolving your admin console
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                    This route checks your live admin scope and opens the right console automatically.
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

            <Card className="border-border/80 bg-card/85 shadow-xl">
              <CardContent className="space-y-5 p-6">
                {(status === "loading" || status === "redirecting") ? (
                  <div className="flex items-start gap-4 rounded-2xl border border-border/80 bg-background/60 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">
                        {status === "redirecting" ? "Opening the correct console..." : "Checking admin scope..."}
                      </p>
                      <p className="text-sm leading-7 text-muted-foreground">
                        Signed in as {user?.email || "the current user"}. Platform admins go to the platform console.
                        Series admins go to the series console.
                      </p>
                    </div>
                  </div>
                ) : null}

                {status === "error" ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                      <div className="space-y-3">
                        <p className="font-semibold text-destructive">Admin routing failed</p>
                        <p className="text-sm leading-6 text-destructive/80">
                          {errorMessage || "Admin access could not be resolved right now."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {status === "no_access" ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-200" />
                      <div className="space-y-3">
                        <p className="font-semibold text-amber-100">No admin console access</p>
                        <p className="text-sm leading-6 text-amber-100/80">
                          This account does not currently have platform-admin or series-admin access.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AnalyticsAdminGateway;

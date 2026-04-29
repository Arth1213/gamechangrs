import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  Brain,
  GraduationCap,
  type LucideIcon,
  ShoppingBag,
  Sparkles,
  UserCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Coach, Player, Session } from "@/types/coaching";

interface AnalysisResult {
  id: string;
  mode: string;
  overall_score: number;
  created_at: string;
  video_duration: string | null;
}

interface MarketplaceListing {
  id: string;
  title: string;
  price: number | null;
  listing_type: string;
  condition: string;
  is_active: boolean;
  created_at: string;
}

type DashboardService =
  | "Technique AI"
  | "Analytics"
  | "Coaching Marketplace"
  | "Gear Marketplace";

interface RecentActivityItem {
  id: string;
  service: DashboardService;
  title: string;
  detail?: string;
  occurredAt: string;
  href: string;
}

const activityMeta: Record<
  DashboardService,
  {
    icon: LucideIcon;
    badgeClass: string;
    iconWrapClass: string;
    iconClass: string;
  }
> = {
  "Technique AI": {
    icon: Zap,
    badgeClass: "border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10",
    iconWrapClass: "bg-primary/12",
    iconClass: "text-primary",
  },
  Analytics: {
    icon: BarChart3,
    badgeClass: "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10",
    iconWrapClass: "bg-emerald-400/12",
    iconClass: "text-emerald-300",
  },
  "Coaching Marketplace": {
    icon: Brain,
    badgeClass: "border border-accent/20 bg-accent/10 text-accent hover:bg-accent/10",
    iconWrapClass: "bg-accent/12",
    iconClass: "text-accent",
  },
  "Gear Marketplace": {
    icon: ShoppingBag,
    badgeClass: "border border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/10",
    iconWrapClass: "bg-amber-400/12",
    iconClass: "text-amber-300",
  },
};

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recent";
  }
  return format(date, "MMM d, yyyy");
}

function formatScheduledTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return format(date, "MMM d, h:mm a");
}

function getSessionActivityTitle(status: Session["status"]) {
  switch (status) {
    case "confirmed":
      return "Session confirmed";
    case "completed":
      return "Session completed";
    case "canceled":
      return "Session canceled";
    default:
      return "Session booked";
  }
}

function getProfileActivityTitle(
  roleLabel: "Coach" | "Player",
  createdAt: string,
  updatedAt: string
) {
  return createdAt === updatedAt ? `${roleLabel} profile created` : `${roleLabel} profile updated`;
}

export const UserDashboard = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [playerProfile, setPlayerProfile] = useState<Player | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [matchedCoaches, setMatchedCoaches] = useState<Coach[]>([]);
  const [matchedPlayers, setMatchedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        return;
      }

      const [analysisRes, listingsRes, coachRes, playerRes] = await Promise.all([
        supabase
          .from("analysis_results")
          .select("id, mode, overall_score, created_at, video_duration")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("marketplace_listings")
          .select("id, title, price, listing_type, condition, is_active, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("coaches").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("players").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      if (analysisRes.data) {
        setAnalyses(analysisRes.data);
      }
      if (listingsRes.data) {
        setListings(listingsRes.data);
      }
      if (coachRes.data) {
        setCoachProfile(coachRes.data as Coach);
      }
      if (playerRes.data) {
        setPlayerProfile(playerRes.data as Player);
      }

      if (coachRes.data) {
        const { data: coachSessions } = await supabase
          .from("sessions")
          .select("*")
          .eq("coach_id", coachRes.data.id)
          .order("session_date_time_utc", { ascending: true });

        if (coachSessions) {
          setAllSessions((prev) => {
            const existingIds = new Set(prev.map((session) => session.id));
            const nextSessions = (coachSessions as Session[]).filter((session) => !existingIds.has(session.id));
            return [...prev, ...nextSessions];
          });

          const upcoming = coachSessions
            .filter(
              (session) => new Date(session.session_date_time_utc) > new Date() && session.status !== "canceled"
            )
            .slice(0, 3);
          setUpcomingSessions(upcoming as Session[]);

          const playerIds = [...new Set(coachSessions.map((session) => session.student_id))];
          if (playerIds.length > 0) {
            const { data: sessionPlayers } = await supabase.from("players").select("*").in("id", playerIds);
            if (sessionPlayers) {
              setMatchedPlayers((prev) => {
                const existingIds = prev.map((player) => player.id);
                return [...prev, ...(sessionPlayers.filter((player) => !existingIds.includes(player.id)) as Player[])];
              });
            }
          }
        }

        const { data: connections } = await supabase
          .from("connections")
          .select("student_id")
          .eq("coach_id", coachRes.data.id)
          .eq("verified", true);

        if (connections && connections.length > 0) {
          const studentIds = connections.map((connection) => connection.student_id);
          const { data: students } = await supabase
            .from("players")
            .select("*")
            .in("id", studentIds)
            .eq("is_active", true);

          if (students) {
            setMatchedPlayers((prev) => {
              const existingIds = prev.map((player) => player.id);
              return [...prev, ...(students.filter((player) => !existingIds.includes(player.id)) as Player[])];
            });
          }
        }
      }

      if (playerRes.data) {
        const { data: playerSessions } = await supabase
          .from("sessions")
          .select("*")
          .eq("student_id", playerRes.data.id)
          .order("session_date_time_utc", { ascending: true });

        if (playerSessions) {
          setAllSessions((prev) => {
            const existingIds = new Set(prev.map((session) => session.id));
            const nextSessions = (playerSessions as Session[]).filter((session) => !existingIds.has(session.id));
            return [...prev, ...nextSessions];
          });

          const upcoming = playerSessions
            .filter(
              (session) => new Date(session.session_date_time_utc) > new Date() && session.status !== "canceled"
            )
            .slice(0, 3);
          setUpcomingSessions((prev) => {
            const existingIds = new Set(prev.map((session) => session.id));
            const nextSessions = (upcoming as Session[]).filter((session) => !existingIds.has(session.id));
            return [...prev, ...nextSessions];
          });

          const coachIds = [...new Set(playerSessions.map((session) => session.coach_id))];
          if (coachIds.length > 0) {
            const { data: sessionCoaches } = await supabase.from("coaches").select("*").in("id", coachIds);
            if (sessionCoaches) {
              setMatchedCoaches((prev) => {
                const existingIds = prev.map((coach) => coach.id);
                return [...prev, ...(sessionCoaches.filter((coach) => !existingIds.includes(coach.id)) as Coach[])];
              });
            }
          }
        }

        const { data: connections } = await supabase
          .from("connections")
          .select("coach_id")
          .eq("student_id", playerRes.data.id)
          .eq("verified", true);

        if (connections && connections.length > 0) {
          const coachIds = connections.map((connection) => connection.coach_id);
          const { data: coaches } = await supabase
            .from("coaches")
            .select("*")
            .in("id", coachIds)
            .eq("is_active", true);

          if (coaches) {
            setMatchedCoaches((prev) => {
              const existingIds = prev.map((coach) => coach.id);
              return [...prev, ...(coaches.filter((coach) => !existingIds.includes(coach.id)) as Coach[])];
            });
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete";
  const latestAnalysis = analyses[0] || null;
  const latestListing = listings[0] || null;
  const activeListingsCount = listings.filter((listing) => listing.is_active).length;
  const coachingProfilesCount = Number(Boolean(coachProfile)) + Number(Boolean(playerProfile));
  const totalConnections = matchedCoaches.length + matchedPlayers.length;
  const hasTechniqueActivity = analyses.length > 0;
  const hasCoachingActivity = coachingProfilesCount > 0 || totalConnections > 0 || upcomingSessions.length > 0;
  const hasGearActivity = listings.length > 0;
  const coachingSignals = [
    coachingProfilesCount > 0
      ? `${coachingProfilesCount} active profile${coachingProfilesCount === 1 ? "" : "s"}`
      : null,
    totalConnections > 0 ? `${totalConnections} active connection${totalConnections === 1 ? "" : "s"}` : null,
    upcomingSessions.length > 0
      ? `${upcomingSessions.length} upcoming session${upcomingSessions.length === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  const coachingDetail = coachingSignals.join(" • ") || "Set up coach or player access.";

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    const items: RecentActivityItem[] = [
      ...analyses.map((analysis) => ({
        id: `analysis-${analysis.id}`,
        service: "Technique AI" as const,
        title: `${analysis.mode} analysis saved`,
        detail: `Score ${analysis.overall_score}%`,
        occurredAt: analysis.created_at,
        href: `/analysis/${analysis.id}`,
      })),
      ...listings.map((listing) => ({
        id: `listing-${listing.id}`,
        service: "Gear Marketplace" as const,
        title: listing.title,
        detail: `${listing.listing_type === "donation" ? "Donation" : "For sale"} • ${
          listing.price ? `$${listing.price}` : "Free"
        }`,
        occurredAt: listing.created_at,
        href: "/marketplace",
      })),
      ...allSessions.map((session) => ({
        id: `session-${session.id}`,
        service: "Coaching Marketplace" as const,
        title: getSessionActivityTitle(session.status),
        detail: `${formatScheduledTime(session.session_date_time_utc)}${
          session.duration_minutes ? ` • ${session.duration_minutes} min` : ""
        }`,
        occurredAt: session.updated_at || session.created_at,
        href: "/coaching-marketplace",
      })),
    ];

    if (coachProfile) {
      items.push({
        id: `coach-profile-${coachProfile.id}`,
        service: "Coaching Marketplace",
        title: getProfileActivityTitle("Coach", coachProfile.created_at, coachProfile.updated_at),
        detail: coachProfile.name,
        occurredAt: coachProfile.updated_at || coachProfile.created_at,
        href: "/coaching-marketplace/coach-dashboard?tab=profile",
      });
    }

    if (playerProfile) {
      items.push({
        id: `player-profile-${playerProfile.id}`,
        service: "Coaching Marketplace",
        title: getProfileActivityTitle("Player", playerProfile.created_at, playerProfile.updated_at),
        detail: playerProfile.name,
        occurredAt: playerProfile.updated_at || playerProfile.created_at,
        href: "/coaching-marketplace/player-dashboard?tab=profile",
      });
    }

    return items
      .filter((item) => item.occurredAt)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, 10);
  }, [allSessions, analyses, coachProfile, listings, playerProfile]);

  return (
    <section className="pb-16 pt-32">
      <div className="container mx-auto px-4">
        <div className="mb-10 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Game-Changrs Service Hub
          </div>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
                Welcome back, <span className="text-gradient-primary">{userName}</span>
              </h1>
              <p className="text-lg text-muted-foreground">Choose a service.</p>
            </div>

            {!loading && (coachProfile || playerProfile) ? (
              <div className="flex flex-wrap gap-2">
                {coachProfile ? (
                  <Badge variant="default" className="px-3 py-1 text-sm">
                    <GraduationCap className="mr-1 h-4 w-4" />
                    Coach
                  </Badge>
                ) : null}
                {playerProfile ? (
                  <Badge variant="secondary" className="px-3 py-1 text-sm">
                    <UserCircle className="mr-1 h-4 w-4" />
                    Player
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Link to="/techniqueai" className="group">
            <div className="flex h-full flex-col rounded-[28px] border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),rgba(15,23,42,0.92)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_60px_rgba(37,99,235,0.18)]">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                  Technique AI
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Video analysis</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Technique AI</h2>
                </div>
                <div className="rounded-2xl border border-primary/15 bg-background/40 p-4">
                  <p className="font-display text-3xl font-bold text-foreground">{analyses.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved analyses</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {latestAnalysis
                      ? `Latest score ${latestAnalysis.overall_score}% from ${formatActivityDate(latestAnalysis.created_at)}`
                      : "No video analysis yet."}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm font-medium text-primary">
                  <span>{hasTechniqueActivity ? "Open Technique AI" : "Try Technique AI"}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>

          <Link to="/analytics" className="group">
            <div className="flex h-full flex-col rounded-[28px] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),rgba(15,23,42,0.92)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-[0_24px_60px_rgba(16,185,129,0.18)]">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15">
                  <BarChart3 className="h-7 w-7 text-emerald-300" />
                </div>
                <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/10">
                  Analytics
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">Selector intelligence</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Analytics</h2>
                </div>
                <div className="rounded-2xl border border-emerald-400/15 bg-background/40 p-4">
                  <p className="font-display text-xl font-bold text-foreground">Live player reports</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Series workspace</p>
                </div>
                <div className="flex items-center justify-between text-sm font-medium text-emerald-300">
                  <span>Open Analytics</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>

          <Link to="/coaching-marketplace" className="group">
            <div className="flex h-full flex-col rounded-[28px] border border-accent/25 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.16),transparent_34%),rgba(15,23,42,0.92)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/45 hover:shadow-[0_24px_60px_rgba(217,70,239,0.18)]">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
                  <Brain className="h-7 w-7 text-accent" />
                </div>
                <Badge className="border border-accent/25 bg-accent/10 text-accent hover:bg-accent/10">
                  Coaching Marketplace
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-accent/80">Coach and player network</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Coaching Marketplace</h2>
                </div>
                <div className="rounded-2xl border border-accent/15 bg-background/40 p-4">
                  <p className="font-display text-3xl font-bold text-foreground">{coachingProfilesCount}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Active profiles</p>
                  <p className="mt-2 text-sm text-muted-foreground">{loading ? "Loading..." : coachingDetail}</p>
                </div>
                <div className="flex items-center justify-between text-sm font-medium text-accent">
                  <span>{hasCoachingActivity ? "Open Coaching Marketplace" : "Try Coaching Marketplace"}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>

          <Link to="/marketplace" className="group">
            <div className="flex h-full flex-col rounded-[28px] border border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_34%),rgba(15,23,42,0.92)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_24px_60px_rgba(251,191,36,0.16)]">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15">
                  <ShoppingBag className="h-7 w-7 text-amber-300" />
                </div>
                <Badge className="border border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/10">
                  Gear Marketplace
                </Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-300/80">Buy, sell, donate</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Gear Marketplace</h2>
                </div>
                <div className="rounded-2xl border border-amber-400/15 bg-background/40 p-4">
                  <p className="font-display text-3xl font-bold text-foreground">{activeListingsCount}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Active listings</p>
                  <p className="mt-2 text-sm text-muted-foreground">{latestListing ? latestListing.title : "No listings yet."}</p>
                </div>
                <div className="flex items-center justify-between text-sm font-medium text-amber-300">
                  <span>{hasGearActivity ? "Open Gear Marketplace" : "Try Gear Marketplace"}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="rounded-[30px] border border-border bg-gradient-card p-6 lg:p-8">
          <div className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service activity</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Recent Activity</h2>
            </div>
            {!loading && recentActivity.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {recentActivity.length} recent item{recentActivity.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-24 rounded-2xl bg-secondary/40 animate-pulse" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No recent activity yet.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentActivity.map((item) => {
                const meta = activityMeta[item.service];
                const Icon = meta.icon;

                return (
                  <Link
                    key={item.id}
                    to={item.href}
                    className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/45 p-4 transition-all duration-200 hover:border-primary/20 hover:bg-background/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.iconWrapClass}`}>
                        <Icon className={`h-5 w-5 ${meta.iconClass}`} />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={meta.badgeClass}>{item.service}</Badge>
                          <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            {formatActivityDate(item.occurredAt)}
                          </span>
                        </div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

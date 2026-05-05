import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  Brain,
  GraduationCap,
  ShieldCheck,
  type LucideIcon,
  ShoppingBag,
  UserCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdminStatus } from "@/hooks/usePlatformAdminStatus";
import { supabase } from "@/integrations/supabase/client";
import { fetchCricketDashboardSummary } from "@/lib/cricketApi";
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

interface DashboardNavigationCard {
  key: string;
  href: string;
  title: string;
  eyebrow: string;
  eyebrowClassName: string;
  ctaLabel: string;
  ctaClassName: string;
  icon: LucideIcon;
  iconWrapClassName: string;
  iconClassName: string;
  statValue: string;
  statLabel: string;
  statDetail: string;
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

function DashboardServiceCard({
  href,
  title,
  eyebrow,
  eyebrowClassName,
  ctaLabel,
  ctaClassName,
  icon: Icon,
  iconWrapClassName,
  iconClassName,
  statValue,
  statLabel,
  statDetail,
}: DashboardNavigationCard) {
  return (
    <Link to={href} className="group block h-full">
      <div className="flex h-full flex-col rounded-[28px] border border-border/80 bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-elevated">
        <div className="mb-6 flex h-14 items-start gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconWrapClassName}`}>
            <Icon className={`h-7 w-7 ${iconClassName}`} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="min-h-[7.5rem]">
            <p className={`min-h-[3.25rem] text-xs uppercase tracking-[0.18em] ${eyebrowClassName}`}>
              {eyebrow}
            </p>
            <h2 className="mt-2 min-h-[4.25rem] font-display text-2xl font-bold text-foreground">
              {title}
            </h2>
          </div>

          <div className="flex min-h-[14.5rem] flex-col rounded-2xl border border-border/70 bg-background/60 p-4">
            <p className="font-display text-3xl font-bold text-foreground">{statValue}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{statLabel}</p>
            <p className="mt-2 min-h-[5.75rem] text-sm text-muted-foreground">{statDetail}</p>
          </div>

          <div className={`mt-auto flex items-center justify-between text-sm font-medium ${ctaClassName}`}>
            <span>{ctaLabel}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export const UserDashboard = () => {
  const { user, session } = useAuth();
  const { isPlatformAdmin } = usePlatformAdminStatus(session?.access_token);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [playerProfile, setPlayerProfile] = useState<Player | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [matchedCoaches, setMatchedCoaches] = useState<Coach[]>([]);
  const [matchedPlayers, setMatchedPlayers] = useState<Player[]>([]);
  const [analyticsSeriesCount, setAnalyticsSeriesCount] = useState<number>(0);
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

    let cancelled = false;
    fetchCricketDashboardSummary()
      .then((summary) => {
        if (cancelled) {
          return;
        }

        setAnalyticsSeriesCount(summary.seriesCards?.length ?? 0);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAnalyticsSeriesCount(0);
      });

    return () => {
      cancelled = true;
    };
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
  const dashboardCards = useMemo<DashboardNavigationCard[]>(() => {
    const cards: DashboardNavigationCard[] = [];

    if (isPlatformAdmin) {
      cards.push({
        key: "platform-console",
        href: "/platform-admin",
        title: "Platform Console",
        eyebrow: "Private operator surface",
        eyebrowClassName: "text-cyan-200/80",
        ctaLabel: "Open Platform Console",
        ctaClassName: "text-cyan-200",
        icon: ShieldCheck,
        iconWrapClassName: "bg-cyan-400/15",
        iconClassName: "text-cyan-200",
        statValue: "Admin",
        statLabel: "Global scope",
        statDetail: "Governance, analytics admin surfaces, local-ops launch, and safe DB workflow guidance.",
      });
    }

    cards.push(
      {
        key: "technique-ai",
        href: "/techniqueai",
        title: "Technique AI",
        eyebrow: "Video analysis",
        eyebrowClassName: "text-primary/80",
        ctaLabel: hasTechniqueActivity ? "Open Technique AI" : "Try Technique AI",
        ctaClassName: "text-primary",
        icon: Zap,
        iconWrapClassName: "bg-primary/15",
        iconClassName: "text-primary",
        statValue: String(analyses.length),
        statLabel: "Saved analyses",
        statDetail: latestAnalysis
          ? `Latest score ${latestAnalysis.overall_score}% from ${formatActivityDate(latestAnalysis.created_at)}`
          : "No video analysis yet.",
      },
      {
        key: "analytics",
        href: "/analytics",
        title: "Analytics",
        eyebrow: "Selector intelligence",
        eyebrowClassName: "text-emerald-300/80",
        ctaLabel: "Open Analytics",
        ctaClassName: "text-emerald-300",
        icon: BarChart3,
        iconWrapClassName: "bg-emerald-400/15",
        iconClassName: "text-emerald-300",
        statValue: String(analyticsSeriesCount),
        statLabel: "Series analyzed",
        statDetail: analyticsSeriesCount > 0
          ? `${analyticsSeriesCount} live analytics workspace${analyticsSeriesCount === 1 ? "" : "s"} available.`
          : "No analytics series available yet.",
      },
      {
        key: "coaching-marketplace",
        href: "/coaching-marketplace",
        title: "Coaching Marketplace",
        eyebrow: "Coach and player network",
        eyebrowClassName: "text-accent/80",
        ctaLabel: hasCoachingActivity ? "Open Coaching Marketplace" : "Try Coaching Marketplace",
        ctaClassName: "text-accent",
        icon: Brain,
        iconWrapClassName: "bg-accent/15",
        iconClassName: "text-accent",
        statValue: String(coachingProfilesCount),
        statLabel: "Active profiles",
        statDetail: loading ? "Loading..." : coachingDetail,
      },
      {
        key: "gear-marketplace",
        href: "/marketplace",
        title: "Gear Marketplace",
        eyebrow: "Buy, sell, donate",
        eyebrowClassName: "text-amber-300/80",
        ctaLabel: hasGearActivity ? "Open Gear Marketplace" : "Try Gear Marketplace",
        ctaClassName: "text-amber-300",
        icon: ShoppingBag,
        iconWrapClassName: "bg-amber-400/15",
        iconClassName: "text-amber-300",
        statValue: String(activeListingsCount),
        statLabel: "Active listings",
        statDetail: latestListing ? latestListing.title : "No listings yet.",
      }
    );

    return cards;
  }, [
    activeListingsCount,
    analyses.length,
    analyticsSeriesCount,
    coachingDetail,
    coachingProfilesCount,
    hasCoachingActivity,
    hasGearActivity,
    hasTechniqueActivity,
    isPlatformAdmin,
    latestAnalysis,
    latestListing,
    loading,
  ]);

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

        <div className={`mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 ${isPlatformAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
          {dashboardCards.map((card) => (
            <DashboardServiceCard key={card.key} {...card} />
          ))}
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

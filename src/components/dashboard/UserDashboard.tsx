import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, Brain, ShoppingBag, Zap, ArrowRight, 
  FileText, Package, Clock, TrendingUp, Plus, Eye,
  Users, Calendar, Star, MapPin, GraduationCap, UserCircle, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { Coach, Player, Session } from "@/types/coaching";
import { SessionCalendar } from "@/components/coaching/SessionCalendar";
import { ProfileAvatar } from "@/components/coaching/ProfileAvatar";
import { PendingConnections } from "@/components/coaching/PendingConnections";

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

export const UserDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
      if (!user) return;

      // Fetch all data in parallel
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
        supabase
          .from("coaches")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (analysisRes.data) setAnalyses(analysisRes.data);
      if (listingsRes.data) setListings(listingsRes.data);
      if (coachRes.data) setCoachProfile(coachRes.data as Coach);
      if (playerRes.data) setPlayerProfile(playerRes.data as Player);

      // Fetch sessions and connections if user has a profile
      if (coachRes.data) {
        // Fetch all sessions for coach (for calendar)
        const { data: allSessionsData } = await supabase
          .from("sessions")
          .select("*")
          .eq("coach_id", coachRes.data.id)
          .order("session_date_time_utc", { ascending: true });
        
        if (allSessionsData) {
          setAllSessions(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSessions = (allSessionsData as Session[]).filter(s => !existingIds.has(s.id));
            return [...prev, ...newSessions];
          });
          
          // Filter upcoming sessions
          const upcoming = allSessionsData.filter(s => 
            new Date(s.session_date_time_utc) > new Date() && s.status !== "canceled"
          ).slice(0, 3);
          setUpcomingSessions(upcoming as Session[]);
          
          // Fetch all players from sessions
          const playerIds = [...new Set(allSessionsData.map(s => s.student_id))];
          if (playerIds.length > 0) {
            const { data: sessionPlayers } = await supabase
              .from("players")
              .select("*")
              .in("id", playerIds);
            if (sessionPlayers) setMatchedPlayers(prev => {
              const existingIds = prev.map(p => p.id);
              return [...prev, ...sessionPlayers.filter(p => !existingIds.includes(p.id)) as Player[]];
            });
          }
        }

        // Fetch connected students
        const { data: connections } = await supabase
          .from("connections")
          .select("student_id")
          .eq("coach_id", coachRes.data.id)
          .eq("verified", true);

        if (connections && connections.length > 0) {
          const studentIds = connections.map(c => c.student_id);
          const { data: students } = await supabase
            .from("players")
            .select("*")
            .in("id", studentIds)
            .eq("is_active", true);
          
          if (students) setMatchedPlayers(prev => {
            const existingIds = prev.map(p => p.id);
            return [...prev, ...students.filter(p => !existingIds.includes(p.id)) as Player[]];
          });
        }
      }

      if (playerRes.data) {
        // Fetch all sessions for player (for calendar)
        const { data: allSessionsData } = await supabase
          .from("sessions")
          .select("*")
          .eq("student_id", playerRes.data.id)
          .order("session_date_time_utc", { ascending: true });
        
        if (allSessionsData) {
          setAllSessions(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSessions = (allSessionsData as Session[]).filter(s => !existingIds.has(s.id));
            return [...prev, ...newSessions];
          });
          
          // Filter upcoming sessions
          const upcoming = allSessionsData.filter(s => 
            new Date(s.session_date_time_utc) > new Date() && s.status !== "canceled"
          ).slice(0, 3);
          setUpcomingSessions(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSessions = (upcoming as Session[]).filter(s => !existingIds.has(s.id));
            return [...prev, ...newSessions];
          });
          
          // Fetch all coaches from sessions
          const coachIds = [...new Set(allSessionsData.map(s => s.coach_id))];
          if (coachIds.length > 0) {
            const { data: sessionCoaches } = await supabase
              .from("coaches")
              .select("*")
              .in("id", coachIds);
            if (sessionCoaches) setMatchedCoaches(prev => {
              const existingIds = prev.map(c => c.id);
              return [...prev, ...sessionCoaches.filter(c => !existingIds.includes(c.id)) as Coach[]];
            });
          }
        }

        // Fetch connected coaches
        const { data: connections } = await supabase
          .from("connections")
          .select("coach_id")
          .eq("student_id", playerRes.data.id)
          .eq("verified", true);

        if (connections && connections.length > 0) {
          const coachIds = connections.map(c => c.coach_id);
          const { data: coaches } = await supabase
            .from("coaches")
            .select("*")
            .in("id", coachIds)
            .eq("is_active", true);
          
          if (coaches) setMatchedCoaches(prev => {
            const existingIds = prev.map(c => c.id);
            return [...prev, ...coaches.filter(c => !existingIds.includes(c.id)) as Coach[]];
          });
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete";

  // Session confirmation handler (for coaches)
  const handleConfirmSession = useCallback(async (sessionId: string) => {
    if (!coachProfile) return;
    
    try {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*, players!sessions_student_id_fkey(name, email)")
        .eq("id", sessionId)
        .single();

      const { error } = await supabase
        .from("sessions")
        .update({ status: "confirmed" })
        .eq("id", sessionId);

      if (error) throw error;

      // Send notification
      if (sessionData) {
        try {
          await supabase.functions.invoke("send-session-notification", {
            body: {
              sessionId: sessionId,
              coachEmail: coachProfile.email,
              coachName: coachProfile.name,
              playerEmail: sessionData.players?.email || "",
              playerName: sessionData.players?.name || "Player",
              sessionDateTime: sessionData.session_date_time_utc,
              durationMinutes: sessionData.duration_minutes,
              timezone: coachProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              action: "confirmed",
            },
          });
        } catch (emailError) {
          console.error("Error sending notification:", emailError);
        }
      }

      toast({
        title: "Session Confirmed",
        description: "The session has been confirmed and notification sent.",
      });

      // Update local state
      setAllSessions(prev => 
        prev.map(s => s.id === sessionId ? { ...s, status: "confirmed" } : s)
      );
    } catch (error: any) {
      console.error("Error confirming session:", error);
      toast({
        title: "Error",
        description: "Failed to confirm session.",
        variant: "destructive",
      });
    }
  }, [coachProfile, toast]);

  // Session cancellation handler
  const handleCancelSession = useCallback(async (sessionId: string) => {
    try {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*, players!sessions_student_id_fkey(name, email), coaches!sessions_coach_id_fkey(name, email, timezone)")
        .eq("id", sessionId)
        .single();

      const { error } = await supabase
        .from("sessions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      // Send notification
      if (sessionData) {
        const coach = sessionData.coaches || coachProfile;
        const playerInfo = sessionData.players || playerProfile;
        
        try {
          await supabase.functions.invoke("send-session-notification", {
            body: {
              sessionId: sessionId,
              coachEmail: coach?.email || "",
              coachName: coach?.name || "Coach",
              playerEmail: playerInfo?.email || "",
              playerName: playerInfo?.name || "Player",
              sessionDateTime: sessionData.session_date_time_utc,
              durationMinutes: sessionData.duration_minutes,
              timezone: coach?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              action: "canceled",
            },
          });
        } catch (emailError) {
          console.error("Error sending notification:", emailError);
        }
      }

      toast({
        title: "Session Canceled",
        description: "The session has been canceled and notification sent.",
      });

      // Update local state
      setAllSessions(prev => 
        prev.map(s => s.id === sessionId ? { ...s, status: "canceled", canceled_at: new Date().toISOString() } : s)
      );
    } catch (error: any) {
      console.error("Error canceling session:", error);
      toast({
        title: "Error",
        description: "Failed to cancel session.",
        variant: "destructive",
      });
    }
  }, [coachProfile, playerProfile, toast]);

  const latestAnalysis = analyses[0] || null;
  const latestListing = listings[0] || null;
  const activeListingsCount = listings.filter((listing) => listing.is_active).length;
  const coachingProfilesCount = Number(Boolean(coachProfile)) + Number(Boolean(playerProfile));
  const totalConnections = matchedCoaches.length + matchedPlayers.length;
  const hasTechniqueActivity = analyses.length > 0;
  const hasCoachingActivity = coachingProfilesCount > 0 || totalConnections > 0 || upcomingSessions.length > 0;
  const hasGearActivity = activeListingsCount > 0;
  const coachingStatus = coachProfile && playerProfile
    ? "Coach and player profiles active"
    : coachProfile
      ? "Coach profile active"
      : playerProfile
        ? "Player profile active"
        : "No coaching profile yet";
  const coachingDetail = coachProfile || playerProfile
    ? `${totalConnections} active connection${totalConnections === 1 ? "" : "s"} • ${upcomingSessions.length} upcoming session${upcomingSessions.length === 1 ? "" : "s"}`
    : "Create a coach or player profile to manage sessions, matches, and connections.";

  return (
    <section className="pt-32 pb-16">
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
              <p className="text-lg text-muted-foreground">
                Choose a service and jump into its full landing page. The home view now stays organized by the four
                core Game-Changrs offerings instead of centering everything around coaching roles.
              </p>
            </div>

            {!loading && (coachProfile || playerProfile) ? (
              <div className="flex flex-wrap gap-2">
                {coachProfile && (
                  <Badge variant="default" className="text-sm py-1 px-3">
                    <GraduationCap className="mr-1 h-4 w-4" />
                    Coach
                  </Badge>
                )}
                {playerProfile && (
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    <UserCircle className="mr-1 h-4 w-4" />
                    Player
                  </Badge>
                )}
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
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Upload batting clips, review scored movement analysis, and track technical improvement.
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/15 bg-background/40 p-4">
                  <p className="font-display text-3xl font-bold text-foreground">{analyses.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved analyses</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {latestAnalysis
                      ? `Latest score ${latestAnalysis.overall_score}% from ${format(new Date(latestAnalysis.created_at), "MMM d")}`
                      : "No video analysis yet. Try Technique AI."}
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
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Open live player search, series workspace intelligence, and executive selector reports.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/15 bg-background/40 p-4">
                  <p className="font-display text-xl font-bold text-foreground">Live report workspace</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Current landing page</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Search players, review series coverage, and move into selector-ready reports.
                  </p>
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
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Browse coaches, manage player and coach profiles, and coordinate sessions and connections.
                  </p>
                </div>
                <div className="rounded-2xl border border-accent/15 bg-background/40 p-4">
                  <p className="font-display text-3xl font-bold text-foreground">{coachingProfilesCount}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Active profiles</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {loading ? "Loading coaching workspace..." : hasCoachingActivity ? `${coachingStatus}. ${coachingDetail}` : "No coaching workspace yet. Try Coaching Marketplace."}
                  </p>
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
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Browse equipment, manage your listings, and move between community gear and retail options.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-400/15 bg-background/40 p-4">
                  <p className="font-display text-3xl font-bold text-foreground">{activeListingsCount}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">Active listings</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {latestListing
                      ? `Latest listing: ${latestListing.title}`
                      : "No gear activity yet. Try Gear Marketplace."}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm font-medium text-amber-300">
                  <span>{hasGearActivity ? "Open Gear Marketplace" : "Try Gear Marketplace"}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mb-10 space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service workspace</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">
                Coaching Marketplace
              </h2>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                Profiles, connections, and schedule stay here, separate from the four main service launch tiles above.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/coaching-marketplace">
                Open Coaching Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {!loading && (coachProfile || playerProfile) ? (
            <div className="space-y-4">
              {coachProfile && (
                <PendingConnections
                  userType="coach"
                  profileId={coachProfile.id}
                  onConnectionChange={() => window.location.reload()}
                />
              )}
              {playerProfile && (
                <PendingConnections
                  userType="player"
                  profileId={playerProfile.id}
                  onConnectionChange={() => window.location.reload()}
                />
              )}
            </div>
          ) : null}

          {!loading && !coachProfile && !playerProfile ? (
            <div className="rounded-2xl border border-border bg-gradient-card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <h3 className="font-display text-xl font-bold text-foreground">Set up your coaching workspace</h3>
                  <p className="mt-2 text-muted-foreground">
                    Add a coach profile, a player profile, or both. That unlocks session management, connection
                    requests, and coaching marketplace recommendations.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/coaching-marketplace/coach-signup">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Coach Profile
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/coaching-marketplace/player-signup">
                      <Plus className="mr-1 h-4 w-4" />
                      Add Player Profile
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-gradient-card p-6 lg:col-span-2">
                <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-foreground">
                  <UserCircle className="h-5 w-5 text-primary" />
                  Profile & Role Setup
                </h3>

                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {coachProfile && (
                        <Badge variant="default" className="text-sm py-1 px-3">
                          <GraduationCap className="mr-1 h-4 w-4" />
                          Coach
                        </Badge>
                      )}
                      {playerProfile && (
                        <Badge variant="secondary" className="text-sm py-1 px-3">
                          <UserCircle className="mr-1 h-4 w-4" />
                          Player
                        </Badge>
                      )}
                      {!coachProfile && !playerProfile && (
                        <span className="text-sm text-muted-foreground">No coaching roles set up yet</span>
                      )}
                    </div>

                    {(coachProfile || playerProfile) && (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {coachProfile && (
                          <div className="rounded-xl bg-secondary/30 p-4">
                            <div className="flex items-start gap-3">
                              <ProfileAvatar
                                name={coachProfile.name}
                                imageUrl={coachProfile.profile_picture_url}
                                size="md"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <h4 className="truncate font-semibold text-foreground">{coachProfile.name}</h4>
                                  {coachProfile.is_verified && (
                                    <Badge variant="secondary" className="bg-green-500/20 text-xs text-green-400">
                                      Verified
                                    </Badge>
                                  )}
                                </div>
                                <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {coachProfile.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {coachProfile.location}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    {coachProfile.average_rating?.toFixed(1) || "0.0"}
                                  </span>
                                  <span>{coachProfile.years_experience} yrs</span>
                                </div>
                                <div className="mb-3 flex flex-wrap gap-3 text-xs">
                                  <div className="flex items-center gap-1 text-primary">
                                    <Users className="h-3 w-3" />
                                    <span>{matchedPlayers.length} student{matchedPlayers.length !== 1 ? "s" : ""}</span>
                                  </div>
                                  {upcomingSessions.filter((session) => session.coach_id === coachProfile.id).length > 0 && (
                                    <div className="flex items-center gap-1 text-green-500">
                                      <Calendar className="h-3 w-3" />
                                      <span>{upcomingSessions.filter((session) => session.coach_id === coachProfile.id).length} upcoming</span>
                                    </div>
                                  )}
                                </div>

                                {upcomingSessions.filter((session) => session.coach_id === coachProfile.id).length > 0 && (
                                  <div className="mb-3 rounded-lg bg-primary/10 p-2 text-xs">
                                    <p className="text-muted-foreground">Next session:</p>
                                    <p className="font-medium text-foreground">
                                      {format(new Date(upcomingSessions.filter((session) => session.coach_id === coachProfile.id)[0].session_date_time_utc), "MMM d, h:mm a")}
                                    </p>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button size="sm" variant="hero" asChild>
                                    <Link to="/coaching-marketplace/coach-dashboard?tab=profile">Edit Profile</Link>
                                  </Button>
                                  <Button size="sm" variant="ghost" asChild>
                                    <Link to={`/coaching-marketplace/coach/${coachProfile.id}`}>
                                      <Eye className="h-3 w-3" />
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {playerProfile && (
                          <div className="rounded-xl bg-secondary/30 p-4">
                            <div className="flex items-start gap-3">
                              <ProfileAvatar
                                name={playerProfile.name}
                                imageUrl={playerProfile.profile_picture_url}
                                size="md"
                              />
                              <div className="min-w-0 flex-1">
                                <h4 className="mb-1 truncate font-semibold text-foreground">{playerProfile.name}</h4>
                                <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {playerProfile.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {playerProfile.location}
                                    </span>
                                  )}
                                  {playerProfile.playing_role && (
                                    <span className="capitalize">{playerProfile.playing_role}</span>
                                  )}
                                  <span className="capitalize">{playerProfile.experience_level}</span>
                                </div>
                                <div className="mb-3 flex flex-wrap gap-3 text-xs">
                                  <div className="flex items-center gap-1 text-accent">
                                    <GraduationCap className="h-3 w-3" />
                                    <span>{matchedCoaches.length} coach{matchedCoaches.length !== 1 ? "es" : ""}</span>
                                  </div>
                                  {upcomingSessions.filter((session) => session.student_id === playerProfile.id).length > 0 && (
                                    <div className="flex items-center gap-1 text-green-500">
                                      <Calendar className="h-3 w-3" />
                                      <span>{upcomingSessions.filter((session) => session.student_id === playerProfile.id).length} upcoming</span>
                                    </div>
                                  )}
                                </div>

                                {upcomingSessions.filter((session) => session.student_id === playerProfile.id).length > 0 && (
                                  <div className="mb-3 rounded-lg bg-accent/10 p-2 text-xs">
                                    <p className="text-muted-foreground">Next session:</p>
                                    <p className="font-medium text-foreground">
                                      {format(new Date(upcomingSessions.filter((session) => session.student_id === playerProfile.id)[0].session_date_time_utc), "MMM d, h:mm a")}
                                    </p>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button size="sm" variant="hero" asChild>
                                    <Link to="/coaching-marketplace/player-dashboard?tab=profile">Edit Profile</Link>
                                  </Button>
                                  <Button size="sm" variant="ghost" asChild>
                                    <Link to={`/coaching-marketplace/player/${playerProfile.id}`}>
                                      <Eye className="h-3 w-3" />
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-2">
                      {coachProfile ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/coaching-marketplace/coach-dashboard?tab=profile">
                            <GraduationCap className="mr-1 h-4 w-4" />
                            Edit Coach Profile
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/coaching-marketplace/coach-signup">
                            <Plus className="mr-1 h-4 w-4" />
                            Add Coach Profile
                          </Link>
                        </Button>
                      )}
                      {playerProfile ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/coaching-marketplace/player-dashboard?tab=profile">
                            <UserCircle className="mr-1 h-4 w-4" />
                            Edit Player Profile
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/coaching-marketplace/player-signup">
                            <Plus className="mr-1 h-4 w-4" />
                            Add Player Profile
                          </Link>
                        </Button>
                      )}
                    </div>

                    {(matchedCoaches.length > 0 || matchedPlayers.length > 0) && (
                      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
                        {matchedCoaches.length > 0 && (
                          <div className="rounded-xl bg-secondary/20 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-accent" />
                                <h4 className="text-sm font-semibold text-foreground">Your Coaches</h4>
                              </div>
                              <Link to="/coaching-marketplace/player-dashboard" className="flex items-center gap-1 text-xs text-accent hover:underline">
                                View All <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                            <div className="space-y-2">
                              {matchedCoaches.slice(0, 3).map((coach) => (
                                <Link
                                  key={coach.id}
                                  to={`/coaching-marketplace/coach/${coach.id}`}
                                  className="flex items-center justify-between rounded-lg bg-secondary/30 p-2 transition-colors hover:bg-secondary/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <ProfileAvatar name={coach.name} imageUrl={coach.profile_picture_url} size="xs" />
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{coach.name}</p>
                                      <p className="text-xs text-muted-foreground">{coach.coaching_level} • {coach.years_experience} yrs</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs">
                                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                    {coach.average_rating?.toFixed(1) || "0.0"}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {matchedPlayers.length > 0 && (
                          <div className="rounded-xl bg-secondary/20 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-accent" />
                                <h4 className="text-sm font-semibold text-foreground">Your Students</h4>
                              </div>
                              <Link to="/coaching-marketplace/coach-dashboard" className="flex items-center gap-1 text-xs text-accent hover:underline">
                                View All <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                            <div className="space-y-2">
                              {matchedPlayers.slice(0, 3).map((player) => (
                                <Link
                                  key={player.id}
                                  to={`/coaching-marketplace/player/${player.id}`}
                                  className="flex items-center justify-between rounded-lg bg-secondary/30 p-2 transition-colors hover:bg-secondary/50"
                                >
                                  <div className="flex items-center gap-2">
                                    <ProfileAvatar name={player.name} imageUrl={player.profile_picture_url} size="xs" />
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{player.name}</p>
                                      <p className="text-xs capitalize text-muted-foreground">
                                        {player.experience_level} • {player.playing_role || "Player"}
                                      </p>
                                    </div>
                                  </div>
                                  {player.location && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" />
                                      {player.location}
                                    </span>
                                  )}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!loading && (coachProfile || playerProfile) ? (
                <div className="rounded-2xl border border-border bg-gradient-card p-6">
                  <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-foreground">
                    <Calendar className="h-5 w-5 text-primary" />
                    Your Schedule
                  </h3>
                  <SessionCalendar
                    sessions={allSessions}
                    userType={coachProfile ? "coach" : "player"}
                    coaches={matchedCoaches}
                    players={matchedPlayers}
                    timezone={coachProfile?.timezone || playerProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                    onConfirmSession={coachProfile ? handleConfirmSession : undefined}
                    onCancelSession={handleCancelSession}
                    compact
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service activity</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Recent Activity</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Technique AI and Gear Marketplace activity stay grouped here, so the logged-in home reads by service
              rather than as one mixed dashboard.
            </p>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-gradient-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Technique AI Activity
                </h2>
              </div>
              <Link to="/analysis-history" className="text-sm text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
                ))}
              </div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">No analysis yet</p>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/techniqueai">
                    <Plus className="w-4 h-4" />
                    Start Your First Analysis
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    to={`/analysis/${analysis.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground capitalize">
                          {analysis.mode} Analysis
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(analysis.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-display font-bold text-xl text-primary">
                          {analysis.overall_score}%
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <Eye className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-gradient-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-accent" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Gear Marketplace Activity
                </h2>
              </div>
              <Link to="/marketplace" className="text-sm text-accent hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-accent" />
                </div>
                <p className="text-muted-foreground mb-4">No listings yet</p>
                <Button variant="accent" size="sm" asChild>
                  <Link to="/marketplace">
                    <Plus className="w-4 h-4" />
                    List Your First Item
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {listing.title}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className={`px-2 py-0.5 rounded-md text-xs ${
                            listing.listing_type === 'donation' 
                              ? 'bg-accent/10 text-accent' 
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {listing.listing_type === 'donation' ? 'Donation' : 'For Sale'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-xs">
                            {listing.condition}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {listing.price ? (
                        <p className="font-display font-bold text-lg text-foreground">
                          ${listing.price}
                        </p>
                      ) : (
                        <p className="font-display font-bold text-lg text-accent">
                          Free
                        </p>
                      )}
                      <p className={`text-xs ${listing.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                        {listing.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
};

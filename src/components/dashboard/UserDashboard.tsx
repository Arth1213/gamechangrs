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
  Users, Calendar, Star, MapPin, GraduationCap, UserCircle
} from "lucide-react";
import { format } from "date-fns";
import { Coach, Player, Session } from "@/types/coaching";
import { SessionCalendar } from "@/components/coaching/SessionCalendar";

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

  const quickActions = [
    { name: "AI Coaching", path: "/coaching", icon: Zap, color: "primary" },
    { name: "TechniqueAI", path: "/techniqueai", icon: Brain, color: "accent" },
    { name: "Smart Analytics", path: "/analytics", icon: BarChart3, color: "primary" },
    { name: "Gear Marketplace", path: "/marketplace", icon: ShoppingBag, color: "primary" },
  ];

  return (
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4">
        {/* Welcome Header */}
        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Welcome back, <span className="text-gradient-primary">{userName}</span>!
            </h1>
            {!loading && (coachProfile || playerProfile) && (
              <div className="flex gap-2">
                {coachProfile && (
                  <Badge variant="default" className="text-sm py-1 px-3">
                    <GraduationCap className="w-4 h-4 mr-1" />
                    Coach
                  </Badge>
                )}
                {playerProfile && (
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    <UserCircle className="w-4 h-4 mr-1" />
                    Player
                  </Badge>
                )}
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-lg">
            Ready to elevate your game? Here's your personalized dashboard.
          </p>
        </div>

        {/* Role Status Section with Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Coaching Roles */}
          <div className="lg:col-span-2 rounded-2xl bg-gradient-card border border-border p-6">
            <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              Your Coaching Roles
            </h3>
            
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Current Roles */}
                <div className="flex flex-wrap gap-3 items-center">
                  {coachProfile && (
                    <Badge variant="default" className="text-sm py-1 px-3">
                      <GraduationCap className="w-4 h-4 mr-1" />
                      Coach
                    </Badge>
                  )}
                  {playerProfile && (
                    <Badge variant="secondary" className="text-sm py-1 px-3">
                      <UserCircle className="w-4 h-4 mr-1" />
                      Player
                    </Badge>
                  )}
                  {!coachProfile && !playerProfile && (
                    <span className="text-muted-foreground text-sm">No coaching roles set up yet</span>
                  )}
                </div>

                {/* Profile Cards with Edit Options */}
                {(coachProfile || playerProfile) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {coachProfile && (
                      <div className="rounded-xl bg-secondary/30 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {coachProfile.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground truncate">{coachProfile.name}</h4>
                              {coachProfile.is_verified && (
                                <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">Verified</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                              {coachProfile.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {coachProfile.location}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                {coachProfile.average_rating?.toFixed(1) || '0.0'}
                              </span>
                              <span>{coachProfile.years_experience} yrs</span>
                            </div>
                            
                            {/* Coach Stats: Matched Players & Sessions */}
                            <div className="flex flex-wrap gap-3 text-xs mb-3">
                              <div className="flex items-center gap-1 text-primary">
                                <Users className="w-3 h-3" />
                                <span>{matchedPlayers.length} student{matchedPlayers.length !== 1 ? 's' : ''}</span>
                              </div>
                              {upcomingSessions.filter(s => s.coach_id === coachProfile.id).length > 0 && (
                                <div className="flex items-center gap-1 text-green-500">
                                  <Calendar className="w-3 h-3" />
                                  <span>{upcomingSessions.filter(s => s.coach_id === coachProfile.id).length} upcoming</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Next Session for Coach */}
                            {upcomingSessions.filter(s => s.coach_id === coachProfile.id).length > 0 && (
                              <div className="bg-primary/10 rounded-lg p-2 mb-3 text-xs">
                                <p className="text-muted-foreground">Next session:</p>
                                <p className="text-foreground font-medium">
                                  {format(new Date(upcomingSessions.filter(s => s.coach_id === coachProfile.id)[0].session_date_time_utc), "MMM d, h:mm a")}
                                </p>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <Button size="sm" variant="hero" asChild>
                                <Link to="/coaching-marketplace/coach-dashboard?tab=profile">
                                  Edit Profile
                                </Link>
                              </Button>
                              <Button size="sm" variant="ghost" asChild>
                                <Link to={`/coaching-marketplace/coach/${coachProfile.id}`}>
                                  <Eye className="w-3 h-3" />
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
                          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                            {playerProfile.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground mb-1 truncate">{playerProfile.name}</h4>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                              {playerProfile.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {playerProfile.location}
                                </span>
                              )}
                              {playerProfile.playing_role && (
                                <span className="capitalize">{playerProfile.playing_role}</span>
                              )}
                              <span className="capitalize">{playerProfile.experience_level}</span>
                            </div>
                            
                            {/* Player Stats: Matched Coaches & Sessions */}
                            <div className="flex flex-wrap gap-3 text-xs mb-3">
                              <div className="flex items-center gap-1 text-accent">
                                <GraduationCap className="w-3 h-3" />
                                <span>{matchedCoaches.length} coach{matchedCoaches.length !== 1 ? 'es' : ''}</span>
                              </div>
                              {upcomingSessions.filter(s => s.student_id === playerProfile.id).length > 0 && (
                                <div className="flex items-center gap-1 text-green-500">
                                  <Calendar className="w-3 h-3" />
                                  <span>{upcomingSessions.filter(s => s.student_id === playerProfile.id).length} upcoming</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Next Session for Player */}
                            {upcomingSessions.filter(s => s.student_id === playerProfile.id).length > 0 && (
                              <div className="bg-accent/10 rounded-lg p-2 mb-3 text-xs">
                                <p className="text-muted-foreground">Next session:</p>
                                <p className="text-foreground font-medium">
                                  {format(new Date(upcomingSessions.filter(s => s.student_id === playerProfile.id)[0].session_date_time_utc), "MMM d, h:mm a")}
                                </p>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <Button size="sm" variant="hero" asChild>
                                <Link to="/coaching-marketplace/player-dashboard?tab=profile">
                                  Edit Profile
                                </Link>
                              </Button>
                              <Button size="sm" variant="ghost" asChild>
                                <Link to={`/coaching-marketplace/player/${playerProfile.id}`}>
                                  <Eye className="w-3 h-3" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Role Management Options */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-border mt-4">
                  {coachProfile ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/coaching-marketplace/coach-dashboard?tab=profile">
                        <GraduationCap className="w-4 h-4 mr-1" />
                        Edit Coach Profile
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/coaching-marketplace/coach-signup">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Coach Profile
                      </Link>
                    </Button>
                  )}
                  {playerProfile ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/coaching-marketplace/player-dashboard?tab=profile">
                        <UserCircle className="w-4 h-4 mr-1" />
                        Edit Player Profile
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/coaching-marketplace/player-signup">
                        <Plus className="w-4 h-4 mr-1" />
                        Add Player Profile
                      </Link>
                    </Button>
                  )}
                </div>

                {/* Connections inside Coaching Roles */}
                {(matchedCoaches.length > 0 || matchedPlayers.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 mt-4 border-t border-border">
                    {/* Matched Coaches (for players) */}
                    {matchedCoaches.length > 0 && (
                      <div className="rounded-xl bg-secondary/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-accent" />
                            <h4 className="font-semibold text-foreground text-sm">Your Coaches</h4>
                          </div>
                          <Link to="/coaching-marketplace/player-dashboard" className="text-xs text-accent hover:underline flex items-center gap-1">
                            View All <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {matchedCoaches.slice(0, 3).map((coach) => (
                            <Link 
                              key={coach.id} 
                              to={`/coaching-marketplace/coach/${coach.id}`}
                              className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                                  {coach.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{coach.name}</p>
                                  <p className="text-xs text-muted-foreground">{coach.coaching_level} • {coach.years_experience} yrs</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs">
                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                {coach.average_rating?.toFixed(1) || '0.0'}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matched Players (for coaches) */}
                    {matchedPlayers.length > 0 && (
                      <div className="rounded-xl bg-secondary/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-accent" />
                            <h4 className="font-semibold text-foreground text-sm">Your Students</h4>
                          </div>
                          <Link to="/coaching-marketplace/coach-dashboard" className="text-xs text-accent hover:underline flex items-center gap-1">
                            View All <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="space-y-2">
                          {matchedPlayers.slice(0, 3).map((player) => (
                            <Link 
                              key={player.id} 
                              to={`/coaching-marketplace/player/${player.id}`}
                              className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                  {player.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{player.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{player.experience_level} • {player.playing_role || 'Player'}</p>
                                </div>
                              </div>
                              {player.location && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
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

          {/* Session Calendar - Always visible for users with profiles */}
          {!loading && (coachProfile || playerProfile) && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6">
              <h3 className="font-display font-bold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
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
          )}
        </div>


        {/* Analysis History & Gear Listings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Analysis History */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Your Analysis History
                </h2>
              </div>
              <Link to="/analytics" className="text-sm text-primary hover:underline flex items-center gap-1">
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
                  <Link to="/coaching">
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

          {/* Marketplace Listings */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-accent" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Your Gear Listings
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path} className="group">
              <div className={`p-5 rounded-2xl bg-card border border-border hover:border-${action.color}/50 transition-all duration-300 hover:shadow-glow`}>
                <div className={`w-12 h-12 rounded-xl bg-${action.color}/10 flex items-center justify-center mb-4 group-hover:bg-${action.color}/20 transition-colors`}>
                  <action.icon className={`w-6 h-6 text-${action.color}`} />
                </div>
                <h3 className="font-display font-semibold text-foreground">
                  {action.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
};

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Users, Star, Clock, MapPin, 
  BookOpen, Plus, Eye, XCircle, Settings, Edit
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link, useSearchParams } from "react-router-dom";
import { Player, Session, Coach, Connection } from "@/types/coaching";
import { PlayerProfileEditor } from "@/components/coaching/PlayerProfileEditor";
import { formatDate } from "@/lib/helpers";
import { sortCoachesByMatch, getMaxExperienceYears } from "@/lib/coaching-matching";

const PlayerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matchedCoaches, setMatchedCoaches] = useState<any[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Handle tab from URL parameter
  const tabFromUrl = searchParams.get('tab');
  const defaultTab = tabFromUrl === 'profile' ? 'edit-profile' : 'sessions';

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch player profile
      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!playerData) {
        toast({
          title: "Player Profile Not Found",
          description: "Please create a player profile first.",
          variant: "destructive",
        });
        return;
      }

      setPlayer(playerData as Player);

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .eq("student_id", playerData.id)
        .order("session_date_time_utc", { ascending: true });

      if (sessionsData) setSessions(sessionsData as Session[]);

      // Fetch connections
      const { data: connectionsData } = await supabase
        .from("connections")
        .select("*")
        .eq("student_id", playerData.id)
        .eq("verified", true);

      if (connectionsData) {
        setConnections(connectionsData as Connection[]);

        // Fetch matched coaches
        const coachIds = connectionsData.map((c) => c.coach_id);
        if (coachIds.length > 0) {
          const { data: coachesData } = await supabase
            .from("coaches")
            .select("*")
            .in("id", coachIds)
            .eq("is_active", true);

          if (coachesData) {
            const maxExp = getMaxExperienceYears(coachesData as Coach[]);
            const matched = sortCoachesByMatch(coachesData as Coach[], playerData as Player, maxExp);
            setMatchedCoaches(matched.map((m) => m.coach!));
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session Canceled",
        description: "The session has been canceled.",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error canceling session:", error);
      toast({
        title: "Error",
        description: "Failed to cancel session.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-3xl font-bold text-foreground mb-4">
              Player Profile Not Found
            </h1>
            <p className="text-muted-foreground mb-6">
              Please create a player profile to access the dashboard.
            </p>
            <Button asChild variant="hero">
              <Link to="/coaching-marketplace/player-signup">Create Player Profile</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const upcomingSessions = sessions.filter(
    (s) =>
      new Date(s.session_date_time_utc) > new Date() &&
      s.status !== "canceled" &&
      s.status !== "completed"
  );

  const pastSessions = sessions.filter(
    (s) =>
      new Date(s.session_date_time_utc) < new Date() ||
      s.status === "completed" ||
      s.status === "canceled"
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Profile Header */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-display text-3xl font-bold text-foreground">
                    {player.name}
                  </h1>
                  <Badge variant="secondary">Player</Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-muted-foreground mb-3">
                  {player.location && (
                    <span className="flex items-center gap-1 text-sm">
                      <MapPin className="w-4 h-4" />
                      {player.location}
                    </span>
                  )}
                  {player.playing_role && (
                    <span className="text-sm">{player.playing_role}</span>
                  )}
                  {player.age_group && (
                    <span className="text-sm">{player.age_group}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">{player.experience_level} Level</Badge>
                  <Badge variant="outline">{player.matches_played || 0} matches played</Badge>
                  {player.preferred_mode && (
                    <Badge variant="secondary" className="capitalize">{player.preferred_mode} training</Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/coaching-marketplace/player/${player.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Profile
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Upcoming Sessions</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground">
                {upcomingSessions.length}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Connected Coaches</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground">
                {connections.length}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total Sessions</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground">
                {sessions.length}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Experience Level</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground capitalize">
                {player.experience_level}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="coaches">Matched Coaches</TabsTrigger>
              <TabsTrigger value="edit-profile">
                <Edit className="w-4 h-4 mr-1" />
                Edit Profile
              </TabsTrigger>
            </TabsList>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="space-y-6">
              {/* Upcoming Sessions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Upcoming Sessions
                  </h2>
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/coaching-marketplace">
                      <Plus className="w-4 h-4 mr-2" />
                      Book New Session
                    </Link>
                  </Button>
                </div>
                {upcomingSessions.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-gradient-card border border-border text-center">
                    <p className="text-muted-foreground mb-4">No upcoming sessions</p>
                    <Button variant="outline" asChild>
                      <Link to="/coaching-marketplace">Find a Coach</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-6 rounded-2xl bg-gradient-card border border-border"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-foreground">
                                {formatDate(session.session_date_time_utc, "long")}
                              </h3>
                              <Badge
                                variant={
                                  session.status === "confirmed"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {session.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Duration: {session.duration_minutes} minutes
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Time: {new Date(session.session_date_time_utc).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {session.status !== "canceled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelSession(session.id)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Past Sessions */}
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                  Past Sessions
                </h2>
                {pastSessions.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-gradient-card border border-border text-center">
                    <p className="text-muted-foreground">No past sessions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pastSessions.slice(0, 10).map((session) => (
                      <div
                        key={session.id}
                        className="p-6 rounded-2xl bg-gradient-card border border-border"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">
                              {formatDate(session.session_date_time_utc, "long")}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {session.duration_minutes} minutes • {session.status}
                            </p>
                          </div>
                          {session.status === "completed" && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/coaching-marketplace/session/${session.id}/rate`}>
                                Rate & Review
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Matched Coaches Tab */}
            <TabsContent value="coaches">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Matched Coaches
              </h2>
              {matchedCoaches.length === 0 ? (
                <div className="p-8 rounded-2xl bg-gradient-card border border-border text-center">
                  <p className="text-muted-foreground mb-4">No connected coaches yet</p>
                  <Button variant="hero" asChild>
                    <Link to="/coaching-marketplace">Find Coaches</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matchedCoaches.map((coach) => (
                    <div
                      key={coach.id}
                      className="p-6 rounded-2xl bg-gradient-card border border-border"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-foreground">{coach.name}</h3>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-primary text-primary" />
                          <span className="text-sm font-semibold">
                            {coach.adjusted_rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      {coach.location && (
                        <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {coach.location}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-4">
                        {coach.years_experience} years experience • {coach.coaching_level}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <Link to={`/coaching-marketplace/coach/${coach.id}`}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button size="sm" variant="hero" asChild className="flex-1">
                          <Link to={`/coaching-marketplace/book/${coach.id}`}>
                            <Plus className="w-4 h-4 mr-1" />
                            Book
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Edit Profile Tab */}
            <TabsContent value="edit-profile">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Edit Your Profile
              </h2>
              <PlayerProfileEditor player={player} onSave={fetchData} />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PlayerDashboard;


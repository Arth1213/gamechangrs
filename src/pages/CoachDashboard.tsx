import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Users, Star, Clock, MapPin, 
  Settings, Plus, Eye, XCircle, CheckCircle, Edit
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Coach, Session, Player, Connection } from "@/types/coaching";
import { AvailabilityEditor } from "@/components/coaching/AvailabilityEditor";
import { CoachProfileEditor } from "@/components/coaching/CoachProfileEditor";
import { formatDate } from "@/lib/helpers";
import { sortPlayersByMatch } from "@/lib/coaching-matching";

const CoachDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matchedStudents, setMatchedStudents] = useState<any[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch coach profile
      const { data: coachData } = await supabase
        .from("coaches")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!coachData) {
        toast({
          title: "Coach Profile Not Found",
          description: "Please create a coach profile first.",
          variant: "destructive",
        });
        return;
      }

      setCoach(coachData as Coach);

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from("sessions")
        .select("*")
        .eq("coach_id", coachData.id)
        .order("session_date_time_utc", { ascending: true });

      if (sessionsData) setSessions(sessionsData as Session[]);

      // Fetch connections
      const { data: connectionsData } = await supabase
        .from("connections")
        .select("*")
        .eq("coach_id", coachData.id)
        .eq("verified", true);

      if (connectionsData) {
        setConnections(connectionsData as Connection[]);

        // Fetch matched students
        const studentIds = connectionsData.map((c) => c.student_id);
        if (studentIds.length > 0) {
          const { data: studentsData } = await supabase
            .from("players")
            .select("*")
            .in("id", studentIds)
            .eq("is_active", true);

          if (studentsData) {
            const matched = sortPlayersByMatch(studentsData as Player[], coachData as Coach);
            setMatchedStudents(matched.map((m) => m.player!));
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

  const confirmSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({
          status: "confirmed",
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session Confirmed",
        description: "The session has been confirmed.",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error confirming session:", error);
      toast({
        title: "Error",
        description: "Failed to confirm session.",
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

  if (!coach) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-3xl font-bold text-foreground mb-4">
              Coach Profile Not Found
            </h1>
            <p className="text-muted-foreground mb-6">
              Please create a coach profile to access the dashboard.
            </p>
            <Button asChild variant="hero">
              <Link to="/coaching-marketplace/coach-signup">Create Coach Profile</Link>
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
                {coach.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-display text-3xl font-bold text-foreground">
                    {coach.name}
                  </h1>
                  <Badge variant="default">Coach</Badge>
                  {coach.is_verified && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-muted-foreground mb-3">
                  {coach.location && (
                    <span className="flex items-center gap-1 text-sm">
                      <MapPin className="w-4 h-4" />
                      {coach.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-sm">
                    <Clock className="w-4 h-4" />
                    {coach.years_experience} years experience
                  </span>
                  <span className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    {coach.average_rating?.toFixed(1) || '0.0'} ({coach.number_of_ratings || 0} reviews)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{coach.coaching_level} Level</Badge>
                  {coach.specialties?.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/coaching-marketplace/coach/${coach.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Public Profile
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
                <span className="text-sm text-muted-foreground">Connected Students</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground">
                {connections.length}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Average Rating</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground">
                {coach.average_rating?.toFixed(1) || '0.0'}
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-gradient-card border border-border">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total Sessions</span>
              </div>
              <p className="font-display text-3xl font-bold text-foreground">
                {sessions.length}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="sessions" className="space-y-6">
            <TabsList>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="students">Matched Students</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
              <TabsTrigger value="edit-profile">
                <Edit className="w-4 h-4 mr-1" />
                Edit Profile
              </TabsTrigger>
            </TabsList>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="space-y-6">
              {/* Upcoming Sessions */}
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                  Upcoming Sessions
                </h2>
                {upcomingSessions.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-gradient-card border border-border text-center">
                    <p className="text-muted-foreground">No upcoming sessions</p>
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
                            {session.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => confirmSession(session.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelSession(session.id)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </>
                            )}
                            {session.status === "confirmed" && (
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
                                View/Add Rating
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

            {/* Matched Students Tab */}
            <TabsContent value="students">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Matched Students
              </h2>
              {matchedStudents.length === 0 ? (
                <div className="p-8 rounded-2xl bg-gradient-card border border-border text-center">
                  <p className="text-muted-foreground mb-4">No connected students yet</p>
                  <Button variant="outline" asChild>
                    <Link to="/coaching-marketplace">Browse Marketplace</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {matchedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="p-6 rounded-2xl bg-gradient-card border border-border"
                    >
                      <h3 className="font-semibold text-foreground mb-2">{student.name}</h3>
                      {student.location && (
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {student.location}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-4">
                        Level: {student.experience_level} • Role: {student.playing_role || "N/A"}
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/coaching-marketplace/player/${student.id}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Availability Tab */}
            <TabsContent value="availability">
              <AvailabilityEditor coachId={coach.id} />
            </TabsContent>

            {/* Edit Profile Tab */}
            <TabsContent value="edit-profile">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Edit Your Profile
              </h2>
              <CoachProfileEditor coach={coach} onSave={fetchData} />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoachDashboard;


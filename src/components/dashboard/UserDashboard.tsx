import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, Brain, ShoppingBag, Zap, ArrowRight, 
  FileText, Package, Clock, TrendingUp, Plus, Eye,
  Users, Calendar, Star, MapPin, GraduationCap, UserCircle
} from "lucide-react";
import { format } from "date-fns";
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

export const UserDashboard = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [playerProfile, setPlayerProfile] = useState<Player | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
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
        // Fetch upcoming sessions for coach
        const { data: sessionsData } = await supabase
          .from("sessions")
          .select("*")
          .eq("coach_id", coachRes.data.id)
          .gte("session_date_time_utc", new Date().toISOString())
          .neq("status", "canceled")
          .order("session_date_time_utc", { ascending: true })
          .limit(3);
        
        if (sessionsData) setUpcomingSessions(sessionsData as Session[]);

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
            .eq("is_active", true)
            .limit(3);
          
          if (students) setMatchedPlayers(students as Player[]);
        }
      }

      if (playerRes.data) {
        // Fetch upcoming sessions for player
        const { data: sessionsData } = await supabase
          .from("sessions")
          .select("*")
          .eq("student_id", playerRes.data.id)
          .gte("session_date_time_utc", new Date().toISOString())
          .neq("status", "canceled")
          .order("session_date_time_utc", { ascending: true })
          .limit(3);
        
        if (sessionsData) setUpcomingSessions(prev => [...prev, ...(sessionsData as Session[])]);

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
            .eq("is_active", true)
            .limit(3);
          
          if (coaches) setMatchedCoaches(coaches as Coach[]);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete";

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
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Welcome back, <span className="text-gradient-primary">{userName}</span>!
          </h1>
          <p className="text-muted-foreground text-lg">
            Ready to elevate your game? Here's your personalized dashboard.
          </p>
        </div>

        {/* Coaching Profile Cards */}
        {(coachProfile || playerProfile) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Coach Profile Card */}
            {coachProfile && (
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                    {coachProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-foreground">{coachProfile.name}</h3>
                      <Badge variant="default">Coach</Badge>
                      {coachProfile.is_verified && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">Verified</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
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
                      <span>{coachProfile.years_experience} yrs exp</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/coaching-marketplace/coach-dashboard">
                          <Eye className="w-3 h-3 mr-1" />
                          Dashboard
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/coaching-marketplace/coach/${coachProfile.id}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Player Profile Card */}
            {playerProfile && (
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xl font-bold">
                    {playerProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-foreground">{playerProfile.name}</h3>
                      <Badge variant="secondary">Player</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                      {playerProfile.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {playerProfile.location}
                        </span>
                      )}
                      {playerProfile.playing_role && (
                        <span>{playerProfile.playing_role}</span>
                      )}
                      <span className="capitalize">{playerProfile.experience_level}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/coaching-marketplace/player-dashboard">
                          <Eye className="w-3 h-3 mr-1" />
                          Dashboard
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/coaching-marketplace/player/${playerProfile.id}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sign up prompts if no coaching profile */}
        {!loading && !coachProfile && !playerProfile && (
          <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Join the Coaching Marketplace</h3>
                <p className="text-sm text-muted-foreground">Connect with coaches or offer your expertise</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="hero" size="sm" asChild>
                <Link to="/coaching-marketplace/coach-signup">
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Become a Coach
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/coaching-marketplace/player-signup">
                  <UserCircle className="w-4 h-4 mr-2" />
                  Sign Up as Player
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming Sessions & Matches Row */}
        {(upcomingSessions.length > 0 || matchedCoaches.length > 0 || matchedPlayers.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">Upcoming Sessions</h3>
                  </div>
                  <Link 
                    to={coachProfile ? "/coaching-marketplace/coach-dashboard" : "/coaching-marketplace/player-dashboard"} 
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {format(new Date(session.session_date_time_utc), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(session.session_date_time_utc), "h:mm a")} • {session.duration_minutes} min
                          </p>
                        </div>
                      </div>
                      <Badge variant={session.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                        {session.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matched Coaches (for players) */}
            {matchedCoaches.length > 0 && (
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">Your Coaches</h3>
                  </div>
                  <Link to="/coaching-marketplace/player-dashboard" className="text-sm text-accent hover:underline flex items-center gap-1">
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {matchedCoaches.map((coach) => (
                    <Link 
                      key={coach.id} 
                      to={`/coaching-marketplace/coach/${coach.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                          {coach.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{coach.name}</p>
                          <p className="text-xs text-muted-foreground">{coach.coaching_level} • {coach.years_experience} yrs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
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
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">Your Students</h3>
                  </div>
                  <Link to="/coaching-marketplace/coach-dashboard" className="text-sm text-accent hover:underline flex items-center gap-1">
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {matchedPlayers.map((player) => (
                    <Link 
                      key={player.id} 
                      to={`/coaching-marketplace/player/${player.id}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
      </div>
    </section>
  );
};

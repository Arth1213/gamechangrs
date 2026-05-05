import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MapPin, Clock, ExternalLink, Trophy, Target, Video, Calendar, Sparkles, Loader2 } from "lucide-react";
import { ProfileAvatar } from "@/components/coaching/ProfileAvatar";
import { format } from "date-fns";
import { buildFallbackPlayerSummary } from "@/lib/profileSummary";

interface Player {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  timezone: string | null;
  age_group: string | null;
  playing_role: string | null;
  training_categories_needed: string[];
  experience_level: string | null;
  matches_played: number | null;
  batting_strike_rate: number | null;
  batting_average: number | null;
  bowling_economy: number | null;
  best_figures: string | null;
  external_links: string[];
  preferred_mode: string | null;
  preferred_days: string[];
  preferred_time_range: string | null;
  user_id: string;
  profile_picture_url: string | null;
  career_summary: string | null;
}

interface CoachingCategory {
  id: string;
  name: string;
}

interface AnalysisResult {
  id: string;
  mode: string;
  overall_score: number;
  created_at: string;
  video_duration: string | null;
  video_url: string | null;
}

const PlayerProfile = () => {
  const { playerId } = useParams();
  const { user } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isConnectedCoach, setIsConnectedCoach] = useState(false);

  useEffect(() => {
    fetchPlayer();
    fetchCategories();
  }, [playerId, user]);

  useEffect(() => {
    if (isConnectedCoach && player?.user_id) {
      fetchPlayerAnalysisResults();
    }
  }, [isConnectedCoach, player]);

  const fetchPlayer = async () => {
    if (!playerId) return;

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching player:", error);
      setLoading(false);
      return;
    }

    if (data) {
      setPlayer(data as Player);
      setIsOwnProfile(user?.id === data.user_id);
      
      // Check if current user is a connected coach
      if (user && user.id !== data.user_id) {
        const { data: connection } = await supabase
          .from("connections")
          .select("id")
          .eq("student_id", playerId)
          .eq("verified", true)
          .maybeSingle();
        
        // Check if current user is a coach with verified connection
        const { data: coachData } = await supabase
          .from("coaches")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (coachData && connection) {
          const { data: isConnected } = await supabase
            .from("connections")
            .select("id")
            .eq("student_id", playerId)
            .eq("coach_id", coachData.id)
            .eq("verified", true)
            .maybeSingle();
          
          setHasAccess(!!isConnected);
          setIsConnectedCoach(!!isConnected);
        }
      }
      
      setHasAccess(prev => prev || user?.id === data.user_id);
    }

    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("coaching_categories")
      .select("*");
    if (data) setCategories(data as CoachingCategory[]);
  };

  const fetchPlayerAnalysisResults = async () => {
    if (!player?.user_id) return;

    const { data, error } = await supabase
      .from("analysis_results")
      .select("id, mode, overall_score, created_at, video_duration, video_url")
      .eq("user_id", player.user_id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAnalysisResults(data);
    }
  };

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || id;
  };

  const formatExperienceLevel = (level: string | null) => {
    if (!level) return "Not specified";
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const displayedCareerSummary = player && hasAccess
    ? player.career_summary?.trim() || buildFallbackPlayerSummary(player, categories)
    : null;

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
            <h1 className="font-display text-4xl font-bold text-foreground mb-4">
              Player Not Found
            </h1>
            <p className="text-muted-foreground mb-8">
              This player profile doesn't exist or is no longer active.
            </p>
            <Button asChild>
              <Link to="/coaching-marketplace">Back to Marketplace</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  if (!hasAccess && !isOwnProfile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-4xl font-bold text-foreground mb-4">
              Access Restricted
            </h1>
            <p className="text-muted-foreground mb-8">
              You can only view player profiles if you are connected to them as a coach.
            </p>
            <Button asChild>
              <Link to="/coaching-marketplace">Back to Marketplace</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/coaching-marketplace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          {/* Profile Header */}
          <div className="rounded-2xl bg-gradient-card border border-border p-8 mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              <ProfileAvatar
                name={player.name}
                imageUrl={player.profile_picture_url}
                size="lg"
              />
              
              <div className="flex-1">
                <h1 className="font-display text-3xl font-bold text-foreground mb-2">
                  {player.name}
                </h1>

                <div className="flex flex-wrap gap-4 text-muted-foreground mb-4">
                  {player.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {player.location}
                    </span>
                  )}
                  {player.timezone && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {player.timezone}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {player.playing_role && (
                    <Badge variant="default">{player.playing_role}</Badge>
                  )}
                  <Badge variant="outline">
                    {formatExperienceLevel(player.experience_level)}
                  </Badge>
                  {player.age_group && (
                    <Badge variant="outline">{player.age_group}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isOwnProfile && (
              <div className="flex gap-3 mt-6">
                <Button asChild>
                  <Link to="/coaching-marketplace/player-dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Career Summary */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-6">
            <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Career Summary
            </h2>
            {displayedCareerSummary ? (
              <p className="text-muted-foreground leading-relaxed">{displayedCareerSummary}</p>
            ) : (
              <p className="text-muted-foreground italic">Summary unavailable</p>
            )}
          </div>

          {/* Training Needs */}
          {player.training_categories_needed && player.training_categories_needed.length > 0 && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                <Target className="w-5 h-5 inline mr-2" />
                Training Categories Needed
              </h2>
              <div className="flex flex-wrap gap-2">
                {player.training_categories_needed.map((category) => (
                  <Badge key={category} variant="default">
                    {getCategoryName(category)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-6">
            <h2 className="font-display text-xl font-bold text-foreground mb-4">
              <Trophy className="w-5 h-5 inline mr-2" />
              Performance Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-secondary/50">
                <p className="text-2xl font-bold text-foreground">
                  {player.matches_played || 0}
                </p>
                <p className="text-sm text-muted-foreground">Matches</p>
              </div>
              {player.batting_average && (
                <div className="text-center p-4 rounded-xl bg-secondary/50">
                  <p className="text-2xl font-bold text-foreground">
                    {player.batting_average.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Batting Avg</p>
                </div>
              )}
              {player.batting_strike_rate && (
                <div className="text-center p-4 rounded-xl bg-secondary/50">
                  <p className="text-2xl font-bold text-foreground">
                    {player.batting_strike_rate.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Strike Rate</p>
                </div>
              )}
              {player.bowling_economy && (
                <div className="text-center p-4 rounded-xl bg-secondary/50">
                  <p className="text-2xl font-bold text-foreground">
                    {player.bowling_economy.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Economy</p>
                </div>
              )}
              {player.best_figures && (
                <div className="text-center p-4 rounded-xl bg-secondary/50">
                  <p className="text-2xl font-bold text-foreground">
                    {player.best_figures}
                  </p>
                  <p className="text-sm text-muted-foreground">Best Figures</p>
                </div>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-6">
            <h2 className="font-display text-xl font-bold text-foreground mb-4">
              Training Preferences
            </h2>
            <div className="space-y-4">
              {player.preferred_mode && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Preferred Mode</p>
                  <Badge variant="outline">
                    {player.preferred_mode.charAt(0).toUpperCase() + player.preferred_mode.slice(1)}
                  </Badge>
                </div>
              )}
              {player.preferred_days && player.preferred_days.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Preferred Days</p>
                  <div className="flex flex-wrap gap-2">
                    {player.preferred_days.map((day) => (
                      <Badge key={day} variant="outline">{day}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {player.preferred_time_range && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Preferred Time</p>
                  <Badge variant="outline">{player.preferred_time_range}</Badge>
                </div>
              )}
            </div>
          </div>

          {/* External Links */}
          {player.external_links && player.external_links.length > 0 && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                <ExternalLink className="w-5 h-5 inline mr-2" />
                External Links
              </h2>
              <div className="flex flex-wrap gap-4">
                {player.external_links.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {(() => {
                      try {
                        return new URL(link).hostname;
                      } catch {
                        return link;
                      }
                    })()}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Video Analysis Results - Only for connected coaches */}
          {isConnectedCoach && analysisResults.length > 0 && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6 mt-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                <Video className="w-5 h-5 inline mr-2" />
                Video Analysis History
              </h2>
              <div className="space-y-3">
                {analysisResults.map((result) => (
                  <Link
                    key={result.id}
                    to={`/analysis/${result.id}`}
                    className="block p-4 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                          result.overall_score >= 80 ? 'bg-green-500/20 text-green-500' :
                          result.overall_score >= 60 ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {result.overall_score}
                        </div>
                        <div>
                          <p className="font-medium text-foreground capitalize flex items-center gap-2">
                            {result.mode} Analysis
                            {result.video_url && (
                              <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                <Video className="w-3 h-3" />
                                Video
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(result.created_at), "MMM d, yyyy 'at' h:mm a")}
                            {result.video_duration && ` • ${result.video_duration}`}
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isConnectedCoach && analysisResults.length === 0 && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6 mt-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                <Video className="w-5 h-5 inline mr-2" />
                Video Analysis History
              </h2>
              <p className="text-muted-foreground text-center py-4">
                This player hasn't uploaded any video analysis yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PlayerProfile;

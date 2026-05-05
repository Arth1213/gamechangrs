import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, TrendingUp, Clock, Video, Calendar, BarChart3 } from "lucide-react";
import { format } from "date-fns";

interface AnalysisResult {
  id: string;
  mode: string;
  overall_score: number;
  created_at: string;
  video_duration: string | null;
  video_url: string | null;
}

export default function AnalysisHistory() {
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("analysis_results")
        .select("id, mode, overall_score, created_at, video_duration, video_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(null);
        setAnalyses(data || []);
      }
      setLoading(false);
    };

    if (!authLoading) {
      fetchAnalyses();
    }
  }, [user, authLoading]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500 bg-green-500/20';
    if (score >= 60) return 'text-yellow-500 bg-yellow-500/20';
    return 'text-red-500 bg-red-500/20';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Your Analysis History
            </h1>
            <p className="text-muted-foreground">
              View all your saved technique analysis results
            </p>
          </div>

          {errorMessage ? (
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-medium">Saved report history could not be loaded.</p>
              <p className="mt-1 opacity-90">{errorMessage}</p>
            </div>
          ) : null}

          {analyses.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-gradient-card border border-border">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-10 h-10 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">
                No Analysis Yet
              </h2>
              <p className="text-muted-foreground mb-6">
                Complete a video analysis and save it to see your history here.
              </p>
              <Button asChild>
                <Link to="/techniqueai">Go to Technique AI</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {analyses.map((analysis) => (
                <Link
                  key={analysis.id}
                  to={`/analysis/${analysis.id}`}
                  className="block rounded-2xl bg-gradient-card border border-border p-6 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${getScoreColor(analysis.overall_score)}`}>
                        {analysis.overall_score}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-display text-lg font-semibold text-foreground capitalize">
                            {analysis.mode} Analysis
                          </p>
                          {analysis.video_url && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Video className="w-3 h-3" />
                              Video
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(analysis.created_at), "MMMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {format(new Date(analysis.created_at), "h:mm a")}
                          </span>
                          {analysis.video_duration && (
                            <span>Duration: {analysis.video_duration}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                      <span className="text-sm">View Details</span>
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

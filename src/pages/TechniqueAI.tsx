import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BarChart3, Calendar, Clock, Video, ArrowRight } from "lucide-react";
import { TechniqueAI as TechniqueAIComponent } from "@/components/coaching/TechniqueAI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface AnalysisResult {
  id: string;
  mode: string;
  overall_score: number;
  created_at: string;
  video_duration: string | null;
  video_url: string | null;
}

const TechniqueAI = () => {
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyses = async () => {
      if (!user) {
        setAnalyses([]);
        setHistoryLoading(false);
        return;
      }

      const { data } = await supabase
        .from("analysis_results")
        .select("id, mode, overall_score, created_at, video_duration, video_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);

      setAnalyses(data || []);
      setHistoryLoading(false);
    };

    if (!authLoading) {
      fetchAnalyses();
    }
  }, [user, authLoading]);

  const latestAnalysis = analyses[0] || null;

  const getScoreTone = (score: number) => {
    if (score >= 80) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/20";
    if (score >= 60) return "text-amber-300 bg-amber-500/15 border-amber-500/20";
    return "text-rose-300 bg-rose-500/15 border-rose-500/20";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Batting AI Tracker</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              <span className="text-gradient-primary">Technique AI</span> Batting Analysis
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload a cricket batting clip to get pose-driven scoring, phase-by-phase feedback,
              and drills that replace the old AI video analysis flow.
            </p>
          </div>
        </div>
      </section>

      {user && (
        <section className="border-b border-border bg-card/60 py-8">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl">
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Your Technique AI library</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">
                    Uploaded Videos & Reports
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    Every saved upload stays here so you can reopen the report without searching through the app.
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/analysis-history">
                    View Full History
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {authLoading || historyLoading ? (
                <div className="rounded-3xl border border-border bg-background/70 p-8 text-sm text-muted-foreground">
                  Loading your saved uploads...
                </div>
              ) : analyses.length === 0 ? (
                <div className="grid gap-6 rounded-3xl border border-border bg-background/70 p-8 lg:grid-cols-[0.85fr_1.15fr]">
                  <div>
                    <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                      No saved reports yet
                    </div>
                    <h3 className="mt-4 font-display text-2xl font-bold text-foreground">
                      You have not performed any video analysis yet.
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Upload your first batting clip below. Once the analysis is saved, this page will show the video
                      history and direct links back into each report.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border bg-gradient-card p-5">
                      <p className="font-display text-3xl font-bold text-foreground">0</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Saved analyses</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-gradient-card p-5">
                      <p className="font-display text-xl font-bold text-foreground">No uploads</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest video</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-gradient-card p-5">
                      <p className="font-display text-xl font-bold text-foreground">Start below</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Next action</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
                      <p className="font-display text-3xl font-bold text-foreground">{analyses.length}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Recent uploads shown</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-gradient-card p-5">
                      <p className="font-display text-3xl font-bold text-foreground">{latestAnalysis?.overall_score ?? "--"}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest score</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-gradient-card p-5">
                      <p className="font-display text-lg font-bold text-foreground">
                        {latestAnalysis ? format(new Date(latestAnalysis.created_at), "MMM d, yyyy") : "--"}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest upload date</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {analyses.map((analysis) => (
                      <div
                        key={analysis.id}
                        className="rounded-3xl border border-border bg-gradient-card p-6 transition-colors hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Saved report</p>
                            <h3 className="mt-2 font-display text-xl font-bold text-foreground capitalize">
                              {analysis.mode} Analysis
                            </h3>
                          </div>
                          <div className={`rounded-2xl border px-4 py-2 font-display text-2xl font-bold ${getScoreTone(analysis.overall_score)}`}>
                            {analysis.overall_score}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {analysis.video_url && (
                            <Badge variant="secondary" className="gap-1">
                              <Video className="h-3 w-3" />
                              Video saved
                            </Badge>
                          )}
                          {analysis.video_duration && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {analysis.video_duration}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            {format(new Date(analysis.created_at), "MMMM d, yyyy")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            {format(new Date(analysis.created_at), "h:mm a")}
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <Button className="flex-1" asChild>
                            <Link to={`/analysis/${analysis.id}`}>
                              View Report
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                          {analysis.video_url && (
                            <Button variant="outline" asChild>
                              <a href={analysis.video_url} target="_blank" rel="noreferrer">
                                Open Video
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TechniqueAI Component */}
      <section id="technique-uploader" className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Run a New Video Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  Upload a fresh clip and save the result so it appears in your Technique AI history above.
                </p>
              </div>
            </div>
            <TechniqueAIComponent />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TechniqueAI;

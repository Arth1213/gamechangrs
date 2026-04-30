import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Dumbbell,
  Eye,
  Sparkles,
  Target,
  Upload,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { TechniqueAI as TechniqueAIComponent } from "@/components/coaching/TechniqueAI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AnalysisResult {
  id: string;
  mode: string;
  overall_score: number;
  created_at: string;
  video_duration: string | null;
  video_url: string | null;
}

const TECHNIQUE_PHASES = [
  {
    title: "Setup",
    description: "Base, head line, and balance before the movement starts.",
  },
  {
    title: "Backlift",
    description: "How the bat gets into position for a repeatable swing.",
  },
  {
    title: "Trigger",
    description: "Whether the body loads early enough before release.",
  },
  {
    title: "Downswing",
    description: "Bat path, shoulder control, and movement into the ball.",
  },
  {
    title: "Contact Zone",
    description: "Contact timing, hand control, and meeting point.",
  },
  {
    title: "Shot Match",
    description: "How closely the movement fits the intended batting shot.",
  },
];

const TECHNIQUE_FLOW = [
  {
    title: "Upload clip",
    description: "Add a batting video with one clear rep in frame.",
    icon: Upload,
  },
  {
    title: "Pose detection",
    description: "Technique AI maps the body movement across the clip.",
    icon: Activity,
  },
  {
    title: "Score the phases",
    description: "The system scores the batting sequence phase by phase.",
    icon: BarChart3,
  },
  {
    title: "Get fixes and drills",
    description: "Receive findings, corrections, and practical next reps.",
    icon: Dumbbell,
  },
];

const TECHNIQUE_OUTPUTS = [
  {
    title: "Overall score",
    description: "One clear read on the batting rep.",
    icon: Target,
  },
  {
    title: "Phase breakdown",
    description: "Setup through shot match in one report.",
    icon: Eye,
  },
  {
    title: "Findings and drills",
    description: "Issues, fixes, and repeatable correction work.",
    icon: Dumbbell,
  },
  {
    title: "Saved reports",
    description: "Signed-in users can reopen past analyses later.",
    icon: Clock,
  },
];

const CAPTURE_GUIDANCE = [
  "Use a side-on batting angle when possible.",
  "Keep one batter clearly visible in frame.",
  "Use a stable camera with enough light to see the body.",
  "Upload MP4, MOV, or AVI clips.",
];

const SAMPLE_PHASE_SCORES = [
  { label: "Setup", score: 88 },
  { label: "Backlift", score: 81 },
  { label: "Trigger", score: 76 },
  { label: "Downswing", score: 84 },
  { label: "Contact Zone", score: 79 },
  { label: "Shot Match", score: 82 },
];

const SAMPLE_FINDINGS = [
  "Front foot reaches line late",
  "Head falls away from the ball line",
];

function TechniqueAIGuestLanding() {
  return (
    <>
      <section className="bg-gradient-hero pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-accent">Batting Technique AI</span>
                </div>

                <div className="space-y-4">
                  <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
                    Upload a batting clip. Get scored technique feedback.
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                    Pose-driven batting analysis with phase scoring, corrective drills, and saved reports once signed in.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="hero" size="lg" asChild>
                    <Link to="/auth">
                      Sign In to Analyze
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <a href="#technique-ai-report-preview">See Sample Report</a>
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-border/80 bg-background/40">
                    Batting-focused
                  </Badge>
                  <Badge variant="outline" className="border-border/80 bg-background/40">
                    Pose-driven
                  </Badge>
                  <Badge variant="outline" className="border-border/80 bg-background/40">
                    Saved history
                  </Badge>
                </div>
              </div>

              <div
                id="technique-ai-report-preview"
                className="rounded-[32px] border border-border/80 bg-card/85 p-6 shadow-xl"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Sample Report</p>
                      <h2 className="mt-2 font-display text-3xl font-bold text-foreground">Batting Analysis</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Technique AI turns one batting clip into a clear report with scores, findings, and next drills.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-primary/20 bg-primary/10 px-5 py-4 text-center">
                      <p className="font-display text-4xl font-bold text-foreground">84</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Overall score</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">Phase breakdown</p>
                      <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                        Strong base
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {SAMPLE_PHASE_SCORES.map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium text-foreground">{item.score}</span>
                          </div>
                          <Progress value={item.score} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Top findings</p>
                      <div className="mt-3 space-y-3">
                        {SAMPLE_FINDINGS.map((item) => (
                          <div key={item} className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-amber-500/15 p-1">
                              <Activity className="h-3.5 w-3.5 text-amber-300" />
                            </div>
                            <p className="text-sm leading-6 text-foreground">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Next drill</p>
                      <h3 className="mt-3 font-display text-xl text-foreground">Stride and freeze</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Land the front foot earlier, hold balance, then let the hands release through the ball line.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {TECHNIQUE_OUTPUTS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-primary/80">What It Scores</p>
                <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">The batting phases it reads</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                The current Technique AI flow is built around batting movement and phase-based scoring.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {TECHNIQUE_PHASES.map((phase) => (
                <div key={phase.title} className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-primary/80">Phase</p>
                  <h3 className="mt-2 font-display text-2xl text-foreground">{phase.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{phase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-primary/80">How It Works</p>
                <h2 className="mt-2 font-display text-3xl text-foreground md:text-4xl">From clip to report</h2>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              {TECHNIQUE_FLOW.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-2xl text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-3xl border border-border/80 bg-card/80 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Recording Guidance</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">Get a cleaner read</h2>
                <div className="mt-5 space-y-4">
                  {CAPTURE_GUIDANCE.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 text-primary" />
                      <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/15 to-sky-400/10 p-6 shadow-xl">
                <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Signed-In Benefits</p>
                <h2 className="mt-3 font-display text-3xl text-foreground">Keep your report library</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                    <p className="font-display text-2xl text-foreground">Saved reports</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Reopen prior analyses without re-uploading the clip.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                    <p className="font-display text-2xl text-foreground">Video history</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Keep track of recent uploads and report dates.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                    <p className="font-display text-2xl text-foreground">Detailed report</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Overall score, findings, angle reads, and improvement areas.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-background/50 p-4">
                    <p className="font-display text-2xl text-foreground">Next drills</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Practical correction work tied directly to the report.
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <Button variant="hero" size="lg" asChild>
                    <Link to="/auth">
                      Sign In to Start
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TechniqueAIWorkspace({
  analyses,
  latestAnalysis,
  authLoading,
  historyLoading,
}: {
  analyses: AnalysisResult[];
  latestAnalysis: AnalysisResult | null;
  authLoading: boolean;
  historyLoading: boolean;
}) {
  const getScoreTone = (score: number) => {
    if (score >= 80) return "text-emerald-300 bg-emerald-500/15 border-emerald-500/20";
    if (score >= 60) return "text-amber-300 bg-amber-500/15 border-amber-500/20";
    return "text-rose-300 bg-rose-500/15 border-rose-500/20";
  };

  return (
    <>
      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              <span className="text-gradient-primary">Technique AI</span>
            </h1>
            <p className="text-lg text-muted-foreground">Upload a batting clip for scored feedback and drills.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/60 py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Your Technique AI library</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Saved Reports</h2>
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
                Loading reports...
              </div>
            ) : analyses.length === 0 ? (
              <div className="grid gap-6 rounded-3xl border border-border bg-background/70 p-8 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">
                    Start here
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-bold text-foreground">No saved reports yet.</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Run your first analysis below.</p>
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
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Reports shown</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-gradient-card p-5">
                    <p className="font-display text-3xl font-bold text-foreground">{latestAnalysis?.overall_score ?? "--"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest score</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-gradient-card p-5">
                    <p className="font-display text-lg font-bold text-foreground">
                      {latestAnalysis ? format(new Date(latestAnalysis.created_at), "MMM d, yyyy") : "--"}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest upload</p>
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
                        <div
                          className={`rounded-2xl border px-4 py-2 font-display text-2xl font-bold ${getScoreTone(analysis.overall_score)}`}
                        >
                          {analysis.overall_score}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {analysis.video_url ? (
                          <Badge variant="secondary" className="gap-1">
                            <Video className="h-3 w-3" />
                            Video saved
                          </Badge>
                        ) : null}
                        {analysis.video_duration ? (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {analysis.video_duration}
                          </Badge>
                        ) : null}
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
                        {analysis.video_url ? (
                          <Button variant="outline" asChild>
                            <a href={analysis.video_url} target="_blank" rel="noreferrer">
                              Open Video
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="technique-uploader" className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">New Analysis</h2>
              </div>
            </div>
            <TechniqueAIComponent />
          </div>
        </div>
      </section>
    </>
  );
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="bg-gradient-hero pb-20 pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl rounded-3xl border border-border/80 bg-card/85 p-8 text-sm text-muted-foreground shadow-xl">
              Loading Technique AI.
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {user ? (
        <TechniqueAIWorkspace
          analyses={analyses}
          latestAnalysis={latestAnalysis}
          authLoading={authLoading}
          historyLoading={historyLoading}
        />
      ) : (
        <TechniqueAIGuestLanding />
      )}
      <Footer />
    </div>
  );
};

export default TechniqueAI;

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AnalysisResults } from "@/components/coaching/AnalysisResults";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Video, Play } from "lucide-react";
import { format } from "date-fns";

interface StoredAnalysis {
  id: string;
  mode: string;
  overall_score: number;
  scores: any;
  angles: any;
  feedback: any;
  drills: any;
  video_duration: string | null;
  video_url: string | null;
  created_at: string;
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!user || !id) return;

      // First try to fetch (RLS will handle access - either own analysis or connected player's)
      const { data, error } = await supabase
        .from("analysis_results")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        setError("Analysis not found or you don't have permission to view it.");
      } else {
        setAnalysis(data);
      }
      setLoading(false);
    };

    if (!authLoading) {
      fetchAnalysis();
    }
  }, [id, user, authLoading]);

  // Transform stored data to AnalysisResults format
  const transformToAnalysisFormat = (stored: StoredAnalysis) => {
    const scores = stored.scores || {};
    const angles = stored.angles || {};
    const feedback = stored.feedback || {};
    const drills = stored.drills || [];

    // Build aspects from scores
    const aspects = Object.entries(scores).map(([name, score]: [string, any]) => ({
      name: name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      score: typeof score === 'number' ? score : score?.score || 75,
      status: getStatus(typeof score === 'number' ? score : score?.score || 75),
      feedback: feedback[name] || `Your ${name.toLowerCase()} shows good fundamentals.`,
      keyPoints: [`Focus on maintaining consistent ${name.toLowerCase()}`],
    }));

    // Build angle analysis
    const angleAnalysis: any = {};
    if (angles.elbow) {
      angleAnalysis.elbowAngle = {
        value: angles.elbow,
        optimal: "90-110°",
        assessment: angles.elbow >= 90 && angles.elbow <= 110 ? "Good" : "Needs adjustment",
      };
    }
    if (angles.knee) {
      angleAnalysis.kneeAngle = {
        value: angles.knee,
        optimal: "130-150°",
        assessment: angles.knee >= 130 && angles.knee <= 150 ? "Good" : "Needs adjustment",
      };
    }
    if (angles.shoulder) {
      angleAnalysis.shoulderAngle = {
        value: angles.shoulder,
        optimal: "160-180°",
        assessment: angles.shoulder >= 160 ? "Good" : "Needs adjustment",
      };
    }
    if (angles.hip) {
      angleAnalysis.hipAngle = {
        value: angles.hip,
        optimal: "45-60°",
        assessment: angles.hip >= 45 && angles.hip <= 60 ? "Good" : "Needs adjustment",
      };
    }

    // Build improvements from drills
    const areasForImprovement = drills.map((drill: any, index: number) => ({
      issue: drill.focus || `Area ${index + 1}`,
      severity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
      drill: drill.description || drill,
    }));

    return {
      overallScore: stored.overall_score,
      overallGrade: getGrade(stored.overall_score),
      summary: `Your ${stored.mode} technique analysis from ${format(new Date(stored.created_at), "MMMM d, yyyy")}. Overall score: ${stored.overall_score}/100.`,
      aspects: aspects.length > 0 ? aspects : [
        { name: "Overall Technique", score: stored.overall_score, status: getStatus(stored.overall_score), feedback: "Analysis completed successfully.", keyPoints: ["Continue practicing"] }
      ],
      strengths: feedback.strengths || ["Good foundational technique", "Consistent execution"],
      areasForImprovement: areasForImprovement.length > 0 ? areasForImprovement : [
        { issue: "General improvement", severity: 'medium' as const, drill: "Continue regular practice sessions" }
      ],
      angleAnalysis,
      comparisonToElite: feedback.eliteComparison || "Your technique shows promising fundamentals. Continue to refine your form for better results.",
      nextSteps: feedback.nextSteps || ["Review this analysis", "Focus on identified improvement areas", "Schedule another analysis to track progress"],
    };
  };

  const getStatus = (score: number): 'excellent' | 'good' | 'needs_improvement' | 'poor' => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'needs_improvement';
    return 'poor';
  };

  const getGrade = (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
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
        <div className="container mx-auto px-4 max-w-5xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </Button>

          {error ? (
            <div className="text-center py-16">
              <p className="text-destructive mb-4">{error}</p>
              <Button asChild>
                <Link to="/">Return to Dashboard</Link>
              </Button>
            </div>
          ) : analysis ? (
            <>
              <div className="mb-8">
                <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2 capitalize">
                  {analysis.mode} Analysis Results
                </h1>
                <p className="text-muted-foreground">
                  Analyzed on {format(new Date(analysis.created_at), "MMMM d, yyyy 'at' h:mm a")}
                  {analysis.video_duration && ` • Duration: ${analysis.video_duration}`}
                </p>
              </div>

              {/* Video Player Section */}
              {analysis.video_url && (
                <div className="mb-8 rounded-2xl bg-gradient-card border border-border p-6">
                  <h2 className="font-display text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Analyzed Video
                  </h2>
                  <div className="relative rounded-xl overflow-hidden bg-secondary/50">
                    <video
                      src={analysis.video_url}
                      controls
                      className="w-full max-h-[500px] object-contain"
                      poster=""
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Click play to review the original video that was analyzed
                  </p>
                </div>
              )}

              <AnalysisResults 
                analysis={transformToAnalysisFormat(analysis)} 
                mode={analysis.mode as 'batting' | 'bowling'} 
              />
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}

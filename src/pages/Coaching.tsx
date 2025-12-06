import { useState } from "react";

import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Upload, Video, CheckCircle, Target, Zap, BarChart3, Play, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Coaching = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setAnalysisComplete(false);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a video file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAnalyze = () => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    // Simulate analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      toast({
        title: "Analysis Complete",
        description: "Your technique analysis is ready!",
      });
    }, 3000);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setAnalysisComplete(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-12 pb-20 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Analysis</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              AI <span className="text-gradient-primary">Coaching</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your cricket or tennis videos and receive instant, professional-grade technique analysis powered by advanced AI.
            </p>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              {/* Upload Area */}
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                  Video Analysis
                </h2>
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                    selectedFile
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-card"
                  }`}
                >
                  {!selectedFile ? (
                    <>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                        Upload Your Video
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3">
                        Drag and drop or click to select
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP4, MOV, AVI (max 500MB)
                      </p>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Video className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-foreground">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={clearFile}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                {selectedFile && !analysisComplete && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Analyze Video
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Pro Tips */}
                <div className="mt-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <p className="text-sm font-medium text-accent mb-1">💡 Pro Tip</p>
                  <p className="text-xs text-muted-foreground">
                    For batting analysis, film from side-on. For bowling, capture your full run-up and delivery stride.
                  </p>
                </div>
              </div>

              {/* Pose Visualization - Embedded */}
              <div>
                <h2 className="font-display text-xl font-semibold text-foreground mb-4">
                  Pose Detection
                </h2>
                <div className="rounded-2xl overflow-hidden border border-border h-[400px]">
                  <iframe
                    src="https://deepsiteai.com/s/b82ff1b3-5d6b-4456-ac17-664237305e6d?source=share"
                    className="w-full h-full border-0"
                    title="Pose Analysis Visualization"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>

            {/* Analysis Results */}
            {analysisComplete && (
              <div className="animate-slide-up">
                <div className="flex items-center gap-3 mb-8">
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Analysis Results
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {[
                    { label: "Technique Score", value: "87/100", status: "good" },
                    { label: "Posture Rating", value: "92/100", status: "excellent" },
                    { label: "Timing Accuracy", value: "78/100", status: "needs work" },
                    { label: "Follow Through", value: "85/100", status: "good" },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="p-6 rounded-2xl bg-gradient-card border border-border"
                    >
                      <p className="text-muted-foreground text-sm mb-2">{metric.label}</p>
                      <p className="font-display text-3xl font-bold text-foreground mb-1">
                        {metric.value}
                      </p>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          metric.status === "excellent"
                            ? "bg-primary/10 text-primary"
                            : metric.status === "good"
                            ? "bg-accent/10 text-accent"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {metric.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-6 rounded-2xl bg-gradient-card border border-border">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                    Recommendations
                  </h3>
                  <ul className="space-y-3">
                    {[
                      "Focus on maintaining a straighter back during your backswing",
                      "Improve weight transfer from back foot to front foot",
                      "Work on extending arms fully through the hitting zone",
                      "Practice timing drills to sync body movement with bat swing",
                    ].map((rec, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Sport Selection */}
            <div className="mt-16">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 text-center">
                Select Your Sport
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    sport: "Cricket",
                    skills: ["Batting Stance", "Bowling Action", "Fielding Technique"],
                    icon: "🏏",
                  },
                  {
                    sport: "Tennis",
                    skills: ["Serve Motion", "Forehand Swing", "Backhand Form"],
                    icon: "🎾",
                  },
                ].map((item) => (
                  <div
                    key={item.sport}
                    className="p-6 rounded-2xl bg-gradient-card border border-border hover:border-primary/30 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="text-4xl mb-4">{item.icon}</div>
                    <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                      {item.sport} Analysis
                    </h3>
                    <ul className="space-y-2">
                      {item.skills.map((skill) => (
                        <li key={skill} className="flex items-center gap-2 text-muted-foreground text-sm">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Coaching;

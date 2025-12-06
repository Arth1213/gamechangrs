import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Zap, BarChart3 } from "lucide-react";
import { VideoAnalyzer } from "@/components/coaching/VideoAnalyzer";

type AnalysisMode = 'batting' | 'bowling';

const Coaching = () => {
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>('batting');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Analysis</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              AI <span className="text-gradient-primary">Cricket Coaching</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your cricket videos and receive instant, professional-grade technique analysis with pose detection, angle measurements, and personalized coaching feedback.
            </p>
          </div>
        </div>
      </section>

      {/* Mode Selection */}
      <section className="py-8 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4 text-center">
              Select Analysis Mode
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  mode: 'batting' as AnalysisMode,
                  title: 'Batting Analysis',
                  icon: '🏏',
                  skills: ['Stance & Setup', 'Backlift', 'Shot Execution', 'Follow Through'],
                },
                {
                  mode: 'bowling' as AnalysisMode,
                  title: 'Bowling Analysis',
                  icon: '🎯',
                  skills: ['Run-Up', 'Bound & Gather', 'Arm Action', 'Release Point'],
                },
              ].map((item) => (
                <button
                  key={item.mode}
                  onClick={() => setSelectedMode(item.mode)}
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                    selectedMode === item.mode
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30 bg-card'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">{item.icon}</span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                        {item.title}
                      </h3>
                      <ul className="space-y-1">
                        {item.skills.map((skill) => (
                          <li key={skill} className="flex items-center gap-2 text-muted-foreground text-sm">
                            <BarChart3 className="w-3 h-3 text-primary" />
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Video Analysis Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <VideoAnalyzer mode={selectedMode} />
            
            {/* Pro Tips */}
            <div className="mt-8 p-4 rounded-xl bg-accent/10 border border-accent/20">
              <p className="text-sm font-medium text-accent mb-2">💡 Tips for Best Results</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {selectedMode === 'batting' ? (
                  <>
                    <li>• Film from a side-on angle (perpendicular to the pitch)</li>
                    <li>• Ensure full body is visible from stance to follow-through</li>
                    <li>• Good lighting helps with pose detection accuracy</li>
                    <li>• Record multiple shots for comprehensive analysis</li>
                  </>
                ) : (
                  <>
                    <li>• Capture the full run-up and delivery stride</li>
                    <li>• Film from side-on for best arm action analysis</li>
                    <li>• End-on view helps analyze front-arm alignment</li>
                    <li>• Include the release and follow-through in frame</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Coaching;

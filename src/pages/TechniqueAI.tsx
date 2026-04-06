import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Sparkles } from "lucide-react";
import { TechniqueAI as TechniqueAIComponent } from "@/components/coaching/TechniqueAI";

const TechniqueAI = () => {
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

      {/* TechniqueAI Component */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <TechniqueAIComponent />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TechniqueAI;

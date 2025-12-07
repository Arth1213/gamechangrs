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
              <span className="text-sm font-medium text-accent">Advanced Pose Detection</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              <span className="text-gradient-primary">TechniqueAI</span> Analysis
            </h1>
            <p className="text-lg text-muted-foreground">
              Upload your cricket videos and get real-time pose detection with biomechanical analysis. 
              See exactly how your body moves and receive instant feedback on your technique.
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

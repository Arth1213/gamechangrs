import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { StatsSection } from "@/components/StatsSection";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, TrendingUp, Users, Shield, Sparkles, ChevronRight, Zap, BarChart3, ShoppingBag, Brain } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Show personalized dashboard for logged-in users, hero for guests */}
      {loading ? (
        <div className="pt-32 pb-16 flex justify-center">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : user ? (
        <UserDashboard />
      ) : (
        <>
          <HeroSection />
          <StatsSection />
        </>
      )}

      {/* Show marketing sections only for guests */}
      {!loading && !user && (
        <>
          {/* Products Section */}
          <section className="py-20 lg:py-32 bg-gradient-card border-y border-border">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                  Our <span className="text-gradient-primary">Platform</span>
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Everything you need to analyze, improve, and excel in your cricket journey.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {/* AI Coaching */}
                <Link to="/coaching" className="group">
                  <div className="h-full p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                      <Zap className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-2xl text-foreground mb-3">
                      AI Coaching
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Upload your cricket videos and receive instant, professional-grade technique analysis with pose detection and personalized coaching feedback.
                    </p>
                    <div className="flex items-center text-primary font-medium">
                      Start Analyzing
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>

                {/* TechniqueAI */}
                <Link to="/techniqueai" className="group">
                  <div className="h-full p-8 rounded-2xl bg-card border border-border hover:border-accent/50 transition-all duration-300 hover:shadow-[0_0_40px_hsl(var(--accent)/0.3)]">
                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent/20 transition-colors">
                      <Brain className="w-7 h-7 text-accent" />
                    </div>
                    <h3 className="font-display font-bold text-2xl text-foreground mb-3">
                      TechniqueAI
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Advanced pose detection with real-time biomechanical analysis. See exactly how your body moves and get instant feedback on angles and positions.
                    </p>
                    <div className="flex items-center text-accent font-medium">
                      Try TechniqueAI
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>

                {/* Smart Analytics */}
                <Link to="/analytics" className="group">
                  <div className="h-full p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                      <BarChart3 className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-2xl text-foreground mb-3">
                      Smart Analytics
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Track your progress over time with detailed performance metrics, trend analysis, and data-driven improvement recommendations.
                    </p>
                    <div className="flex items-center text-primary font-medium">
                      View Analytics
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>

                {/* Gear Exchange */}
                <Link to="/marketplace" className="group">
                  <div className="h-full p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                      <ShoppingBag className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-display font-bold text-2xl text-foreground mb-3">
                      Gear Exchange
                    </h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      Buy, sell, and trade quality cricket gear. Every purchase supports our mission to provide equipment to underprivileged young athletes.
                    </p>
                    <div className="flex items-center text-primary font-medium">
                      Browse Gear
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 lg:py-32">
            <div className="container mx-auto px-4">
              <div className="text-center mb-16">
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                  Why Choose <span className="text-gradient-primary">GameChangrs</span>?
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  We combine cutting-edge AI technology with deep sports expertise to deliver insights that actually improve performance.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  {
                    icon: Target,
                    title: "Precision Analysis",
                    description: "Frame-by-frame video analysis identifies technique flaws invisible to the human eye.",
                  },
                  {
                    icon: TrendingUp,
                    title: "Performance Tracking",
                    description: "Track progress over time with detailed metrics and improvement recommendations.",
                  },
                  {
                    icon: Users,
                    title: "Community Impact",
                    description: "Every purchase supports our mission to provide gear to underprivileged young athletes.",
                  },
                  {
                    icon: Shield,
                    title: "Trusted by Coaches",
                    description: "Used by youth league coaches across the country for data-driven decision making.",
                  },
                  {
                    icon: Sparkles,
                    title: "AI-Powered Insights",
                    description: "Advanced machine learning models trained on professional athlete data.",
                  },
                  {
                    icon: ChevronRight,
                    title: "Instant Feedback",
                    description: "Get actionable recommendations within seconds of uploading your video.",
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="p-6 rounded-2xl bg-gradient-card border border-border hover:border-primary/30 transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-20 lg:py-32 bg-gradient-card border-y border-border">
            <div className="container mx-auto px-4">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                  Ready to Elevate Your Game?
                </h2>
                <p className="text-muted-foreground text-lg mb-8">
                  Join thousands of athletes and coaches who are using AI to unlock their full potential.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/coaching">
                    <Button variant="hero" size="xl">
                      Get Started Free
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/contact">
                    <Button variant="outline" size="xl">
                      Talk to Us
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <Footer />
    </div>
  );
};

export default Index;

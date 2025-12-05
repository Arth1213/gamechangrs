import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { StatsSection } from "@/components/StatsSection";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, TrendingUp, Users, Shield, Sparkles, ChevronRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <StatsSection />

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
            ].map((feature, index) => (
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

      <Footer />
    </div>
  );
};

export default Index;

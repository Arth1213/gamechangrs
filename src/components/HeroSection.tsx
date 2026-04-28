import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Video, ShoppingBag, Users } from "lucide-react";
import { HomeHeroOrbit } from "@/components/HomeHeroOrbit";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMXYxaC0xeiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-50" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-primary">Game-Changrs</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight mb-6 animate-slide-up">
                Transform Your Cricket with{" "}
                <span className="text-gradient-primary">Intelligent</span>{" "}
                Tools
              </h1>

              <p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10 animate-slide-up"
                style={{ animationDelay: "0.1s" }}
              >
                Technique AI, cricket analytics, coaching workflows, and gear access in one platform.
              </p>

              <div
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10 lg:mb-0 animate-slide-up"
                style={{ animationDelay: "0.2s" }}
              >
                <Link to="/auth">
                  <Button variant="hero" size="xl">
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="animate-scale-in" style={{ animationDelay: "0.25s" }}>
              <HomeHeroOrbit />
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {[
              {
                icon: Video,
                title: "Technique AI",
                description: "Video scoring, feedback, drills",
                link: "/techniqueai",
                color: "primary",
              },
              {
                icon: Users,
                title: "Coaching Marketplace",
                description: "Coach and player matching",
                link: "/coaching-marketplace",
                color: "accent",
              },
              {
                icon: BarChart3,
                title: "Analytics",
                description: "Live series search and reports",
                link: "/analytics",
                color: "primary",
              },
              {
                icon: ShoppingBag,
                title: "Gear Marketplace",
                description: "Community gear and retail access",
                link: "/marketplace",
                color: "primary",
              },
            ].map((feature) => (
              <Link
                key={feature.title}
                to={feature.link}
                className={`group p-6 rounded-2xl bg-gradient-card border border-border hover:border-${feature.color}/30 transition-all duration-300 hover:shadow-glow`}
              >
                <div className={`w-12 h-12 rounded-xl bg-${feature.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}`} />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

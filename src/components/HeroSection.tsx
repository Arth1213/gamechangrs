import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Video, ShoppingBag, Users } from "lucide-react";
import { HomeHeroOrbit } from "@/components/HomeHeroOrbit";

export const HeroSection = () => {
  const features = [
    {
      icon: Video,
      title: "Technique AI",
      description: "Video scoring, feedback, drills",
      link: "/techniqueai",
      iconWrapClass: "bg-primary/12",
      iconClass: "text-primary",
    },
    {
      icon: Users,
      title: "Coaching Marketplace",
      description: "Coach and player matching",
      link: "/coaching-marketplace",
      iconWrapClass: "bg-accent/14",
      iconClass: "text-accent",
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "Live series search and reports",
      link: "/analytics",
      iconWrapClass: "bg-primary/12",
      iconClass: "text-primary",
    },
    {
      icon: ShoppingBag,
      title: "Gear Marketplace",
      description: "Community gear and retail access",
      link: "/marketplace",
      iconWrapClass: "bg-accent/14",
      iconClass: "text-accent",
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMXYxaC0xeiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-20" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="text-center lg:text-left">
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight mb-6 animate-slide-up">
                Sports Analytics, AI &amp; Science for{" "}
                <span className="text-gradient-primary">Smarter Cricket</span>
              </h1>

              <p
                className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10 animate-slide-up"
                style={{ animationDelay: "0.1s" }}
              >
                From AI-based technique feedback and coach matching to analytics-driven scouting, selection, and
                opposition planning, Game-Changrs transforms cricket data into decisions.
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
            {features.map((feature) => (
              <Link
                key={feature.title}
                to={feature.link}
                className="group rounded-2xl border border-border/80 bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-elevated"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconWrapClass} transition-transform duration-300 group-hover:scale-105`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconClass}`} />
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

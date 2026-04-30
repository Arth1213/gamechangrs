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
    <section className="relative overflow-hidden bg-gradient-hero pb-8 pt-14 sm:pb-10 sm:pt-16 lg:pb-12 lg:pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMXYxaC0xeiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-20" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:gap-12 xl:gap-16">
            <div className="text-center lg:text-left">
              <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-[4.3rem] font-bold text-foreground leading-tight mb-4 sm:mb-5 animate-slide-up">
                Sports Analytics, AI &amp; Science for{" "}
                <span className="text-gradient-primary">Smarter Cricket</span>
              </h1>

              <p
                className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-6 sm:mb-8 animate-slide-up"
                style={{ animationDelay: "0.1s" }}
              >
                From AI-based technique feedback and coach matching to analytics-driven scouting, selection, and
                opposition planning, Game-Changrs transforms cricket data into decisions.
              </p>

              <div
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-2 lg:mb-0 animate-slide-up"
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

            <div className="animate-scale-in lg:pl-2" style={{ animationDelay: "0.25s" }}>
              <HomeHeroOrbit />
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up lg:mt-10" style={{ animationDelay: "0.3s" }}>
            {features.map((feature) => (
              <Link
                key={feature.title}
                to={feature.link}
                className="group rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-elevated"
              >
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${feature.iconWrapClass} transition-transform duration-300 group-hover:scale-105`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconClass}`} />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
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

import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Video, ShoppingBag, Users } from "lucide-react";
import { HomeHeroOrbit } from "@/components/HomeHeroOrbit";

export const HeroSection = () => {
  const heroHighlights = [
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
            <div className="animate-slide-up" style={{ animationDelay: "0.05s" }}>
              <div className="flex h-full flex-col rounded-[32px] border border-border/80 bg-card/80 p-6 text-center shadow-card lg:min-h-[470px] lg:p-8 lg:text-left">
                <div>
                  <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl lg:text-[4.1rem]">
                    Sports Analytics, AI for{" "}
                    <span className="text-gradient-primary">Smarter Cricket</span>
                  </h1>

                  <p
                    className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-5 sm:text-lg md:text-xl lg:mx-0"
                    style={{ animationDelay: "0.1s" }}
                  >
                    From AI-based technique feedback and coach matching to analytics-driven scouting, selection, and
                    opposition planning, Game-Changrs transforms cricket data into decisions.
                  </p>

                  <div
                    className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start"
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

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {heroHighlights.map((feature) => (
                    <Link
                      key={feature.title}
                      to={feature.link}
                      className="group rounded-[22px] border border-border/80 bg-background/40 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-elevated"
                    >
                      <div
                        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${feature.iconWrapClass} transition-transform duration-300 group-hover:scale-105`}
                      >
                        <feature.icon className={`h-5 w-5 ${feature.iconClass}`} />
                      </div>
                      <h3 className="font-display text-lg font-semibold text-foreground">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {feature.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="animate-scale-in lg:pl-2" style={{ animationDelay: "0.25s" }}>
              <HomeHeroOrbit />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

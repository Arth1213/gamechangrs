import { usePublicSiteStats } from "@/hooks/usePublicSiteStats";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Target, Heart, Zap, Users, Award, Linkedin, ExternalLink, Video, Package } from "lucide-react";

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

const About = () => {
  const { playerCount, computedMatchCount, gearDonationCount, videoAnalysisCount } = usePublicSiteStats();

  const team = [
    // First row - Current team
    {
      name: "Arth Arun",
      role: "Founder & CEO",
      bio: "Building a more connected cricket development platform across feedback, analytics, coaching, and access.",
      initials: "AA",
      linkedin: "https://www.linkedin.com/in/helloarth/",
      cricclubs: "https://cricclubs.com/ASCE/viewPlayer.do?playerId=2262444&clubId=22142",
    },
    {
      name: "Samir Shah",
      role: "Advisor / Mentor",
      bio: "Experienced advisor supporting strategic growth, cricket direction, and long-term development of the platform.",
      initials: "SS",
      linkedin: "https://www.linkedin.com/in/samirnshah/",
    },
    {
      name: "TBD",
      role: "Technical Advisor",
      bio: "Advisor on cricket systems, product direction, and platform depth.",
      initials: "TB",
    },
    // Second row - Open positions
    {
      name: "To Be Hired",
      role: "COO",
      bio: "Leading operations, execution discipline, and platform scale across the cricket ecosystem.",
      initials: "CO",
    },
    {
      name: "To Be Hired",
      role: "CIO/Head of AI",
      bio: "Driving AI systems across technique feedback, analytics workflows, and product intelligence.",
      initials: "AI",
    },
    {
      name: "To Be Hired",
      role: "Community Lead",
      bio: "Growing trusted relationships with players, coaches, clubs, academies, and cricket communities.",
      initials: "CL",
    },
  ];

  const values = [
    {
      icon: Target,
      title: "Excellence",
      description: "We aim for analysis and product decisions that are clear, credible, and genuinely useful.",
    },
    {
      icon: Heart,
      title: "Accessibility",
      description: "High-quality cricket feedback and insight should be easier to access across the grassroots game.",
    },
    {
      icon: Users,
      title: "Community",
      description: "Players, coaches, clubs, and academies improve faster when the right connections are easier to make.",
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "We use AI and analytics where they improve cricket decisions, not just where they sound impressive.",
    },
  ];

  const impactStats = [
    { icon: Award, value: formatCount(playerCount), label: "Athletes Analyzed" },
    { icon: Target, value: formatCount(computedMatchCount), label: "Matches Analyzed" },
    { icon: Video, value: formatCount(videoAnalysisCount), label: "Videos Analyzed" },
    { icon: Package, value: formatCount(gearDonationCount), label: "Gears Donated" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              About <span className="text-gradient-primary">GameChangrs</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Democratize cricket excellence through AI-powered feedback, deeper performance and game insights, coach-matched development pathways, and access enabled by a community gear marketplace.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Our Mission
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                GameChangrs exists to democratize cricket excellence through AI-powered feedback, deeper performance and game insights, coach-matched development pathways, and access enabled by a community gear marketplace.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We bring technique analysis, context-rich analytics, coaching discovery, and gear exchange into one connected platform so players, coaches, and academies can make better cricket decisions with less guesswork.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The goal is straightforward: give the wider cricket ecosystem better feedback loops, better game understanding, and a clearer path from insight to action.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {impactStats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-6 rounded-2xl bg-gradient-card border border-border text-center"
                >
                  <stat.icon className="w-8 h-8 text-primary mx-auto mb-4" />
                  <p className="font-display text-3xl font-bold text-foreground mb-1">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Values
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              These principles guide everything we do at GameChangrs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="p-6 rounded-2xl bg-background border border-border hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                  {value.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Meet Our Team
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Builders, operators, and advisors focused on modern cricket development.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member) => (
              <div
                key={member.name}
                className="p-6 rounded-2xl bg-gradient-card border border-border text-center hover:border-primary/30 transition-all duration-300"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="font-display text-2xl font-bold text-primary">
                    {member.initials}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-1">
                  {member.name}
                </h3>
                <p className="text-primary text-sm mb-3">{member.role}</p>
                <p className="text-muted-foreground text-sm mb-3">{member.bio}</p>
                {(member.linkedin || member.cricclubs) && (
                  <div className="flex justify-center gap-2 mt-3">
                    {member.linkedin && (
                      <a
                        href={member.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
                        aria-label="LinkedIn"
                      >
                        <Linkedin className="w-4 h-4" />
                      </a>
                    )}
                    {member.cricclubs && (
                      <a
                        href={member.cricclubs}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
                        aria-label="CricClubs Profile"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;

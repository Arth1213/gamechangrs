import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Target, Heart, Zap, Users, Award, Globe, Linkedin, ExternalLink } from "lucide-react";

const About = () => {
  const team = [
    // First row - Current team
    {
      name: "Arth Arun",
      role: "Founder & CEO",
      bio: "Visionary leader with a passion for democratizing sports excellence through technology.",
      initials: "AA",
      linkedin: "https://www.linkedin.com/in/helloarth/",
      cricclubs: "https://www.nccacricket.org/NCCA/viewPlayer.do?playerId=2262444&clubId=1191",
    },
    {
      name: "Coach Dasarath Sanke",
      role: "Director of Coaching",
      bio: "Certified coach with extensive experience in youth sports programs and athlete development.",
      initials: "DS",
    },
    {
      name: "Coach Esmail Mitchla",
      role: "Director of Coaching",
      bio: "Experienced coach dedicated to nurturing talent and building strong fundamentals in young athletes.",
      initials: "EM",
    },
    // Second row - Open positions
    {
      name: "To Be Hired",
      role: "COO",
      bio: "We're seeking an operations leader to scale our platform and community initiatives.",
      initials: "CO",
    },
    {
      name: "To Be Hired",
      role: "CIO/Head of AI",
      bio: "We're looking for an ML engineer specializing in computer vision and sports analytics.",
      initials: "AI",
    },
    {
      name: "To Be Hired",
      role: "Community Lead",
      bio: "We're seeking someone passionate about making sports accessible to underserved communities.",
      initials: "CL",
    },
  ];

  const values = [
    {
      icon: Target,
      title: "Excellence",
      description: "We pursue the highest standards in everything we do, from AI accuracy to customer service.",
    },
    {
      icon: Heart,
      title: "Accessibility",
      description: "Sports should be available to everyone regardless of economic background.",
    },
    {
      icon: Users,
      title: "Community",
      description: "We believe in the power of sports to build connections and transform lives.",
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "We leverage cutting-edge technology to solve real problems for athletes and coaches.",
    },
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
              We're on a mission to democratize sports excellence through AI-powered coaching and community-driven initiatives.
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
                GameChangrs was founded with a simple belief: every athlete deserves access to world-class coaching and analytics, regardless of their background or resources.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We combine advanced AI technology with deep sports expertise to provide insights that were once only available to professional teams. Our platform analyzes technique, tracks performance, and delivers personalized recommendations that help athletes at every level improve their game.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                But technology is only part of the equation. Through our gear marketplace and community programs, we're working to remove the financial barriers that prevent talented young athletes from reaching their potential.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { icon: Award, value: "10K+", label: "Athletes Helped" },
                { icon: Globe, value: "25+", label: "States Covered" },
                { icon: Users, value: "500+", label: "Partner Teams" },
                { icon: Heart, value: "5K+", label: "Gear Donated" },
              ].map((stat) => (
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
              A passionate group of athletes, technologists, and community builders working to transform sports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Story */}
      <section className="py-20 bg-gradient-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
              Our Story
            </h2>
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p>
                GameChangrs started with a simple observation by our founder Arth Arun: talented kids from underprivileged backgrounds were being left behind – not because of lack of skill, but because they couldn't afford quality equipment or access to advanced coaching.
              </p>
              <p>
                Arth saw how professional teams were using data and video analysis to gain competitive advantages. He wondered: what if we could bring those same tools to youth sports, making them affordable and accessible to everyone?
              </p>
              <p>
                That question led to the creation of GameChangrs in 2024. Today, we're proud to serve thousands of young athletes across the country, providing AI-powered coaching analysis, real-time performance analytics, and a marketplace that helps quality sports gear find new homes with kids who need it most.
              </p>
              <p>
                But we're just getting started. Our vision is a world where every young athlete, regardless of their zip code or family income, has the tools and support they need to reach their full potential.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, TrendingUp, Users, Target, Search, Filter,
  ChevronDown, ArrowUpRight, ArrowDownRight
} from "lucide-react";

const Analytics = () => {
  const [selectedTeam, setSelectedTeam] = useState("All Teams");
  const [selectedPlayer, setSelectedPlayer] = useState("");

  const mockTeams = [
    { name: "Thunder Hawks", wins: 12, losses: 3, avg: 245 },
    { name: "Rising Stars", wins: 10, losses: 5, avg: 228 },
    { name: "Golden Eagles", wins: 9, losses: 6, avg: 215 },
    { name: "Storm Breakers", wins: 8, losses: 7, avg: 198 },
  ];

  const mockPlayers = [
    { name: "Aiden Smith", role: "Batsman", avg: 42.5, sr: 128.3, trend: "up" },
    { name: "Ryan Patel", role: "Bowler", wickets: 24, econ: 5.2, trend: "up" },
    { name: "James Wilson", role: "All-rounder", avg: 35.2, wickets: 12, trend: "down" },
    { name: "Michael Brown", role: "Batsman", avg: 38.7, sr: 115.6, trend: "up" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Real-Time Data</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Analytics <span className="text-gradient-primary">Engine</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Comprehensive youth cricket league analytics powered by CricClubs data. Make data-driven coaching decisions.
            </p>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="py-8 border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search players, teams, or matches..."
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex gap-4">
              <button className="h-12 px-6 rounded-xl bg-secondary border border-border text-foreground flex items-center gap-2 hover:bg-secondary/80 transition-colors">
                <Filter className="w-5 h-5" />
                Filters
                <ChevronDown className="w-4 h-4" />
              </button>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="h-12 px-6 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option>All Teams</option>
                {mockTeams.map((team) => (
                  <option key={team.name}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { label: "Total Teams", value: "48", icon: Users, change: "+12%", up: true },
              { label: "Active Players", value: "624", icon: Target, change: "+8%", up: true },
              { label: "Matches Played", value: "156", icon: BarChart3, change: "+24%", up: true },
              { label: "Avg Run Rate", value: "7.2", icon: TrendingUp, change: "-2%", up: false },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-6 rounded-2xl bg-gradient-card border border-border"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span
                    className={`flex items-center gap-1 text-sm font-medium ${
                      stat.up ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {stat.up ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {stat.change}
                  </span>
                </div>
                <p className="font-display text-3xl font-bold text-foreground mb-1">
                  {stat.value}
                </p>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Teams Table */}
          <div className="mb-12">
            <h2 className="font-display text-2xl font-bold text-foreground mb-6">
              Team Standings
            </h2>
            <div className="rounded-2xl bg-gradient-card border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Team</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Wins</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Losses</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-foreground">Avg Score</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTeams.map((team, index) => (
                      <tr
                        key={team.name}
                        className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-display font-bold text-primary">
                              {index + 1}
                            </div>
                            <span className="font-medium text-foreground">{team.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-primary font-semibold">{team.wins}</td>
                        <td className="px-6 py-4 text-center text-destructive font-semibold">{team.losses}</td>
                        <td className="px-6 py-4 text-center text-muted-foreground">{team.avg}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Players Grid */}
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground mb-6">
              Top Performers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mockPlayers.map((player) => (
                <div
                  key={player.name}
                  className="p-6 rounded-2xl bg-gradient-card border border-border hover:border-primary/30 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-display font-bold">
                      {player.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span
                      className={`flex items-center gap-1 text-sm font-medium ${
                        player.trend === "up" ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {player.trend === "up" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-1">
                    {player.name}
                  </h3>
                  <p className="text-primary text-sm mb-4">{player.role}</p>
                  <div className="grid grid-cols-2 gap-4">
                    {player.role === "Batsman" || player.role === "All-rounder" ? (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">Average</p>
                          <p className="font-semibold text-foreground">{player.avg}</p>
                        </div>
                        {player.sr && (
                          <div>
                            <p className="text-muted-foreground text-xs">Strike Rate</p>
                            <p className="font-semibold text-foreground">{player.sr}</p>
                          </div>
                        )}
                      </>
                    ) : null}
                    {player.role === "Bowler" || player.role === "All-rounder" ? (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">Wickets</p>
                          <p className="font-semibold text-foreground">{player.wickets}</p>
                        </div>
                        {player.econ && (
                          <div>
                            <p className="text-muted-foreground text-xs">Economy</p>
                            <p className="font-semibold text-foreground">{player.econ}</p>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-card border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground mb-4">
            Want Deeper Insights?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Connect your CricClubs account for real-time team and player analytics customized for your coaching needs.
          </p>
          <Button variant="hero" size="xl">
            Connect CricClubs Account
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Analytics;

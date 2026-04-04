import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Loader2,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

type Trend = "up" | "down" | "neutral";

interface SummaryCard {
  label: string;
  value: string;
  icon: "players" | "runs" | "batting" | "bowling";
  changeLabel: string;
  trend: Trend;
}

interface DerivedInsight {
  title: string;
  body: string;
}

interface FormatSplit {
  format: string;
  matches: number | null;
  runs: number | null;
  battingAverage: number | null;
  strikeRate: number | null;
  wickets: number | null;
  economy: number | null;
}

interface CricClubsAnalyticsResponse {
  searchQuery: string;
  sourceUrl: string;
  searchedAt: string;
  player: {
    name: string | null;
    role: string | null;
    team: string | null;
    battingStyle: string | null;
    bowlingStyle: string | null;
  };
  stats: {
    matches: number | null;
    innings: number | null;
    runs: number | null;
    battingAverage: number | null;
    strikeRate: number | null;
    highestScore: string | null;
    notOuts: number | null;
    fours: number | null;
    sixes: number | null;
    ducks: number | null;
    wickets: number | null;
    bowlingAverage: number | null;
    economy: number | null;
    bowlingStrikeRate: number | null;
    bestBowling: string | null;
    maidens: number | null;
    catches: number | null;
    stumpings: number | null;
    runOuts: number | null;
  };
  formatSplits: FormatSplit[];
  explicitInsights: {
    dismissalPatterns: string[];
    bowlerTypeNotes: string[];
    groundingNotes: string[];
  };
  derived: {
    summaryCards: SummaryCard[];
    strengths: DerivedInsight[];
    concerns: DerivedInsight[];
    selectionSummary: string;
    battingProfile: string;
    dismissalRisk: string;
    matchupRead: string;
    recommendation: string;
    dataLimitations: string[];
  };
}

const statIconMap = {
  players: Users,
  runs: BarChart3,
  batting: TrendingUp,
  bowling: Target,
} as const;

const Analytics = () => {
  const [playerQuery, setPlayerQuery] = useState("");
  const [clubHint, setClubHint] = useState("");
  const [result, setResult] = useState<CricClubsAnalyticsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    const trimmedQuery = playerQuery.trim();
    const trimmedHint = clubHint.trim();

    if (trimmedQuery.length < 3) {
      setErrorMessage("Enter at least 3 characters for the player search.");
      setResult(null);
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cricclubs-player-analytics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            query: trimmedQuery,
            clubHint: trimmedHint || null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Search failed (${response.status})`);
      }

      if (!data || !data.player) {
        throw new Error("No player data came back from CricClubs.");
      }

      setResult(data as CricClubsAnalyticsResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch player analytics right now.";
      setErrorMessage(message);
      setResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">CricClubs Live Search</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Analytics <span className="text-gradient-primary">Engine</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Search a real player name, pull the public CricClubs profile, and turn actual stats
              into grounded scouting notes for selection and match planning.
            </p>
          </div>
        </div>
      </section>

      <section className="py-8 border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_auto] gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search CricClubs player name..."
                value={playerQuery}
                onChange={(event) => setPlayerQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSearch();
                  }
                }}
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <input
              type="text"
              placeholder="Optional club or league hint"
              value={clubHint}
              onChange={(event) => setClubHint(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSearch();
                }
              }}
              className="w-full h-12 px-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            <Button
              variant="hero"
              size="lg"
              className="h-12"
              disabled={isSearching}
              onClick={() => void handleSearch()}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching
                </>
              ) : (
                "Run Analytics"
              )}
            </Button>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            This uses public CricClubs pages only. If CricClubs does not expose a stat split, the
            analysis leaves that area blank instead of inventing an answer.
          </div>

          {errorMessage ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
              <AlertCircle className="mt-0.5 w-4 h-4 text-destructive shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {!result ? (
            <div className="rounded-3xl border border-border bg-gradient-card p-8 md:p-10">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold text-foreground mb-3">
                  Search A Player To Replace The Mock Analytics
                </h2>
                <p className="text-muted-foreground mb-6">
                  This section no longer depends on fake sample teams or demo players. It waits for
                  a real CricClubs search, then shows only the stats and scouting notes grounded in
                  that public player profile.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      title: "Selection View",
                      body: "Instant summary for coaches deciding whether a player is more anchor, enforcer, all-round cover, or matchup-specific.",
                    },
                    {
                      title: "Batting Read",
                      body: "Average, strike rate, boundary profile, and format splits are used to frame how the player scores.",
                    },
                    {
                      title: "Honest Gaps",
                      body: "If dismissal patterns or bowler-type splits are not present on the public page, the UI says that clearly.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-border bg-background/60 p-5">
                      <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-border bg-gradient-card p-8 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary">Public CricClubs Profile</span>
                    </div>
                    <h2 className="font-display text-3xl font-bold text-foreground mb-2">
                      {result.player.name || result.searchQuery}
                    </h2>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>{result.player.role || "Role unavailable"}</span>
                      <span>{result.player.team || "Team unavailable"}</span>
                      <span>{result.player.battingStyle || "Batting style unavailable"}</span>
                      <span>{result.player.bowlingStyle || "Bowling style unavailable"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                    >
                      <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        View Source
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border bg-background/60 p-5">
                  <p className="text-sm font-medium text-foreground mb-2">Selection Summary</p>
                  <p className="text-muted-foreground">{result.derived.selectionSummary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {result.derived.summaryCards.map((card) => {
                  const Icon = statIconMap[card.icon];

                  return (
                    <div
                      key={card.label}
                      className="p-6 rounded-2xl bg-gradient-card border border-border"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <span
                          className={`flex items-center gap-1 text-sm font-medium ${
                            card.trend === "up"
                              ? "text-primary"
                              : card.trend === "down"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {card.trend === "up" ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : card.trend === "down" ? (
                            <ShieldAlert className="w-4 h-4" />
                          ) : null}
                          {card.changeLabel}
                        </span>
                      </div>
                      <p className="font-display text-3xl font-bold text-foreground mb-1">
                        {card.value}
                      </p>
                      <p className="text-muted-foreground text-sm">{card.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8 mb-10">
                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Tactical Read
                  </h3>
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Batting Profile</p>
                      <p className="text-muted-foreground">{result.derived.battingProfile}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Dismissal Risk</p>
                      <p className="text-muted-foreground">{result.derived.dismissalRisk}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Bowler Matchup</p>
                      <p className="text-muted-foreground">{result.derived.matchupRead}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Selection Recommendation</p>
                      <p className="text-muted-foreground">{result.derived.recommendation}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Raw Stat Snapshot
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Matches", value: result.stats.matches },
                      { label: "Innings", value: result.stats.innings },
                      { label: "Runs", value: result.stats.runs },
                      { label: "Bat Avg", value: result.stats.battingAverage },
                      { label: "Strike Rate", value: result.stats.strikeRate },
                      { label: "Highest", value: result.stats.highestScore },
                      { label: "Wickets", value: result.stats.wickets },
                      { label: "Economy", value: result.stats.economy },
                      { label: "Best Bowling", value: result.stats.bestBowling },
                      { label: "Catches", value: result.stats.catches },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-border bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                          {item.label}
                        </p>
                        <p className="font-semibold text-foreground">
                          {item.value === null || item.value === "" ? "Unavailable" : item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Strength Signals
                  </h3>
                  <div className="space-y-4">
                    {result.derived.strengths.length > 0 ? (
                      result.derived.strengths.map((item) => (
                        <div key={item.title} className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                          <p className="font-semibold text-foreground mb-1">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.body}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">
                        Not enough public signal on this profile to mark a clear strength.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Risk Signals
                  </h3>
                  <div className="space-y-4">
                    {result.derived.concerns.length > 0 ? (
                      result.derived.concerns.map((item) => (
                        <div
                          key={item.title}
                          className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5"
                        >
                          <p className="font-semibold text-foreground mb-1">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.body}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">
                        No major red flag was directly supported by the public stats returned.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 mb-10">
                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Format Splits
                  </h3>
                  {result.formatSplits.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Format</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Matches</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Runs</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Avg</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">SR</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Wkts</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Econ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.formatSplits.map((split) => (
                            <tr key={split.format} className="border-b border-border last:border-0">
                              <td className="px-4 py-3 text-foreground font-medium">{split.format}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">{split.matches ?? "-"}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">{split.runs ?? "-"}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {split.battingAverage ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {split.strikeRate ?? "-"}
                              </td>
                              <td className="px-4 py-3 text-center text-muted-foreground">{split.wickets ?? "-"}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">{split.economy ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      This public CricClubs page did not expose a clean format split table.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Data Limits
                  </h3>
                  <div className="space-y-4">
                    {result.derived.dataLimitations.map((item) => (
                      <div key={item} className="rounded-2xl border border-border bg-background/60 p-4">
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>

                  {result.explicitInsights.groundingNotes.length > 0 ? (
                    <div className="mt-6">
                      <p className="text-sm font-medium text-foreground mb-3">Grounding Notes</p>
                      <div className="space-y-3">
                        {result.explicitInsights.groundingNotes.map((note) => (
                          <div key={note} className="rounded-2xl border border-border bg-background/60 p-4">
                            <p className="text-sm text-muted-foreground">{note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Analytics;

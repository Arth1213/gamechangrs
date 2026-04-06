import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
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
  previewMode?: string | null;
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

const PUBLIC_SCOPE_LABEL = "USA Cricket Junior Pathway Hub - Bay Area public dataset";
const REMOTE_SCOPE_HINT = "USA Cricket Junior Pathway Hub Bay Area U15";

const LOCAL_PREVIEW_PLAYERS: CricClubsAnalyticsResponse[] = [
  {
    searchQuery: "Arth Arun",
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewTeam.do?clubId=40319&teamId=1688",
    searchedAt: new Date().toISOString(),
    previewMode: "Local verified preview data",
    player: {
      name: "Arth Arun",
      role: "All Rounder",
      team: "DSCA Rhinos U15",
      battingStyle: null,
      bowlingStyle: null,
    },
    stats: {
      matches: 3,
      innings: 1,
      runs: 54,
      battingAverage: 54,
      strikeRate: 120,
      highestScore: "54",
      notOuts: 0,
      fours: 5,
      sixes: 2,
      ducks: 0,
      wickets: null,
      bowlingAverage: null,
      economy: null,
      bowlingStrikeRate: null,
      bestBowling: null,
      maidens: null,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      {
        format: "U15 Phase 1",
        matches: 3,
        runs: 54,
        battingAverage: 54,
        strikeRate: 120,
        wickets: null,
        economy: null,
      },
      {
        format: "U15 Preseason",
        matches: 2,
        runs: null,
        battingAverage: null,
        strikeRate: null,
        wickets: null,
        economy: null,
      },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Verified public USA Cricket Junior Pathway player listed on the DSCA Rhinos U15 team page.",
        "Public U15 batting table shows 54 runs with high score 54 at strike rate 120.00.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "3", icon: "players", changeLabel: "Small sample", trend: "neutral" },
        { label: "Runs", value: "54", icon: "runs", changeLabel: "HS 54", trend: "neutral" },
        { label: "Bat Avg / SR", value: "54 / 120", icon: "batting", changeLabel: "Good start", trend: "up" },
        { label: "Wickets / Econ", value: "Unavailable", icon: "bowling", changeLabel: "Need more data", trend: "neutral" },
      ],
      strengths: [
        {
          title: "Positive early batting return",
          body: "The visible U15 Phase 1 public table shows a productive batting sample with 54 runs at 54.00 average and 120.00 strike rate.",
        },
      ],
      concerns: [
        {
          title: "Sample size",
          body: "The public stat sample is still small, so selection decisions should treat this as an early signal rather than a settled profile.",
        },
      ],
      selectionSummary:
        "The visible U15 Junior Pathway data supports treating Arth Arun as a real DSCA Rhinos U15 player with an encouraging early batting sample.",
      battingProfile:
        "The public U15 batting record shows a compact but positive batting profile so far, with one strong visible innings and healthy scoring tempo.",
      dismissalRisk:
        "This preview does not expose a dismissal-mode split for Arth Arun, so no grounded claim is made about how he gets out most often.",
      matchupRead:
        "This preview does not expose pace-vs-spin or bowler-arm matchup splits for Arth Arun.",
      recommendation:
        "Track as a developing U15 all-rounder with early batting upside, but wait for a larger public sample before making stronger matchup claims.",
      dataLimitations: [
        "This localhost preview uses verified public USA Cricket Junior Pathway data cached locally because the remote edge function has not been updated yet.",
        "Current public U15 pages used here do not expose a full dismissal-type or bowler-type split for Arth Arun.",
      ],
    },
  },
];

function normalizeQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function getLocalPreviewPlayer(query: string) {
  const normalizedQuery = normalizeQuery(query);

  return (
    LOCAL_PREVIEW_PLAYERS.find((player) => {
      const playerName = normalizeQuery(player.searchQuery);
      return (
        playerName === normalizedQuery ||
        playerName.includes(normalizedQuery) ||
        normalizedQuery.includes(playerName)
      );
    }) ?? null
  );
}

const statIconMap = {
  players: Users,
  runs: BarChart3,
  batting: TrendingUp,
  bowling: Target,
} as const;

const VERIFIED_PLAYER_NAMES = LOCAL_PREVIEW_PLAYERS.map((player) => player.searchQuery);

const Analytics = () => {
  const [playerQuery, setPlayerQuery] = useState("");
  const [result, setResult] = useState<CricClubsAnalyticsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    const trimmedQuery = playerQuery.trim();

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
            clubHint: REMOTE_SCOPE_HINT,
          }),
        },
      );

      const data = await response.json();

      if (response.ok && data?.player) {
        setResult({
          ...(data as CricClubsAnalyticsResponse),
          previewMode: data.previewMode ?? `${PUBLIC_SCOPE_LABEL} · public CricClubs search`,
        });
        return;
      }

      const localPreview = getLocalPreviewPlayer(trimmedQuery);
      if (localPreview) {
        setResult({
          ...localPreview,
          searchedAt: new Date().toISOString(),
          previewMode: `${PUBLIC_SCOPE_LABEL} · verified local preview`,
        });
        return;
      }

      throw new Error(
        data?.error ||
          `No Bay Area result came back for "${trimmedQuery}". Verified local coverage in this build: ${VERIFIED_PLAYER_NAMES.join(", ")}.`,
      );
    } catch (error) {
      const localPreview = getLocalPreviewPlayer(trimmedQuery);
      if (localPreview) {
        setResult({
          ...localPreview,
          searchedAt: new Date().toISOString(),
          previewMode: `${PUBLIC_SCOPE_LABEL} · verified local preview`,
        });
        setErrorMessage(null);
        return;
      }

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
              <span className="text-sm font-medium text-primary">Bay Area CricClubs Analytics</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Analytics <span className="text-gradient-primary">Engine</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Search a verified Bay Area USA Cricket Junior Pathway player and turn public CricClubs
              stats into grounded scouting notes for selection and match planning.
            </p>
          </div>
        </div>
      </section>

      <section className="py-8 border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Scope: {PUBLIC_SCOPE_LABEL}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Verified players in this build: {VERIFIED_PLAYER_NAMES.length}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              Remote public search: enabled
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Bay Area player name..."
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

            <Button
              variant="hero"
              size="lg"
              className="h-12 w-full md:w-auto"
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

          <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            This build first tries a public CricClubs search with a Bay Area Junior Pathway hint,
            then falls back to verified local Bay Area profiles if the remote search does not return
            a usable result. If CricClubs does not expose a stat split, the analysis leaves that
            area blank instead of inventing an answer.
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {VERIFIED_PLAYER_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setPlayerQuery(name);
                  setErrorMessage(null);
                }}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {name}
              </button>
            ))}
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
                  Search A Verified Bay Area Player
                </h2>
                <p className="text-muted-foreground mb-6">
                  This section is now scoped to the Bay Area USA Cricket Junior Pathway Hub. It only
                  shows verified public CricClubs profiles cached in this build, so the testing flow
                  stays grounded and does not invent players or unsupported matchup reads.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    {
                      title: "Bay Area Scope",
                      body: "The search is intentionally limited to Bay Area Junior Pathway public data for cleaner verification.",
                    },
                    {
                      title: "Grounded Reads",
                      body: "Average, strike rate, boundary profile, and format splits are used only when they are publicly visible.",
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
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 mb-4">
                      <Trophy className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary">Verified Bay Area CricClubs Profile</span>
                    </div>
                    {result.previewMode ? (
                      <div className="mb-4">
                        <div className="inline-flex items-center gap-2 rounded-full bg-secondary border border-border px-3 py-1">
                          <span className="text-xs font-medium text-foreground">{result.previewMode}</span>
                        </div>
                      </div>
                    ) : null}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-10">
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

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr] mb-10">
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
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-10">
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] mb-10">
                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    Format Splits
                  </h3>
                  {result.formatSplits.length > 0 ? (
                    <>
                      <div className="space-y-3 md:hidden">
                        {result.formatSplits.map((split) => (
                          <div key={split.format} className="rounded-2xl border border-border bg-background/60 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="font-semibold text-foreground">{split.format}</p>
                              <span className="text-xs text-muted-foreground">Public split</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {[
                                { label: "Matches", value: split.matches },
                                { label: "Runs", value: split.runs },
                                { label: "Avg", value: split.battingAverage },
                                { label: "SR", value: split.strikeRate },
                                { label: "Wkts", value: split.wickets },
                                { label: "Econ", value: split.economy },
                              ].map((item) => (
                                <div key={`${split.format}-${item.label}`} className="rounded-xl border border-border/70 p-3">
                                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                                  <p className="font-medium text-foreground">{item.value ?? "-"}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
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
                    </>
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

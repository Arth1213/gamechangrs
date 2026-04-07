import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Database,
  ExternalLink,
  Flag,
  Gauge,
  Loader2,
  Search,
  ShieldAlert,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Workflow,
} from "lucide-react";
import {
  COMPLETE_LOCAL_PREVIEW_PLAYERS,
  type CricClubsAnalyticsResponse,
} from "@/data/analyticsPlayers";
import {
  BAY_AREA_LEAGUES,
  BAY_AREA_SOURCE_TABS,
  BAY_AREA_WEIGHT_RULES,
  getPlayerModelSnapshot,
} from "@/lib/analyticsModel";

type SearchStatus = "idle" | "searching" | "remote-success" | "local-preview" | "no-result" | "error";

const PUBLIC_SCOPE_LABEL = "USA Cricket Junior Pathway Hub - Bay Area public dataset";
const REMOTE_SCOPE_HINT = "USA Cricket Junior Pathway Hub Bay Area U15";

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
    COMPLETE_LOCAL_PREVIEW_PLAYERS.find((player) => {
      const names = [player.searchQuery, ...(player.aliases ?? [])].map(normalizeQuery);

      return names.some((playerName) => (
        playerName === normalizedQuery ||
        playerName.includes(normalizedQuery) ||
        normalizedQuery.includes(playerName)
      ));
    }) ?? null
  );
}

const statIconMap = {
  players: Users,
  runs: BarChart3,
  batting: TrendingUp,
  bowling: Target,
} as const;

const VERIFIED_PLAYER_NAMES = COMPLETE_LOCAL_PREVIEW_PLAYERS.map((player) => player.searchQuery);

const Analytics = () => {
  const [playerQuery, setPlayerQuery] = useState("");
  const [result, setResult] = useState<CricClubsAnalyticsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");

  const handleSearch = async () => {
    const trimmedQuery = playerQuery.trim();

    if (trimmedQuery.length < 3) {
      setErrorMessage("Enter at least 3 characters for the player search.");
      setResult(null);
      setSearchStatus("error");
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    setResult(null);
    setLastSearchedQuery(trimmedQuery);
    setSearchStatus("searching");

    try {
      const localPreview = getLocalPreviewPlayer(trimmedQuery);
      if (localPreview) {
        setResult({
          ...localPreview,
          searchedAt: new Date().toISOString(),
          previewMode: `${PUBLIC_SCOPE_LABEL} · verified local public profile cache`,
        });
        setSearchStatus("local-preview");
        return;
      }

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

      const data = await response.json().catch(() => null);

      if (response.ok && data?.player && (data.player.name || data.searchQuery || data.sourceUrl)) {
        setResult({
          ...(data as CricClubsAnalyticsResponse),
          previewMode: data.previewMode ?? `${PUBLIC_SCOPE_LABEL} · public CricClubs search`,
        });
        setSearchStatus("remote-success");
        return;
      }

      setSearchStatus("no-result");
      setErrorMessage(
        data?.error ||
          `No public CricClubs player result came back for "${trimmedQuery}". If the player has a public profile, the next thing to check is the Lovable Cloud logs for this search.`,
      );
      setResult(null);
      return;
    } catch (error) {
      const localPreview = getLocalPreviewPlayer(trimmedQuery);
      if (localPreview) {
        setResult({
          ...localPreview,
          searchedAt: new Date().toISOString(),
          previewMode: `${PUBLIC_SCOPE_LABEL} · verified local public profile cache`,
        });
        setErrorMessage(null);
        setSearchStatus("local-preview");
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unable to fetch player analytics right now.";
      setErrorMessage(message);
      setResult(null);
      setSearchStatus("error");
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
            This build now checks a verified local cache of publicly indexed full CricClubs player
            profiles first, then falls back to remote public search only if the player is not
            already covered locally. Partial scorecard-only samples are not shown as complete player
            analytics.
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-background/80 p-4">
            <div className="flex items-start gap-3 text-sm">
              {searchStatus === "searching" ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
              ) : searchStatus === "remote-success" ? (
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : searchStatus === "local-preview" ? (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : searchStatus === "no-result" || searchStatus === "error" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}

              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {searchStatus === "searching"
                    ? `Searching public CricClubs sources for "${lastSearchedQuery}"...`
                    : searchStatus === "remote-success"
                      ? `Live public stats loaded for "${lastSearchedQuery}".`
                      : searchStatus === "local-preview"
                        ? `Remote search did not return a usable profile, so a verified local preview was used for "${lastSearchedQuery}".`
                        : searchStatus === "no-result"
                          ? `No public player result was returned for "${lastSearchedQuery}".`
                          : searchStatus === "error"
                            ? "The analytics request failed before a usable result was returned."
                            : "Search a player to check the live CricClubs lookup path."}
                </p>
                <p className="text-muted-foreground">
                  {searchStatus === "searching"
                    ? "The previous result is cleared while the new request runs so you can see when the latest query is still in flight."
                    : searchStatus === "remote-success"
                      ? "This card confirms the frontend received a usable response from the analytics backend."
                      : searchStatus === "local-preview"
                        ? "This is a bundled cache of a full publicly indexed CricClubs player profile, not an invented or partial record."
                        : searchStatus === "no-result"
                          ? "If this player has a public full-profile CricClubs page, the likely next check is the edge function runtime logs or adding that exact profile to the local cache."
                          : searchStatus === "error"
                            ? "The backend may be unreachable, returning invalid JSON, or failing at runtime."
                            : "Current local verified coverage in this build includes only the players listed below."}
                </p>
              </div>
            </div>
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
          <Tabs defaultValue="series" className="mb-10">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-secondary/60 p-2">
              <TabsTrigger value="series">Series Map</TabsTrigger>
              <TabsTrigger value="weights">Weighting Model</TabsTrigger>
              <TabsTrigger value="outcomes">Report Outputs</TabsTrigger>
            </TabsList>

            <TabsContent value="series" className="mt-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3">
                      <Flag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-foreground">
                        Bay Area U15 League Coverage
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The analytics model is scoped to the four Bay Area Hub series pages you gave:
                        `434`, `435`, `436`, and `437`.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {BAY_AREA_LEAGUES.map((league) => (
                      <a
                        key={league.id}
                        href={league.href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-border bg-background/60 p-5 transition-colors hover:border-primary/30"
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-primary">{league.label}</p>
                        <p className="mt-2 font-semibold text-foreground">CricClubs League {league.id}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{league.focus}</p>
                      </a>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3">
                      <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-foreground">
                        CricClubs Tabs Used
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The page is structured around the same tab flow you outlined from CricClubs.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {BAY_AREA_SOURCE_TABS.map((tab) => (
                      <div key={tab.label} className="rounded-2xl border border-border bg-background/60 p-4">
                        <p className="font-semibold text-foreground">{tab.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{tab.use}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="weights" className="mt-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3">
                      <Gauge className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-foreground">
                        Weighting Rules
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Div 1 gets a premium, strong teams get more weight, and high-leverage overs
                        matter more than flat-scoreboard events.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {BAY_AREA_WEIGHT_RULES.map((rule) => (
                      <div key={rule.label} className="rounded-2xl border border-border bg-background/60 p-5">
                        <p className="text-xs uppercase tracking-[0.22em] text-primary">{rule.label}</p>
                        <p className="mt-2 font-display text-3xl font-bold text-foreground">{rule.value}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{rule.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-3">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-foreground">
                        Intelligence Formula
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The target Bay Area U15 model is based on opposition quality, phase, and
                        leverage. The current public-player build already exposes the exact report
                        sections needed for that pipeline.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/70 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Target event weighting</p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-sm text-foreground">
{`event_weight =
division_weight
* team_strength_weight
* opponent_player_weight
* phase_weight
* leverage_weight`}
                    </pre>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                      "Team strength should come from Points Table win %, NRR, and standing.",
                      "Top-opposition intelligence should come from Results + ball-by-ball commentary.",
                      "Batting and bowling records are baseline only, not the final score.",
                      "Fielding records must influence final impact, especially catches and run-outs.",
                    ].map((item) => (
                      <div key={item} className="rounded-2xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="outcomes" className="mt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Career Totals",
                    body: "Pull the first public CricClubs page and show the big Matches / Runs / Wickets totals first.",
                  },
                  {
                    title: "Pathway Tabs",
                    body: "Show USA Cricket Junior Pathway batting and bowling rows separately when that tab is publicly visible.",
                  },
                  {
                    title: "Selection Lens",
                    body: "Convert the public stat record into a clear selection summary, strengths, risks, and role fit.",
                  },
                  {
                    title: "Peer Comparison",
                    body: "Rank the player against the local supported Bay Area cohort rather than showing isolated raw totals only.",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-3xl border border-border bg-gradient-card p-6">
                    <h3 className="font-display text-xl font-bold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {!result ? (
            <div className="rounded-3xl border border-border bg-gradient-card p-8 md:p-10">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold text-foreground mb-3">
                  {searchStatus === "searching"
                    ? "Running Public Player Search"
                    : searchStatus === "no-result"
                      ? "No Public Player Result Found"
                      : searchStatus === "error"
                        ? "Analytics Request Failed"
                        : "Search A Verified Bay Area Player"}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {searchStatus === "searching"
                    ? `The app is actively checking the analytics backend for "${lastSearchedQuery}".`
                    : searchStatus === "no-result"
                      ? `No usable full-profile public CricClubs result was returned for "${lastSearchedQuery}". This UI now keeps that state visible instead of appearing blank.`
                      : searchStatus === "error"
                        ? "The search did not complete successfully. Use the error message above to distinguish backend failure from a true no-result."
                        : "This section now prefers verified full public CricClubs player profiles cached in this build, so the testing flow stays grounded and does not invent players or treat scorecard fragments as complete career records."}
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    {
                      title: "Bay Area Scope",
                      body: "The search is intentionally limited to Bay Area Junior Pathway public data for cleaner verification.",
                    },
                    {
                      title: "Grounded Reads",
                      body: "Average, strike rate, boundary profile, and format splits are used only when they are publicly visible on a full player profile.",
                    },
                    {
                      title: "Honest Gaps",
                      body: "If a full public player profile is not indexed, the UI leaves the player unsupported instead of filling from partial scorecards.",
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
              {(() => {
                const model = getPlayerModelSnapshot(result);

                return (
                  <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                    {[
                      { label: "Bay Area Score", value: model.overall, detail: "0-100 public model" },
                      { label: "Peer Percentile", value: model.peerPercentile, detail: "supported cohort" },
                      { label: "Production", value: model.production, detail: "runs, wickets, efficiency" },
                      { label: "Consistency", value: model.consistency, detail: "matches + innings depth" },
                      { label: "Versatility", value: model.versatility, detail: "multi-skill contribution" },
                      { label: "Fielding", value: model.fielding, detail: "catching contribution" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-border bg-gradient-card p-5">
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                        <p className="mt-2 font-display text-3xl font-bold text-foreground">{item.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

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

              {result.careerTotals ? (
                <div className="mb-10 rounded-3xl border border-border bg-gradient-card p-8">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-display text-2xl font-bold text-foreground">
                        Career CricClubs Totals
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Main player-profile totals from the first public CricClubs page.
                      </p>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      Profile totals
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { label: "Matches", value: result.careerTotals.matches },
                      { label: "Runs", value: result.careerTotals.runs },
                      { label: "Wickets", value: result.careerTotals.wickets },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-primary/15 bg-background/60 p-6">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-2 font-display text-4xl font-bold text-foreground">
                          {item.value ?? "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
                    USA Cricket Junior Pathway Batting
                  </h3>
                  {result.pathwayBatting ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        { label: "Series", value: result.pathwayBatting.seriesType },
                        { label: "Mat", value: result.pathwayBatting.matches },
                        { label: "Inns", value: result.pathwayBatting.innings },
                        { label: "NO", value: result.pathwayBatting.notOuts },
                        { label: "Runs", value: result.pathwayBatting.runs },
                        { label: "Balls", value: result.pathwayBatting.balls },
                        { label: "Ave", value: result.pathwayBatting.average },
                        { label: "SR", value: result.pathwayBatting.strikeRate },
                        { label: "HS", value: result.pathwayBatting.highestScore },
                        { label: "100s", value: result.pathwayBatting.hundreds },
                        { label: "50s", value: result.pathwayBatting.fifties },
                        { label: "25s", value: result.pathwayBatting.twentyFives },
                        { label: "0s", value: result.pathwayBatting.ducks },
                        { label: "4s", value: result.pathwayBatting.fours },
                        { label: "6s", value: result.pathwayBatting.sixes },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-border bg-background/60 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{item.label}</p>
                          <p className="font-semibold text-foreground">{item.value ?? "Unavailable"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      A full USA Cricket Junior Pathway batting tab was not publicly exposed in the indexed profile used for this player.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-border bg-gradient-card p-8">
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    USA Cricket Junior Pathway Bowling
                  </h3>
                  {result.pathwayBowling ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        { label: "Series", value: result.pathwayBowling.seriesType },
                        { label: "Mat", value: result.pathwayBowling.matches },
                        { label: "Inns", value: result.pathwayBowling.innings },
                        { label: "Overs", value: result.pathwayBowling.overs },
                        { label: "Runs", value: result.pathwayBowling.runs },
                        { label: "Wkts", value: result.pathwayBowling.wickets },
                        { label: "BBI", value: result.pathwayBowling.bestBowling },
                        { label: "Maidens", value: result.pathwayBowling.maidens },
                        { label: "Ave", value: result.pathwayBowling.average },
                        { label: "Econ", value: result.pathwayBowling.economy },
                        { label: "SR", value: result.pathwayBowling.strikeRate },
                        { label: "4W", value: result.pathwayBowling.fourWickets },
                        { label: "5W", value: result.pathwayBowling.fiveWickets },
                        { label: "Wd", value: result.pathwayBowling.wides },
                        { label: "Ct", value: result.pathwayBowling.catches },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-border bg-background/60 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{item.label}</p>
                          <p className="font-semibold text-foreground">{item.value ?? "Unavailable"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      A full USA Cricket Junior Pathway bowling tab was not publicly exposed in the indexed profile used for this player.
                    </p>
                  )}
                </div>
              </div>

              {(() => {
                const model = getPlayerModelSnapshot(result);

                return (
                  <div className="mb-10 grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-3xl border border-border bg-gradient-card p-8">
                      <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                        Bay Area U15 Model Read
                      </h3>
                      <div className="space-y-4">
                        {[
                          {
                            title: "Current build",
                            body: "This score is computed from the public player page, career totals, pathway batting row, pathway bowling row, and fielding signal already cached in this build.",
                          },
                          {
                            title: "What it is good for",
                            body: "It gives a clean Bay Area selection-facing snapshot, peer ranking, and report structure that lines up with the CricClubs pages you referenced.",
                          },
                          {
                            title: "What still requires full scraping",
                            body: "True opposition-adjusted scoring against top teams and top bowlers still depends on scraping Results, scorecards, and ball-by-ball commentary for leagues 434-437.",
                          },
                        ].map((item) => (
                          <div key={item.title} className="rounded-2xl border border-border bg-background/60 p-5">
                            <p className="font-semibold text-foreground">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border bg-gradient-card p-8">
                      <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                        Peer Comparison
                      </h3>
                      {model.peers.length > 0 ? (
                        <div className="space-y-3">
                          {model.peers.map((peer, index) => (
                            <div key={peer.name} className="flex items-center justify-between rounded-2xl border border-border bg-background/60 p-4">
                              <div>
                                <p className="font-semibold text-foreground">{index + 1}. {peer.name}</p>
                                <p className="text-sm text-muted-foreground">{peer.role || "Role unavailable"}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-display text-2xl font-bold text-foreground">{peer.score}</p>
                                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Bay Area score</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          There are not enough same-role players in the currently supported cohort to show a clean peer stack.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

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

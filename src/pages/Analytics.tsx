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
  Target,
  Trophy,
  Users,
} from "lucide-react";
import {
  SUPPORTED_ANALYTICS_PLAYERS,
  type CricClubsAnalyticsResponse,
} from "@/data/analyticsPlayers";
import { getPlayerModelSnapshot } from "@/lib/analyticsModel";
import { normalizeAnalyticsResult } from "@/lib/analyticsNormalize";

type SearchStatus = "idle" | "searching" | "success" | "no-result" | "error";

const PUBLIC_SCOPE_LABEL = "USA Cricket Junior Hub / Pathway public dataset";
const REMOTE_SCOPE_HINT = "USA Cricket Junior Hub Pathway regional national international";

function normalizeQuery(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function getNameTokens(value: string) {
  return normalizeQuery(value).split(" ").filter(Boolean);
}

function getStructuredNameScore(query: string, candidate: string) {
  const queryTokens = getNameTokens(query);
  const candidateTokens = getNameTokens(candidate);

  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const firstCandidate = candidateTokens[0] ?? "";
  const lastCandidate = candidateTokens[candidateTokens.length - 1] ?? "";

  if (queryTokens.length === 1) {
    const token = queryTokens[0];
    if (token === firstCandidate || token === lastCandidate) {
      return 0.91;
    }
    return 0;
  }

  const firstQuery = queryTokens[0] ?? "";
  const lastQuery = queryTokens[queryTokens.length - 1] ?? "";
  const firstMatches = firstCandidate === firstQuery || firstCandidate.startsWith(firstQuery) || firstQuery.startsWith(firstCandidate);
  const lastMatches = lastCandidate === lastQuery || lastCandidate.startsWith(lastQuery) || lastQuery.startsWith(lastCandidate);
  const exactTokenMatches = queryTokens.filter((token) => candidateTokens.includes(token)).length;
  const prefixTokenMatches = queryTokens.filter((token) =>
    candidateTokens.some((candidateToken) => candidateToken.startsWith(token) || token.startsWith(candidateToken)),
  ).length;
  const allTokensCovered = prefixTokenMatches === queryTokens.length;

  if (!firstMatches || !lastMatches || !allTokensCovered) {
    return 0;
  }

  return Math.max(
    0.82 + (exactTokenMatches / queryTokens.length) * 0.16,
    0.8 + (prefixTokenMatches / queryTokens.length) * 0.14,
  );
}

function getPlayerSearchScore(query: string, candidate: string) {
  const normalizedQuery = normalizeQuery(query);
  const normalizedCandidate = normalizeQuery(candidate);

  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  if (normalizedQuery === normalizedCandidate) {
    return 1;
  }

  const structuredScore = getStructuredNameScore(query, candidate);
  if (structuredScore > 0) {
    return structuredScore;
  }

  if (getNameTokens(query).length > 1 && (normalizedCandidate.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedCandidate))) {
    return 0.94;
  }

  if (getNameTokens(query).length > 1 && (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate))) {
    return 0.9;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const candidateTokens = normalizedCandidate.split(" ").filter(Boolean);
  const exactTokenMatches = queryTokens.filter((token) => candidateTokens.includes(token)).length;
  const prefixTokenMatches = queryTokens.filter((token) =>
    candidateTokens.some((candidateToken) => candidateToken.startsWith(token) || token.startsWith(candidateToken)),
  ).length;

  if (queryTokens.length === 0) {
    return 0;
  }

  return Math.max(
    (exactTokenMatches / queryTokens.length) * 0.84,
    (prefixTokenMatches / queryTokens.length) * 0.78,
  );
}

function getLocalPreviewPlayer(query: string) {
  const normalizedTokens = getNameTokens(query);
  let bestMatch: CricClubsAnalyticsResponse | null = null;
  let bestScore = 0;
  let secondBestScore = 0;

  for (const player of SUPPORTED_ANALYTICS_PLAYERS) {
    const names = [player.searchQuery, ...(player.aliases ?? [])];
    const playerScore = Math.max(...names.map((name) => getPlayerSearchScore(query, name)));

    if (playerScore > bestScore) {
      secondBestScore = bestScore;
      bestScore = playerScore;
      bestMatch = player;
    } else if (playerScore > secondBestScore) {
      secondBestScore = playerScore;
    }
  }

  if (normalizedTokens.length === 1 && secondBestScore >= bestScore - 0.03) {
    return null;
  }

  return bestScore >= 0.52 ? bestMatch : null;
}

function getLocalPreviewMatches(query: string, limit = 6) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return SUPPORTED_ANALYTICS_PLAYERS.slice(0, limit);
  }

  return SUPPORTED_ANALYTICS_PLAYERS.map((player) => {
    const names = [player.searchQuery, ...(player.aliases ?? [])];
    const score = Math.max(...names.map((name) => getPlayerSearchScore(trimmedQuery, name)));

    return { player, score };
  })
    .filter((entry) => entry.score >= 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.player);
}

function getPrimaryMatchCount(result: CricClubsAnalyticsResponse) {
  return result.careerTotals?.matches ?? result.stats.matches ?? result.pathwayBatting?.matches ?? result.pathwayBowling?.matches ?? null;
}

function getPrimaryRuns(result: CricClubsAnalyticsResponse) {
  return result.careerTotals?.runs ?? result.stats.runs ?? result.pathwayBatting?.runs ?? null;
}

function getPrimaryWickets(result: CricClubsAnalyticsResponse) {
  return result.careerTotals?.wickets ?? result.stats.wickets ?? result.pathwayBowling?.wickets ?? null;
}

function isThinAnalyticsResult(result: CricClubsAnalyticsResponse) {
  const matches = Number(getPrimaryMatchCount(result) ?? 0);
  const runs = Number(getPrimaryRuns(result) ?? 0);
  const wickets = Number(getPrimaryWickets(result) ?? 0);
  const hasIdentity = Boolean(result.player.team || result.player.battingStyle || result.player.bowlingStyle);

  return (!hasIdentity && matches <= 1 && runs <= 1 && wickets <= 1) || matches <= 1;
}

function formatMetric(value: string | number | null | undefined, digits = 0) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";

    return value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  return value;
}

function formatCompactMetric(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    return value >= 1000 ? value.toLocaleString() : `${Math.round(value)}`;
  }

  return value;
}

function getRoleLabel(role: string | null | undefined) {
  const normalized = (role ?? "").toLowerCase();
  if (normalized.includes("all")) return "All-Rounder";
  if (normalized.includes("bowl")) return "Bowler";
  if (normalized.includes("wicket")) return "Keeper";
  if (normalized.includes("bat")) return "Batter";
  return role || "Player";
}

function getRecommendationTone(score: number) {
  if (score >= 80) {
    return {
      badge: "Strong Consideration",
      badgeClass: "border-primary/30 bg-primary/10 text-primary",
      tier: "High-Value Selector Profile",
    };
  }

  if (score >= 65) {
    return {
      badge: "Track Closely",
      badgeClass: "border-accent/30 bg-accent/10 text-accent",
      tier: "High-Upside Watchlist",
    };
  }

  if (score >= 50) {
    return {
      badge: "Monitor",
      badgeClass: "border-primary/20 bg-secondary text-foreground",
      tier: "Developing Profile",
    };
  }

  return {
    badge: "Development Watch",
    badgeClass: "border-border bg-secondary text-muted-foreground",
    tier: "Longer-Term Track",
  };
}

function buildCurrentSnapshot(result: CricClubsAnalyticsResponse) {
  return {
    label: result.pathwayBatting?.seriesType || result.pathwayBowling?.seriesType || "USA Cricket Junior Pathway",
    matches: result.pathwayBatting?.matches ?? result.pathwayBowling?.matches ?? result.stats.matches,
    batting: {
      runs: result.pathwayBatting?.runs ?? result.stats.runs,
      innings: result.pathwayBatting?.innings ?? result.stats.innings,
      high: result.pathwayBatting?.highestScore ?? result.stats.highestScore,
      average: result.pathwayBatting?.average ?? result.stats.battingAverage,
      strikeRate: result.pathwayBatting?.strikeRate ?? result.stats.strikeRate,
    },
    bowling: {
      wickets: result.pathwayBowling?.wickets ?? result.stats.wickets,
      innings: result.pathwayBowling?.innings ?? result.stats.innings,
      overs: result.pathwayBowling?.overs,
      economy: result.pathwayBowling?.economy ?? result.stats.economy,
      best: result.pathwayBowling?.bestBowling ?? result.stats.bestBowling,
    },
    fielding: {
      total:
        (result.pathwayBowling?.catches ?? result.stats.catches ?? 0) +
        (result.stats.runOuts ?? 0) +
        (result.stats.stumpings ?? 0),
      catches: result.pathwayBowling?.catches ?? result.stats.catches,
      directRunOuts: result.stats.runOuts,
      stumpings: result.stats.stumpings,
    },
  };
}

function buildOverallSnapshot(result: CricClubsAnalyticsResponse) {
  return {
    label: "Overall CricClubs Career",
    matches: result.careerTotals?.matches ?? result.stats.matches,
    batting: {
      runs: result.careerTotals?.runs ?? result.stats.runs,
      innings: result.stats.innings,
      high: result.stats.highestScore,
      average: result.stats.battingAverage,
      strikeRate: result.stats.strikeRate,
    },
    bowling: {
      wickets: result.careerTotals?.wickets ?? result.stats.wickets,
      innings: result.stats.innings,
      overs: null as string | null,
      economy: result.stats.economy,
      best: result.stats.bestBowling,
    },
    fielding: {
      total: (result.stats.catches ?? 0) + (result.stats.runOuts ?? 0) + (result.stats.stumpings ?? 0),
      catches: result.stats.catches,
      directRunOuts: result.stats.runOuts,
      stumpings: result.stats.stumpings,
    },
  };
}

function buildQuickReadBars(
  result: CricClubsAnalyticsResponse,
  model: ReturnType<typeof getPlayerModelSnapshot>,
) {
  const role = getRoleLabel(result.player.role).toLowerCase();
  const primaryLabel =
    role === "bowler"
      ? "Bowling Impact"
      : role === "batter"
        ? "Batting Impact"
        : role === "keeper"
          ? "Keeper Value"
          : "All-Round Value";

  return [
    { label: primaryLabel, value: model.production },
    { label: "Peer Percentile", value: model.peerPercentile },
    { label: "Consistency", value: model.consistency },
    { label: "Versatility", value: model.versatility },
    { label: "Fielding Impact", value: model.fielding },
  ];
}

function buildTrendCards(
  result: CricClubsAnalyticsResponse,
  model: ReturnType<typeof getPlayerModelSnapshot>,
) {
  const current = buildCurrentSnapshot(result);
  const overall = buildOverallSnapshot(result);
  const currentRuns = Number(current.batting.runs ?? 0);
  const overallRuns = Number(overall.batting.runs ?? 0);
  const currentWickets = Number(current.bowling.wickets ?? 0);
  const overallWickets = Number(overall.bowling.wickets ?? 0);
  const matches = Number(overall.matches ?? 0);

  return [
    {
      title: "Current Pathway Output",
      value: model.production >= 75 ? "Strong" : model.production >= 55 ? "Building" : "Early",
      note: "Shows how the current USA Junior Cricket Pathway sample compares with the broader public record.",
      points: [
        { label: "Runs", value: currentRuns, height: currentRuns && overallRuns ? (currentRuns / overallRuns) * 100 : 18 },
        { label: "Avg", value: Number(current.batting.average ?? 0), height: (Number(current.batting.average ?? 0) / 50) * 100 },
        { label: "SR", value: Number(current.batting.strikeRate ?? 0), height: (Number(current.batting.strikeRate ?? 0) / 140) * 100 },
        { label: "Wkts", value: currentWickets, height: currentWickets && overallWickets ? (currentWickets / overallWickets) * 100 : 18 },
        { label: "Econ", value: Number(current.bowling.economy ?? 0), height: current.bowling.economy ? Math.max(18, ((9 - Number(current.bowling.economy)) / 9) * 100) : 18 },
      ],
    },
    {
      title: "Career Backing",
      value: matches >= 120 ? "Established" : matches >= 50 ? "Growing" : "Limited",
      note: "Keeps the career volume and overall public CricClubs production visible next to the pathway sample.",
      points: [
        { label: "Matches", value: matches, height: (matches / 320) * 100 },
        { label: "Runs", value: overallRuns, height: (overallRuns / 5500) * 100 },
        { label: "Wkts", value: overallWickets, height: (overallWickets / 350) * 100 },
        { label: "Pct", value: model.peerPercentile, height: model.peerPercentile },
        { label: "Score", value: model.overall, height: model.overall },
      ],
    },
  ];
}

function buildSelectorNarrative(
  result: CricClubsAnalyticsResponse,
  model: ReturnType<typeof getPlayerModelSnapshot>,
) {
  const role = getRoleLabel(result.player.role);
  const primary =
    role === "Bowler"
      ? "bowling impact"
      : role === "Batter"
        ? "batting output"
        : role === "Keeper"
          ? "keeping value"
          : "all-round contribution";

  const percentilePhrase =
    model.peerPercentile >= 80
      ? "grades well against the current peer group"
      : model.peerPercentile >= 60
        ? "sits in a competitive middle-to-upper band against peers"
        : "still profiles as more developmental relative to the current peer group";

  return `${result.player.name || result.searchQuery} profiles as a ${role.toLowerCase()} whose ${primary} ${percentilePhrase}. ${result.derived.selectionSummary} ${result.derived.recommendation}`;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getRoleCohort(result: CricClubsAnalyticsResponse) {
  const targetRole = getRoleLabel(result.player.role);
  return SUPPORTED_ANALYTICS_PLAYERS.filter((candidate) =>
    candidate.searchQuery !== result.searchQuery && getRoleLabel(candidate.player.role) === targetRole,
  );
}

function getBenchmarkRows(result: CricClubsAnalyticsResponse) {
  const current = buildCurrentSnapshot(result);
  const overall = buildOverallSnapshot(result);
  const cohort = getRoleCohort(result);

  const metrics = [
    {
      label: "Overall Runs",
      value: overall.batting.runs,
      formatter: (value: number) => formatCompactMetric(value),
      getValue: (player: CricClubsAnalyticsResponse) => Number(buildOverallSnapshot(player).batting.runs ?? 0),
      higherBetter: true,
    },
    {
      label: "Overall Wickets",
      value: overall.bowling.wickets,
      formatter: (value: number) => formatCompactMetric(value),
      getValue: (player: CricClubsAnalyticsResponse) => Number(buildOverallSnapshot(player).bowling.wickets ?? 0),
      higherBetter: true,
    },
    {
      label: "Pathway Runs",
      value: current.batting.runs,
      formatter: (value: number) => formatCompactMetric(value),
      getValue: (player: CricClubsAnalyticsResponse) => Number(buildCurrentSnapshot(player).batting.runs ?? 0),
      higherBetter: true,
    },
    {
      label: "Pathway Wickets",
      value: current.bowling.wickets,
      formatter: (value: number) => formatCompactMetric(value),
      getValue: (player: CricClubsAnalyticsResponse) => Number(buildCurrentSnapshot(player).bowling.wickets ?? 0),
      higherBetter: true,
    },
    {
      label: "Batting Average",
      value: current.batting.average ?? overall.batting.average,
      formatter: (value: number) => formatMetric(value, 1),
      getValue: (player: CricClubsAnalyticsResponse) => {
        const snapshot = buildCurrentSnapshot(player);
        const overallSnapshot = buildOverallSnapshot(player);
        return Number(snapshot.batting.average ?? overallSnapshot.batting.average ?? 0);
      },
      higherBetter: true,
    },
    {
      label: "Economy",
      value: current.bowling.economy ?? overall.bowling.economy,
      formatter: (value: number) => formatMetric(value, 2),
      getValue: (player: CricClubsAnalyticsResponse) => {
        const snapshot = buildCurrentSnapshot(player);
        const overallSnapshot = buildOverallSnapshot(player);
        return Number(snapshot.bowling.economy ?? overallSnapshot.bowling.economy ?? 0);
      },
      higherBetter: false,
    },
  ];

  return metrics
    .map((metric) => {
      if (metric.value === null || metric.value === undefined || metric.value === "") return null;
      const playerValue = Number(metric.value);
      if (!Number.isFinite(playerValue) || playerValue <= 0) return null;

      const cohortValues = cohort
        .map(metric.getValue)
        .filter((value) => Number.isFinite(value) && value > 0);

      if (cohortValues.length < 2) return null;

      const medianValue = median(cohortValues);
      if (medianValue === null) return null;

      const bestValue = metric.higherBetter ? Math.max(...cohortValues) : Math.min(...cohortValues);
      const maxTrack = metric.higherBetter
        ? Math.max(bestValue, playerValue)
        : Math.max(...cohortValues, playerValue);
      const playerPct = metric.higherBetter
        ? Math.min(100, (playerValue / maxTrack) * 100)
        : Math.min(100, ((maxTrack - playerValue) / maxTrack) * 100);
      const medianPct = metric.higherBetter
        ? Math.min(100, (medianValue / maxTrack) * 100)
        : Math.min(100, ((maxTrack - medianValue) / maxTrack) * 100);

      return {
        label: metric.label,
        playerValue: metric.formatter(playerValue),
        medianValue: metric.formatter(medianValue),
        bestValue: metric.formatter(bestValue),
        playerPct,
        medianPct,
        higherBetter: metric.higherBetter,
      };
    })
    .filter((row): row is {
      label: string;
      playerValue: string;
      medianValue: string;
      bestValue: string;
      playerPct: number;
      medianPct: number;
      higherBetter: boolean;
    } => Boolean(row))
    .slice(0, 5);
}

function buildScoutingCards(
  result: CricClubsAnalyticsResponse,
  model: ReturnType<typeof getPlayerModelSnapshot>,
) {
  const current = buildCurrentSnapshot(result);
  const overall = buildOverallSnapshot(result);
  const role = getRoleLabel(result.player.role);
  const pathwayRuns = Number(current.batting.runs ?? 0);
  const overallRuns = Number(overall.batting.runs ?? 0);
  const pathwayWickets = Number(current.bowling.wickets ?? 0);
  const overallWickets = Number(overall.bowling.wickets ?? 0);
  const pathwayShareRuns = overallRuns > 0 && pathwayRuns > 0 ? Math.round((pathwayRuns / overallRuns) * 100) : null;
  const pathwayShareWickets = overallWickets > 0 && pathwayWickets > 0 ? Math.round((pathwayWickets / overallWickets) * 100) : null;
  const cohort = getRoleCohort(result);
  const roleRank = cohort.length + 1 - Math.round((model.peerPercentile / 100) * cohort.length);

  const cards = [
    {
      title: "Batting Read",
      eyebrow: current.batting.runs || overall.batting.runs ? "Grounded by public batting record" : "Limited batting evidence",
      body:
        current.batting.runs || current.batting.average || current.batting.strikeRate
          ? `${result.player.name || result.searchQuery} has ${formatCompactMetric(current.batting.runs)} confirmed USA Junior Pathway runs, with average ${formatMetric(current.batting.average, 1)} and strike rate ${formatMetric(current.batting.strikeRate, 1)} in the returned public data.`
          : overall.batting.runs
            ? `${result.player.name || result.searchQuery} has ${formatCompactMetric(overall.batting.runs)} confirmed overall CricClubs runs. The current public export is stronger on volume than on batting-rate detail.`
            : "Public batting detail is too thin to support a selector-grade batting read yet.",
      metrics: [
        `Overall runs: ${formatCompactMetric(overall.batting.runs)}`,
        `Pathway runs: ${formatCompactMetric(current.batting.runs)}`,
        pathwayShareRuns !== null ? `Pathway share of overall runs: ${pathwayShareRuns}%` : "Pathway share unavailable",
      ],
    },
    {
      title: "Bowling Read",
      eyebrow: current.bowling.wickets || overall.bowling.wickets ? "Grounded by public bowling record" : "Limited bowling evidence",
      body:
        current.bowling.wickets || current.bowling.economy
          ? `${result.player.name || result.searchQuery} has ${formatCompactMetric(current.bowling.wickets)} confirmed USA Junior Pathway wickets with economy ${formatMetric(current.bowling.economy, 2)} in the currently returned profile.`
          : overall.bowling.wickets
            ? `${formatCompactMetric(overall.bowling.wickets)} overall wickets is the strongest confirmed signal in this profile, which points to real bowling contribution even when matchup detail is missing.`
            : "Public bowling detail is too thin to support a selector-grade bowling read yet.",
      metrics: [
        `Overall wickets: ${formatCompactMetric(overall.bowling.wickets)}`,
        `Pathway wickets: ${formatCompactMetric(current.bowling.wickets)}`,
        pathwayShareWickets !== null ? `Pathway share of overall wickets: ${pathwayShareWickets}%` : "Pathway wicket share unavailable",
      ],
    },
    {
      title: "Role And Cohort Position",
      eyebrow: "Same-role public cohort comparison",
      body: `${result.player.name || result.searchQuery} currently profiles as a ${role.toLowerCase()} with peer percentile ${formatCompactMetric(model.peerPercentile)}. Against the supported same-role cohort, this reads more like a rank around ${Math.max(1, roleRank)} of ${cohort.length + 1} than an isolated stat line.`,
      metrics: [
        `Selector score: ${formatCompactMetric(model.overall)}`,
        `Peer percentile: ${formatCompactMetric(model.peerPercentile)}`,
        `Career volume score: ${formatCompactMetric(model.careerVolume)}`,
      ],
    },
  ];

  const meaningfulMatchup = result.derived.matchupRead && !/not included|not exposed|not available|does not expose|could not/i.test(result.derived.matchupRead);
  if (meaningfulMatchup) {
    cards.push({
      title: "Matchup Read",
      eyebrow: "Only shown when public evidence supports it",
      body: result.derived.matchupRead,
      metrics: [
        result.derived.battingProfile,
      ],
    });
  }

  return cards;
}

function barHeight(value: number) {
  return `${Math.max(12, Math.min(100, Math.round(value)))}%`;
}

const Analytics = () => {
  const [playerQuery, setPlayerQuery] = useState("");
  const [result, setResult] = useState<CricClubsAnalyticsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const suggestedPlayers = getLocalPreviewMatches(playerQuery, 6);
  const examplePlayers = getLocalPreviewMatches("", 8);

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
        const liveResult = normalizeAnalyticsResult({
          ...(data as CricClubsAnalyticsResponse),
          previewMode: data.previewMode ?? `${PUBLIC_SCOPE_LABEL} · live public CricClubs profile`,
        });
        const localPreview = getLocalPreviewPlayer(trimmedQuery);
        const resolvedResult = localPreview && isThinAnalyticsResult(liveResult)
          ? normalizeAnalyticsResult({
              ...localPreview,
              searchedAt: new Date().toISOString(),
              previewMode: `${PUBLIC_SCOPE_LABEL} · verified local CricClubs record`,
            })
          : liveResult;

        setResult(resolvedResult);
        setSearchStatus("success");
        return;
      }

      const localPreview = getLocalPreviewPlayer(trimmedQuery);
      if (localPreview) {
        setResult(normalizeAnalyticsResult({
          ...localPreview,
          searchedAt: new Date().toISOString(),
          previewMode: `${PUBLIC_SCOPE_LABEL} · verified local CricClubs record`,
        }));
        setSearchStatus("success");
        return;
      }

      setSearchStatus("no-result");
      setErrorMessage(
        data?.error ||
          `No usable public CricClubs player profile was found for "${trimmedQuery}". Search one of the supported players below or add a verified profile record for that player.`,
      );
      setResult(null);
      return;
    } catch (error) {
      const localPreview = getLocalPreviewPlayer(trimmedQuery);
      if (localPreview) {
        setResult(normalizeAnalyticsResult({
          ...localPreview,
          searchedAt: new Date().toISOString(),
          previewMode: `${PUBLIC_SCOPE_LABEL} · verified local CricClubs record`,
        }));
        setErrorMessage(null);
        setSearchStatus("success");
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unable to search the public CricClubs profile lookup right now.";
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

      <section className="bg-gradient-hero pt-32 pb-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
              Search a player
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Search a public CricClubs player profile and open the Game-Changrs selector dashboard with
              current USA Junior Cricket Pathway stats plus overall career totals.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl rounded-[28px] border border-border bg-gradient-card p-6 shadow-card md:p-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search player name..."
                  value={playerQuery}
                  onChange={(event) => setPlayerQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSearch();
                    }
                  }}
                  className="h-14 w-full rounded-2xl border border-border bg-background pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button
                variant="hero"
                size="xl"
                className="h-14 w-full md:w-auto"
                disabled={isSearching}
                onClick={() => void handleSearch()}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching
                  </>
                ) : (
                  "Search player"
                )}
              </Button>
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Examples</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {examplePlayers.map((player) => (
                  <button
                    key={player.searchQuery}
                    type="button"
                    onClick={() => {
                      setPlayerQuery(player.searchQuery);
                      setErrorMessage(null);
                    }}
                    className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {player.searchQuery}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-start gap-3 text-sm">
                {searchStatus === "searching" ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : searchStatus === "success" ? (
                  <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : searchStatus === "no-result" || searchStatus === "error" ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {searchStatus === "searching"
                      ? `Searching verified CricClubs records for "${lastSearchedQuery}"...`
                      : searchStatus === "success"
                        ? `Verified CricClubs stats loaded for "${lastSearchedQuery}".`
                        : searchStatus === "no-result"
                          ? `No verified player record was found for "${lastSearchedQuery}".`
                          : searchStatus === "error"
                            ? "The analytics search did not complete successfully."
                            : "Search a player from the public CricClubs dataset."}
                  </p>
                  <p className="text-muted-foreground">
                    {searchStatus === "searching"
                      ? "The previous result is cleared while the public player-profile lookup runs."
                      : searchStatus === "success"
                        ? "This result comes either from a live public player page or, if that failed, from the bundled verified registry."
                        : searchStatus === "no-result"
                          ? "No public player page or bundled verified registry match was available for that search."
                          : searchStatus === "error"
                            ? "The public lookup and local fallback both failed."
                            : "Example players are shown above, and close matches update as you type."}
                  </p>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Suggested matches</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedPlayers.map((player) => (
                  <button
                    key={player.searchQuery}
                    type="button"
                    onClick={() => {
                      setPlayerQuery(player.searchQuery);
                      setErrorMessage(null);
                    }}
                    className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    {player.searchQuery}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          {!result ? (
            <div className="rounded-[30px] border border-border bg-gradient-card p-8 md:p-10">
              <div className="max-w-3xl">
                <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                  {searchStatus === "searching"
                    ? "Running public player search"
                    : searchStatus === "no-result"
                      ? "No public player result found"
                      : searchStatus === "error"
                        ? "Analytics search failed"
                        : "Search any public CricClubs player"}
                </h2>
                <p className="mt-3 text-muted-foreground">
                  {searchStatus === "searching"
                    ? `The app is checking live public CricClubs player pages for "${lastSearchedQuery}".`
                    : searchStatus === "no-result"
                      ? `No usable public CricClubs player page or bundled verified record matched "${lastSearchedQuery}".`
                      : searchStatus === "error"
                        ? "The search did not complete successfully. Use the error message above to distinguish a lookup issue from a true no-result."
                        : "The analytics report opens once a public profile is found. The report then keeps current pathway stats and overall career totals side by side in the Game-Changrs selector view."}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    {
                      title: "Search-first flow",
                      body: "The page now opens on a single search action with example players instead of a heavy tabbed explainer.",
                    },
                    {
                      title: "Pathway + overall",
                      body: "The report keeps USA Junior Cricket Pathway output visible next to overall CricClubs totals so small samples stay grounded.",
                    },
                    {
                      title: "Selector format",
                      body: "Results are rendered as a cleaner executive-style dashboard using the existing Game-Changrs green and amber palette.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-border bg-background/60 p-5">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            (() => {
              const model = getPlayerModelSnapshot(result);
              const recommendation = getRecommendationTone(model.overall);
              const currentSnapshot = buildCurrentSnapshot(result);
              const overallSnapshot = buildOverallSnapshot(result);
              const quickReadBars = buildQuickReadBars(result, model);
              const trendCards = buildTrendCards(result, model);
              const scoutingCards = buildScoutingCards(result, model);
              const benchmarkRows = getBenchmarkRows(result);
              const selectorNarrative = buildSelectorNarrative(result, model);
              const peerCards = model.peers.slice(0, 3);

              return (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${recommendation.badgeClass}`}>
                              {recommendation.badge}
                            </span>
                            {result.previewMode ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                                {result.previewMode}
                              </span>
                            ) : null}
                          </div>

                          <h2 className="mt-5 font-display text-4xl font-bold text-foreground md:text-5xl">
                            {result.player.name || result.searchQuery}
                          </h2>
                          <p className="mt-2 text-lg text-primary">{recommendation.tier}</p>

                          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span>{result.player.team || "Team unavailable"}</span>
                            <span>{getRoleLabel(result.player.role)}</span>
                            <span>{result.player.battingStyle || "Batting style unavailable"}</span>
                            <span>{result.player.bowlingStyle || "Bowling style unavailable"}</span>
                          </div>

                          <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground">
                            {selectorNarrative}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-3">
                          <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto">
                              Open CricClubs profile
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </div>

                      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/15 bg-background/60 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Overall CricClubs</p>
                            <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                              Career record
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-4">
                            {[
                              { label: "Matches", value: overallSnapshot.matches },
                              { label: "Runs", value: overallSnapshot.batting.runs },
                              { label: "Wickets", value: overallSnapshot.bowling.wickets },
                            ].map((item) => (
                              <div key={item.label}>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                                <p className="mt-2 font-display text-3xl font-bold text-foreground">
                                  {formatCompactMetric(item.value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-primary/15 bg-background/60 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">USA Junior Pathway</p>
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                              Current pathway
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-4">
                            {[
                              { label: "Matches", value: currentSnapshot.matches },
                              { label: "Runs", value: currentSnapshot.batting.runs },
                              { label: "Wickets", value: currentSnapshot.bowling.wickets },
                            ].map((item) => (
                              <div key={item.label}>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                                <p className="mt-2 font-display text-3xl font-bold text-foreground">
                                  {formatCompactMetric(item.value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Quick Read For Selectors</p>
                          <h3 className="font-display text-2xl font-bold text-foreground">At-a-glance profile</h3>
                        </div>
                      </div>

                      <div className="mt-6 space-y-4">
                        {quickReadBars.map((item) => (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{item.label}</p>
                              <p className="text-sm text-muted-foreground">{formatCompactMetric(item.value)}</p>
                            </div>
                            <div className="h-3 rounded-full bg-secondary">
                              <div
                                className="h-3 rounded-full bg-gradient-primary"
                                style={{ width: `${Math.max(8, Math.min(100, item.value))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Peer Comparison Strip</p>
                          <h3 className="font-display text-2xl font-bold text-foreground">Where this player sits</h3>
                        </div>
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                          Same-role sample
                        </span>
                      </div>

                      <div className="mt-6 space-y-3">
                        {peerCards.length > 0 ? (
                          peerCards.map((peer, index) => (
                            <div key={peer.name} className="rounded-2xl border border-border bg-background/60 p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {index === 0 ? `${result.player.name || result.searchQuery}` : peer.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {index === 0
                                      ? `${result.player.team || "Team unavailable"} • ${getRoleLabel(result.player.role)}`
                                      : peer.role || "Role unavailable"}
                                  </p>
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {index === 0
                                      ? result.derived.selectionSummary
                                      : "Peer comparator shown from the currently supported public cohort."}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-display text-3xl font-bold text-foreground">
                                    {index === 0 ? formatCompactMetric(model.overall) : formatCompactMetric(peer.score)}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Selector score</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-border bg-background/60 p-5 text-sm text-muted-foreground">
                            There are not enough same-role players in the currently supported cohort to show a clean peer strip for this profile.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-accent/10 p-3 text-accent">
                          <ArrowUpRight className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Trend Graphics</p>
                          <h3 className="font-display text-2xl font-bold text-foreground">Current vs career context</h3>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4">
                        {trendCards.map((card) => (
                          <div key={card.title} className="rounded-2xl border border-border bg-background/60 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-foreground">{card.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{card.note}</p>
                              </div>
                              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                {card.value}
                              </span>
                            </div>

                            <div className="mt-5 grid h-36 grid-cols-5 items-end gap-3">
                              {card.points.map((point) => (
                                <div key={`${card.title}-${point.label}`} className="flex h-full flex-col items-center justify-end gap-2">
                                  <div className="flex h-24 w-full items-end justify-center rounded-xl bg-secondary/80 px-2 py-2">
                                    <div
                                      className="w-full rounded-lg bg-gradient-primary"
                                      style={{ height: barHeight(point.height) }}
                                    />
                                  </div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{point.label}</p>
                                  <p className="text-xs font-medium text-foreground">{formatCompactMetric(point.value)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Detailed Scouting Breakdown</p>
                      <h3 className="mt-2 font-display text-2xl font-bold text-foreground">What the public record supports right now</h3>

                      <div className="mt-6 space-y-4">
                        {scoutingCards.map((item) => (
                          <div key={item.title} className="rounded-2xl border border-border bg-background/60 p-5">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-primary">{item.eyebrow}</p>
                            <h4 className="mt-2 font-semibold text-foreground">{item.title}</h4>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.metrics.map((metric) => (
                                <span
                                  key={`${item.title}-${metric}`}
                                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
                                >
                                  {metric}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Role Benchmarks</p>
                      <h3 className="mt-2 font-display text-2xl font-bold text-foreground">Player vs same-role public cohort</h3>

                      <div className="mt-6 space-y-5">
                        {benchmarkRows.length > 0 ? (
                          benchmarkRows.map((row) => (
                            <div key={row.label}>
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{row.label}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>Player {row.playerValue}</span>
                                  <span>Median {row.medianValue}</span>
                                  <span>Best {row.bestValue}</span>
                                </div>
                              </div>
                              <div className="relative h-3 rounded-full bg-secondary">
                                <div
                                  className="h-3 rounded-full bg-gradient-primary"
                                  style={{ width: `${Math.max(8, Math.min(100, row.playerPct))}%` }}
                                />
                                <div
                                  className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-accent"
                                  style={{ left: `${Math.max(4, Math.min(96, row.medianPct))}%` }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-border bg-background/60 p-5 text-sm text-muted-foreground">
                            Same-role public benchmarks are only shown when the returned profile and the current supported cohort expose enough comparable numbers.
                          </div>
                        )}
                      </div>

                      <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/10 p-5">
                        <p className="font-medium text-foreground">Advanced matchup note</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Opponent-quality, team-strength, and bowler-type comparisons are only safe when verified match-level tables or commentary are available. This profile view is now cleaner and more grounded, but it will not invent those splits from incomplete public data.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-border bg-gradient-card p-8 shadow-card">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Standard CricClubs Stats Snapshot</p>
                    <h3 className="mt-2 font-display text-2xl font-bold text-foreground">Current pathway and overall public record</h3>

                    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                      {[
                        {
                          title: "Current USA Junior Cricket Pathway",
                          accent: "text-primary",
                          snapshot: currentSnapshot,
                        },
                        {
                          title: "Overall CricClubs Career",
                          accent: "text-accent",
                          snapshot: overallSnapshot,
                        },
                      ].map((section) => (
                        <div key={section.title} className="rounded-3xl border border-border bg-background/60 p-6">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-display text-xl font-bold text-foreground">{section.title}</h4>
                              <p className={`mt-1 text-sm ${section.accent}`}>{section.snapshot.label}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Matches</p>
                              <p className="font-display text-3xl font-bold text-foreground">
                                {formatCompactMetric(section.snapshot.matches)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-border bg-card p-5">
                              <div className="flex items-center gap-2 text-primary">
                                <BarChart3 className="h-4 w-4" />
                                <p className="text-sm font-medium">Batting</p>
                              </div>
                              <p className="mt-4 font-display text-3xl font-bold text-foreground">
                                {formatCompactMetric(section.snapshot.batting.runs)}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Runs from {formatCompactMetric(section.snapshot.batting.innings)} innings
                              </p>
                              <p className="mt-3 text-sm text-muted-foreground">
                                HS {formatMetric(section.snapshot.batting.high)}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Avg {formatMetric(section.snapshot.batting.average, 1)} | SR {formatMetric(section.snapshot.batting.strikeRate, 1)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-5">
                              <div className="flex items-center gap-2 text-accent">
                                <Target className="h-4 w-4" />
                                <p className="text-sm font-medium">Bowling</p>
                              </div>
                              <p className="mt-4 font-display text-3xl font-bold text-foreground">
                                {formatCompactMetric(section.snapshot.bowling.wickets)}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Wickets in {formatCompactMetric(section.snapshot.bowling.innings)} innings
                              </p>
                              <p className="mt-3 text-sm text-muted-foreground">
                                {section.snapshot.bowling.overs ? `${section.snapshot.bowling.overs} overs` : "Overs unavailable"}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Econ {formatMetric(section.snapshot.bowling.economy, 2)} | BBF {formatMetric(section.snapshot.bowling.best)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-5">
                              <div className="flex items-center gap-2 text-primary">
                                <Users className="h-4 w-4" />
                                <p className="text-sm font-medium">Fielding</p>
                              </div>
                              <p className="mt-4 font-display text-3xl font-bold text-foreground">
                                {formatCompactMetric(section.snapshot.fielding.total)}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Total public dismissals or involvements
                              </p>
                              <p className="mt-3 text-sm text-muted-foreground">
                                {formatCompactMetric(section.snapshot.fielding.catches)} catches
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatCompactMetric(section.snapshot.fielding.directRunOuts)} run outs | {formatCompactMetric(section.snapshot.fielding.stumpings)} stumpings
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Analytics;

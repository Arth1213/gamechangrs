import type {
  CareerTotals,
  CricClubsAnalyticsResponse,
  DerivedInsight,
  FormatSplit,
  PathwayBattingLine,
  PathwayBowlingLine,
  SummaryCard,
} from "@/data/analyticsPlayers";

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (!normalized) return null;

    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;

    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;

    const extracted = Number(match[0]);
    return Number.isFinite(extracted) ? extracted : null;
  }

  return null;
}

function coerceText(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }

  return null;
}

function metricText(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "Unavailable" : `${value}`;
}

// Parse cricket overs notation: 202.4 means 202 overs and 4 balls (NOT decimal).
// Returns total balls bowled, or null if invalid.
export function parseOversToBalls(overs: string | number | null | undefined): number | null {
  if (overs === null || overs === undefined || overs === "") return null;
  const str = String(overs).trim();
  const match = str.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    const num = Number(str);
    if (!Number.isFinite(num)) return null;
    const whole = Math.trunc(num);
    const frac = Math.round((num - whole) * 10);
    if (frac > 5 || frac < 0) return null;
    return whole * 6 + frac;
  }
  const wholeOvers = Number(match[1]);
  const balls = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(wholeOvers) || !Number.isFinite(balls)) return null;
  if (balls > 5) return null;
  return wholeOvers * 6 + balls;
}

function valuesAgree(values: number[], tolerance: number): boolean {
  if (values.length === 0) return false;
  if (values.length === 1) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min <= tolerance;
}

// Derive missing pathwayBatting.runs from balls*SR/100 and average*(innings-notOuts).
// Only return derived value if the available formulas agree within ~2 runs.
export function deriveBattingRuns(
  pb: NonNullable<CricClubsAnalyticsResponse["pathwayBatting"]>,
): number | null {
  if (pb.runs !== null && pb.runs !== undefined) return pb.runs;

  const candidates: number[] = [];

  if (pb.balls !== null && pb.balls !== undefined && pb.strikeRate !== null && pb.strikeRate !== undefined) {
    const value = (pb.balls * pb.strikeRate) / 100;
    if (Number.isFinite(value) && value >= 0) candidates.push(value);
  }

  if (
    pb.average !== null && pb.average !== undefined &&
    pb.innings !== null && pb.innings !== undefined
  ) {
    const notOuts = pb.notOuts ?? 0;
    const dismissals = pb.innings - notOuts;
    if (dismissals > 0) {
      const value = pb.average * dismissals;
      if (Number.isFinite(value) && value >= 0) candidates.push(value);
    }
  }

  if (candidates.length === 0) return null;
  if (!valuesAgree(candidates, 2)) return null;

  const average = candidates.reduce((left, right) => left + right, 0) / candidates.length;
  return Math.round(average);
}

// Derive missing pathwayBowling.wickets from runs/average and ballsBowled/strikeRate.
// Only return derived value if formulas agree within ~2 wickets.
export function deriveBowlingWickets(
  pb: NonNullable<CricClubsAnalyticsResponse["pathwayBowling"]>,
): number | null {
  if (pb.wickets !== null && pb.wickets !== undefined) return pb.wickets;

  const candidates: number[] = [];

  if (
    pb.runs !== null && pb.runs !== undefined &&
    pb.average !== null && pb.average !== undefined && pb.average > 0
  ) {
    const value = pb.runs / pb.average;
    if (Number.isFinite(value) && value >= 0) candidates.push(value);
  }

  const totalBalls = parseOversToBalls(pb.overs);
  if (totalBalls !== null && pb.strikeRate !== null && pb.strikeRate !== undefined && pb.strikeRate > 0) {
    const value = totalBalls / pb.strikeRate;
    if (Number.isFinite(value) && value >= 0) candidates.push(value);
  }

  if (candidates.length === 0) return null;
  if (!valuesAgree(candidates, 2)) return null;

  const average = candidates.reduce((left, right) => left + right, 0) / candidates.length;
  return Math.round(average);
}

function normalizeCareerTotals(value: unknown): CareerTotals | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const totals: CareerTotals = {
    matches: coerceNumber(source.matches),
    runs: coerceNumber(source.runs),
    wickets: coerceNumber(source.wickets),
  };

  return totals.matches !== null || totals.runs !== null || totals.wickets !== null ? totals : null;
}

function normalizePathwayBatting(value: unknown): PathwayBattingLine | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const batting: PathwayBattingLine = {
    seriesType: coerceText(source.seriesType) ?? "USA Cricket Junior Pathway",
    matches: coerceNumber(source.matches),
    innings: coerceNumber(source.innings),
    notOuts: coerceNumber(source.notOuts),
    runs: coerceNumber(source.runs),
    balls: coerceNumber(source.balls),
    average: coerceNumber(source.average),
    strikeRate: coerceNumber(source.strikeRate),
    highestScore: coerceText(source.highestScore),
    hundreds: coerceNumber(source.hundreds),
    fifties: coerceNumber(source.fifties),
    twentyFives: coerceNumber(source.twentyFives),
    ducks: coerceNumber(source.ducks),
    fours: coerceNumber(source.fours),
    sixes: coerceNumber(source.sixes),
  };

  return {
    ...batting,
    runs: deriveBattingRuns(batting),
  };
}

function normalizePathwayBowling(value: unknown): PathwayBowlingLine | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Record<string, unknown>;
  const bowling: PathwayBowlingLine = {
    seriesType: coerceText(source.seriesType) ?? "USA Cricket Junior Pathway",
    matches: coerceNumber(source.matches),
    innings: coerceNumber(source.innings),
    overs: coerceText(source.overs),
    runs: coerceNumber(source.runs),
    wickets: coerceNumber(source.wickets),
    bestBowling: coerceText(source.bestBowling),
    maidens: coerceNumber(source.maidens),
    average: coerceNumber(source.average),
    economy: coerceNumber(source.economy),
    strikeRate: coerceNumber(source.strikeRate),
    fourWickets: coerceNumber(source.fourWickets),
    fiveWickets: coerceNumber(source.fiveWickets),
    wides: coerceNumber(source.wides),
    catches: coerceNumber(source.catches),
  };

  return {
    ...bowling,
    wickets: deriveBowlingWickets(bowling),
  };
}

function normalizeFormatSplits(value: unknown): FormatSplit[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      format: coerceText(item.format) ?? "Unknown format",
      matches: coerceNumber(item.matches),
      runs: coerceNumber(item.runs),
      battingAverage: coerceNumber(item.battingAverage),
      strikeRate: coerceNumber(item.strikeRate),
      wickets: coerceNumber(item.wickets),
      economy: coerceNumber(item.economy),
    }));
}

function normalizeInsights(value: unknown): DerivedInsight[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      title: coerceText(item.title) ?? "Insight",
      body: coerceText(item.body) ?? "No additional detail available.",
    }));
}

function buildFallbackSummaryCards(
  stats: CricClubsAnalyticsResponse["stats"],
  careerTotals: CareerTotals | null,
): SummaryCard[] {
  return [
    {
      label: "Matches",
      value: metricText(careerTotals?.matches ?? stats.matches),
      icon: "players",
      changeLabel: "Public profile",
      trend: "neutral",
    },
    {
      label: "Runs",
      value: metricText(careerTotals?.runs ?? stats.runs),
      icon: "runs",
      changeLabel: stats.highestScore ? `HS ${stats.highestScore}` : "Public profile",
      trend: "neutral",
    },
    {
      label: "Bat Avg / SR",
      value:
        stats.battingAverage !== null || stats.strikeRate !== null
          ? `${metricText(stats.battingAverage)} / ${metricText(stats.strikeRate)}`
          : "Unavailable",
      icon: "batting",
      changeLabel: "Public profile",
      trend: "neutral",
    },
    {
      label: "Wickets / Econ",
      value:
        stats.wickets !== null || stats.economy !== null
          ? `${metricText(stats.wickets)} / ${metricText(stats.economy)}`
          : "Unavailable",
      icon: "bowling",
      changeLabel: "Public profile",
      trend: "neutral",
    },
  ];
}

function normalizeSummaryCards(
  value: unknown,
  stats: CricClubsAnalyticsResponse["stats"],
  careerTotals: CareerTotals | null,
): SummaryCard[] {
  if (!Array.isArray(value)) {
    return buildFallbackSummaryCards(stats, careerTotals);
  }

  const summaryCards = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const icon = coerceText(item.icon);
      const trend = coerceText(item.trend);

      return {
        label: coerceText(item.label) ?? "Stat",
        value: coerceText(item.value) ?? "Unavailable",
        icon:
          icon === "players" || icon === "runs" || icon === "batting" || icon === "bowling"
            ? icon
            : "players",
        changeLabel: coerceText(item.changeLabel) ?? "Public profile",
        trend: trend === "up" || trend === "down" || trend === "neutral" ? trend : "neutral",
      } satisfies SummaryCard;
    });

  return summaryCards.length > 0 ? summaryCards : buildFallbackSummaryCards(stats, careerTotals);
}

export function normalizeAnalyticsResult(
  data: Partial<CricClubsAnalyticsResponse>,
): CricClubsAnalyticsResponse {
  const careerTotals = normalizeCareerTotals(data.careerTotals);
  const pathwayBatting = normalizePathwayBatting(data.pathwayBatting);
  const pathwayBowling = normalizePathwayBowling(data.pathwayBowling);
  const formatSplits = normalizeFormatSplits(data.formatSplits);

  const stats: CricClubsAnalyticsResponse["stats"] = {
    matches: coerceNumber(data.stats?.matches) ?? careerTotals?.matches ?? pathwayBatting?.matches ?? pathwayBowling?.matches,
    innings: coerceNumber(data.stats?.innings),
    runs: coerceNumber(data.stats?.runs) ?? careerTotals?.runs ?? pathwayBatting?.runs,
    battingAverage: coerceNumber(data.stats?.battingAverage) ?? pathwayBatting?.average,
    strikeRate: coerceNumber(data.stats?.strikeRate) ?? pathwayBatting?.strikeRate,
    highestScore: coerceText(data.stats?.highestScore) ?? pathwayBatting?.highestScore,
    notOuts: coerceNumber(data.stats?.notOuts) ?? pathwayBatting?.notOuts,
    fours: coerceNumber(data.stats?.fours) ?? pathwayBatting?.fours,
    sixes: coerceNumber(data.stats?.sixes) ?? pathwayBatting?.sixes,
    ducks: coerceNumber(data.stats?.ducks) ?? pathwayBatting?.ducks,
    wickets: coerceNumber(data.stats?.wickets) ?? careerTotals?.wickets ?? pathwayBowling?.wickets,
    bowlingAverage: coerceNumber(data.stats?.bowlingAverage) ?? pathwayBowling?.average,
    economy: coerceNumber(data.stats?.economy) ?? pathwayBowling?.economy,
    bowlingStrikeRate: coerceNumber(data.stats?.bowlingStrikeRate) ?? pathwayBowling?.strikeRate,
    bestBowling: coerceText(data.stats?.bestBowling) ?? pathwayBowling?.bestBowling,
    maidens: coerceNumber(data.stats?.maidens) ?? pathwayBowling?.maidens,
    catches: coerceNumber(data.stats?.catches) ?? pathwayBowling?.catches,
    stumpings: coerceNumber(data.stats?.stumpings),
    runOuts: coerceNumber(data.stats?.runOuts),
  };

  const summaryCards = normalizeSummaryCards(data.derived?.summaryCards, stats, careerTotals);

  const next: CricClubsAnalyticsResponse = {
    searchQuery: coerceText(data.searchQuery) ?? coerceText(data.player?.name) ?? "Unknown player",
    sourceUrl: coerceText(data.sourceUrl) ?? "",
    searchedAt: coerceText(data.searchedAt) ?? new Date().toISOString(),
    previewMode: coerceText(data.previewMode),
    careerTotals:
      careerTotals ??
      ((pathwayBatting?.runs != null || pathwayBowling?.wickets != null)
        ? {
            matches: stats.matches,
            runs: pathwayBatting?.runs ?? null,
            wickets: pathwayBowling?.wickets ?? null,
          }
        : null),
    pathwayBatting,
    pathwayBowling,
    player: {
      name: coerceText(data.player?.name) ?? coerceText(data.searchQuery),
      role: coerceText(data.player?.role),
      team: coerceText(data.player?.team),
      battingStyle: coerceText(data.player?.battingStyle),
      bowlingStyle: coerceText(data.player?.bowlingStyle),
    },
    stats,
    formatSplits,
    explicitInsights: {
      dismissalPatterns: Array.isArray(data.explicitInsights?.dismissalPatterns)
        ? data.explicitInsights.dismissalPatterns.map((item) => coerceText(item)).filter((item): item is string => Boolean(item))
        : [],
      bowlerTypeNotes: Array.isArray(data.explicitInsights?.bowlerTypeNotes)
        ? data.explicitInsights.bowlerTypeNotes.map((item) => coerceText(item)).filter((item): item is string => Boolean(item))
        : [],
      groundingNotes: Array.isArray(data.explicitInsights?.groundingNotes)
        ? data.explicitInsights.groundingNotes.map((item) => coerceText(item)).filter((item): item is string => Boolean(item))
        : [],
    },
    derived: {
      summaryCards,
      strengths: normalizeInsights(data.derived?.strengths),
      concerns: normalizeInsights(data.derived?.concerns),
      selectionSummary:
        coerceText(data.derived?.selectionSummary) ??
        "Public CricClubs data loaded, but some analytics fields were missing from the returned result.",
      battingProfile:
        coerceText(data.derived?.battingProfile) ??
        "The batting profile could not be fully constructed from the returned public data.",
      dismissalRisk:
        coerceText(data.derived?.dismissalRisk) ??
        "Dismissal-risk detail was not included in the returned public data.",
      matchupRead:
        coerceText(data.derived?.matchupRead) ??
        "Matchup detail was not included in the returned public data.",
      recommendation:
        coerceText(data.derived?.recommendation) ??
        "Use the public profile as a directional read, not a complete scouting file.",
      dataLimitations:
        Array.isArray(data.derived?.dataLimitations)
          ? data.derived.dataLimitations.map((item) => coerceText(item)).filter((item): item is string => Boolean(item))
          : ["Some public CricClubs fields were missing from the returned response."],
    },
  };

  if (next.careerTotals) {
    if ((next.careerTotals.runs === null || next.careerTotals.runs === undefined) && next.pathwayBatting?.runs != null) {
      next.careerTotals.runs = next.pathwayBatting.runs;
    }
    if ((next.careerTotals.wickets === null || next.careerTotals.wickets === undefined) && next.pathwayBowling?.wickets != null) {
      next.careerTotals.wickets = next.pathwayBowling.wickets;
    }
  }

  if (next.formatSplits.length > 0 && next.pathwayBatting?.runs != null) {
    for (const row of next.formatSplits) {
      if (row.format === next.pathwayBatting.seriesType && (row.runs === null || row.runs === undefined)) {
        row.runs = next.pathwayBatting.runs;
      }
    }
  }

  if (next.formatSplits.length > 0 && next.pathwayBowling?.wickets != null) {
    for (const row of next.formatSplits) {
      if (row.format === next.pathwayBowling.seriesType && (row.wickets === null || row.wickets === undefined)) {
        row.wickets = next.pathwayBowling.wickets;
      }
    }
  }

  return next;
}

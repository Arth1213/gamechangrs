import {
  SUPPORTED_ANALYTICS_PLAYERS,
  type CricClubsAnalyticsResponse,
} from "@/data/analyticsPlayers";

export const BAY_AREA_LEAGUES = [
  {
    id: 434,
    label: "League 434",
    href: "https://cricclubs.com/USACricketJunior/viewLeague.do?league=434&clubId=40319",
    focus: "Bay Area U15 source league",
  },
  {
    id: 435,
    label: "League 435",
    href: "https://cricclubs.com/USACricketJunior/viewLeague.do?league=435&clubId=40319",
    focus: "Bay Area U15 source league",
  },
  {
    id: 436,
    label: "League 436",
    href: "https://cricclubs.com/USACricketJunior/viewLeague.do?league=436&clubId=40319",
    focus: "Bay Area U15 source league",
  },
  {
    id: 437,
    label: "League 437",
    href: "https://cricclubs.com/USACricketJunior/viewLeague.do?league=437&clubId=40319",
    focus: "Bay Area U15 source league",
  },
] as const;

export const PATHWAY_SERIES_LEVELS = [
  {
    label: "Regional Hub",
    value: "Bay Area U15 Hub",
    note: "Regional series pages such as leagues 434-437 are the current grounded competition layer in this build.",
  },
  {
    label: "National Pathway",
    value: "USA Cricket Junior Pathway",
    note: "When public player tabs expose pathway rows, the analytics page surfaces those national-development stats separately.",
  },
  {
    label: "International Track",
    value: "Public profile scouting",
    note: "Career totals and public player-profile data are kept visible so selectors can compare broader pathway and international-track volume.",
  },
] as const;

export const BAY_AREA_SOURCE_TABS = [
  {
    label: "Overview",
    use: "Seed the leaderboard and establish the active player pool.",
  },
  {
    label: "Points Table",
    use: "Build team-strength weighting with division and standings context.",
  },
  {
    label: "Results",
    use: "Ingest scorecards and ball-by-ball feeds for deeper matchup intelligence.",
  },
  {
    label: "Batting / Bowling / Fielding Records",
    use: "Set baseline public rankings before adjustment.",
  },
  {
    label: "Ranking",
    use: "Validate division context; not the final intelligence layer by itself.",
  },
] as const;

export const BAY_AREA_WEIGHT_RULES = [
  {
    label: "Div 1 Premium",
    value: "1.15x",
    note: "Higher-grade opposition gets a built-in premium.",
  },
  {
    label: "Div 2 Baseline",
    value: "1.00x",
    note: "Baseline weighting for standard Bay Area U15 competition.",
  },
  {
    label: "Powerplay Premium",
    value: "1.20x",
    note: "Early-over impact is treated as more valuable.",
  },
  {
    label: "Death Overs Premium",
    value: "1.15x",
    note: "Late-over performance gets extra leverage weight.",
  },
  {
    label: "High-Leverage Situations",
    value: "1.20x",
    note: "Close-match moments should count more than flat-scoreboard events.",
  },
] as const;

type PeerSnapshot = {
  name: string;
  role: string | null;
  score: number;
};

export type PlayerModelSnapshot = {
  production: number;
  consistency: number;
  versatility: number;
  fielding: number;
  careerVolume: number;
  overall: number;
  peerPercentile: number;
  peers: PeerSnapshot[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizeScale(value: number | null | undefined, min: number, max: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  if (max <= min) {
    return 0;
  }

  return clamp(((value - min) / (max - min)) * 100);
}

function inverseScale(value: number | null | undefined, min: number, max: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  if (max <= min) {
    return 0;
  }

  return clamp(((max - value) / (max - min)) * 100);
}

function getRoleBucket(player: CricClubsAnalyticsResponse) {
  const role = (player.player.role ?? "").toLowerCase();

  if (role.includes("all rounder")) return "all-rounder";
  if (role.includes("wicket")) return "keeper";
  if (role.includes("bowler")) return "bowler";
  return "batter";
}

function getBattingProduction(player: CricClubsAnalyticsResponse) {
  const batting = player.pathwayBatting;
  const stats = player.stats;
  const runs = batting?.runs ?? stats.runs;
  const avg = batting?.average ?? stats.battingAverage;
  const sr = batting?.strikeRate ?? stats.strikeRate;
  const boundaries = (batting?.fours ?? stats.fours ?? 0) + ((batting?.sixes ?? stats.sixes ?? 0) * 2);

  return (
    normalizeScale(runs, 0, 1000) * 0.35 +
    normalizeScale(avg, 0, 50) * 0.3 +
    normalizeScale(sr, 40, 120) * 0.2 +
    normalizeScale(boundaries, 0, 120) * 0.15
  );
}

function getBowlingProduction(player: CricClubsAnalyticsResponse) {
  const bowling = player.pathwayBowling;
  const stats = player.stats;
  const wickets = bowling?.wickets ?? stats.wickets;
  const economy = bowling?.economy ?? stats.economy;
  const average = bowling?.average ?? stats.bowlingAverage;
  const wides = bowling?.wides ?? 0;

  return (
    normalizeScale(wickets, 0, 45) * 0.45 +
    inverseScale(economy, 2.5, 9) * 0.25 +
    inverseScale(average, 8, 28) * 0.2 +
    inverseScale(wides, 0, 140) * 0.1
  );
}

function getProduction(player: CricClubsAnalyticsResponse) {
  const roleBucket = getRoleBucket(player);
  const batting = getBattingProduction(player);
  const bowling = getBowlingProduction(player);

  if (roleBucket === "all-rounder") {
    return batting * 0.55 + bowling * 0.45;
  }

  if (roleBucket === "bowler") {
    return bowling;
  }

  if (roleBucket === "keeper") {
    return batting * 0.75 + getFielding(player) * 0.25;
  }

  return batting;
}

function getConsistency(player: CricClubsAnalyticsResponse) {
  const matches = player.pathwayBatting?.matches ?? player.stats.matches ?? player.careerTotals?.matches;
  const innings = player.pathwayBatting?.innings ?? player.stats.innings ?? 0;

  return normalizeScale(matches, 0, 40) * 0.65 + normalizeScale(innings, 0, 35) * 0.35;
}

function getVersatility(player: CricClubsAnalyticsResponse) {
  const hasBatting =
    (player.pathwayBatting?.runs ?? player.stats.runs ?? player.careerTotals?.runs ?? 0) > 0;
  const hasBowling =
    (player.pathwayBowling?.wickets ?? player.stats.wickets ?? player.careerTotals?.wickets ?? 0) > 0;

  if (hasBatting && hasBowling) return 92;
  if (hasBatting || hasBowling) return 48;
  return 15;
}

function getFielding(player: CricClubsAnalyticsResponse) {
  const catches = player.pathwayBowling?.catches ?? player.stats.catches ?? 0;
  return normalizeScale(catches, 0, 25);
}

function getCareerVolume(player: CricClubsAnalyticsResponse) {
  return normalizeScale(player.careerTotals?.matches ?? player.stats.matches, 0, 400);
}

function getOverall(player: CricClubsAnalyticsResponse) {
  const production = getProduction(player);
  const consistency = getConsistency(player);
  const versatility = getVersatility(player);
  const fielding = getFielding(player);
  const careerVolume = getCareerVolume(player);

  return clamp(
    production * 0.45 +
      consistency * 0.2 +
      versatility * 0.15 +
      fielding * 0.1 +
      careerVolume * 0.1,
  );
}

function getSupportedCohort() {
  return SUPPORTED_ANALYTICS_PLAYERS.filter((candidate) => {
    const hasRuns =
      (candidate.pathwayBatting?.runs ?? candidate.stats.runs ?? candidate.careerTotals?.runs ?? 0) > 0;
    const hasWickets =
      (candidate.pathwayBowling?.wickets ?? candidate.stats.wickets ?? candidate.careerTotals?.wickets ?? 0) > 0;

    return hasRuns || hasWickets;
  });
}

function getRolePeers(player: CricClubsAnalyticsResponse) {
  const roleBucket = getRoleBucket(player);

  return getSupportedCohort().filter((candidate) => {
    if (candidate.searchQuery === player.searchQuery) return false;
    return getRoleBucket(candidate) === roleBucket;
  });
}

export function getPlayerModelSnapshot(player: CricClubsAnalyticsResponse): PlayerModelSnapshot {
  const production = clamp(getProduction(player));
  const consistency = clamp(getConsistency(player));
  const versatility = clamp(getVersatility(player));
  const fielding = clamp(getFielding(player));
  const careerVolume = clamp(getCareerVolume(player));
  const overall = getOverall(player);

  const cohort = getSupportedCohort().map((candidate) => ({
    player: candidate,
    score: getOverall(candidate),
  })).sort((a, b) => b.score - a.score);

  const rank = cohort.findIndex((entry) => entry.player.searchQuery === player.searchQuery);
  const peerPercentile =
    rank === -1 || cohort.length === 0
      ? 0
      : clamp(((cohort.length - rank) / cohort.length) * 100);

  const peers = getRolePeers(player)
    .map((candidate) => ({
      name: candidate.player.name ?? candidate.searchQuery,
      role: candidate.player.role,
      score: Math.round(getOverall(candidate)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    production: Math.round(production),
    consistency: Math.round(consistency),
    versatility: Math.round(versatility),
    fielding: Math.round(fielding),
    careerVolume: Math.round(careerVolume),
    overall: Math.round(overall),
    peerPercentile: Math.round(peerPercentile),
    peers,
  };
}

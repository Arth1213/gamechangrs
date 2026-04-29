export type Trend = "up" | "down" | "neutral";

export interface SummaryCard {
  label: string;
  value: string;
  icon: "players" | "runs" | "batting" | "bowling";
  changeLabel: string;
  trend: Trend;
}

export interface DerivedInsight {
  title: string;
  body: string;
}

export interface FormatSplit {
  format: string;
  matches: number | null;
  runs: number | null;
  battingAverage: number | null;
  strikeRate: number | null;
  wickets: number | null;
  economy: number | null;
}

export interface CareerTotals {
  matches: number | null;
  runs: number | null;
  wickets: number | null;
}

export interface PathwayBattingLine {
  seriesType: string;
  matches: number | null;
  innings: number | null;
  notOuts: number | null;
  runs: number | null;
  balls: number | null;
  average: number | null;
  strikeRate: number | null;
  highestScore: string | null;
  hundreds: number | null;
  fifties: number | null;
  twentyFives: number | null;
  ducks: number | null;
  fours: number | null;
  sixes: number | null;
}

export interface PathwayBowlingLine {
  seriesType: string;
  matches: number | null;
  innings: number | null;
  overs: string | null;
  runs: number | null;
  wickets: number | null;
  bestBowling: string | null;
  maidens: number | null;
  average: number | null;
  economy: number | null;
  strikeRate: number | null;
  fourWickets: number | null;
  fiveWickets: number | null;
  wides: number | null;
  catches: number | null;
}

export interface CricClubsAnalyticsResponse {
  searchQuery: string;
  sourceUrl: string;
  searchedAt: string;
  previewMode?: string | null;
  careerTotals?: CareerTotals | null;
  pathwayBatting?: PathwayBattingLine | null;
  pathwayBowling?: PathwayBowlingLine | null;
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

export interface LocalPreviewPlayer extends CricClubsAnalyticsResponse {
  aliases?: string[];
}

const searchedAt = new Date().toISOString();

export const LOCAL_PREVIEW_PLAYERS: LocalPreviewPlayer[] = [
  {
    searchQuery: "Arth Arun",
    sourceUrl: "https://cricclubs.com/ASCE/viewPlayer.do?playerId=2262444&clubId=22142",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 312,
      runs: 3439,
      wickets: 338,
    },
    pathwayBatting: {
      seriesType: "1 DAY",
      matches: 32,
      innings: 23,
      notOuts: 7,
      runs: 400,
      balls: 752,
      average: 25,
      strikeRate: 53.19,
      highestScore: "54",
      hundreds: 0,
      fifties: 2,
      twentyFives: 4,
      ducks: 0,
      fours: 30,
      sixes: 13,
    },
    pathwayBowling: null,
    player: {
      name: "Arth Arun",
      role: "All Rounder",
      team: "DSCA",
      battingStyle: "Right Handed Batter",
      bowlingStyle: "Right Arm Leg Spin",
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
      { format: "U15 Phase 1", matches: 3, runs: 54, battingAverage: 54, strikeRate: 120, wickets: null, economy: null },
      { format: "U15 Preseason", matches: 2, runs: null, battingAverage: null, strikeRate: null, wickets: null, economy: null },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public CricClubs player profile page shows career totals of 312 matches, 3,439 runs, and 338 wickets.",
        "The USA Cricket Junior Pathway batting tab visible in the indexed player page shows a 1 Day line of 32 matches, 400 runs, 25.00 average, and 53.19 strike rate.",
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
        { title: "Positive early batting return", body: "The visible U15 Phase 1 public table shows a productive batting sample with 54 runs at 54.00 average and 120.00 strike rate." },
      ],
      concerns: [
        { title: "Sample size", body: "The public stat sample is still small, so selection decisions should treat this as an early signal rather than a settled profile." },
      ],
      selectionSummary: "The visible U15 Junior Pathway data supports treating Arth Arun as a real DSCA Rhinos U15 player with an encouraging early batting sample.",
      battingProfile: "The public U15 batting record shows a compact but positive batting profile so far, with one strong visible innings and healthy scoring tempo.",
      dismissalRisk: "This preview does not expose a dismissal-mode split for Arth Arun, so no grounded claim is made about how he gets out most often.",
      matchupRead: "This preview does not expose pace-vs-spin or bowler-arm matchup splits for Arth Arun.",
      recommendation: "Track as a developing U15 all-rounder with early batting upside, but wait for a larger public sample before making stronger matchup claims.",
      dataLimitations: [
        "This localhost preview uses verified public USA Cricket Junior Pathway data cached locally because the remote edge function has not been updated yet.",
        "Current public U15 pages used here do not expose a full dismissal-type or bowler-type split for Arth Arun.",
      ],
    },
  },
  {
    searchQuery: "Naman Patil",
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewPlayer.do?clubId=40319&playerId=1460404",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 245,
      runs: 5074,
      wickets: 232,
    },
    pathwayBatting: {
      seriesType: "1 DAY",
      matches: 37,
      innings: 32,
      notOuts: 10,
      runs: 1003,
      balls: null,
      average: 45.59,
      strikeRate: 104.81,
      highestScore: "173",
      hundreds: null,
      fifties: null,
      twentyFives: null,
      ducks: 1,
      fours: 62,
      sixes: 61,
    },
    pathwayBowling: {
      seriesType: "1 DAY",
      matches: 37,
      innings: null,
      overs: null,
      runs: null,
      wickets: 43,
      bestBowling: "34/4",
      maidens: 17,
      average: 16.19,
      economy: 3.76,
      strikeRate: 25.9,
      fourWickets: null,
      fiveWickets: null,
      wides: 136,
      catches: 17,
    },
    player: {
      name: "Naman Patil",
      role: "All Rounder",
      team: "Bay Area - Warriors",
      battingStyle: "Left Handed Batter",
      bowlingStyle: "Left Arm Fast",
    },
    stats: {
      matches: 37,
      innings: 32,
      runs: 1003,
      battingAverage: 45.59,
      strikeRate: 104.81,
      highestScore: "173",
      notOuts: 10,
      fours: 62,
      sixes: 61,
      ducks: 1,
      wickets: 43,
      bowlingAverage: 16.19,
      economy: 3.76,
      bowlingStrikeRate: 25.9,
      bestBowling: "34/4",
      maidens: 17,
      catches: 17,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "USA Cricket Junior Pathway 1 Day", matches: 37, runs: 1003, battingAverage: 45.59, strikeRate: 104.81, wickets: 43, economy: 3.76 },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public CricClubs player profile page shows career totals of 245 matches, 5,074 runs, and 232 wickets.",
        "The USA Cricket Junior Pathway tab shows a 1 Day line of 1,003 runs at 45.59 average and 104.81 strike rate, plus 43 wickets at 3.76 economy.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "37", icon: "players", changeLabel: "Large pathway sample", trend: "up" },
        { label: "Runs", value: "1003", icon: "runs", changeLabel: "HS 173", trend: "up" },
        { label: "Bat Avg / SR", value: "45.59 / 104.81", icon: "batting", changeLabel: "High-impact scoring", trend: "up" },
        { label: "Wickets / Econ", value: "43 / 3.76", icon: "bowling", changeLabel: "Two-way value", trend: "up" },
      ],
      strengths: [
        { title: "Strong batting output", body: "The public pathway record shows both volume and pace: 1,003 runs with a 45.59 average, 104.81 strike rate, and a highest score of 173." },
        { title: "Real bowling value", body: "Forty-three wickets at 3.76 economy indicates he is contributing as a genuine all-round option, not just a batting-heavy profile." },
      ],
      concerns: [
        { title: "Control discipline still matters", body: "The same public bowling line also shows 136 wides, so the wicket output is strong but control can still decide whether spells stay pressure-building or leak momentum." },
      ],
      selectionSummary: "The public CricClubs pathway profile supports Naman Patil as a proven Bay Area all-rounder with enough sample size to influence selection decisions directly.",
      battingProfile: "The visible batting line points to a left-handed run-maker who can score at tempo, clear the rope, and build match-defining innings rather than just chip in around the edges.",
      dismissalRisk: "This public profile exposes only aggregate batting totals, so it does not support a grounded claim about his most common dismissal mode.",
      matchupRead: "A left-handed batter with 61 sixes and strong strike rate looks like a player who can change fields quickly, while the bowling record adds flexibility when balancing the XI.",
      recommendation: "Treat as a high-value all-round selection whose public numbers already justify top-order batting responsibility and meaningful overs.",
      dataLimitations: [
        "This cached local record is based on the publicly indexed CricClubs profile and visible pathway tables, not on any private API.",
        "No dismissal-type or pace-vs-spin split was publicly exposed on the indexed page used here.",
      ],
    },
  },
  {
    searchQuery: "Arjun Shah",
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewPlayer.do?clubId=40319&playerId=1641657",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 202,
      runs: 2421,
      wickets: 122,
    },
    pathwayBatting: {
      seriesType: "1 DAY",
      matches: 26,
      innings: 25,
      notOuts: 3,
      runs: 435,
      balls: 587,
      average: 19.77,
      strikeRate: 74.11,
      highestScore: "146",
      hundreds: 1,
      fifties: 0,
      twentyFives: null,
      ducks: 2,
      fours: 38,
      sixes: 6,
    },
    pathwayBowling: {
      seriesType: "1 DAY",
      matches: 26,
      innings: 18,
      overs: "88.0",
      runs: 295,
      wickets: 19,
      bestBowling: "6/2",
      maidens: 3,
      average: 15.53,
      economy: 3.35,
      strikeRate: 27.79,
      fourWickets: 0,
      fiveWickets: 0,
      wides: 25,
      catches: 9,
    },
    player: {
      name: "Arjun Shah",
      role: "All Rounder",
      team: "DSCA Rhinos",
      battingStyle: "Right Handed Batter",
      bowlingStyle: "Right Arm Medium",
    },
    stats: {
      matches: 26,
      innings: 25,
      runs: 435,
      battingAverage: 19.77,
      strikeRate: 74.11,
      highestScore: "146",
      notOuts: 3,
      fours: 38,
      sixes: 6,
      ducks: 2,
      wickets: 19,
      bowlingAverage: 15.53,
      economy: 3.35,
      bowlingStrikeRate: 27.8,
      bestBowling: "6/2",
      maidens: 3,
      catches: 9,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "USA Cricket Junior Pathway 1 Day", matches: 26, runs: 435, battingAverage: 19.77, strikeRate: 74.11, wickets: 19, economy: 3.35 },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public CricClubs player profile page shows career totals of 202 matches, 2,421 runs, and 122 wickets.",
        "The USA Cricket Junior Pathway tab shows a 1 Day batting line of 435 runs at 74.11 strike rate and a bowling line of 19 wickets at 3.35 economy.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "26", icon: "players", changeLabel: "Stable pathway sample", trend: "up" },
        { label: "Runs", value: "435", icon: "runs", changeLabel: "HS 146", trend: "up" },
        { label: "Bat Avg / SR", value: "19.77 / 74.11", icon: "batting", changeLabel: "Needs tempo growth", trend: "neutral" },
        { label: "Wickets / Econ", value: "19 / 3.35", icon: "bowling", changeLabel: "Useful overs", trend: "up" },
      ],
      strengths: [
        { title: "Bowling control", body: "The public pathway bowling numbers show useful efficiency: 19 wickets at 15.53 average and only 3.35 economy." },
        { title: "Ceiling with the bat", body: "A listed high score of 146 shows there is real batting upside when he gets through the early phase." },
      ],
      concerns: [
        { title: "Batting consistency", body: "The pathway batting average and strike rate are more modest than the standout high score, which suggests the top-end innings has not yet become week-to-week output." },
      ],
      selectionSummary: "The public profile supports Arjun Shah as a legitimate DSCA Rhinos all-round option whose bowling numbers are currently the more stable selection lever.",
      battingProfile: "The batting line looks more accumulation-based than explosive right now, but the 146 ceiling shows there is room for larger innings when he settles.",
      dismissalRisk: "This page does not expose dismissal-mode breakdowns, so the analysis does not claim a specific dismissal pattern.",
      matchupRead: "The strongest public signal is his bowling efficiency, which makes him easier to fit into balanced XIs even when the batting output is still uneven.",
      recommendation: "Use him as a two-skill player whose bowling remains bankable while the batting continues to chase more repeatable output.",
      dataLimitations: [
        "This cached local record uses only the publicly indexed CricClubs profile and visible pathway tables.",
        "No public dismissal-mode or bowler-type split was exposed on the indexed player page used here.",
      ],
    },
  },
  {
    searchQuery: "Sharvik Shah",
    sourceUrl: "https://cricclubs.com/CCF/viewPlayer.do?clubId=4617&playerId=1615806",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 236,
      runs: 2275,
      wickets: 205,
    },
    pathwayBatting: null,
    pathwayBowling: null,
    player: {
      name: "Sharvik Shah",
      role: "All Rounder",
      team: "SRCA Stars",
      battingStyle: "Right Handed Batter",
      bowlingStyle: "Left Arm Fast",
    },
    stats: {
      matches: 4,
      innings: 3,
      runs: 70,
      battingAverage: 35,
      strikeRate: 72.16,
      highestScore: "52",
      notOuts: 1,
      fours: 5,
      sixes: 2,
      ducks: 0,
      wickets: 5,
      bowlingAverage: 15.4,
      economy: 3.21,
      bowlingStrikeRate: 28.8,
      bestBowling: "6/2",
      maidens: 3,
      catches: 1,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "CCF 1 Day", matches: 4, runs: 70, battingAverage: 35, strikeRate: 72.16, wickets: 5, economy: 3.21 },
      { format: "Profile Totals", matches: 237, runs: 2276, battingAverage: null, strikeRate: null, wickets: 205, economy: null },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Public CricClubs player profile lists Sharvik Shah as a verified all rounder and shows 237 matches, 2,276 runs, and 205 wickets overall.",
        "The indexed CCF 1 Day line shows 70 runs at 35.00 average and 72.16 strike rate, plus 5 wickets at 3.21 economy.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "237", icon: "players", changeLabel: "Deep public history", trend: "up" },
        { label: "Runs", value: "2276", icon: "runs", changeLabel: "Career profile", trend: "up" },
        { label: "Bat Avg / SR", value: "35.00 / 72.16", icon: "batting", changeLabel: "Current club sample", trend: "neutral" },
        { label: "Wickets / Econ", value: "205 / 3.21", icon: "bowling", changeLabel: "Left-arm threat", trend: "up" },
      ],
      strengths: [
        { title: "Bowling volume over time", body: "The public profile total of 205 wickets is the clearest signal here and supports the idea that his left-arm pace has been a real recurring weapon across competitions." },
        { title: "Reliable all-round footprint", body: "Even the visible current-club sample shows he can still contribute on both sides of the game rather than relying on one discipline alone." },
      ],
      concerns: [
        { title: "Current batting sample is small", body: "The indexed 1 Day sample is useful, but it is still a narrow slice of the full profile and should not be treated as the whole batting picture by itself." },
      ],
      selectionSummary: "The public CricClubs record supports Sharvik Shah as an experienced all-rounder whose bowling body of work is already large enough to matter in team balance discussions.",
      battingProfile: "The visible batting sample is steady rather than explosive, while the overall profile suggests a player who has stayed involved across a lot of cricket.",
      dismissalRisk: "No public dismissal-type table was exposed in the indexed profile snapshot used here, so dismissal claims are intentionally left out.",
      matchupRead: "The strongest usable signal is the left-arm bowling volume, which gives lineup value against batting groups that do not often see that angle.",
      recommendation: "Prioritize him when the XI needs bowling depth from an all-round slot, then assess batting role based on the latest team-specific form around him.",
      dataLimitations: [
        "This cached local record combines publicly indexed profile totals with a visible current-club 1 Day sample from CricClubs.",
        "The indexed source did not expose a reliable overall batting average and strike rate line to use as a universal headline number.",
      ],
    },
  },
  {
    searchQuery: "Shreyak Porecha",
    sourceUrl: "https://cricclubs.com/viewPlayer.do?clubId=3833&playerId=994074",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 199,
      runs: 3788,
      wickets: 174,
    },
    pathwayBatting: null,
    pathwayBowling: null,
    player: {
      name: "Shreyak Porecha",
      role: "All Rounder",
      team: "SCYCA",
      battingStyle: "Left Handed Batter",
      bowlingStyle: "Left Arm Off Spin",
    },
    stats: {
      matches: 8,
      innings: 8,
      runs: 380,
      battingAverage: 76,
      strikeRate: 102.15,
      highestScore: "106",
      notOuts: 3,
      fours: 47,
      sixes: 5,
      ducks: 0,
      wickets: 9,
      bowlingAverage: 13.89,
      economy: 3.47,
      bowlingStrikeRate: 24,
      bestBowling: "11/3",
      maidens: 6,
      catches: 8,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "PSD 1 Day", matches: 8, runs: 380, battingAverage: 76, strikeRate: 102.15, wickets: 9, economy: 3.47 },
      { format: "PSD T20", matches: 5, runs: 194, battingAverage: 48.5, strikeRate: 82.2, wickets: 3, economy: 9.14 },
      { format: "Profile Totals", matches: 196, runs: 3748, battingAverage: null, strikeRate: null, wickets: 173, economy: null },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Public CricClubs player profile lists Shreyak Porecha as a verified all rounder and shows 196 matches, 3,748 runs, and 173 wickets overall.",
        "The indexed PSD 1 Day line shows 380 runs at 76.00 average and 102.15 strike rate, plus 9 wickets at 3.47 economy.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "196", icon: "players", changeLabel: "Deep public history", trend: "up" },
        { label: "Runs", value: "3748", icon: "runs", changeLabel: "HS 106 in PSD sample", trend: "up" },
        { label: "Bat Avg / SR", value: "76.00 / 102.15", icon: "batting", changeLabel: "High-output 1 Day sample", trend: "up" },
        { label: "Wickets / Econ", value: "9 / 3.47", icon: "bowling", changeLabel: "Adds control", trend: "up" },
      ],
      strengths: [
        { title: "Heavy batting output", body: "The visible PSD 1 Day numbers point to a player who can both occupy time and score fast, with 380 runs, 76.00 average, and 102.15 strike rate." },
        { title: "Balanced all-round contribution", body: "The same sample still returns 9 wickets at 3.47 economy, which means the profile is not dependent on batting alone." },
      ],
      concerns: [
        { title: "T20 bowling variability", body: "The indexed T20 line is still productive, but the economy is much higher than the 1 Day sample, so role fit may depend on format." },
      ],
      selectionSummary: "The public profile supports Shreyak Porecha as one of the more bankable all-round performers in this local search set because both batting production and secondary bowling value are visible.",
      battingProfile: "The visible 1 Day sample reads like a left-handed top-order player who can score long and still keep the innings moving.",
      dismissalRisk: "The indexed profile snapshot did not expose a grounded dismissal-mode table, so no specific dismissal claim is made.",
      matchupRead: "The left-handed batting plus left-arm spin combination gives flexible matchup value and makes him easier to fit into different XI structures.",
      recommendation: "Treat as a strong all-round selection whose public numbers justify serious batting responsibility while preserving bowling upside.",
      dataLimitations: [
        "This cached local record uses publicly indexed CricClubs profile totals and visible competition splits only.",
        "The overall profile totals are broader than a single Bay Area pathway season, so role decisions should still consider the specific competition context.",
      ],
    },
  },
  {
    searchQuery: "Neil Mishra",
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewScorecard.do?clubId=40319&matchId=4227",
    searchedAt,
    previewMode: "Local verified public CricClubs scorecard sample",
    player: {
      name: "Neil Mishra",
      role: "Wicket Keeper",
      team: "DSCA Rhinos",
      battingStyle: null,
      bowlingStyle: null,
    },
    stats: {
      matches: 4,
      innings: 4,
      runs: 31,
      battingAverage: 7.75,
      strikeRate: 67.39,
      highestScore: "13",
      notOuts: 0,
      fours: 3,
      sixes: 0,
      ducks: 2,
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
      { format: "Indexed U15 scorecards", matches: 4, runs: 31, battingAverage: 7.75, strikeRate: 67.39, wickets: null, economy: null },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Public team pages across USA Cricket Junior Pathway, BACA, and tournament pages consistently list Neil Mishra as a verified wicket keeper.",
        "Indexed DSCA Rhinos scorecards expose a four-innings batting sample of 0, 8, 13, and 10 runs, which is what this local cache uses.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "4", icon: "players", changeLabel: "Indexed scorecard sample", trend: "neutral" },
        { label: "Runs", value: "31", icon: "runs", changeLabel: "HS 13", trend: "neutral" },
        { label: "Bat Avg / SR", value: "7.75 / 67.39", icon: "batting", changeLabel: "Small public sample", trend: "neutral" },
        { label: "Wickets / Econ", value: "Unavailable", icon: "bowling", changeLabel: "Wicket keeper profile", trend: "neutral" },
      ],
      strengths: [
        { title: "Verified pathway presence", body: "The public pages are consistent about his role and team footprint, so this is a real player record rather than a guessed result." },
      ],
      concerns: [
        { title: "Thin batting return in indexed sample", body: "The four visible innings in indexed scorecards are still a small and low-output batting sample, so stronger claims would not be grounded yet." },
      ],
      selectionSummary: "Neil Mishra is publicly verifiable as a wicket keeper in the DSCA Rhinos ecosystem, but the currently indexed batting evidence is still limited.",
      battingProfile: "The visible scorecards show short contributions rather than one settled innings, so the public record does not yet support a stronger batting label.",
      dismissalRisk: "This local cache is based on scorecards rather than a full player profile page, so it does not include a dismissal-type breakdown.",
      matchupRead: "The strongest public signal is role clarity as a wicket keeper rather than a clear batting or bowling matchup edge.",
      recommendation: "Use him where wicket-keeping value is the primary reason for selection, and wait for a fuller public batting sample before making bigger claims.",
      dataLimitations: [
        "A clean indexed Neil Mishra player profile page was not available through search, so this local cache is intentionally limited to publicly visible team pages and scorecards.",
        "No bowling or dismissal split is inferred because those details were not publicly exposed in the indexed sources used here.",
      ],
    },
  },
  {
    searchQuery: "Sreehaas Krishna",
    sourceUrl: "https://cricclubs.com/strikersca/viewScorecard.do?clubId=1095791&matchId=1022",
    searchedAt,
    previewMode: "Local verified public CricClubs scorecard sample",
    player: {
      name: "Sreehaas Krishna",
      role: "All Rounder",
      team: "Team Blue / DSCA pathway",
      battingStyle: null,
      bowlingStyle: null,
    },
    stats: {
      matches: 3,
      innings: 3,
      runs: 31,
      battingAverage: 10.33,
      strikeRate: 59.62,
      highestScore: "14",
      notOuts: 0,
      fours: 3,
      sixes: 0,
      ducks: 0,
      wickets: 4,
      bowlingAverage: 13.75,
      economy: 6.11,
      bowlingStrikeRate: 13.5,
      bestBowling: "16/2",
      maidens: 0,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "Indexed Strikers scorecards", matches: 3, runs: 31, battingAverage: 10.33, strikeRate: 59.62, wickets: 4, economy: 6.11 },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Public USA Cricket Junior Pathway and WYCA team pages list Sreehaas Krishna as a verified all rounder and also show him captaining DSCA in a Thanksgiving U15 event.",
        "The local cache uses three indexed Strikers scorecards where he scored 14, 10, and 7 and returned bowling figures including 16/2 and 26/2.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "3", icon: "players", changeLabel: "Indexed scorecard sample", trend: "neutral" },
        { label: "Runs", value: "31", icon: "runs", changeLabel: "HS 14", trend: "neutral" },
        { label: "Bat Avg / SR", value: "10.33 / 59.62", icon: "batting", changeLabel: "Needs more batting sample", trend: "neutral" },
        { label: "Wickets / Econ", value: "4 / 6.11", icon: "bowling", changeLabel: "Visible wicket threat", trend: "up" },
      ],
      strengths: [
        { title: "All-round public footprint", body: "Even with limited indexed scorecards, the public record already shows him contributing with both bat and ball rather than in only one discipline." },
        { title: "Leadership signal", body: "The indexed WYCA team page lists him as DSCA's captain in a 2023 Thanksgiving U15 event, which is a useful contextual signal even if it is not a performance stat." },
      ],
      concerns: [
        { title: "Batting sample is still narrow", body: "Only a small set of indexed innings was available, so stronger batting claims would go beyond what is publicly grounded right now." },
      ],
      selectionSummary: "Sreehaas Krishna is publicly verifiable in the pathway ecosystem and does show genuine all-round contribution, but the indexed sample available through search is still small.",
      battingProfile: "The visible batting returns are modest and do not yet support a strong scoring-tempo claim from public data alone.",
      dismissalRisk: "This local cache is scorecard-based, so it does not expose a complete dismissal-type profile.",
      matchupRead: "The public evidence is stronger on his ability to chip in with wickets than on a fully defined batting matchup profile.",
      recommendation: "Treat as a real pathway all-rounder with visible utility, but keep the confidence level tied to the currently indexed scorecard sample.",
      dataLimitations: [
        "A clean indexed Sreehaas Krishna player profile page was not available through search, so this local cache relies on publicly visible team pages and scorecards only.",
        "Because this is a scorecard sample rather than a full profile export, some career totals remain intentionally unavailable.",
      ],
    },
  },
  {
    searchQuery: "Advay Mandalia",
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewPlayer.do?playerId=1360989&clubId=40319",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 297,
      runs: 2265,
      wickets: 250,
    },
    player: {
      name: "Advay Mandalia",
      role: "All Rounder",
      team: "DSCA Rhinos",
      battingStyle: "Right Handed Batter",
      bowlingStyle: "Right Arm Medium",
    },
    stats: {
      matches: 297,
      innings: null,
      runs: 2265,
      battingAverage: null,
      strikeRate: null,
      highestScore: null,
      notOuts: null,
      fours: null,
      sixes: null,
      ducks: null,
      wickets: 250,
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
      { format: "USA Cricket Junior Pathway", matches: 297, runs: 2265, battingAverage: null, strikeRate: null, wickets: 250, economy: null },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public USA Cricket Junior Pathway player profile for Advay Mandalia shows 297 matches, 2265 runs, and 250 wickets.",
        "The visible profile header lists DSCA Rhinos as current team, All Rounder as role, Right Handed Batter, and Right Arm Medium.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "297", icon: "players", changeLabel: "Full public profile", trend: "up" },
        { label: "Runs", value: "2265", icon: "runs", changeLabel: "Career total", trend: "up" },
        { label: "Bat Avg / SR", value: "Unavailable", icon: "batting", changeLabel: "Need deeper tab extraction", trend: "neutral" },
        { label: "Wickets / Econ", value: "250 / Unavailable", icon: "bowling", changeLabel: "Career total", trend: "up" },
      ],
      strengths: [
        { title: "Large career sample", body: "The public player profile shows a substantial body of work rather than a small scorecard sample, which makes the baseline record much more trustworthy." },
        { title: "True all-round volume", body: "The visible public profile shows both strong run volume and a major wicket total, which is consistent with an all-rounder rather than a specialist-only read." },
      ],
      concerns: [
        { title: "Detailed rate stats still missing", body: "The profile header gives dependable totals, but the current extraction still needs deeper tab parsing for averages, strike rates, and richer split context." },
      ],
      selectionSummary: "Advay Mandalia is publicly verifiable on the USA Cricket Junior Pathway player profile and the career totals support a real all-round contributor with major volume.",
      battingProfile: "The public player profile confirms substantial overall batting volume, although the current extraction still needs the deeper stat tabs for stronger rate-based batting interpretation.",
      dismissalRisk: "The public profile header does not expose a dismissal-type split, so dismissal-pattern claims remain intentionally grounded and limited.",
      matchupRead: "The clear public signal is all-round volume through both runs and wickets, while matchup-specific interpretation still depends on deeper table extraction.",
      recommendation: "Treat him as a genuine all-round profile with strong public career volume, and use the detailed tabs for finer rate and matchup evaluation.",
      dataLimitations: [
        "This local fallback currently preserves the correct public profile totals and identity fields first, even when the live extractor returns a thinner record.",
        "Detailed tab-level averages and split data still depend on stronger parsing of the full public player page.",
      ],
    },
  },
  {
    searchQuery: "Ahan Behera",
    aliases: ["Ahan Behra"],
    sourceUrl: "https://bayareacricket.org/viewPlayer.do?playerId=2257074&clubId=1755",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 271,
      runs: 1220,
      wickets: 197,
    },
    player: {
      name: "Ahan Behera",
      role: "All Rounder",
      team: "Phoenix Yuva",
      battingStyle: "Right Handed Batter",
      bowlingStyle: "Right Arm Medium",
    },
    stats: {
      matches: 271,
      innings: null,
      runs: 1220,
      battingAverage: null,
      strikeRate: null,
      highestScore: null,
      notOuts: null,
      fours: null,
      sixes: null,
      ducks: null,
      wickets: 197,
      bowlingAverage: null,
      economy: null,
      bowlingStrikeRate: null,
      bestBowling: null,
      maidens: null,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public BACA CricClubs player profile page shows Ahan Behera with 271 matches, 1,220 runs, and 197 wickets.",
        "The linked public player page also identifies him as an all rounder for Phoenix Yuva, batting right-handed and bowling right-arm medium.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "271", icon: "players", changeLabel: "Full profile total", trend: "up" },
        { label: "Runs", value: "1220", icon: "runs", changeLabel: "Career public total", trend: "up" },
        { label: "Bat Avg / SR", value: "Unavailable", icon: "batting", changeLabel: "Need full split table", trend: "neutral" },
        { label: "Wickets / Econ", value: "197 / Unavailable", icon: "bowling", changeLabel: "Career wicket total", trend: "up" },
      ],
      strengths: [
        { title: "Large all-round record", body: "The public player profile already shows triple-digit wicket volume alongside more than a thousand runs, which is enough to confirm a real all-round career footprint." },
      ],
      concerns: [
        { title: "Detailed splits still missing", body: "The headline public profile totals are reliable, but the indexed cache still does not expose a clean average, strike-rate, or pathway split table for this player." },
      ],
      selectionSummary: "The public player profile confirms Ahan Behera as a real Phoenix Yuva all-rounder with enough total matches, runs, and wickets to treat him as an established player rather than a small-sample prospect.",
      battingProfile: "The strongest grounded batting signal in this cache is overall career run volume from the public profile page, not a detailed format split.",
      dismissalRisk: "This public profile snapshot does not expose a dismissal-mode table, so no grounded mode-of-dismissal claim is made.",
      matchupRead: "The clearest public signal is broad all-round career value, not a detailed pace-vs-spin or format-specific matchup split.",
      recommendation: "Use the public headline totals as the first selection reference, then layer in competition-specific splits once those are scraped from the direct player tabs.",
      dataLimitations: [
        "This entry is now grounded by a direct public player profile page rather than a short scorecard-only sample.",
        "The search also commonly surfaces the misspelling 'Ahan Behra', which this lookup still supports as an alias.",
      ],
    },
  },
  {
    searchQuery: "Vidit Kwatra",
    sourceUrl: "https://cricclubs.com/CCA/viewPlayer.do?clubId=1146&playerId=2581673",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 336,
      runs: 5408,
      wickets: 270,
    },
    pathwayBatting: null,
    pathwayBowling: null,
    player: {
      name: "Vidit Kwatra",
      role: "Batsman",
      team: "CCA",
      battingStyle: "Right Handed Batter",
      bowlingStyle: null,
    },
    stats: {
      matches: 336,
      innings: null,
      runs: 5408,
      battingAverage: null,
      strikeRate: null,
      highestScore: null,
      notOuts: null,
      fours: null,
      sixes: null,
      ducks: null,
      wickets: 270,
      bowlingAverage: null,
      economy: null,
      bowlingStrikeRate: null,
      bestBowling: null,
      maidens: null,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public CricClubs player profile page shows career totals of 336 matches, 5,408 runs, and 270 wickets.",
        "A complete USA Cricket Junior Pathway tab was not exposed in the indexed public snippet used for this cache.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "336", icon: "players", changeLabel: "Career total", trend: "up" },
        { label: "Runs", value: "5408", icon: "runs", changeLabel: "Public profile total", trend: "up" },
        { label: "Bat Avg / SR", value: "Unavailable", icon: "batting", changeLabel: "Need full tab", trend: "neutral" },
        { label: "Wickets / Econ", value: "270 / Unavailable", icon: "bowling", changeLabel: "Career wicket total", trend: "up" },
      ],
      strengths: [{ title: "Heavy public body of work", body: "The indexed profile already shows a large overall sample, so the main signal here is broad career volume rather than one short competition slice." }],
      concerns: [{ title: "Junior pathway detail missing", body: "The indexed public snippet did not expose the exact USA Cricket Junior Pathway batting and bowling tables for this player." }],
      selectionSummary: "The public CricClubs profile confirms Vidit Kwatra has a large career record, but the junior pathway tab detail is not fully indexed in this cache.",
      battingProfile: "Overall run volume is clearly strong, but the exact pathway-format split is not exposed here.",
      dismissalRisk: "No public dismissal split was exposed in the indexed profile snippet.",
      matchupRead: "The overall profile confirms deep match experience, but matchup detail should wait for the exact pathway tab.",
      recommendation: "Use the public career totals as the grounding layer and add the direct player-profile tab later if you want exact pathway batting and bowling lines.",
      dataLimitations: [
        "This entry is grounded by a full public CricClubs player profile page.",
        "The USA Cricket Junior Pathway batting and bowling tab rows were not fully exposed in the indexed snippet available here.",
      ],
    },
  },
  {
    searchQuery: "Vivaan Jagtiani",
    aliases: ["Vivaan Jagtyanni"],
    sourceUrl: "https://cricclubs.com/SPSCA/viewPlayer.do?clubId=5232&playerId=1514601",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 372,
      runs: 5370,
      wickets: 340,
    },
    pathwayBatting: null,
    pathwayBowling: null,
    player: {
      name: "Vivaan Jagtiani",
      role: "All Rounder",
      team: "SPSCA",
      battingStyle: "Right Handed Batter",
      bowlingStyle: "Right Arm Medium",
    },
    stats: {
      matches: 372,
      innings: null,
      runs: 5370,
      battingAverage: null,
      strikeRate: null,
      highestScore: null,
      notOuts: null,
      fours: null,
      sixes: null,
      ducks: null,
      wickets: 340,
      bowlingAverage: null,
      economy: null,
      bowlingStrikeRate: null,
      bestBowling: null,
      maidens: null,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public CricClubs player profile page shows career totals of 372 matches, 5,370 runs, and 340 wickets.",
        "A complete USA Cricket Junior Pathway tab was not exposed in the indexed public snippet used for this cache.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "372", icon: "players", changeLabel: "Career total", trend: "up" },
        { label: "Runs", value: "5370", icon: "runs", changeLabel: "Public profile total", trend: "up" },
        { label: "Bat Avg / SR", value: "Unavailable", icon: "batting", changeLabel: "Need full tab", trend: "neutral" },
        { label: "Wickets / Econ", value: "340 / Unavailable", icon: "bowling", changeLabel: "Career wicket total", trend: "up" },
      ],
      strengths: [{ title: "Massive career footprint", body: "The indexed profile shows both large run volume and large wicket volume, which is the clearest usable signal from the public page." }],
      concerns: [{ title: "Pathway detail still missing", body: "The exact USA Cricket Junior Pathway batting and bowling tables are not available in the indexed snippet used here." }],
      selectionSummary: "The public CricClubs profile confirms Vivaan Jagtiani as a deep-sample all-round record, but the exact junior pathway tab still needs the direct profile view.",
      battingProfile: "The overall profile supports a genuine all-round career record rather than a short sample.",
      dismissalRisk: "No public dismissal split was exposed in the indexed profile snippet.",
      matchupRead: "The public signal is broad all-round production, not a specific pathway matchup split.",
      recommendation: "Use the full career totals now and add pathway tab extraction later if you need the exact junior-only line.",
      dataLimitations: [
        "This entry is grounded by a full public CricClubs player profile page.",
        "The USA Cricket Junior Pathway batting and bowling tab rows were not fully exposed in the indexed snippet available here.",
      ],
    },
  },
  {
    searchQuery: "Krishang Naikar",
    aliases: ["Krishaang Naikar"],
    sourceUrl: "https://cricclubs.com/CCA/viewPlayer.do?clubId=1146&playerId=822265",
    searchedAt,
    previewMode: "Local verified public CricClubs profile",
    careerTotals: {
      matches: 204,
      runs: 3305,
      wickets: 9,
    },
    pathwayBatting: null,
    pathwayBowling: null,
    player: {
      name: "Krishang Naikar",
      role: "Batsman",
      team: "CCA",
      battingStyle: "Right Handed Batter",
      bowlingStyle: null,
    },
    stats: {
      matches: 204,
      innings: null,
      runs: 3305,
      battingAverage: null,
      strikeRate: null,
      highestScore: null,
      notOuts: null,
      fours: null,
      sixes: null,
      ducks: null,
      wickets: 9,
      bowlingAverage: null,
      economy: null,
      bowlingStrikeRate: null,
      bestBowling: null,
      maidens: null,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "The public CricClubs player profile page shows career totals of 204 matches, 3,305 runs, and 9 wickets.",
        "A complete USA Cricket Junior Pathway tab was not exposed in the indexed public snippet used for this cache.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "204", icon: "players", changeLabel: "Career total", trend: "up" },
        { label: "Runs", value: "3305", icon: "runs", changeLabel: "Public profile total", trend: "up" },
        { label: "Bat Avg / SR", value: "Unavailable", icon: "batting", changeLabel: "Need full tab", trend: "neutral" },
        { label: "Wickets / Econ", value: "9 / Unavailable", icon: "bowling", changeLabel: "Secondary skill only", trend: "neutral" },
      ],
      strengths: [{ title: "Career batting volume", body: "The strongest public signal is overall batting volume across more than 200 recorded matches." }],
      concerns: [{ title: "Limited pathway exposure in cache", body: "The public indexed snippet does not include the exact USA Cricket Junior Pathway batting and bowling rows for this player." }],
      selectionSummary: "The public CricClubs profile confirms Krishang Naikar as a high-volume batting record, but the exact pathway tab is not yet captured here.",
      battingProfile: "The overall record leans batting-first based on the public totals currently exposed.",
      dismissalRisk: "No public dismissal split was exposed in the indexed profile snippet.",
      matchupRead: "The available public record is better for broad batting volume than detailed junior-pathway matchup work.",
      recommendation: "Use the public career totals for identification and wait for the direct pathway tab if you need junior-only precision.",
      dataLimitations: [
        "This entry is grounded by a full public CricClubs player profile page.",
        "The USA Cricket Junior Pathway batting and bowling tab rows were not fully exposed in the indexed snippet available here.",
      ],
    },
  },
];

export const COMPLETE_LOCAL_PREVIEW_PLAYERS = LOCAL_PREVIEW_PLAYERS.filter(
  (player) => player.previewMode?.includes("public CricClubs profile") ?? false,
);

export const SUPPORTED_ANALYTICS_PLAYERS = LOCAL_PREVIEW_PLAYERS;

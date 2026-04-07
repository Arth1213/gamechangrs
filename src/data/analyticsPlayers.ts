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

export interface CricClubsAnalyticsResponse {
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

export interface LocalPreviewPlayer extends CricClubsAnalyticsResponse {
  aliases?: string[];
}

const searchedAt = new Date().toISOString();

export const LOCAL_PREVIEW_PLAYERS: LocalPreviewPlayer[] = [
  {
    searchQuery: "Arth Arun",
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewTeam.do?clubId=40319&teamId=1688",
    searchedAt,
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
      { format: "U15 Phase 1", matches: 3, runs: 54, battingAverage: 54, strikeRate: 120, wickets: null, economy: null },
      { format: "U15 Preseason", matches: 2, runs: null, battingAverage: null, strikeRate: null, wickets: null, economy: null },
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
        "Public USA Cricket Junior Pathway profile lists Naman Patil as a verified Bay Area - Warriors all rounder.",
        "The indexed 1 Day pathway table shows 1,003 runs at 45.59 average and 104.81 strike rate, plus 43 wickets at 3.76 economy.",
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
        "Public USA Cricket Junior Pathway profile lists Arjun Shah as a verified DSCA Rhinos all rounder.",
        "The indexed 1 Day pathway table shows 435 runs with a highest score of 146, alongside 19 wickets at 3.35 economy.",
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
        "Public team pages across USA Cricket Junior Pathway, BACA, NCCA, and tournament pages consistently list Neil Mishra as a verified wicket keeper.",
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
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewScorecard.do?clubId=40319&matchId=4404",
    searchedAt,
    previewMode: "Local verified public CricClubs scorecard sample",
    player: {
      name: "Advay Mandalia",
      role: "All Rounder",
      team: "DSCA Rhinos / Bay Area pathway",
      battingStyle: null,
      bowlingStyle: null,
    },
    stats: {
      matches: 4,
      innings: 4,
      runs: 93,
      battingAverage: 31,
      strikeRate: 79.49,
      highestScore: "30*",
      notOuts: 1,
      fours: 8,
      sixes: 1,
      ducks: 0,
      wickets: 1,
      bowlingAverage: 42,
      economy: 3.23,
      bowlingStrikeRate: 78,
      bestBowling: "23/1",
      maidens: 0,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "Indexed pathway scorecards", matches: 4, runs: 93, battingAverage: 31, strikeRate: 79.49, wickets: 1, economy: 3.23 },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Public USA Cricket Junior Pathway and youth team pages list Advay Mandalia as a verified all rounder in Bay Area pathway teams.",
        "The local cache uses indexed scorecards that expose innings of 30*, 28, 21, and 14, plus visible bowling contributions in pathway matches.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "4", icon: "players", changeLabel: "Indexed scorecard sample", trend: "neutral" },
        { label: "Runs", value: "93", icon: "runs", changeLabel: "HS 30*", trend: "up" },
        { label: "Bat Avg / SR", value: "31.00 / 79.49", icon: "batting", changeLabel: "Healthy sample start", trend: "up" },
        { label: "Wickets / Econ", value: "1 / 3.23", icon: "bowling", changeLabel: "Low-cost overs", trend: "neutral" },
      ],
      strengths: [
        { title: "Useful middle-order scoring", body: "The visible scorecards show repeated contributions rather than one isolated innings, which is a positive sign even before a full profile page is available." },
      ],
      concerns: [
        { title: "Bowling sample is incomplete", body: "Some indexed scorecards show overs and economy, but not enough complete bowling history was exposed to make a stronger wicket-taking claim." },
      ],
      selectionSummary: "Advay Mandalia is publicly verifiable in the Bay Area pathway search footprint and the visible scorecards support him as a real all-round contributor.",
      battingProfile: "The indexed innings suggest a player who can build 20-to-30 run contributions with moderate tempo instead of only cameo batting.",
      dismissalRisk: "This cache is built from scorecards rather than a fully indexed player profile, so dismissal-pattern claims are intentionally omitted.",
      matchupRead: "The clearest public signal is batting repeatability in the visible sample, while the bowling evidence currently reads more as support overs than a primary attack role.",
      recommendation: "Keep him in consideration as a balanced all-round option and reassess once a fuller public profile becomes easier to index.",
      dataLimitations: [
        "A clean indexed Advay Mandalia player profile page was not available through search, so this local cache uses publicly visible team pages and scorecards only.",
        "The bowling line here reflects only the visible indexed scorecards, not a full career extraction.",
      ],
    },
  },
  {
    searchQuery: "Ahan Behera",
    aliases: ["Ahan Behra"],
    sourceUrl: "https://cricclubs.com/USACricketJunior/viewScorecard.do?clubId=40319&matchId=4404",
    searchedAt,
    previewMode: "Local verified public CricClubs scorecard sample",
    player: {
      name: "Ahan Behera",
      role: "All Rounder",
      team: "DSCA Rhinos / Bay Area pathway",
      battingStyle: null,
      bowlingStyle: null,
    },
    stats: {
      matches: 4,
      innings: 4,
      runs: 53,
      battingAverage: 26.5,
      strikeRate: 60.23,
      highestScore: "24",
      notOuts: 2,
      fours: 3,
      sixes: 0,
      ducks: 0,
      wickets: 5,
      bowlingAverage: 16.8,
      economy: 4,
      bowlingStrikeRate: 25.2,
      bestBowling: "33/2",
      maidens: 0,
      catches: null,
      stumpings: null,
      runOuts: null,
    },
    formatSplits: [
      { format: "Indexed pathway scorecards", matches: 4, runs: 53, battingAverage: 26.5, strikeRate: 60.23, wickets: 5, economy: 4 },
    ],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes: [
        "Public USA Cricket Junior Pathway, WYCA, and other youth team pages list Ahan Behera as a verified all rounder.",
        "The local cache uses indexed scorecards that expose innings of 24, 16*, 10, and 3*, plus a visible bowling sample of 5 wickets across those pathway matches.",
      ],
    },
    derived: {
      summaryCards: [
        { label: "Matches", value: "4", icon: "players", changeLabel: "Indexed scorecard sample", trend: "neutral" },
        { label: "Runs", value: "53", icon: "runs", changeLabel: "HS 24", trend: "neutral" },
        { label: "Bat Avg / SR", value: "26.50 / 60.23", icon: "batting", changeLabel: "Finishing value", trend: "neutral" },
        { label: "Wickets / Econ", value: "5 / 4.00", icon: "bowling", changeLabel: "Clear all-round signal", trend: "up" },
      ],
      strengths: [
        { title: "Two-way contribution", body: "The visible public scorecards show both unbeaten batting contributions and a real wicket-taking sample, which is enough to call him a genuine all-round contributor." },
      ],
      concerns: [
        { title: "Still a sampled view", body: "Without a full indexed player profile page, these numbers are grounded but still only represent the visible scorecards rather than a complete history." },
      ],
      selectionSummary: "Ahan Behera is publicly verifiable in Bay Area pathway team pages and the indexed scorecards show real two-skill value rather than one-off involvement.",
      battingProfile: "The visible innings lean more toward support and finishing value than heavy top-order run volume, but the not-out pattern is still useful.",
      dismissalRisk: "This scorecard-based cache does not expose enough dismissal information to make a grounded mode-of-dismissal claim.",
      matchupRead: "The strongest public signal is his ability to add low-cost overs while still contributing with the bat, which helps balance a pathway XI.",
      recommendation: "Keep him in the all-round conversation, especially when the side needs another bowler who can still hold a chase or lower-middle-order role together.",
      dataLimitations: [
        "A clean indexed Ahan Behera player profile page was not available through search, so this local cache uses publicly visible team pages and scorecards only.",
        "The search also commonly surfaces the misspelling 'Ahan Behra', which this local lookup now supports as an alias.",
      ],
    },
  },
];

export const COMPLETE_LOCAL_PREVIEW_PLAYERS = LOCAL_PREVIEW_PLAYERS.filter(
  (player) => player.previewMode?.includes("public CricClubs profile") ?? false,
);

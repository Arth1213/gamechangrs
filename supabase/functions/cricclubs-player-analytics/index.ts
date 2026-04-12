import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query?: string;
  clubHint?: string | null;
}

interface ExtractedPlayerData {
  matchedPlayer: boolean;
  careerTotals?: {
    matches: number | null;
    runs: number | null;
    wickets: number | null;
  } | null;
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
  formatSplits: {
    format: string;
    matches: number | null;
    runs: number | null;
    battingAverage: number | null;
    strikeRate: number | null;
    wickets: number | null;
    economy: number | null;
  }[];
  explicitInsights: {
    dismissalPatterns: string[];
    bowlerTypeNotes: string[];
    groundingNotes: string[];
  };
}

interface SummaryCard {
  label: string;
  value: string;
  icon: "players" | "runs" | "batting" | "bowling";
  changeLabel: string;
  trend: "up" | "down" | "neutral";
}

interface DerivedInsight {
  title: string;
  body: string;
}

const BOT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://duckduckgo.com/",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getNameOverlap(searchName: string, candidateName: string | null) {
  if (!candidateName) return 0;

  const searchTokens = new Set(normalizeName(searchName).split(" ").filter((token) => token.length > 1));
  const candidateTokens = new Set(
    normalizeName(candidateName).split(" ").filter((token) => token.length > 1),
  );

  if (searchTokens.size === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of searchTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / searchTokens.size;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDuckDuckGoHref(href: string) {
  try {
    if (href.startsWith("//")) {
      href = `https:${href}`;
    }

    const parsed = new URL(href);
    const redirected = parsed.searchParams.get("uddg");
    if (redirected) {
      return decodeURIComponent(redirected);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function extractLinksFromDuckDuckGo(html: string) {
  const urls = new Set<string>();
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const decoded = decodeDuckDuckGoHref(match[1]);
    if (!decoded) continue;
    if (!/viewPlayer\.do|viewLeague\.do|viewTeams\.do|viewTeam\.do|ranking|player|batting|bowling/i.test(decoded)) continue;
    urls.add(decoded);
  }

  return Array.from(urls);
}

function isUsaJuniorPathwayHint(value: string | null | undefined) {
  if (!value) return false;

  return /usa|usac|junior|pathway|hub|u-?11|u-?13|u-?15|u-?19/i.test(value);
}

function isUsaJuniorPathwayU15Hint(value: string | null | undefined) {
  if (!value) return false;

  return /usa|usac|junior|pathway|hub|u-?15/i.test(value);
}

function buildSearchTerms(playerName: string, clubHint?: string | null) {
  const trimmedHint = clubHint?.trim();
  const terms = new Set<string>();

  terms.add(`site:cricclubs.com/viewPlayer.do "${playerName}"`);
  terms.add(`site:cricclubs.com "${playerName}" CricClubs player`);
  terms.add(`site:cricclubs.com ${playerName} CricClubs cricket`);
  terms.add(`"${playerName}" "viewPlayer.do" cricket`);
  terms.add(`"${playerName}" "Powered by CricClubs"`);
  terms.add(`"${playerName}" "CC Player ID"`);

  if (trimmedHint) {
    terms.add(`site:cricclubs.com/viewPlayer.do "${playerName}" "${trimmedHint}"`);
    terms.add(`site:cricclubs.com "${playerName}" "${trimmedHint}" CricClubs`);
    terms.add(`site:cricclubs.com ${playerName} ${trimmedHint} CricClubs cricket`);
    terms.add(`"${playerName}" "${trimmedHint}" "viewPlayer.do"`);
    terms.add(`"${playerName}" "${trimmedHint}" "Powered by CricClubs"`);
  }

  if (isUsaJuniorPathwayHint(trimmedHint)) {
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}"`);
    terms.add(`site:cricclubs.com/USACricketJunior ${playerName} ${trimmedHint ?? ""}`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" "USA Cricket Junior Pathway"`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" U15`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" hub`);
  }

  if (isUsaJuniorPathwayU15Hint(trimmedHint)) {
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" "U15 Phase 1"`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" "U15 Phase 2"`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" "playerRankings"`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" "battingRecords"`);
    terms.add(`site:cricclubs.com/USACricketJunior "${playerName}" "viewTeam.do"`);
  }

  return Array.from(terms);
}

async function fetchDuckDuckGoResults(query: string) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: BOT_HEADERS });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed with ${response.status}`);
  }

  return await response.text();
}

async function searchCricClubsProfiles(playerName: string, clubHint?: string | null) {
  const found = new Set<string>();
  const searchTerms = buildSearchTerms(playerName, clubHint);

  for (const term of searchTerms) {
    const html = await fetchDuckDuckGoResults(term.trim());
    const links = extractLinksFromDuckDuckGo(html);

    for (const link of links) {
      found.add(link);
    }

    if (found.size >= 5) {
      break;
    }
  }

  if (found.size === 0 && clubHint) {
    for (const term of buildSearchTerms(playerName, null)) {
      const html = await fetchDuckDuckGoResults(term.trim());
      const links = extractLinksFromDuckDuckGo(html);

      for (const link of links) {
        found.add(link);
      }

      if (found.size >= 5) {
        break;
      }
    }
  }

  return Array.from(found).slice(0, 5);
}

async function fetchPageText(url: string) {
  const response = await fetch(url, { headers: BOT_HEADERS });

  if (!response.ok) {
    throw new Error(`Profile fetch failed with ${response.status}`);
  }

  const html = await response.text();
  return stripHtml(html).slice(0, 16000);
}

function extractNumberAfterLabel(pageText: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const match = pageText.match(regex);
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }

  return null;
}

function extractTextAfterLabel(pageText: string, labels: string[], maxLength = 40) {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:\\-]?\\s*([A-Za-z0-9/().,&\\-\\s]{1,${maxLength}})`, "i");
    const match = pageText.match(regex);
    if (match) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function extractPlayerName(pageText: string, searchName: string) {
  const exactRegex = new RegExp(`\\b(${searchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "i");
  const exactMatch = pageText.match(exactRegex);
  if (exactMatch) {
    return exactMatch[1].trim();
  }

  return searchName.trim();
}

async function extractPlayerDataFromText(
  searchName: string,
  url: string,
  pageText: string,
): Promise<ExtractedPlayerData> {
  const normalizedText = normalizeName(pageText);
  const normalizedSearch = normalizeName(searchName);
  const matchedPlayer = normalizedText.includes(normalizedSearch);

  const playerName = extractPlayerName(pageText, searchName);
  const team =
    extractTextAfterLabel(pageText, ["Current Team", "Team", "Club"], 60) ||
    (url.includes("USACricketJunior") ? "USA Cricket Junior Pathway" : null);
  const battingStyle = extractTextAfterLabel(pageText, ["Batting Style", "Batting"], 40);
  const bowlingStyle = extractTextAfterLabel(pageText, ["Bowling Style", "Bowling"], 40);
  const role = extractTextAfterLabel(pageText, ["Playing Role", "Role"], 32);

  const stats = {
    matches: extractNumberAfterLabel(pageText, ["Matches", "Match"]),
    innings: extractNumberAfterLabel(pageText, ["Innings", "Inns"]),
    runs: extractNumberAfterLabel(pageText, ["Runs"]),
    battingAverage: extractNumberAfterLabel(pageText, ["Bat Avg", "Average", "Avg"]),
    strikeRate: extractNumberAfterLabel(pageText, ["Strike Rate", "SR"]),
    highestScore: extractTextAfterLabel(pageText, ["Highest Score", "High Score", "HS"], 12),
    notOuts: extractNumberAfterLabel(pageText, ["Not Outs", "NO"]),
    fours: extractNumberAfterLabel(pageText, ["Fours", "4s"]),
    sixes: extractNumberAfterLabel(pageText, ["Sixes", "6s"]),
    ducks: extractNumberAfterLabel(pageText, ["Ducks"]),
    wickets: extractNumberAfterLabel(pageText, ["Wickets", "Wkts"]),
    bowlingAverage: extractNumberAfterLabel(pageText, ["Bowl Avg", "Bowling Average"]),
    economy: extractNumberAfterLabel(pageText, ["Economy", "Econ"]),
    bowlingStrikeRate: extractNumberAfterLabel(pageText, ["Bowling Strike Rate", "Bowl SR"]),
    bestBowling: extractTextAfterLabel(pageText, ["Best Bowling", "BBF"], 16),
    maidens: extractNumberAfterLabel(pageText, ["Maidens"]),
    catches: extractNumberAfterLabel(pageText, ["Catches"]),
    stumpings: extractNumberAfterLabel(pageText, ["Stumpings"]),
    runOuts: extractNumberAfterLabel(pageText, ["Run Outs", "Runouts"]),
  };

  const groundingNotes = [
    `Public CricClubs page matched for ${playerName}.`,
    url.includes("USACricketJunior")
      ? "Source is inside the USA Cricket Junior Pathway CricClubs site."
      : "Source is a public CricClubs page discovered through web search.",
  ];

  if (stats.runs !== null) {
    groundingNotes.push(`Visible public batting output includes ${stats.runs} runs.`);
  }
  if (stats.matches !== null) {
    groundingNotes.push(`Visible public sample includes ${stats.matches} matches.`);
  }

  return {
    matchedPlayer,
    careerTotals: {
      matches: stats.matches,
      runs: stats.runs,
      wickets: stats.wickets,
    },
    player: {
      name: playerName,
      role,
      team,
      battingStyle,
      bowlingStyle,
    },
    stats,
    formatSplits: [],
    explicitInsights: {
      dismissalPatterns: [],
      bowlerTypeNotes: [],
      groundingNotes,
    },
  };
}

function formatMetric(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "Unavailable";
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(digits);
}

function buildBoundaryProfile(fours: number | null, sixes: number | null) {
  if (fours === null && sixes === null) {
    return "Boundary profile is not exposed on the public page.";
  }

  if ((fours ?? 0) === 0 && (sixes ?? 0) === 0) {
    return "No clear boundary output is visible from the public summary.";
  }

  if ((fours ?? 0) >= (sixes ?? 0) * 3) {
    return "Boundary profile leans more ground-based than aerial, with fours clearly outweighing sixes.";
  }

  if ((sixes ?? 0) > (fours ?? 0)) {
    return "Boundary profile shows more aerial intent than ground accumulation.";
  }

  return "Boundary profile is mixed across fours and sixes.";
}

function bestFormat(formatSplits: ExtractedPlayerData["formatSplits"]) {
  const battingFormats = formatSplits.filter(
    (item) => item.battingAverage !== null || item.strikeRate !== null || item.runs !== null,
  );

  if (battingFormats.length === 0) {
    return null;
  }

  return battingFormats.slice().sort((a, b) => {
    const aScore = (a.battingAverage ?? 0) * 2 + (a.strikeRate ?? 0) / 3 + (a.runs ?? 0) / 20;
    const bScore = (b.battingAverage ?? 0) * 2 + (b.strikeRate ?? 0) / 3 + (b.runs ?? 0) / 20;
    return bScore - aScore;
  })[0];
}

function buildDerivedAnalytics(extracted: ExtractedPlayerData) {
  const { stats, formatSplits, explicitInsights } = extracted;
  const strengths: DerivedInsight[] = [];
  const concerns: DerivedInsight[] = [];
  const dataLimitations: string[] = [];

  if (stats.battingAverage !== null) {
    if (stats.battingAverage >= 40) {
      strengths.push({
        title: "Consistency",
        body: `Batting average of ${formatMetric(stats.battingAverage)} suggests repeatable run production rather than one-off innings.`,
      });
    } else if (stats.battingAverage < 20) {
      concerns.push({
        title: "Conversion Risk",
        body: `Batting average of ${formatMetric(stats.battingAverage)} points to inconsistent returns and more frequent low scores.`,
      });
    }
  } else {
    dataLimitations.push("Batting average was not visible on the public CricClubs page.");
  }

  if (stats.strikeRate !== null) {
    if (stats.strikeRate >= 130) {
      strengths.push({
        title: "Tempo",
        body: `Strike rate of ${formatMetric(stats.strikeRate)} indicates the player can score at a strong tempo when set.`,
      });
    } else if (stats.strikeRate < 90) {
      concerns.push({
        title: "Scoring Pressure",
        body: `Strike rate of ${formatMetric(stats.strikeRate)} suggests the player may need protection if rapid acceleration is required.`,
      });
    }
  } else {
    dataLimitations.push("Strike rate was not visible on the public CricClubs page.");
  }

  if (stats.ducks !== null && stats.innings !== null && stats.innings > 0) {
    const duckRate = stats.ducks / stats.innings;
    if (duckRate >= 0.18) {
      concerns.push({
        title: "Early Wicket Exposure",
        body: `${stats.ducks} ducks across ${stats.innings} innings points to a meaningful early-dismissal risk.`,
      });
    }
  } else {
    dataLimitations.push("Dismissal distribution was not exposed cleanly enough to quantify early wicket risk.");
  }

  if (stats.wickets !== null) {
    if (stats.wickets >= 15) {
      strengths.push({
        title: "Secondary Bowling Value",
        body: `${stats.wickets} wickets give the player genuine bowling contribution on top of batting output.`,
      });
    }
  }

  if (stats.economy !== null) {
    if (stats.economy <= 6) {
      strengths.push({
        title: "Run Control",
        body: `Economy of ${formatMetric(stats.economy)} supports using the player in control or holding phases.`,
      });
    } else if (stats.economy >= 9) {
      concerns.push({
        title: "Leak Rate",
        body: `Economy of ${formatMetric(stats.economy)} suggests bowling value should be used carefully in pressure overs.`,
      });
    }
  }

  const boundaryProfile = buildBoundaryProfile(stats.fours, stats.sixes);
  const strongestFormat = bestFormat(formatSplits);

  const battingProfileParts = [];
  if (stats.battingAverage !== null) {
    battingProfileParts.push(`average ${formatMetric(stats.battingAverage)}`);
  }
  if (stats.strikeRate !== null) {
    battingProfileParts.push(`strike rate ${formatMetric(stats.strikeRate)}`);
  }
  if (stats.highestScore) {
    battingProfileParts.push(`best visible score ${stats.highestScore}`);
  }

  const battingProfile = battingProfileParts.length > 0
    ? `The public batting output shows ${battingProfileParts.join(", ")}. ${boundaryProfile}`
    : "The public page did not expose enough batting fields to build a reliable batting profile.";

  const dismissalRisk =
    explicitInsights.dismissalPatterns.length > 0
      ? explicitInsights.dismissalPatterns.join(" ")
      : "This public CricClubs profile did not expose a reliable dismissal-mode breakdown, so there is no grounded answer yet on how the player gets out most often.";

  const matchupRead =
    explicitInsights.bowlerTypeNotes.length > 0
      ? explicitInsights.bowlerTypeNotes.join(" ")
      : "This public CricClubs profile does not expose a trustworthy split by bowler type, so no grounded claim is made about pace-vs-spin or left-arm-vs-right-arm matchups.";

  let selectionSummary = "Public CricClubs data was found, but the profile is thin, so use this as a supporting scouting layer rather than a full selection decision.";

  if (stats.battingAverage !== null && stats.strikeRate !== null) {
    if (stats.battingAverage >= 35 && stats.strikeRate >= 120) {
      selectionSummary =
        "The public profile supports selection as a stable top-order or middle-order batting option who can combine run production with workable tempo.";
    } else if (stats.battingAverage >= 35) {
      selectionSummary =
        "The public profile supports selection primarily for stability and innings-building rather than pure acceleration.";
    } else if (stats.strikeRate >= 130) {
      selectionSummary =
        "The public profile supports selection for tempo and pressure-release hitting, with less evidence of long-innings consistency.";
    }
  }

  if (strongestFormat) {
    selectionSummary += ` Best visible format signal: ${strongestFormat.format}.`;
  }

  const recommendation =
    strengths.length > concerns.length
      ? "Use this player where run production or dual-skill contribution matters, but keep decisions anchored to the competition level behind these public stats."
      : "Use this player with role clarity and matchup protection until stronger public evidence supports a bigger selection load.";

  const summaryCards: SummaryCard[] = [
    {
      label: "Matches",
      value: formatMetric(stats.matches, 0),
      icon: "players",
      changeLabel: stats.matches && stats.matches >= 20 ? "Solid sample" : "Small sample",
      trend: stats.matches && stats.matches >= 20 ? "up" : "neutral",
    },
    {
      label: "Runs",
      value: formatMetric(stats.runs, 0),
      icon: "runs",
      changeLabel: stats.highestScore ? `HS ${stats.highestScore}` : "No high score shown",
      trend: stats.runs && stats.runs >= 500 ? "up" : "neutral",
    },
    {
      label: "Bat Avg / SR",
      value:
        stats.battingAverage !== null || stats.strikeRate !== null
          ? `${formatMetric(stats.battingAverage)} / ${formatMetric(stats.strikeRate)}`
          : "Unavailable",
      icon: "batting",
      changeLabel:
        stats.battingAverage !== null && stats.battingAverage >= 35
          ? "Stable output"
          : "Needs more proof",
      trend:
        stats.battingAverage !== null && stats.battingAverage >= 35 ? "up" : "neutral",
    },
    {
      label: "Wickets / Econ",
      value:
        stats.wickets !== null || stats.economy !== null
          ? `${formatMetric(stats.wickets, 0)} / ${formatMetric(stats.economy)}`
          : "Unavailable",
      icon: "bowling",
      changeLabel:
        stats.economy !== null && stats.economy <= 6 ? "Control value" : "Support skill",
      trend: stats.economy !== null && stats.economy <= 6 ? "up" : "neutral",
    },
  ];

  if (explicitInsights.dismissalPatterns.length === 0) {
    dataLimitations.push("Dismissal tendencies were not directly available from the public player page.");
  }
  if (explicitInsights.bowlerTypeNotes.length === 0) {
    dataLimitations.push("Bowler-type matchup insight is unavailable unless CricClubs exposes that split publicly.");
  }
  if (formatSplits.length === 0) {
    dataLimitations.push("Format split tables were not visible or were too incomplete to trust.");
  }
  if (explicitInsights.groundingNotes.length === 0) {
    dataLimitations.push("Grounding notes are empty because the profile text did not surface extra descriptive detail.");
  }

  return {
    summaryCards,
    strengths,
    concerns,
    selectionSummary,
    battingProfile,
    dismissalRisk,
    matchupRead,
    recommendation,
    dataLimitations,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, clubHint }: SearchRequest = await req.json();
    const trimmedQuery = query?.trim();

    if (!trimmedQuery || trimmedQuery.length < 3) {
      return jsonResponse({ error: "A player search query with at least 3 characters is required." }, 400);
    }

    const candidateUrls = await searchCricClubsProfiles(trimmedQuery, clubHint);
    if (candidateUrls.length === 0) {
      return jsonResponse(
        { error: clubHint ? "No public CricClubs player pages were found for that league hint or query." : "No public CricClubs player pages were found for that search." },
        404,
      );
    }

    let bestResult:
      | {
          sourceUrl: string;
          extracted: ExtractedPlayerData;
          overlap: number;
        }
      | null = null;

    for (const sourceUrl of candidateUrls) {
      try {
        const pageText = await fetchPageText(sourceUrl);
        if (pageText.length < 400) {
          continue;
        }

        const extracted = await extractPlayerDataFromText(
          trimmedQuery,
          sourceUrl,
          pageText,
        );

        const overlap =
          getNameOverlap(trimmedQuery, extracted.player.name) +
          (sourceUrl.includes("viewPlayer.do") ? 0.15 : 0);
        if (!bestResult || overlap > bestResult.overlap) {
          bestResult = { sourceUrl, extracted, overlap };
        }

        if (extracted.matchedPlayer && overlap >= 0.5) {
          bestResult = { sourceUrl, extracted, overlap };
          break;
        }
      } catch (candidateError) {
        console.error("Candidate analysis failed:", sourceUrl, candidateError);
      }
    }

    if (!bestResult || !bestResult.extracted.player.name) {
      return jsonResponse(
        { error: "A CricClubs result was found, but the player profile could not be verified." },
        404,
      );
    }

    const derived = buildDerivedAnalytics(bestResult.extracted);

    return jsonResponse({
      searchQuery: trimmedQuery,
      sourceUrl: bestResult.sourceUrl,
      searchedAt: new Date().toISOString(),
      ...bestResult.extracted,
      derived,
    });
  } catch (error) {
    console.error("cricclubs-player-analytics failed:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to load CricClubs analytics.",
      },
      500,
    );
  }
});

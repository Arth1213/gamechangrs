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
  pathwayBatting?: {
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
  } | null;
  pathwayBowling?: {
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

function getNameTokens(value: string) {
  return normalizeName(value).split(" ").filter((token) => token.length > 1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCandidateNameScore(searchName: string, candidateName: string | null) {
  if (!candidateName) return 0;

  const searchTokens = getNameTokens(searchName);
  const candidateTokens = getNameTokens(candidateName);
  if (searchTokens.length === 0 || candidateTokens.length === 0) return 0;

  const firstCandidate = candidateTokens[0] ?? "";
  const lastCandidate = candidateTokens[candidateTokens.length - 1] ?? "";

  if (searchTokens.length === 1) {
    const token = searchTokens[0];
    return token === firstCandidate || token === lastCandidate ? 0.92 : 0;
  }

  const firstQuery = searchTokens[0] ?? "";
  const lastQuery = searchTokens[searchTokens.length - 1] ?? "";
  const firstMatches = firstCandidate === firstQuery || firstCandidate.startsWith(firstQuery) || firstQuery.startsWith(firstCandidate);
  const lastMatches = lastCandidate === lastQuery || lastCandidate.startsWith(lastQuery) || lastQuery.startsWith(lastCandidate);
  const prefixTokenMatches = searchTokens.filter((token) =>
    candidateTokens.some((candidateToken) => candidateToken.startsWith(token) || token.startsWith(candidateToken))
  ).length;
  const exactTokenMatches = searchTokens.filter((token) => candidateTokens.includes(token)).length;

  if (!firstMatches || !lastMatches || prefixTokenMatches !== searchTokens.length) {
    return 0;
  }

  return Math.max(
    0.84 + (exactTokenMatches / searchTokens.length) * 0.14,
    0.82 + (prefixTokenMatches / searchTokens.length) * 0.12,
  );
}

function getNameOverlap(searchName: string, candidateName: string | null) {
  if (!candidateName) return 0;
  const searchTokens = new Set(getNameTokens(searchName));
  const candidateTokens = new Set(getNameTokens(candidateName));
  if (searchTokens.size === 0 || candidateTokens.size === 0) return 0;
  let matches = 0;
  for (const token of searchTokens) {
    if (candidateTokens.has(token)) matches += 1;
  }
  return matches / searchTokens.size;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extract viewPlayer.do links from any HTML search results page
function extractViewPlayerLinks(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  // Match any href containing viewPlayer.do
  const hrefRegex = /href="([^"]*viewPlayer\.do[^"]*)"/gi;
  for (const match of html.matchAll(hrefRegex)) {
    let url = match[1];
    // Handle Google redirect URLs
    if (url.includes("/url?")) {
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https://www.google.com${url}`);
        const q = parsed.searchParams.get("q") || parsed.searchParams.get("url");
        if (q && q.includes("viewPlayer.do")) url = q;
      } catch { /* skip */ }
    }
    // Handle DuckDuckGo redirect URLs
    if (url.includes("uddg=")) {
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https:${url}`);
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) url = decodeURIComponent(uddg);
      } catch { /* skip */ }
    }
    if (!url.startsWith("http")) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

// Also extract general CricClubs links as fallback
function extractCricClubsLinks(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const hrefRegex = /href="([^"]*(?:cricclubs\.com|cricclubs)[^"]*)"/gi;
  for (const match of html.matchAll(hrefRegex)) {
    let url = match[1];
    if (url.includes("/url?")) {
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https://www.google.com${url}`);
        const q = parsed.searchParams.get("q") || parsed.searchParams.get("url");
        if (q) url = q;
      } catch { /* skip */ }
    }
    if (url.includes("uddg=")) {
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https:${url}`);
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) url = decodeURIComponent(uddg);
      } catch { /* skip */ }
    }
    if (!url.startsWith("http")) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

// Build broad search queries - plain name first, then progressively more specific
function buildSearchQueries(playerName: string, clubHint?: string | null): string[] {
  const queries: string[] = [];
  
  // 1. Broadest: plain name + cricclubs
  queries.push(`"${playerName}" cricclubs viewPlayer`);
  queries.push(`"${playerName}" site:cricclubs.com`);
  queries.push(`"${playerName}" viewPlayer.do cricket`);
  
  // 2. With common CricClubs sub-sites
  queries.push(`"${playerName}" cricclubs.com viewPlayer.do`);
  
  // 3. Club hint queries
  if (clubHint?.trim()) {
    const hint = clubHint.trim();
    queries.push(`"${playerName}" "${hint}" viewPlayer.do`);
    queries.push(`"${playerName}" "${hint}" cricclubs`);
    if (/\.[a-z]{2,}$/i.test(hint)) {
      queries.push(`"${playerName}" site:${hint}`);
    }
  }
  
  // 4. Broader fallbacks
  queries.push(`"${playerName}" cricket player profile cricclubs`);
  queries.push(`${playerName} cricclubs player`);
  
  return queries;
}

// Firecrawl search - returns array of result URLs
async function firecrawlSearch(query: string, apiKey: string): Promise<string[]> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 10 }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Firecrawl search returned ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const results = data?.data ?? [];
  return results.map((r: { url?: string }) => r.url).filter((u: unknown): u is string => typeof u === "string");
}

async function searchCricClubsProfiles(playerName: string, clubHint?: string | null): Promise<{ urls: string[]; triedQueries: string[] }> {
  const found = new Set<string>();
  const playerProfileUrls = new Set<string>();
  const triedQueries: string[] = [];
  const queries = buildSearchQueries(playerName, clubHint);

  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not configured");
  }

  for (const query of queries) {
    triedQueries.push(query);
    try {
      const urls = await firecrawlSearch(query, FIRECRAWL_API_KEY);
    for (const url of urls) {
        if (/viewPlayer\.do/i.test(url)) {
          playerProfileUrls.add(url);
        } else if (/cricclubs/i.test(url)) {
          found.add(url);
        }
      }
      // Run a few more queries even after we have hits so we can pick the best
      // (e.g. a player with multiple sub-club profiles vs the main career profile).
      if (playerProfileUrls.size >= 6) break;
    } catch (err) {
      console.warn(`Firecrawl search failed for "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  // Prioritize viewPlayer.do URLs
  const ordered = [...playerProfileUrls, ...found].slice(0, 10);
  return { urls: ordered, triedQueries };
}

// Convert HTML <table> rows into markdown pipe rows so table parsers can read them
function htmlTablesToMarkdown(html: string) {
  return html.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_match, inner) => {
    const cells: string[] = [];
    const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    for (const cellMatch of inner.matchAll(cellRegex)) {
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(cellText);
    }
    if (cells.length === 0) return "\n";
    return `\n| ${cells.join(" | ")} |\n`;
  });
}

function stripHtmlPreservingTables(html: string) {
  const withMdTables = htmlTablesToMarkdown(html);
  return stripHtml(withMdTables);
}

async function fetchPageText(url: string) {
  // Try direct fetch first
  try {
    const response = await fetch(url, { headers: BOT_HEADERS });
    if (response.ok) {
      const html = await response.text();
      return stripHtmlPreservingTables(html).slice(0, 24000);
    }
    console.warn(`Direct fetch returned ${response.status} for ${url}, falling back to Firecrawl scrape`);
  } catch (err) {
    console.warn(`Direct fetch threw for ${url}, falling back to Firecrawl scrape:`, err instanceof Error ? err.message : err);
  }

  // Fallback: use Firecrawl to scrape (bypasses bot blocks). Request both markdown and html.
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) throw new Error("Profile fetch failed and FIRECRAWL_API_KEY not set");

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: false }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Firecrawl scrape failed ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const markdown: string = data?.data?.markdown ?? data?.markdown ?? "";
  const html: string = data?.data?.html ?? data?.html ?? "";

  // Prefer markdown (Firecrawl preserves table pipes); supplement with HTML-derived
  // table rows so we never lose the row/cell structure the parsers depend on.
  const fromHtml = html ? stripHtmlPreservingTables(html) : "";
  const combined = [markdown, fromHtml].filter(Boolean).join("\n\n");
  if (!combined) throw new Error("Firecrawl returned empty content");
  return combined.slice(0, 24000);
}

// Parse the CricClubs viewPlayer.do "career totals" list which appears as
//   - Matches
//   <blank>
//   297
//   - Runs
//   <blank>
//   2265
//   - Wickets
//   <blank>
//   250
// This is the authoritative top-of-page totals block and must be preferred
// over any per-format table cell that also says "Matches".
function extractCareerTotalsFromList(pageText: string): { matches: number | null; runs: number | null; wickets: number | null } | null {
  const lines = pageText.split("\n").map((line) => line.trim());
  const labelRegex = /^[-*]?\s*(Matches|Runs|Wickets)\s*:?\s*$/i;
  const numberRegex = /^([0-9][0-9,]*)$/;
  const found: Record<string, number> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const labelMatch = lines[i].match(labelRegex);
    if (!labelMatch) continue;
    const label = labelMatch[1].toLowerCase();
    // Look ahead a few lines (skipping blanks) for a bare number
    for (let j = i + 1; j < Math.min(lines.length, i + 5); j += 1) {
      if (!lines[j]) continue;
      const numMatch = lines[j].match(numberRegex);
      if (numMatch) {
        const value = Number(numMatch[1].replace(/,/g, ""));
        if (Number.isFinite(value) && !(label in found)) {
          found[label] = value;
        }
        break;
      }
      // If we hit something that's not a number and not blank, stop scanning
      // for this label so we don't grab a stat from an unrelated section.
      break;
    }
  }

  if (!("matches" in found) && !("runs" in found) && !("wickets" in found)) {
    return null;
  }
  return {
    matches: found.matches ?? null,
    runs: found.runs ?? null,
    wickets: found.wickets ?? null,
  };
}

function extractNumberAfterLabel(pageText: string, labels: string[]) {
  const searchScopes = [
    pageText.slice(0, 6000),
    pageText.slice(0, 12000),
    pageText,
  ];

  for (const scope of searchScopes) {
    for (const label of labels) {
      const escaped = escapeRegExp(label);
      const labelBeforeNumber = new RegExp(`${escaped}\\s*[:\\-]?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
      const numberBeforeLabel = new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*${escaped}`, "i");

      const directMatch = scope.match(labelBeforeNumber);
      if (directMatch) {
        const value = Number(directMatch[1]);
        if (!Number.isNaN(value)) return value;
      }

      const reverseMatch = scope.match(numberBeforeLabel);
      if (reverseMatch) {
        const value = Number(reverseMatch[1]);
        if (!Number.isNaN(value)) return value;
      }
    }
  }

  return null;
}

function extractTextAfterLabel(pageText: string, labels: string[], maxLength = 40) {
  const searchScopes = [
    pageText.slice(0, 8000),
    pageText,
  ];

  for (const scope of searchScopes) {
    for (const label of labels) {
      const regex = new RegExp(`${escapeRegExp(label)}\\s*[:\\-]?\\s*([A-Za-z0-9/().,&\\-\\s]{1,${maxLength}})`, "i");
      const match = scope.match(regex);
      if (match) return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return null;
}

function extractPlayerName(pageText: string, searchName: string) {
  const normalizedSearch = normalizeName(searchName);
  const rawRegex = new RegExp(`\\b(${escapeRegExp(searchName)})\\b`, "i");
  const rawMatch = pageText.match(rawRegex);
  if (rawMatch) return rawMatch[1].trim();

  const normalizedLines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of normalizedLines.slice(0, 80)) {
    const normalizedLine = normalizeName(line);
    if (!normalizedLine.includes(normalizedSearch)) continue;

    if (line.length <= 80) {
      return line;
    }
  }

  const labeledName = extractTextAfterLabel(pageText, ["Player Name", "Name"], 60);
  return labeledName;
}

function normalizeCell(value: string | undefined) {
  const normalized = value?.replace(/\*\*/g, "").replace(/`/g, "").trim() ?? "";
  return normalized === "-" ? "" : normalized;
}

function parseNullableNumber(value: string | undefined) {
  const normalized = normalizeCell(value).replace(/,/g, "");
  if (!normalized) return null;
  // Try direct parse first
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  // Fallback: extract first usable number from mixed text (e.g. "12 (3)" or "abc 4.50")
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableText(value: string | undefined) {
  const normalized = normalizeCell(value);
  return normalized || null;
}

function splitMarkdownCells(line: string) {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell, index, arr) => !(index === 0 && cell === "") && !(index === arr.length - 1 && cell === ""));
}

function isMarkdownSeparator(line: string) {
  const normalized = line.replace(/\|/g, "").trim();
  return normalized.length > 0 && /^[-:\s]+$/.test(normalized);
}

function parseBattingRows(pageText: string) {
  const lines = pageText.split("\n").map((line) => line.trim()).filter(Boolean);
  const rows: NonNullable<ExtractedPlayerData["pathwayBatting"]>[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/Series\s*Type[^|]*\|[^|]*Mat[^|]*\|[^|]*Inns[^|]*\|[^|]*NO[^|]*\|[^|]*Runs[^|]*\|[^|]*Balls[^|]*\|[^|]*Ave[^|]*\|[^|]*SR[^|]*\|[^|]*HS/i.test(line)) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length && (isMarkdownSeparator(lines[cursor]) || !lines[cursor].includes("|"))) {
      cursor += 1;
    }

    while (cursor < lines.length && lines[cursor].includes("|")) {
      if (isMarkdownSeparator(lines[cursor])) {
        cursor += 1;
        continue;
      }

      const cells = splitMarkdownCells(lines[cursor]);
      if (cells.length < 15) {
        break;
      }

      rows.push({
        seriesType: normalizeCell(cells[0]),
        matches: parseNullableNumber(cells[1]),
        innings: parseNullableNumber(cells[2]),
        notOuts: parseNullableNumber(cells[3]),
        runs: parseNullableNumber(cells[4]),
        balls: parseNullableNumber(cells[5]),
        average: parseNullableNumber(cells[6]),
        strikeRate: parseNullableNumber(cells[7]),
        highestScore: parseNullableText(cells[8]),
        hundreds: parseNullableNumber(cells[9]),
        fifties: parseNullableNumber(cells[10]),
        twentyFives: parseNullableNumber(cells[11]),
        ducks: parseNullableNumber(cells[12]),
        fours: parseNullableNumber(cells[13]),
        sixes: parseNullableNumber(cells[14]),
      });

      cursor += 1;
    }
  }

  return rows.filter((row) => row.seriesType);
}

function parseBowlingRows(pageText: string) {
  const lines = pageText.split("\n").map((line) => line.trim()).filter(Boolean);
  const rows: NonNullable<ExtractedPlayerData["pathwayBowling"]>[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/Series\s*Type[^|]*\|[^|]*Mat[^|]*\|[^|]*Inns[^|]*\|[^|]*Overs[^|]*\|[^|]*Runs[^|]*\|[^|]*Wkts[^|]*\|[^|]*BBF/i.test(line)) {
      continue;
    }

    let cursor = index + 1;
    while (cursor < lines.length && (isMarkdownSeparator(lines[cursor]) || !lines[cursor].includes("|"))) {
      cursor += 1;
    }

    while (cursor < lines.length && lines[cursor].includes("|")) {
      if (isMarkdownSeparator(lines[cursor])) {
        cursor += 1;
        continue;
      }

      const cells = splitMarkdownCells(lines[cursor]);
      if (cells.length < 15) {
        break;
      }

      rows.push({
        seriesType: normalizeCell(cells[0]),
        matches: parseNullableNumber(cells[1]),
        innings: parseNullableNumber(cells[2]),
        overs: parseNullableText(cells[3]),
        runs: parseNullableNumber(cells[4]),
        wickets: parseNullableNumber(cells[5]),
        bestBowling: parseNullableText(cells[6]),
        maidens: parseNullableNumber(cells[7]),
        average: parseNullableNumber(cells[8]),
        economy: parseNullableNumber(cells[9]),
        strikeRate: parseNullableNumber(cells[10]),
        fourWickets: parseNullableNumber(cells[11]),
        fiveWickets: parseNullableNumber(cells[12]),
        wides: parseNullableNumber(cells[13]),
        catches: parseNullableNumber(cells[14]),
      });

      cursor += 1;
    }
  }

  return rows.filter((row) => row.seriesType);
}

function buildFormatSplits(
  battingRows: ReturnType<typeof parseBattingRows>,
  bowlingRows: ReturnType<typeof parseBowlingRows>,
) {
  const map = new Map<string, ExtractedPlayerData["formatSplits"][number]>();

  for (const row of battingRows) {
    map.set(row.seriesType, {
      format: row.seriesType,
      matches: row.matches,
      runs: row.runs,
      battingAverage: row.average,
      strikeRate: row.strikeRate,
      wickets: map.get(row.seriesType)?.wickets ?? null,
      economy: map.get(row.seriesType)?.economy ?? null,
    });
  }

  for (const row of bowlingRows) {
    map.set(row.seriesType, {
      format: row.seriesType,
      matches: map.get(row.seriesType)?.matches ?? row.matches,
      runs: map.get(row.seriesType)?.runs ?? row.runs,
      battingAverage: map.get(row.seriesType)?.battingAverage ?? null,
      strikeRate: map.get(row.seriesType)?.strikeRate ?? null,
      wickets: row.wickets,
      economy: row.economy,
    });
  }

  return Array.from(map.values());
}

function pickPreferredPathwayBatting(
  battingRows: ReturnType<typeof parseBattingRows>,
  pageText: string,
  url: string,
) {
  if (battingRows.length === 0) return null;

  const preferredOrder = ["1 DAY", "YOUTH", "T20", "OTHER"];
  const sorted = battingRows.slice().sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.seriesType.toUpperCase());
    const rightIndex = preferredOrder.indexOf(right.seriesType.toUpperCase());
    const leftRank = leftIndex === -1 ? preferredOrder.length : leftIndex;
    const rightRank = rightIndex === -1 ? preferredOrder.length : rightIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (right.matches ?? 0) - (left.matches ?? 0);
  });

  const best = sorted[0];
  const isPathwaySource = url.includes("USACricketJunior") || /USA Cricket Junior Pathway/i.test(pageText);

  return {
    ...best,
    seriesType: isPathwaySource ? `USA Cricket Junior Pathway ${best.seriesType}` : best.seriesType,
  };
}

function pickPreferredPathwayBowling(
  bowlingRows: ReturnType<typeof parseBowlingRows>,
  pageText: string,
  url: string,
) {
  if (bowlingRows.length === 0) return null;

  const preferredOrder = ["1 DAY", "YOUTH", "T20", "OTHER"];
  const sorted = bowlingRows.slice().sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.seriesType.toUpperCase());
    const rightIndex = preferredOrder.indexOf(right.seriesType.toUpperCase());
    const leftRank = leftIndex === -1 ? preferredOrder.length : leftIndex;
    const rightRank = rightIndex === -1 ? preferredOrder.length : rightIndex;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (right.matches ?? 0) - (left.matches ?? 0);
  });

  const best = sorted[0];
  const isPathwaySource = url.includes("USACricketJunior") || /USA Cricket Junior Pathway/i.test(pageText);

  return {
    ...best,
    seriesType: isPathwaySource ? `USA Cricket Junior Pathway ${best.seriesType}` : best.seriesType,
  };
}

async function extractPlayerDataFromText(
  searchName: string,
  url: string,
  pageText: string,
): Promise<ExtractedPlayerData> {
  const playerName = extractPlayerName(pageText, searchName);
  const matchedPlayer = getCandidateNameScore(searchName, playerName) >= 0.84;
  const team = extractTextAfterLabel(pageText, ["Current Team", "Team", "Club"], 60) ||
    (url.includes("USACricketJunior") ? "USA Cricket Junior Pathway" : null);
  const battingStyle = extractTextAfterLabel(pageText, ["Batting Style", "Batting"], 40);
  const bowlingStyle = extractTextAfterLabel(pageText, ["Bowling Style", "Bowling"], 40);
  const role = extractTextAfterLabel(pageText, ["Playing Role", "Role"], 32);
  const battingRows = parseBattingRows(pageText);
  const bowlingRows = parseBowlingRows(pageText);
  const pathwayBatting = pickPreferredPathwayBatting(battingRows, pageText, url);
  const pathwayBowling = pickPreferredPathwayBowling(bowlingRows, pageText, url);
  const formatSplits = buildFormatSplits(battingRows, bowlingRows);

  // Authoritative top-of-page totals block (e.g. "- Matches\n\n297\n- Runs\n\n2265\n- Wickets\n\n250")
  const careerListTotals = extractCareerTotalsFromList(pageText);

  const stats = {
    matches: careerListTotals?.matches ?? extractNumberAfterLabel(pageText, ["Matches", "Match"]),
    innings: extractNumberAfterLabel(pageText, ["Innings", "Inns"]),
    runs: careerListTotals?.runs ?? extractNumberAfterLabel(pageText, ["Runs"]),
    battingAverage: extractNumberAfterLabel(pageText, ["Bat Avg", "Average", "Avg"]),
    strikeRate: extractNumberAfterLabel(pageText, ["Strike Rate", "SR"]),
    highestScore: extractTextAfterLabel(pageText, ["Highest Score", "High Score", "HS"], 12),
    notOuts: extractNumberAfterLabel(pageText, ["Not Outs", "NO"]),
    fours: extractNumberAfterLabel(pageText, ["Fours", "4s"]),
    sixes: extractNumberAfterLabel(pageText, ["Sixes", "6s"]),
    ducks: extractNumberAfterLabel(pageText, ["Ducks"]),
    wickets: careerListTotals?.wickets ?? extractNumberAfterLabel(pageText, ["Wickets", "Wkts"]),
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
    `Public CricClubs page matched for ${playerName ?? "the searched player"}.`,
    url.includes("USACricketJunior")
      ? "Source is inside the USA Cricket Junior Pathway CricClubs site."
      : "Source is a public CricClubs page discovered through web search.",
  ];
  if (stats.runs !== null) groundingNotes.push(`Visible public batting output includes ${stats.runs} runs.`);
  if (stats.matches !== null) groundingNotes.push(`Visible public sample includes ${stats.matches} matches.`);
  if (pathwayBatting) groundingNotes.push(`A public pathway batting row was parsed for ${pathwayBatting.seriesType}.`);
  if (pathwayBowling) groundingNotes.push(`A public pathway bowling row was parsed for ${pathwayBowling.seriesType}.`);

  return {
    matchedPlayer,
    careerTotals: careerListTotals ?? { matches: stats.matches, runs: stats.runs, wickets: stats.wickets },
    pathwayBatting,
    pathwayBowling,
    player: { name: playerName, role, team, battingStyle, bowlingStyle },
    stats,
    formatSplits,
    explicitInsights: { dismissalPatterns: [], bowlerTypeNotes: [], groundingNotes },
  };
}

function formatMetric(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "Unavailable";
  return Number.isInteger(value) ? `${value}` : value.toFixed(digits);
}

function buildBoundaryProfile(fours: number | null, sixes: number | null) {
  if (fours === null && sixes === null) return "Boundary profile is not exposed on the public page.";
  if ((fours ?? 0) === 0 && (sixes ?? 0) === 0) return "No clear boundary output is visible from the public summary.";
  if ((fours ?? 0) >= (sixes ?? 0) * 3) return "Boundary profile leans more ground-based than aerial, with fours clearly outweighing sixes.";
  if ((sixes ?? 0) > (fours ?? 0)) return "Boundary profile shows more aerial intent than ground accumulation.";
  return "Boundary profile is mixed across fours and sixes.";
}

function bestFormat(formatSplits: ExtractedPlayerData["formatSplits"]) {
  const battingFormats = formatSplits.filter((item) => item.battingAverage !== null || item.strikeRate !== null || item.runs !== null);
  if (battingFormats.length === 0) return null;
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
      strengths.push({ title: "Consistency", body: `Batting average of ${formatMetric(stats.battingAverage)} suggests repeatable run production.` });
    } else if (stats.battingAverage < 20) {
      concerns.push({ title: "Conversion Risk", body: `Batting average of ${formatMetric(stats.battingAverage)} points to inconsistent returns.` });
    }
  } else {
    dataLimitations.push("Batting average was not visible on the public CricClubs page.");
  }

  if (stats.strikeRate !== null) {
    if (stats.strikeRate >= 130) {
      strengths.push({ title: "Tempo", body: `Strike rate of ${formatMetric(stats.strikeRate)} indicates strong scoring tempo.` });
    } else if (stats.strikeRate < 90) {
      concerns.push({ title: "Scoring Pressure", body: `Strike rate of ${formatMetric(stats.strikeRate)} suggests the player may need protection.` });
    }
  } else {
    dataLimitations.push("Strike rate was not visible on the public CricClubs page.");
  }

  if (stats.ducks !== null && stats.innings !== null && stats.innings > 0) {
    const duckRate = stats.ducks / stats.innings;
    if (duckRate >= 0.18) {
      concerns.push({ title: "Early Wicket Exposure", body: `${stats.ducks} ducks across ${stats.innings} innings points to early-dismissal risk.` });
    }
  } else {
    dataLimitations.push("Dismissal distribution was not exposed cleanly enough to quantify early wicket risk.");
  }

  if (stats.wickets !== null && stats.wickets >= 15) {
    strengths.push({ title: "Secondary Bowling Value", body: `${stats.wickets} wickets give genuine bowling contribution.` });
  }

  if (stats.economy !== null) {
    if (stats.economy <= 6) {
      strengths.push({ title: "Run Control", body: `Economy of ${formatMetric(stats.economy)} supports control or holding phases.` });
    } else if (stats.economy >= 9) {
      concerns.push({ title: "Leak Rate", body: `Economy of ${formatMetric(stats.economy)} suggests bowling value should be used carefully.` });
    }
  }

  const boundaryProfile = buildBoundaryProfile(stats.fours, stats.sixes);
  const strongestFormat = bestFormat(formatSplits);

  const battingProfileParts = [];
  if (stats.battingAverage !== null) battingProfileParts.push(`average ${formatMetric(stats.battingAverage)}`);
  if (stats.strikeRate !== null) battingProfileParts.push(`strike rate ${formatMetric(stats.strikeRate)}`);
  if (stats.highestScore) battingProfileParts.push(`best visible score ${stats.highestScore}`);

  const battingProfile = battingProfileParts.length > 0
    ? `The public batting output shows ${battingProfileParts.join(", ")}. ${boundaryProfile}`
    : "The public page did not expose enough batting fields to build a reliable batting profile.";

  const dismissalRisk = explicitInsights.dismissalPatterns.length > 0
    ? explicitInsights.dismissalPatterns.join(" ")
    : "This public CricClubs profile did not expose a reliable dismissal-mode breakdown.";

  const matchupRead = explicitInsights.bowlerTypeNotes.length > 0
    ? explicitInsights.bowlerTypeNotes.join(" ")
    : "This public CricClubs profile does not expose a trustworthy split by bowler type.";

  let selectionSummary = "Public CricClubs data was found, but the profile is thin.";
  if (stats.battingAverage !== null && stats.strikeRate !== null) {
    if (stats.battingAverage >= 35 && stats.strikeRate >= 120) {
      selectionSummary = "The public profile supports selection as a stable batting option who can combine run production with workable tempo.";
    } else if (stats.battingAverage >= 35) {
      selectionSummary = "The public profile supports selection primarily for stability and innings-building.";
    } else if (stats.strikeRate >= 130) {
      selectionSummary = "The public profile supports selection for tempo and pressure-release hitting.";
    }
  }
  if (strongestFormat) selectionSummary += ` Best visible format signal: ${strongestFormat.format}.`;

  const recommendation = strengths.length > concerns.length
    ? "Use this player where run production or dual-skill contribution matters."
    : "Use this player with role clarity and matchup protection until stronger evidence supports a bigger load.";

  const summaryCards: SummaryCard[] = [
    { label: "Matches", value: formatMetric(stats.matches, 0), icon: "players", changeLabel: stats.matches && stats.matches >= 20 ? "Solid sample" : "Small sample", trend: stats.matches && stats.matches >= 20 ? "up" : "neutral" },
    { label: "Runs", value: formatMetric(stats.runs, 0), icon: "runs", changeLabel: stats.highestScore ? `HS ${stats.highestScore}` : "No high score shown", trend: stats.runs && stats.runs >= 500 ? "up" : "neutral" },
    { label: "Bat Avg / SR", value: stats.battingAverage !== null || stats.strikeRate !== null ? `${formatMetric(stats.battingAverage)} / ${formatMetric(stats.strikeRate)}` : "Unavailable", icon: "batting", changeLabel: stats.battingAverage !== null && stats.battingAverage >= 35 ? "Stable output" : "Needs more proof", trend: stats.battingAverage !== null && stats.battingAverage >= 35 ? "up" : "neutral" },
    { label: "Wickets / Econ", value: stats.wickets !== null || stats.economy !== null ? `${formatMetric(stats.wickets, 0)} / ${formatMetric(stats.economy)}` : "Unavailable", icon: "bowling", changeLabel: stats.economy !== null && stats.economy <= 6 ? "Control value" : "Support skill", trend: stats.economy !== null && stats.economy <= 6 ? "up" : "neutral" },
  ];

  if (explicitInsights.dismissalPatterns.length === 0) dataLimitations.push("Dismissal tendencies were not directly available.");
  if (explicitInsights.bowlerTypeNotes.length === 0) dataLimitations.push("Bowler-type matchup insight is unavailable.");
  if (formatSplits.length === 0) dataLimitations.push("Format split tables were not visible or were too incomplete.");
  if (explicitInsights.groundingNotes.length === 0) dataLimitations.push("Grounding notes are empty because the profile text did not surface extra detail.");

}

// ----- Pathway runs/wickets fallback derivation (mirrors src/lib/analyticsNormalize.ts) -----

function parseOversToBalls(overs: string | number | null | undefined): number | null {
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
  return Math.max(...values) - Math.min(...values) <= tolerance;
}

function deriveBattingRuns(pb: NonNullable<ExtractedPlayerData["pathwayBatting"]>): number | null {
  if (pb.runs !== null && pb.runs !== undefined) return pb.runs;
  const candidates: number[] = [];
  if (pb.balls != null && pb.strikeRate != null) {
    const v = (pb.balls * pb.strikeRate) / 100;
    if (Number.isFinite(v) && v >= 0) candidates.push(v);
  }
  if (pb.average != null && pb.innings != null) {
    const dismissals = pb.innings - (pb.notOuts ?? 0);
    if (dismissals > 0) {
      const v = pb.average * dismissals;
      if (Number.isFinite(v) && v >= 0) candidates.push(v);
    }
  }
  if (candidates.length === 0 || !valuesAgree(candidates, 2)) return null;
  return Math.round(candidates.reduce((a, b) => a + b, 0) / candidates.length);
}

function deriveBowlingWickets(pb: NonNullable<ExtractedPlayerData["pathwayBowling"]>): number | null {
  if (pb.wickets !== null && pb.wickets !== undefined) return pb.wickets;
  const candidates: number[] = [];
  if (pb.runs != null && pb.average != null && pb.average > 0) {
    const v = pb.runs / pb.average;
    if (Number.isFinite(v) && v >= 0) candidates.push(v);
  }
  const totalBalls = parseOversToBalls(pb.overs);
  if (totalBalls !== null && pb.strikeRate != null && pb.strikeRate > 0) {
    const v = totalBalls / pb.strikeRate;
    if (Number.isFinite(v) && v >= 0) candidates.push(v);
  }
  if (candidates.length === 0 || !valuesAgree(candidates, 2)) return null;
  return Math.round(candidates.reduce((a, b) => a + b, 0) / candidates.length);
}

function normalizeExtracted(extracted: ExtractedPlayerData): ExtractedPlayerData {
  if (extracted.pathwayBatting) {
    const d = deriveBattingRuns(extracted.pathwayBatting);
    if (d !== null && extracted.pathwayBatting.runs == null) {
      extracted.pathwayBatting.runs = d;
    }
  }
  if (extracted.pathwayBowling) {
    const d = deriveBowlingWickets(extracted.pathwayBowling);
    if (d !== null && extracted.pathwayBowling.wickets == null) {
      extracted.pathwayBowling.wickets = d;
    }
  }
  if (extracted.careerTotals) {
    if (extracted.careerTotals.runs == null && extracted.pathwayBatting?.runs != null) {
      extracted.careerTotals.runs = extracted.pathwayBatting.runs;
    }
    if (extracted.careerTotals.wickets == null && extracted.pathwayBowling?.wickets != null) {
      extracted.careerTotals.wickets = extracted.pathwayBowling.wickets;
    }
  }
  if (extracted.stats.runs == null && extracted.pathwayBatting?.runs != null) {
    extracted.stats.runs = extracted.pathwayBatting.runs;
  }
  if (extracted.stats.wickets == null && extracted.pathwayBowling?.wickets != null) {
    extracted.stats.wickets = extracted.pathwayBowling.wickets;
  }
  if (extracted.formatSplits && extracted.pathwayBatting?.runs != null) {
    for (const row of extracted.formatSplits) {
      if (row.format === extracted.pathwayBatting.seriesType && row.runs == null) {
        row.runs = extracted.pathwayBatting.runs;
      }
    }
  }
  if (extracted.formatSplits && extracted.pathwayBowling?.wickets != null) {
    for (const row of extracted.formatSplits) {
      if (row.format === extracted.pathwayBowling.seriesType && row.wickets == null) {
        row.wickets = extracted.pathwayBowling.wickets;
      }
    }
  }
  return extracted;
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

    console.log(`Searching for player: "${trimmedQuery}", clubHint: "${clubHint ?? "none"}"`);

    const { urls: candidateUrls, triedQueries } = await searchCricClubsProfiles(trimmedQuery, clubHint);
    
    console.log(`Found ${candidateUrls.length} candidate URLs after trying ${triedQueries.length} queries`);
    if (candidateUrls.length > 0) {
      console.log("Candidate URLs:", candidateUrls.join(", "));
    }

    if (candidateUrls.length === 0) {
      console.error("No results found. Queries tried:", JSON.stringify(triedQueries));
      return jsonResponse({
        error: "No public CricClubs player pages were found for that search.",
        triedQueries,
      }, 404);
    }

    // Score each name-matching candidate by career sample size so we prefer the
    // player's main aggregated profile over a sub-club page that happens to share
    // the same name but only shows 1 match.
    type Candidate = {
      sourceUrl: string;
      extracted: ExtractedPlayerData;
      overlap: number;
      nameScore: number;
      sampleSize: number;
    };
    let bestResult: Candidate | null = null;

    for (const sourceUrl of candidateUrls) {
      try {
        // Only accept actual player profile pages. Other CricClubs pages
        // (fielding/batting/bowling records, scorecards, team pages) can echo
        // the search query back and produce junk matches.
        if (!/viewPlayer\.do/i.test(sourceUrl)) continue;

        const pageText = await fetchPageText(sourceUrl);
        if (pageText.length < 400) continue;

        const extracted = await extractPlayerDataFromText(trimmedQuery, sourceUrl, pageText);
        const nameScore = getCandidateNameScore(trimmedQuery, extracted.player.name);
        if (nameScore === 0) continue;

        // A real CricClubs player profile must expose at least one of:
        //  - the "- Matches / - Runs / - Wickets" career-totals list, OR
        //  - a parsed batting or bowling row from a Series Type table.
        const hasRealProfileSignal =
          extracted.careerTotals !== null &&
          (extracted.careerTotals.matches !== null || extracted.careerTotals.runs !== null || extracted.careerTotals.wickets !== null);
        const hasParsedRows = extracted.pathwayBatting !== null || extracted.pathwayBowling !== null;
        if (!hasRealProfileSignal && !hasParsedRows) continue;

        const overlap = getNameOverlap(trimmedQuery, extracted.player.name) + (sourceUrl.includes("viewPlayer.do") ? 0.15 : 0);
        const sampleSize = (extracted.careerTotals?.matches ?? 0) + (extracted.careerTotals?.runs ?? 0) / 10 + (extracted.careerTotals?.wickets ?? 0);

        const isBetter = !bestResult
          || nameScore > bestResult.nameScore
          || (nameScore === bestResult.nameScore && sampleSize > bestResult.sampleSize)
          || (nameScore === bestResult.nameScore && sampleSize === bestResult.sampleSize && overlap > bestResult.overlap);

        if (isBetter) {
          bestResult = { sourceUrl, extracted, overlap, nameScore, sampleSize };
        }
      } catch (candidateError) {
        console.error("Candidate analysis failed:", sourceUrl, candidateError);
      }
    }

    if (!bestResult || !bestResult.extracted.player.name || bestResult.nameScore < 0.84) {
      return jsonResponse({
        error: "A CricClubs result was found, but the player name did not directly match the search well enough to verify the real profile.",
      }, 404);
    }

    const normalized = normalizeExtracted(bestResult.extracted);
    const derived = buildDerivedAnalytics(normalized);

    return jsonResponse({
      searchQuery: trimmedQuery,
      sourceUrl: bestResult.sourceUrl,
      searchedAt: new Date().toISOString(),
      ...normalized,
      derived,
    });
  } catch (error) {
    console.error("cricclubs-player-analytics failed:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to load CricClubs analytics." }, 500);
  }
});

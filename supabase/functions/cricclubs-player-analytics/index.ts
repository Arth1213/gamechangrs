import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";

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
      if (playerProfileUrls.size >= 3) break;
    } catch (err) {
      console.warn(`Firecrawl search failed for "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  // Prioritize viewPlayer.do URLs
  const ordered = [...playerProfileUrls, ...found].slice(0, 8);
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
  const content = await fetchPageContent(url);
  return content.text;
}

async function fetchPageContent(url: string): Promise<{ text: string; html: string; markdown: string }> {
  // Try direct fetch first
  try {
    const response = await fetch(url, { headers: BOT_HEADERS });
    if (response.ok) {
      const html = await response.text();
      return {
        text: stripHtmlPreservingTables(html).slice(0, 24000),
        html,
        markdown: "",
      };
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
  return {
    text: combined.slice(0, 24000),
    html,
    markdown,
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

function parseDismissalSummary(pageText: string, sectionLabel: "BATTING" | "BOWLING") {
  const nextSectionLabel = sectionLabel === "BATTING" ? "BOWLING:" : "© Copyright";
  const regex = new RegExp(`${sectionLabel}:\\s*DISMISSAL TYPE[\\s\\S]*?Out type\\s+Count([\\s\\S]*?)(?:${nextSectionLabel}|$)`, "i");
  const block = pageText.match(regex)?.[1] ?? "";
  if (!block) return [];

  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: { type: string; count: number }[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const type = lines[index];
    const count = Number(lines[index + 1]);
    if (!type || !Number.isFinite(count)) continue;
    rows.push({ type, count });
    index += 1;
  }

  return rows;
}

function buildDismissalNotes(
  battingDismissals: ReturnType<typeof parseDismissalSummary>,
  bowlingDismissals: ReturnType<typeof parseDismissalSummary>,
) {
  const notes: string[] = [];

  if (battingDismissals.length > 0) {
    const topBatting = battingDismissals
      .filter((entry) => entry.type.toLowerCase() !== "not out")
      .sort((left, right) => right.count - left.count)
      .slice(0, 3)
      .map((entry) => `${entry.type.toLowerCase()} ${entry.count}`);
    const notOuts = battingDismissals.find((entry) => entry.type.toLowerCase() === "not out")?.count ?? 0;

    if (topBatting.length > 0) {
      notes.push(`Public batting dismissal chart shows ${topBatting.join(", ")}${notOuts > 0 ? `, with ${notOuts} not outs.` : "."}`);
    }
  }

  if (bowlingDismissals.length > 0) {
    const topBowling = bowlingDismissals
      .sort((left, right) => right.count - left.count)
      .slice(0, 3)
      .map((entry) => `${entry.type.toLowerCase()} ${entry.count}`);

    if (topBowling.length > 0) {
      notes.push(`Public bowling dismissal chart credits wickets through ${topBowling.join(", ")}.`);
    }
  }

  return notes;
}

function safeDocument(html: string) {
  if (!html) return null;
  try {
    return new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
}

function absoluteUrl(href: string | null | undefined, base = "https://cricclubs.com/") {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function normalizeScorecardUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const matchId = parsed.searchParams.get("matchId");
    const clubId = parsed.searchParams.get("clubId");
    if (!matchId) return parsed.toString();
    return `https://cricclubs.com${parsed.pathname}?matchId=${matchId}${clubId ? `&clubId=${clubId}` : ""}`;
  } catch {
    return url;
  }
}

function extractRecordLinksFromProfile(html: string, baseUrl: string) {
  const doc = safeDocument(html);
  if (!doc) {
    return { battingUrl: null, bowlingUrl: null };
  }

  let battingUrl: string | null = null;
  let bowlingUrl: string | null = null;

  for (const link of [...doc.querySelectorAll("a[href]")]) {
    const href = absoluteUrl(link.getAttribute("href"), baseUrl);
    if (!href) continue;

    if (!battingUrl && /playerAllBattingRecords\.do/i.test(href)) {
      battingUrl = href;
    }

    if (!bowlingUrl && /playerAllBowlingRecords\.do/i.test(href)) {
      bowlingUrl = href;
    }
  }

  return { battingUrl, bowlingUrl };
}

function parseInteger(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function parseFloatValue(value: string | null | undefined) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseRunsValue(value: string | null | undefined) {
  if (!value) return { runs: null, notOut: false, didBat: false };
  const normalized = value.trim();
  if (/^dnb$/i.test(normalized)) return { runs: null, notOut: false, didBat: false };
  return {
    runs: parseInteger(normalized),
    notOut: normalized.includes("*"),
    didBat: true,
  };
}

function extractTableRows(html: string, baseUrl: string) {
  const doc = safeDocument(html);
  if (!doc) return [];

  return [...doc.querySelectorAll("tr")]
    .map((row) => {
      const cells = [...row.querySelectorAll("th, td")].map((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim());
      const scorecardLink = absoluteUrl(row.querySelector('a[href*="viewScorecard.do"]')?.getAttribute("href"), baseUrl);
      return { cells, scorecardUrl: normalizeScorecardUrl(scorecardLink) };
    })
    .filter((row) => row.cells.length > 4);
}

function parsePlayerBattingMatchLog(html: string, baseUrl: string) {
  return extractTableRows(html, baseUrl)
    .map((row) => {
      const cells = row.cells;
      if (cells[0] === "No." || cells[0] === "No") return null;
      if (cells.length < 12) return null;

      return {
        matchDate: cells[1] || null,
        team: cells[2] || null,
        against: cells[3] || null,
        winner: cells[4] || null,
        battingPosition: parseInteger(cells[5]),
        ...parseRunsValue(cells[6]),
        balls: parseInteger(cells[7]),
        strikeRate: parseFloatValue(cells[8]),
        scorecardUrl: row.scorecardUrl,
      };
    })
    .filter((row): row is {
      matchDate: string | null;
      team: string | null;
      against: string | null;
      winner: string | null;
      battingPosition: number | null;
      runs: number | null;
      notOut: boolean;
      didBat: boolean;
      balls: number | null;
      strikeRate: number | null;
      scorecardUrl: string | null;
    } => Boolean(row));
}

function parsePlayerBowlingMatchLog(html: string, baseUrl: string) {
  return extractTableRows(html, baseUrl)
    .map((row) => {
      const cells = row.cells;
      if (cells[0] === "No." || cells[0] === "No") return null;
      if (cells.length < 11) return null;

      return {
        matchDate: cells[1] || null,
        team: cells[2] || null,
        against: cells[3] || null,
        winner: cells[4] || null,
        overs: cells[5] || null,
        runsConceded: parseInteger(cells[6]),
        wickets: parseInteger(cells[7]),
        economy: parseFloatValue(cells[8]),
        strikeRate: parseFloatValue(cells[9]),
        wides: parseInteger(cells[10]),
        scorecardUrl: row.scorecardUrl,
      };
    })
    .filter((row): row is {
      matchDate: string | null;
      team: string | null;
      against: string | null;
      winner: string | null;
      overs: string | null;
      runsConceded: number | null;
      wickets: number | null;
      economy: number | null;
      strikeRate: number | null;
      wides: number | null;
      scorecardUrl: string | null;
    } => Boolean(row));
}

const BAY_AREA_DIVISION_ROUTES = [
  { label: "U15 Phase 1 Div 1", leagueId: "434" },
  { label: "U15 Phase 1 Div 2", leagueId: "435" },
  { label: "U15 Phase 2 Div 1", leagueId: "436" },
  { label: "U15 Phase 2 Div 2", leagueId: "437" },
];

let bayAreaDivisionIndexPromise: Promise<Map<string, string>> | null = null;

async function fetchBayAreaDivisionIndex() {
  if (bayAreaDivisionIndexPromise) return bayAreaDivisionIndexPromise;

  bayAreaDivisionIndexPromise = (async () => {
  const index = new Map<string, string>();

  for (const route of BAY_AREA_DIVISION_ROUTES) {
    const url = `https://cricclubs.com/USACricketJunior/listMatches.do?league=${route.leagueId}&clubId=40319`;
    try {
      const { html } = await fetchPageContent(url);
      const doc = safeDocument(html);
      if (!doc) continue;

      for (const card of [...doc.querySelectorAll(".row.team-data")]) {
        const heading = (card.querySelector(".schedule-text h4")?.textContent || "").replace(/\s+/g, " ").trim();
        const link = normalizeScorecardUrl(absoluteUrl(card.querySelector('a[href*="viewScorecard.do"]')?.getAttribute("href"), url));
        if (heading && link) {
          index.set(link, heading);
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch Bay Area division index for ${route.label}:`, error instanceof Error ? error.message : error);
    }
  }

  return index;
  })();

  return bayAreaDivisionIndexPromise;
}

function buildDivisionFormatSplits(
  battingLog: ReturnType<typeof parsePlayerBattingMatchLog>,
  bowlingLog: ReturnType<typeof parsePlayerBowlingMatchLog>,
  divisionIndex: Map<string, string>,
) {
  const groups = new Map<string, {
    matchIds: Set<string>;
    battingMatches: number;
    battingRuns: number;
    battingBalls: number;
    dismissals: number;
    wickets: number;
    bowlingRuns: number;
    bowlingBalls: number;
  }>();

  const ensureGroup = (label: string) => {
    const group = groups.get(label);
    if (group) return group;
    const created = {
      matchIds: new Set<string>(),
      battingMatches: 0,
      battingRuns: 0,
      battingBalls: 0,
      dismissals: 0,
      wickets: 0,
      bowlingRuns: 0,
      bowlingBalls: 0,
    };
    groups.set(label, created);
    return created;
  };

  for (const entry of battingLog) {
    const division = divisionIndex.get(normalizeScorecardUrl(entry.scorecardUrl) || "");
    if (!division || !entry.didBat) continue;
    const group = ensureGroup(division);
    if (entry.scorecardUrl) group.matchIds.add(entry.scorecardUrl);
    group.battingMatches += 1;
    group.battingRuns += entry.runs ?? 0;
    group.battingBalls += entry.balls ?? 0;
    if (!entry.notOut && entry.runs !== null) {
      group.dismissals += 1;
    }
  }

  for (const entry of bowlingLog) {
    const division = divisionIndex.get(normalizeScorecardUrl(entry.scorecardUrl) || "");
    if (!division) continue;
    const group = ensureGroup(division);
    if (entry.scorecardUrl) group.matchIds.add(entry.scorecardUrl);
    group.wickets += entry.wickets ?? 0;
    group.bowlingRuns += entry.runsConceded ?? 0;
    group.bowlingBalls += parseOversToBalls(entry.overs) ?? 0;
  }

  return [...groups.entries()].map(([format, group]) => ({
    format,
    matches: group.matchIds.size || group.battingMatches || null,
    runs: group.battingRuns || null,
    battingAverage: group.dismissals > 0 ? group.battingRuns / group.dismissals : group.battingRuns > 0 ? group.battingRuns : null,
    strikeRate: group.battingBalls > 0 ? (group.battingRuns / group.battingBalls) * 100 : null,
    wickets: group.wickets || null,
    economy: group.bowlingBalls > 0 ? (group.bowlingRuns / group.bowlingBalls) * 6 : null,
  }));
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
  pageHtml: string,
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
  const battingDismissals = parseDismissalSummary(pageText, "BATTING");
  const bowlingDismissals = parseDismissalSummary(pageText, "BOWLING");
  const dismissalNotes = buildDismissalNotes(battingDismissals, bowlingDismissals);
  const recordLinks = extractRecordLinksFromProfile(pageHtml, url);
  let formatSplits = buildFormatSplits(battingRows, bowlingRows);
  const pathwayBatting = pickPreferredPathwayBatting(battingRows, pageText, url);
  const pathwayBowling = pickPreferredPathwayBowling(bowlingRows, pageText, url);

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
    `Public CricClubs page matched for ${playerName ?? "the searched player"}.`,
    url.includes("USACricketJunior")
      ? "Source is inside the USA Cricket Junior Pathway CricClubs site."
      : "Source is a public CricClubs page discovered through web search.",
  ];
  if (stats.runs !== null) groundingNotes.push(`Visible public batting output includes ${stats.runs} runs.`);
  if (stats.matches !== null) groundingNotes.push(`Visible public sample includes ${stats.matches} matches.`);
  if (pathwayBatting) groundingNotes.push(`A public pathway batting row was parsed for ${pathwayBatting.seriesType}.`);
  if (pathwayBowling) groundingNotes.push(`A public pathway bowling row was parsed for ${pathwayBowling.seriesType}.`);
  if (recordLinks.battingUrl) groundingNotes.push("A public player all-batting log page was discovered for this profile.");
  if (recordLinks.bowlingUrl) groundingNotes.push("A public player all-bowling log page was discovered for this profile.");

  try {
    const [battingLogContent, bowlingLogContent] = await Promise.all([
      recordLinks.battingUrl ? fetchPageContent(recordLinks.battingUrl) : Promise.resolve(null),
      recordLinks.bowlingUrl ? fetchPageContent(recordLinks.bowlingUrl) : Promise.resolve(null),
    ]);

    const battingLog = battingLogContent?.html && recordLinks.battingUrl
      ? parsePlayerBattingMatchLog(battingLogContent.html, recordLinks.battingUrl)
      : [];
    const bowlingLog = bowlingLogContent?.html && recordLinks.bowlingUrl
      ? parsePlayerBowlingMatchLog(bowlingLogContent.html, recordLinks.bowlingUrl)
      : [];

    if (battingLog.length > 0 || bowlingLog.length > 0) {
      const divisionIndex = await fetchBayAreaDivisionIndex();
      const divisionFormatSplits = buildDivisionFormatSplits(battingLog, bowlingLog, divisionIndex);
      if (divisionFormatSplits.length > 0) {
        formatSplits = [...formatSplits, ...divisionFormatSplits];
        groundingNotes.push(`Matched ${divisionFormatSplits.length} public Bay Area division split rows from player match logs and scorecard links.`);
      }
    }
  } catch (error) {
    console.warn(`Extended public log scrape failed for ${url}:`, error instanceof Error ? error.message : error);
  }

  return {
    matchedPlayer,
    careerTotals: { matches: stats.matches, runs: stats.runs, wickets: stats.wickets },
    pathwayBatting,
    pathwayBowling,
    player: { name: playerName, role, team, battingStyle, bowlingStyle },
    stats,
    formatSplits,
    explicitInsights: { dismissalPatterns: dismissalNotes, bowlerTypeNotes: [], groundingNotes },
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
  if (formatSplits.some((item) => /div\s*[12]/i.test(item.format))) {
    strengths.push({
      title: "Division Context",
      body: "Public Bay Area scorecard-linked match logs exposed a usable Div 1 / Div 2 split for this pathway profile.",
    });
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

    let bestResult: { sourceUrl: string; extracted: ExtractedPlayerData; overlap: number; nameScore: number } | null = null;

    for (const sourceUrl of candidateUrls) {
      try {
        const pageContent = await fetchPageContent(sourceUrl);
        const pageText = pageContent.text;
        if (pageText.length < 400) continue;

        const extracted = await extractPlayerDataFromText(trimmedQuery, sourceUrl, pageText, pageContent.html);
        const nameScore = getCandidateNameScore(trimmedQuery, extracted.player.name);
        if (nameScore === 0) continue;
        const overlap = getNameOverlap(trimmedQuery, extracted.player.name) + (sourceUrl.includes("viewPlayer.do") ? 0.15 : 0);

        if (!bestResult || nameScore > bestResult.nameScore || (nameScore === bestResult.nameScore && overlap > bestResult.overlap)) {
          bestResult = { sourceUrl, extracted, overlap, nameScore };
        }
        if (extracted.matchedPlayer && nameScore >= 0.9) {
          bestResult = { sourceUrl, extracted, overlap, nameScore };
          break;
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

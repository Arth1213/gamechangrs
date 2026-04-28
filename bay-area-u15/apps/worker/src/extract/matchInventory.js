const path = require("path");
const { withBrowser } = require("../lib/browser");
const { ensureDir, writeJsonFile, writeTextFile } = require("../lib/fs");

const ROOT_URL = "https://cricclubs.com";

function makeAbsoluteUrl(href) {
  return new URL(href, ROOT_URL).toString();
}

function normalizeLabel(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function enumerateMatches(seriesConfig, discovery, options = {}) {
  const outDir = options.outDir || path.resolve(process.cwd(), "storage/exports/inventory");
  ensureDir(outDir);
  const targetDivisions = (seriesConfig.targeting && seriesConfig.targeting.divisions) || [];
  const targetDivisionSet = new Set(
    targetDivisions
      .filter((division) => division.enabled !== false)
      .map((division) => normalizeLabel(division.label)),
  );

  const result = {
    series: seriesConfig.slug,
    targetDivisions: targetDivisions.map((division) => division.label),
    resultsUrl: discovery.routes?.resultsUrl,
    discoveredDivisions: [],
    matches: [],
  };

  await withBrowser(async (context) => {
    const divisionPages = (discovery.divisions || []).filter((division) =>
      targetDivisionSet.has(normalizeLabel(division.label)),
    );
    result.discoveredDivisions = divisionPages;

    const matches = [];

    for (const division of divisionPages) {
      const page = await context.newPage();
      await page.goto(division.resultsUrl || division.href, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(4000);

      const html = await page.content();
      const rawCards = await page.locator(".row.team-data").evaluateAll((nodes) =>
        nodes.map((node) => {
          const dateCell = node.querySelector(".sch-time");
          const scoreItems = [...node.querySelectorAll(".schedule-logo li")];
          const heading = node.querySelector(".schedule-text h4");
          const teams = node.querySelector(".schedule-text h3");
          const resultText = node.querySelectorAll(".schedule-text h4")[1];
          const scorecardLink = node.querySelector('a[href*="viewScorecard.do"]');
          const ballByBallLink =
            node.querySelector('a[href*="ballbyball.do"]') ||
            node.querySelector('a[href*="fullScorecard.do"]');
          const teamLinks = [...node.querySelectorAll('.schedule-logo a[href*="viewTeam.do"]')];

          return {
            dateBlock: {
              competition: dateCell?.querySelector("h5 strong")?.textContent?.trim() || null,
              day: dateCell?.querySelector("h2")?.textContent?.trim() || null,
              monthYear: dateCell?.querySelectorAll("h5")[1]?.textContent?.trim() || null,
            },
            heading: heading?.textContent?.trim() || null,
            teams: teams?.textContent?.replace(/\s+v\s+/i, " v ").replace(/\s+/g, " ").trim() || null,
            resultText: resultText?.textContent?.trim() || null,
            scoreBlocks: scoreItems.map((item) => ({
              classes: item.className || "",
              score: item.querySelector("span")?.textContent?.trim() || null,
              overs: item.querySelector("p")?.textContent?.trim() || null,
            })),
            scorecardUrl: scorecardLink ? scorecardLink.href : null,
            ballByBallUrl: ballByBallLink ? ballByBallLink.href : null,
            teamUrls: teamLinks.map((link) => link.href),
          };
        }),
      );

      const normalizedCards = rawCards
        .map((card) => normalizeMatchCard(card, division))
        .filter(Boolean);

      writeTextFile(
        path.join(outDir, "raw", `${slugify(division.label)}.html`),
        html,
      );
      writeJsonFile(
        path.join(outDir, "raw", `${slugify(division.label)}.json`),
        {
          division,
          cards: rawCards,
          normalizedCount: normalizedCards.length,
        },
      );

      matches.push(...normalizedCards);
      await page.close();
    }

    result.matches = dedupeMatches(matches);
  });

  writeJsonFile(path.join(outDir, "match_inventory_debug.json"), result);
  return result;
}

function normalizeMatchCard(card, division) {
  const scorecardUrl = card.scorecardUrl ? makeAbsoluteUrl(card.scorecardUrl) : null;
  const ballByBallUrl = card.ballByBallUrl ? makeAbsoluteUrl(card.ballByBallUrl) : null;
  const matchId = extractMatchId(scorecardUrl);

  if (!matchId) {
    return null;
  }

  const [team1Name, team2Name] = splitTeams(card.teams);
  const [team1Score, team2Score] = splitScoreBlocks(card.scoreBlocks);
  const matchDate = buildIsoDate(card.dateBlock?.day, card.dateBlock?.monthYear);

  return {
    source_match_id: matchId,
    division_label: division.label,
    division_league_id: division.leagueId || null,
    match_date: matchDate,
    competition: card.dateBlock?.competition || null,
    heading: card.heading || division.label,
    team_1_name: team1Name,
    team_2_name: team2Name,
    team_1_score: team1Score.score,
    team_1_overs: team1Score.overs,
    team_2_score: team2Score.score,
    team_2_overs: team2Score.overs,
    result_text: card.resultText,
    scorecard_url: scorecardUrl,
    match_page_url: scorecardUrl,
    ball_by_ball_url: ballByBallUrl || scorecardUrl,
    team_urls: (card.teamUrls || []).map((url) => makeAbsoluteUrl(url)),
    raw_card: card,
  };
}

function extractMatchId(url) {
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.searchParams.get("matchId");
}

function splitTeams(value) {
  if (!value) {
    return [null, null];
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const direct = normalized.split(/\s+v\s+/i);
  if (direct.length === 2) {
    return direct.map((entry) => entry.trim());
  }

  const condensedUppercase = normalized.match(/^(.+?)V\s+(.+)$/);
  if (condensedUppercase && condensedUppercase[1] && condensedUppercase[2]) {
    return [condensedUppercase[1].trim(), condensedUppercase[2].trim()];
  }

  return [normalized, null];
}

function splitScoreBlocks(blocks = []) {
  const scoreBlocks = blocks.filter((block) => block && block.score);
  return [
    scoreBlocks[0] || { score: null, overs: null },
    scoreBlocks[1] || { score: null, overs: null },
  ];
}

function buildIsoDate(day, monthYear) {
  if (!day || !monthYear) {
    return null;
  }

  const value = `${day} ${monthYear}`.replace(/\s+/g, " ").trim();
  const parsed = new Date(`${value} UTC`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dedupeMatches(matches) {
  const unique = new Map();
  for (const match of matches) {
    if (!unique.has(match.source_match_id)) {
      unique.set(match.source_match_id, match);
    }
  }
  return [...unique.values()];
}

module.exports = {
  enumerateMatches,
};

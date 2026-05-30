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

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
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
    let divisionPages = (discovery.divisions || []);
    if (targetDivisionSet.size) {
      divisionPages = divisionPages.filter((division) =>
        targetDivisionSet.has(normalizeLabel(division.label)),
      );
    }
    if (!divisionPages.length && discovery.routes?.resultsUrl) {
      divisionPages = [
        {
          label: seriesConfig.label || discovery.series?.label || "All Matches",
          resultsUrl: discovery.routes.resultsUrl,
          href: discovery.routes.resultsUrl,
          leagueId: discovery.series?.leagueId || null,
          isSeriesLevel: true,
        },
      ];
    }
    result.discoveredDivisions = divisionPages;

    const matches = [];

    for (const division of divisionPages) {
      const page = await context.newPage();
      await page.goto(division.resultsUrl || division.href, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(4000);

      let normalizedCards = [];
      let rawCards = [];
      let html = await page.content();

      const legacyRowCount = await page.locator(".row.team-data").count();
      if (legacyRowCount > 0) {
        rawCards = await page.locator(".row.team-data").evaluateAll((nodes) =>
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
              teams: node.querySelector(".schedule-text h3")?.textContent?.replace(/\s+v\s+/i, " v ").replace(/\s+/g, " ").trim() || null,
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

        normalizedCards = rawCards
          .map((card) => normalizeMatchCard(card, division))
          .filter(Boolean);
      } else {
        await applyModernDivisionFilter(page, division.label);
        const modernPageNumbers = await listModernPageNumbers(page);
        const modernEntries = [];

        for (const pageNumber of modernPageNumbers) {
          if (pageNumber > 1) {
            await goToModernPage(page, pageNumber);
          }

          modernEntries.push(...(await readModernResultsPage(page)));
        }

        rawCards = modernEntries;
        normalizedCards = modernEntries
          .map((entry) => normalizeModernResult(entry, division))
          .filter(Boolean);
        html = await page.content();
      }

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
  const queryMatchId = parsed.searchParams.get("matchId");
  if (queryMatchId) {
    return queryMatchId;
  }

  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  const resultsIndex = pathSegments.findIndex((segment) => segment === "results");
  return resultsIndex >= 0 ? pathSegments[resultsIndex + 1] || null : null;
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

function buildIsoDateFromText(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function splitCompactScore(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return { score: null, overs: null };
  }

  const match = normalized.match(/^([^()]+?)(\([^)]*\))?$/);
  return {
    score: normalizeText(match?.[1]) || null,
    overs: normalizeText(match?.[2]) || null,
  };
}

function buildModernBallByBallUrl(url) {
  if (!url) {
    return null;
  }

  const parsed = new URL(url);
  parsed.searchParams.set("tab", "ball_by_ball");
  return parsed.toString();
}

async function applyModernDivisionFilter(page, divisionLabel) {
  const normalizedDivisionLabel = normalizeLabel(divisionLabel);
  if (!normalizedDivisionLabel || normalizedDivisionLabel === "all divisions") {
    return;
  }

  const selectEntries = await page.locator(".ant-select").evaluateAll((nodes) =>
    nodes.map((node, index) => ({
      index,
      label: (node.textContent || "").replace(/\s+/g, " ").trim(),
    }))
  );
  const divisionSelect = selectEntries.find((entry) => /division/i.test(entry.label));
  if (!divisionSelect) {
    return;
  }

  await page.locator(".ant-select").nth(divisionSelect.index).click();
  await page.waitForTimeout(750);

  const optionLocator = page.locator(".ant-select-dropdown .ant-select-item-option");
  const optionCount = await optionLocator.count();
  for (let index = 0; index < optionCount; index += 1) {
    const optionText = normalizeLabel(await optionLocator.nth(index).innerText());
    if (optionText !== normalizedDivisionLabel) {
      continue;
    }

    await optionLocator.nth(index).click();
    await page.waitForTimeout(2500);
    return;
  }

  await page.keyboard.press("Escape").catch(() => {});
}

async function listModernPageNumbers(page) {
  const pageNumbers = await page.locator(".ant-pagination-item").evaluateAll((nodes) =>
    [...new Set(
      nodes
        .map((node) => Number((node.textContent || "").trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    )]
      .sort((left, right) => left - right)
  );

  return pageNumbers.length ? pageNumbers : [1];
}

async function goToModernPage(page, pageNumber) {
  const target = page.locator(`.ant-pagination-item-${pageNumber}`).first();
  if ((await target.count()) === 0) {
    return;
  }

  await target.click();
  await page.waitForTimeout(2500);
}

async function readModernResultsPage(page) {
  return page.evaluate(() => {
    function normalize(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function linesOf(value) {
      return String(value || "")
        .split(/\n+/)
        .map((line) => normalize(line))
        .filter(Boolean);
    }

    return [...document.querySelectorAll("div.cursor-pointer.mb-4")]
      .map((container) => {
        const primaryAnchor = [...container.querySelectorAll('a[href*="/results/"]')].find((anchor) =>
          /\bvs\b/i.test(anchor.innerText || "")
        );
        if (!primaryAnchor) {
          return null;
        }

        const lines = linesOf(primaryAnchor.innerText);
        if (lines.length < 7) {
          return null;
        }

        const containerLines = linesOf(container.innerText);
        const teamUrls = [...container.querySelectorAll('a[href*="/teams/"]')]
          .map((anchor) => ({
            text: normalize(anchor.textContent),
            href: anchor.href,
          }))
          .filter((entry) => entry.href);

        return {
          resultUrl: primaryAnchor.href,
          dateText:
            containerLines.find((line) => /\b\d{4}\b/.test(line) && /\b(?:AM|PM)\b/.test(line)) || "",
          matchType: containerLines.find((line) => /^(league|friendly|tournament)$/i.test(line)) || "",
          resultText:
            containerLines.find((line) =>
              /(won by|match tied|abandoned|no result|cancelled|canceled|drawn)/i.test(line)
            ) || "",
          seriesLabel: lines[0] || "",
          location: lines[1] || "",
          team1Name: lines[2] || "",
          team1ScoreText: lines[3] || "",
          team2Name: lines[5] || "",
          team2ScoreText: lines[6] || "",
          umpires: lines.find((line) => /^Umpires:/i.test(line)) || "",
          teamUrls,
          rawLines: containerLines,
        };
      })
      .filter(Boolean);
  });
}

function normalizeModernResult(entry, division) {
  const scorecardUrl = entry.resultUrl ? makeAbsoluteUrl(entry.resultUrl) : null;
  const matchId = extractMatchId(scorecardUrl);
  if (!matchId) {
    return null;
  }

  const team1Score = splitCompactScore(entry.team1ScoreText);
  const team2Score = splitCompactScore(entry.team2ScoreText);

  return {
    source_match_id: matchId,
    division_label: division.label,
    division_league_id: division.leagueId || null,
    match_date: buildIsoDateFromText(entry.dateText),
    competition: entry.matchType || null,
    heading: entry.seriesLabel || division.label,
    team_1_name: entry.team1Name,
    team_2_name: entry.team2Name,
    team_1_score: team1Score.score,
    team_1_overs: team1Score.overs,
    team_2_score: team2Score.score,
    team_2_overs: team2Score.overs,
    result_text: entry.resultText,
    scorecard_url: scorecardUrl,
    match_page_url: scorecardUrl,
    ball_by_ball_url: buildModernBallByBallUrl(scorecardUrl),
    team_urls: (entry.teamUrls || []).map((team) => makeAbsoluteUrl(team.href)),
    raw_card: entry,
  };
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

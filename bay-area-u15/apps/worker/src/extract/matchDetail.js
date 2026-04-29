const path = require("path");
const { withBrowser } = require("../lib/browser");
const { ensureDir, writeJsonFile, writeTextFile } = require("../lib/fs");
const { normalizeText, parsePlayerIdFromUrl } = require("../lib/cricket");

function buildCommentaryUrl(scorecardUrl, fallbackUrl) {
  const raw = normalizeText(fallbackUrl) || normalizeText(scorecardUrl);
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    if (url.pathname.endsWith("/ballbyball.do")) {
      return url.toString();
    }

    url.pathname = url.pathname.replace(/\/[^/]+$/, "/ballbyball.do");
    return url.toString();
  } catch (_) {
    return raw;
  }
}

function makeMatchOutputDir(outDir, sourceMatchId) {
  return path.join(
    outDir || path.resolve(process.cwd(), "storage/exports/run"),
    "raw",
    "matches",
    String(sourceMatchId || "unknown-match")
  );
}

async function waitForScorecardReady(page) {
  await page.waitForFunction(
    () =>
      !/just a moment/i.test(document.title || "") &&
      document.querySelectorAll("table").length >= 6 &&
      /\bextras\b/i.test(document.body?.innerText || ""),
    { timeout: 90000 }
  );
}

async function waitForCommentaryReady(page) {
  await page.waitForFunction(
    () => {
      if (/just a moment/i.test(document.title || "")) {
        return false;
      }

      const bodyText = document.body?.innerText || "";
      const commentaryRowCount = document.querySelectorAll(
        "#ballByBallTeam1 ul.bbb-row, #ballByBallTeam2 ul.bbb-row"
      ).length;
      const commentaryUnavailable =
        /This View is only available for matches that are scored live via CricClubs Mobile app/i.test(bodyText);

      return commentaryRowCount > 0 || commentaryUnavailable;
    },
    { timeout: 90000 }
  );
}

async function captureScorecard(page) {
  return page.evaluate(() => {
    function normalizeCellText(value) {
      return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }

    function readLinks(node) {
      return [...node.querySelectorAll("a")]
        .map((anchor) => {
          const href = typeof anchor.href === "string" ? anchor.href.trim() : "";
          const text = normalizeCellText(anchor.textContent);
          if (!href && !text) {
            return null;
          }

          let playerId = "";
          try {
            playerId = normalizeCellText(new URL(href, "https://cricclubs.com").searchParams.get("playerId"));
          } catch (_) {
            playerId = "";
          }

          return {
            text,
            href,
            playerId,
          };
        })
        .filter(Boolean);
    }

    function readTable(table, index) {
      return {
        index,
        rows: [...table.querySelectorAll("tr")].map((row, rowIndex) => ({
          rowIndex,
          cells: [...row.querySelectorAll("th,td")].map((cell, cellIndex) => ({
            cellIndex,
            text: normalizeCellText(cell.textContent),
            links: readLinks(cell),
          })),
        })),
      };
    }

    return {
      title: normalizeCellText(document.title),
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5")]
        .map((node) => normalizeCellText(node.textContent))
        .filter(Boolean),
      tables: [...document.querySelectorAll("table")].map(readTable),
    };
  });
}

async function captureCommentary(page) {
  return page.evaluate(() => {
    function normalizeCellText(value) {
      return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }

    function readLinks(node) {
      return [...node.querySelectorAll("a")]
        .map((anchor) => {
          const href = typeof anchor.href === "string" ? anchor.href.trim() : "";
          const text = normalizeCellText(anchor.textContent);
          if (!href && !text) {
            return null;
          }

          let playerId = "";
          try {
            playerId = normalizeCellText(new URL(href, "https://cricclubs.com").searchParams.get("playerId"));
          } catch (_) {
            playerId = "";
          }

          return {
            text,
            href,
            playerId,
          };
        })
        .filter(Boolean);
    }

    function readSection(id, inningsNo) {
      const root = document.querySelector(`#${id}`);
      if (!root) {
        return null;
      }

      return {
        inningsNo,
        heading: normalizeCellText(root.querySelector("h4")?.textContent),
        rows: [...root.querySelectorAll("ul.bbb-row")].map((row, rowIndex) => ({
          rowIndex,
          leftText: normalizeCellText(row.querySelector("li.col2")?.textContent),
          commentaryText: normalizeCellText(row.querySelector("li.col3")?.textContent),
          runsClass:
            row.querySelector("span.runs, span.zero, span.wicket")?.className?.trim() || "",
          links: readLinks(row),
        })),
      };
    }

    const bodyText = normalizeCellText(document.body?.innerText);
    const commentaryUnavailable =
      /This View is only available for matches that are scored live via CricClubs Mobile app/i.test(bodyText);
    const abandoned = /\bAbandoned\b/i.test(bodyText);

    return {
      title: normalizeCellText(document.title),
      commentaryUnavailable,
      unavailableReason: commentaryUnavailable ? "no_live_scoring" : "",
      abandoned,
      bodySummary: bodyText.slice(0, 1200),
      sections: [readSection("ballByBallTeam1", 1), readSection("ballByBallTeam2", 2)].filter(Boolean),
    };
  });
}

async function fetchOnePage(context, url, waitForReady) {
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await waitForReady(page);
    await page.waitForTimeout(1000);

    return {
      html: await page.content(),
      structured:
        waitForReady === waitForCommentaryReady ? await captureCommentary(page) : await captureScorecard(page),
    };
  } finally {
    await page.close();
  }
}

function extractLinkedPlayerIds(payload) {
  const ids = new Set();

  const visitLinks = (links = []) => {
    for (const link of links) {
      const playerId = normalizeText(link?.playerId) || parsePlayerIdFromUrl(link?.href);
      if (playerId) {
        ids.add(playerId);
      }
    }
  };

  for (const table of payload?.tables || []) {
    for (const row of table.rows || []) {
      for (const cell of row.cells || []) {
        visitLinks(cell.links);
      }
    }
  }

  for (const section of payload?.sections || []) {
    for (const row of section.rows || []) {
      visitLinks(row.links);
    }
  }

  return [...ids];
}

async function fetchMatchDetailWithContext(context, matchInventoryRow, options = {}) {
  const scorecardUrl = normalizeText(matchInventoryRow?.scorecard_url);
  const commentaryUrl = buildCommentaryUrl(scorecardUrl, matchInventoryRow?.ball_by_ball_url);
  const matchOutDir = makeMatchOutputDir(options.outDir, matchInventoryRow?.source_match_id);
  ensureDir(matchOutDir);

  if (!scorecardUrl) {
    throw new Error("Cannot fetch match detail without a scorecard URL.");
  }

  const scorecard = await fetchOnePage(context, scorecardUrl, waitForScorecardReady);
  writeTextFile(path.join(matchOutDir, "scorecard.html"), scorecard.html);
  writeJsonFile(path.join(matchOutDir, "scorecard.json"), scorecard.structured);

  const commentary = await fetchOnePage(context, commentaryUrl, waitForCommentaryReady);
  writeTextFile(path.join(matchOutDir, "commentary.html"), commentary.html);
  writeJsonFile(path.join(matchOutDir, "commentary.json"), commentary.structured);

  const rawScorecard = {
    ...scorecard.structured,
    sourceUrl: scorecardUrl,
    commentaryUrl,
    linkedPlayerIds: extractLinkedPlayerIds(scorecard.structured),
  };

  const rawCommentary = {
    ...commentary.structured,
    sourceUrl: commentaryUrl,
    linkedPlayerIds: extractLinkedPlayerIds(commentary.structured),
  };

  return {
    match: matchInventoryRow,
    rawScorecard,
    rawCommentary,
    notes: [
      "Scorecard and commentary fetched through headed Chromium because the source path is Cloudflare-protected.",
      `Raw snapshots saved under ${matchOutDir}.`,
    ],
  };
}

async function fetchMatchDetail(matchInventoryRow, options = {}) {
  if (options.context) {
    return fetchMatchDetailWithContext(options.context, matchInventoryRow, options);
  }

  return withBrowser(
    async (context) => fetchMatchDetailWithContext(context, matchInventoryRow, options),
    { headless: false }
  );
}

module.exports = {
  fetchMatchDetail,
  fetchMatchDetailWithContext,
};

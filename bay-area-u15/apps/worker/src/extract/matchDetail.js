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

    if (url.pathname.includes("/results/")) {
      url.searchParams.set("tab", "ball_by_ball");
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
    () => {
      if (/just a moment/i.test(document.title || "")) {
        return false;
      }

      const bodyText = document.body?.innerText || "";
      const headingText = [...document.querySelectorAll("h1,h2,h3,h4,h5")]
        .map((node) => node.textContent || "")
        .join(" ");
      const tableCount = document.querySelectorAll("table").length;
      const tableHeaderText = [...document.querySelectorAll("table tr:first-child")]
        .map((row) =>
          [...row.querySelectorAll("th,td")]
            .map((cell) => cell.textContent || "")
            .join(" ")
        )
        .join(" ");
      const inningsHeadingCount = (headingText.match(/\bInnings\b/gi) || []).length;
      const hiddenScorecard = /Scorecard Not Available/i.test(bodyText);
      const modernScorecardReady =
        tableCount >= 5 &&
        /Batter/i.test(tableHeaderText) &&
        /Bowler/i.test(tableHeaderText) &&
        (/Fall of Wickets/i.test(tableHeaderText) || inningsHeadingCount >= 2);
      const legacyScorecardReady = tableCount >= 6 && /\bExtras\b/i.test(bodyText);

      return hiddenScorecard || modernScorecardReady || legacyScorecardReady;
    },
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
      const legacyCommentaryRows = document.querySelectorAll(
        "#ballByBallTeam1 ul.bbb-row, #ballByBallTeam2 ul.bbb-row"
      ).length;
      const modernCommentaryRows = document.querySelectorAll(
        "div.border-b.pb-2.flex.flex-col div.text-md.font-semibold"
      ).length;
      const commentaryUnavailable =
        /This View is only available for matches that are scored live via CricClubs Mobile app/i.test(bodyText) ||
        /Ball by Ball Not Available/i.test(bodyText) ||
        /Scorecard Not Available/i.test(bodyText) ||
        /The scorecard is hidden currently/i.test(bodyText);

      return legacyCommentaryRows > 0 || modernCommentaryRows > 0 || commentaryUnavailable;
    },
    { timeout: 90000 }
  );
}

async function captureScorecard(page) {
  return page.evaluate(() => {
    function normalizeCellText(value) {
      return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }

    function resolvePlayerId(href) {
      const raw = normalizeCellText(href);
      if (!raw) {
        return "";
      }

      try {
        const parsed = new URL(raw, "https://cricclubs.com");
        return (
          normalizeCellText(parsed.searchParams.get("playerId")) ||
          normalizeCellText(parsed.searchParams.get("id")) ||
          normalizeCellText(parsed.pathname.split("/").filter(Boolean).slice(-1)[0])
        );
      } catch (_) {
        return "";
      }
    }

    function readLinks(node) {
      return [...node.querySelectorAll("a")]
        .map((anchor) => {
          const href = typeof anchor.href === "string" ? anchor.href.trim() : "";
          const text = normalizeCellText(anchor.textContent);
          if (!href && !text) {
            return null;
          }

          return {
            text,
            href,
            playerId: resolvePlayerId(href),
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

    const bodyText = normalizeCellText(document.body?.innerText);
    const scorecardUnavailable = /Scorecard Not Available/i.test(bodyText);
    const unavailableReason = scorecardUnavailable ? "Scorecard Not Available" : "";

    return {
      title: normalizeCellText(document.title),
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5")]
        .map((node) => normalizeCellText(node.textContent))
        .filter(Boolean),
      scorecardUnavailable,
      unavailableReason,
      bodySummary: bodyText.slice(0, 1200),
      tables: scorecardUnavailable ? [] : [...document.querySelectorAll("table")].map(readTable),
    };
  });
}

async function captureLegacyCommentary(page) {
  return page.evaluate(() => {
    function normalizeCellText(value) {
      return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }

    function resolvePlayerId(href) {
      const raw = normalizeCellText(href);
      if (!raw) {
        return "";
      }

      try {
        const parsed = new URL(raw, "https://cricclubs.com");
        return (
          normalizeCellText(parsed.searchParams.get("playerId")) ||
          normalizeCellText(parsed.searchParams.get("id")) ||
          normalizeCellText(parsed.pathname.split("/").filter(Boolean).slice(-1)[0])
        );
      } catch (_) {
        return "";
      }
    }

    function readLinks(node) {
      return [...node.querySelectorAll("a")]
        .map((anchor) => {
          const href = typeof anchor.href === "string" ? anchor.href.trim() : "";
          const text = normalizeCellText(anchor.textContent);
          if (!href && !text) {
            return null;
          }

          return {
            text,
            href,
            playerId: resolvePlayerId(href),
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
      /This View is only available for matches that are scored live via CricClubs Mobile app/i.test(bodyText) ||
      /Ball by Ball Not Available/i.test(bodyText) ||
      /Scorecard Not Available/i.test(bodyText) ||
      /The scorecard is hidden currently/i.test(bodyText);
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

function uniqueValues(values = []) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function modernCommentaryDropdown(page) {
  return page.locator("button.rounded-2xl.bg-white.shadow-sm").first();
}

async function currentModernCommentaryLabel(page) {
  const dropdown = modernCommentaryDropdown(page);
  if ((await dropdown.count()) === 0) {
    return "";
  }

  return normalizeText(await dropdown.innerText());
}

async function listModernCommentaryOptions(page) {
  const dropdown = modernCommentaryDropdown(page);
  if ((await dropdown.count()) === 0) {
    return [];
  }

  await dropdown.click();
  await page.waitForTimeout(500);

  const optionLocator = page.locator(".ant-dropdown-menu-item");
  const optionCount = await optionLocator.count();
  const options = [];

  for (let index = 0; index < optionCount; index += 1) {
    options.push(normalizeText(await optionLocator.nth(index).innerText()));
  }

  await page.keyboard.press("Escape").catch(() => {});
  return uniqueValues(options);
}

async function selectModernCommentaryInnings(page, label) {
  const targetLabel = normalizeText(label);
  if (!targetLabel) {
    return;
  }

  const currentLabel = await currentModernCommentaryLabel(page);
  if (currentLabel === targetLabel) {
    return;
  }

  const dropdown = modernCommentaryDropdown(page);
  if ((await dropdown.count()) === 0) {
    return;
  }

  await dropdown.click();
  await page.waitForTimeout(500);

  const optionLocator = page.locator(".ant-dropdown-menu-item");
  const optionCount = await optionLocator.count();

  for (let index = 0; index < optionCount; index += 1) {
    if (normalizeText(await optionLocator.nth(index).innerText()) !== targetLabel) {
      continue;
    }

    await optionLocator.nth(index).click();
    await page.waitForTimeout(1500);
    return;
  }

  await page.keyboard.press("Escape").catch(() => {});
}

async function readModernCommentarySection(page) {
  return page.evaluate(() => {
    function normalizeCellText(value) {
      return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }

    function resolvePlayerId(href) {
      const raw = normalizeCellText(href);
      if (!raw) {
        return "";
      }

      try {
        const parsed = new URL(raw, "https://cricclubs.com");
        return (
          normalizeCellText(parsed.searchParams.get("playerId")) ||
          normalizeCellText(parsed.searchParams.get("id")) ||
          normalizeCellText(parsed.pathname.split("/").filter(Boolean).slice(-1)[0])
        );
      } catch (_) {
        return "";
      }
    }

    function readLinks(node) {
      return [...node.querySelectorAll("a")]
        .map((anchor) => {
          const href = typeof anchor.href === "string" ? anchor.href.trim() : "";
          const text = normalizeCellText(anchor.textContent);
          if (!href && !text) {
            return null;
          }

          return {
            text,
            href,
            playerId: resolvePlayerId(href),
          };
        })
        .filter(Boolean);
    }

    const bodyText = normalizeCellText(document.body?.innerText);
    const commentaryUnavailable =
      /This View is only available for matches that are scored live via CricClubs Mobile app/i.test(bodyText) ||
      /Ball by Ball Not Available/i.test(bodyText) ||
      /Scorecard Not Available/i.test(bodyText) ||
      /The scorecard is hidden currently/i.test(bodyText);
    const rowNodes = [...document.querySelectorAll("div.border-b.pb-2.flex.flex-col")];
    const rows = rowNodes
      .map((row, rowIndex) => {
        const runToken = normalizeCellText(row.querySelector("div.w-8.h-8.rounded-full")?.textContent);
        const labelNodes = [...row.querySelectorAll("div.text-md.font-semibold")]
          .map((node) => normalizeCellText(node.textContent))
          .filter(Boolean);
        const ballLabel = labelNodes.length ? labelNodes[labelNodes.length - 1] : "";
        const commentaryText = normalizeCellText(
          row.querySelector("div.text-md.text-gray-900.leading-relaxed.break-words")?.innerText
        );

        if (!ballLabel && !commentaryText) {
          return null;
        }

        return {
          rowIndex,
          leftText: ballLabel ? [runToken, ballLabel].filter(Boolean).join(" ") : "",
          commentaryText,
          runsClass: row.querySelector("div.w-8.h-8.rounded-full")?.className?.trim() || "",
          links: readLinks(row),
          timeText: normalizeCellText(row.querySelector("div.whitespace-nowrap span")?.textContent),
        };
      })
      .filter(Boolean);

    return {
      commentaryUnavailable,
      bodySummary: bodyText.slice(0, 1200),
      rows,
    };
  });
}

async function captureModernCommentary(page) {
  const sections = [];
  const labels = await listModernCommentaryOptions(page);
  const orderedLabels = labels.length
    ? labels
    : uniqueValues([await currentModernCommentaryLabel(page)]);

  let commentaryUnavailable = false;
  let bodySummary = "";

  for (let index = 0; index < orderedLabels.length; index += 1) {
    const label = orderedLabels[index];
    await selectModernCommentaryInnings(page, label);
    const section = await readModernCommentarySection(page);
    commentaryUnavailable = commentaryUnavailable || section.commentaryUnavailable;
    bodySummary = bodySummary || section.bodySummary;
    sections.push({
      inningsNo: index + 1,
      heading: label,
      rows: section.rows,
    });
  }

  const pageText = normalizeText(await page.locator("body").innerText().catch(() => ""));
  const pageCommentaryUnavailable =
    /This View is only available for matches that are scored live via CricClubs Mobile app/i.test(pageText) ||
    /Ball by Ball Not Available/i.test(pageText) ||
    /Scorecard Not Available/i.test(pageText) ||
    /The scorecard is hidden currently/i.test(pageText);

  return {
    title: normalizeText(await page.title()),
    commentaryUnavailable: commentaryUnavailable || pageCommentaryUnavailable,
    unavailableReason: commentaryUnavailable || pageCommentaryUnavailable ? "no_live_scoring" : "",
    abandoned: /\bAbandoned\b/i.test(pageText),
    bodySummary: bodySummary || pageText.slice(0, 1200),
    sections,
  };
}

async function captureCommentary(page) {
  const legacyRowCount = await page.locator("#ballByBallTeam1 ul.bbb-row, #ballByBallTeam2 ul.bbb-row").count();
  if (legacyRowCount > 0) {
    return captureLegacyCommentary(page);
  }

  return captureModernCommentary(page);
}

async function fetchOnePage(context, url, waitForReady) {
  const page = await context.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await waitForReady(page);
    await page.waitForTimeout(750);

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
      ...(rawScorecard.scorecardUnavailable
        ? [`Scorecard unavailable: ${normalizeText(rawScorecard.unavailableReason) || "Scorecard Not Available"}.`]
        : []),
      ...(rawCommentary.commentaryUnavailable
        ? [`Commentary unavailable: ${normalizeText(rawCommentary.unavailableReason) || "no_live_scoring"}.`]
        : []),
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

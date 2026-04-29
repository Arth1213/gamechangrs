const path = require("path");
const { withBrowser } = require("../lib/browser");
const { ensureDir, writeJsonFile, writeTextFile } = require("../lib/fs");

const DEFAULT_CLUB_ID = "40319";
const ROOT_URL = "https://cricclubs.com";

function normalizeLabel(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function makeAbsoluteUrl(href) {
  return new URL(href, ROOT_URL).toString();
}

function parseUrlSafe(value) {
  try {
    return new URL(value, ROOT_URL);
  } catch (_) {
    return null;
  }
}

function extractClubId(url) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).searchParams.get("clubId");
  } catch (_) {
    return null;
  }
}

function extractNamespace(url) {
  if (!url) {
    return null;
  }

  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return normalizeText(segments[0]) || null;
  } catch (_) {
    return null;
  }
}

function getClubId(seriesConfig) {
  return String(
    extractClubId(seriesConfig.series_url) ||
      seriesConfig.source_hints?.legacy_club_id ||
      seriesConfig.source_hints?.club_id ||
      DEFAULT_CLUB_ID,
  );
}

function getNamespace(seriesConfig) {
  return normalizeText(
    extractNamespace(seriesConfig.series_url) ||
      seriesConfig.source_hints?.namespace ||
      seriesConfig.league_name ||
      seriesConfig.expected_league_name ||
      "USACricketJunior"
  );
}

function extractLeagueId(url) {
  try {
    return new URL(url).searchParams.get("league");
  } catch (_) {
    return null;
  }
}

function hasScopedSeriesQuery(url) {
  const parsed = parseUrlSafe(url);
  if (!parsed) {
    return false;
  }

  return ["league", "leagueId", "series", "seriesId"].some((key) =>
    normalizeText(parsed.searchParams.get(key))
  );
}

function isIgnorableDivisionOption(entry) {
  const label = normalizeLabel(entry?.label);
  const parsed = parseUrlSafe(entry?.href);

  if (!label || !parsed) {
    return true;
  }

  if (/^\d{4}$/.test(normalizeText(entry.label))) {
    return true;
  }

  if (["all series", "all teams"].includes(label)) {
    return true;
  }

  const internalClubId = normalizeText(parsed.searchParams.get("internalClubId"));
  if (internalClubId && internalClubId.toLowerCase() !== "null") {
    return true;
  }

  const hasOnlyYearFilter =
    normalizeText(parsed.searchParams.get("year")) &&
    !normalizeText(parsed.searchParams.get("league")) &&
    !normalizeText(parsed.searchParams.get("leagueId")) &&
    !normalizeText(parsed.searchParams.get("series")) &&
    !normalizeText(parsed.searchParams.get("seriesId"));

  if (hasOnlyYearFilter) {
    return true;
  }

  return false;
}

function buildLegacyRoutes(namespace, leagueId, clubId) {
  return {
    leagueUrl: `${ROOT_URL}/${namespace}/viewLeague.do?league=${leagueId}&clubId=${clubId}`,
    resultsUrl: `${ROOT_URL}/${namespace}/listMatches.do?league=${leagueId}&clubId=${clubId}`,
    battingRecordsUrl: `${ROOT_URL}/${namespace}/battingRecords.do?league=${leagueId}&clubId=${clubId}`,
    bowlingRecordsUrl: `${ROOT_URL}/${namespace}/bowlingRecords.do?league=${leagueId}&clubId=${clubId}`,
    fieldingRecordsUrl: `${ROOT_URL}/${namespace}/fieldingRecords.do?league=${leagueId}&clubId=${clubId}`,
    rankingsUrl: `${ROOT_URL}/${namespace}/playerRankings.do?league=${leagueId}&clubId=${clubId}`,
    pointsTableUrl: `${ROOT_URL}/${namespace}/viewPointsTable.do?league=${leagueId}&clubId=${clubId}`,
  };
}

function buildDivisionResultsUrl(namespace, leagueId, clubId) {
  return `${ROOT_URL}/${namespace}/viewLeagueResults.do?league=${leagueId}&clubId=${clubId}`;
}

function buildDivisionStatsUrl(namespace, leagueId, clubId) {
  return `${ROOT_URL}/${namespace}/viewLeague.do?league=${leagueId}&clubId=${clubId}`;
}

function pickLinkByHints(links, hints) {
  return links.find((entry) => {
    const href = normalizeText(entry.href).toLowerCase();
    return hints.some((hint) => href.includes(hint));
  }) || null;
}

async function discoverSeries(seriesConfig, options = {}) {
  const outDir = options.outDir || path.resolve(process.cwd(), "storage/exports/discovery");
  ensureDir(outDir);
  const clubId = getClubId(seriesConfig);
  const namespace = getNamespace(seriesConfig);

  return withBrowser(async (context) => {
    const configuredSeriesPage = await context.newPage();
    await configuredSeriesPage.goto(seriesConfig.series_url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await configuredSeriesPage.waitForTimeout(3000);
    writeTextFile(
      path.join(outDir, "raw", "configured_series_url.html"),
      await configuredSeriesPage.content(),
    );
    const configuredLinks = await configuredSeriesPage.locator("a").evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          label: (node.textContent || "").trim(),
          href: node.href,
        }))
        .filter((entry) => entry.href),
    );
    writeJsonFile(path.join(outDir, "raw", "configured_series_links.json"), configuredLinks);

    const explicitLeagueId =
      extractLeagueId(seriesConfig.series_url) ||
      normalizeText(seriesConfig.source_hints?.legacy_league_id) ||
      "";

    let matchedSeries = null;
    let seriesCandidates = [];
    if (explicitLeagueId) {
      matchedSeries = {
        label: seriesConfig.label,
        href: buildLegacyRoutes(namespace, explicitLeagueId, clubId).leagueUrl,
        normalizedEntryLabel: normalizeLabel(seriesConfig.label),
        score: 100,
      };
    } else {
      const leagueIndexPage = await context.newPage();
      await leagueIndexPage.goto(`${ROOT_URL}/${namespace}/viewAllLeagues.do?clubId=${clubId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await leagueIndexPage.waitForTimeout(4000);

      seriesCandidates = await leagueIndexPage.locator("a").evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            label: (node.textContent || "").trim(),
            href: node.href,
          }))
          .filter((entry) => entry.label && entry.href.includes("/viewLeague.do?league=")),
      );

      writeTextFile(path.join(outDir, "raw", "league_index.html"), await leagueIndexPage.content());
      writeJsonFile(path.join(outDir, "raw", "league_index_links.json"), seriesCandidates);
      await leagueIndexPage.close();

      const desiredSeries = normalizeLabel(seriesConfig.label);
      const rankedCandidates = seriesCandidates
        .map((entry) => {
          const normalizedEntryLabel = normalizeLabel(entry.label);
          let score = 0;

          if (normalizedEntryLabel === desiredSeries) {
            score += 5;
          } else if (desiredSeries && normalizedEntryLabel.includes(desiredSeries)) {
            score += 4;
          } else if (desiredSeries && desiredSeries.includes(normalizedEntryLabel)) {
            score += 3;
          }

          return {
            ...entry,
            normalizedEntryLabel,
            score,
          };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.label.length - right.label.length);
      matchedSeries = rankedCandidates[0];
    }

    if (!matchedSeries) {
      throw new Error(`Unable to find a public series link for "${seriesConfig.label}".`);
    }

    const leagueId = extractLeagueId(matchedSeries.href);
    if (!leagueId) {
      throw new Error(`Unable to extract a league id from ${matchedSeries.href}`);
    }

    const legacyRoutes = buildLegacyRoutes(namespace, leagueId, clubId);
    const configuredResultsLink = pickLinkByHints(configuredLinks, [
      "viewleagueresults.do",
      "listmatches.do",
      "/results",
    ]);
    const configuredStatsLinks = {
      batting: pickLinkByHints(configuredLinks, ["battingrecords.do", "/statistics/batting-records"]),
      bowling: pickLinkByHints(configuredLinks, ["bowlingrecords.do", "/statistics/bowling-records"]),
      fielding: pickLinkByHints(configuredLinks, ["fieldingrecords.do", "/statistics/fielding-records"]),
      rankings: pickLinkByHints(configuredLinks, ["playerrankings.do", "/statistics/rankings-records"]),
      pointsTable: pickLinkByHints(configuredLinks, ["viewpointstable.do"]),
    };
    if (configuredResultsLink?.href && hasScopedSeriesQuery(configuredResultsLink.href)) {
      legacyRoutes.resultsUrl = configuredResultsLink.href;
    }
    if (configuredStatsLinks.batting?.href && hasScopedSeriesQuery(configuredStatsLinks.batting.href)) {
      legacyRoutes.battingRecordsUrl = configuredStatsLinks.batting.href;
    }
    if (configuredStatsLinks.bowling?.href && hasScopedSeriesQuery(configuredStatsLinks.bowling.href)) {
      legacyRoutes.bowlingRecordsUrl = configuredStatsLinks.bowling.href;
    }
    if (configuredStatsLinks.fielding?.href && hasScopedSeriesQuery(configuredStatsLinks.fielding.href)) {
      legacyRoutes.fieldingRecordsUrl = configuredStatsLinks.fielding.href;
    }
    if (configuredStatsLinks.rankings?.href && hasScopedSeriesQuery(configuredStatsLinks.rankings.href)) {
      legacyRoutes.rankingsUrl = configuredStatsLinks.rankings.href;
    }
    if (configuredStatsLinks.pointsTable?.href && hasScopedSeriesQuery(configuredStatsLinks.pointsTable.href)) {
      legacyRoutes.pointsTableUrl = configuredStatsLinks.pointsTable.href;
    }

    const leaguePage = await context.newPage();
    await leaguePage.goto(legacyRoutes.leagueUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await leaguePage.waitForTimeout(4000);

    const seriesMeta = await leaguePage.evaluate(() => {
      const bodyText = document.body.innerText;
      const detailPairs = [...document.querySelectorAll(".series-details strong, .series-details td, .series-details span")]
        .map((node) => (node.textContent || "").trim())
        .filter(Boolean);

      return {
        title: document.title,
        pageTextSample: bodyText.slice(0, 4000),
        detailPairs,
      };
    });
    writeTextFile(path.join(outDir, "raw", "series_page.html"), await leaguePage.content());

    const resultsPage = await context.newPage();
    await resultsPage.goto(legacyRoutes.resultsUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await resultsPage.waitForTimeout(4000);

    const dropdownGroups = await resultsPage.locator(".series-drop .dropdown").evaluateAll((nodes) =>
      nodes
        .map((node, index) => {
          const button = node.querySelector("button");
          const labelNode = button?.querySelector("span");
          const buttonLabel = (labelNode?.textContent || button?.textContent || "").trim();
          const options = [...node.querySelectorAll('li[role="presentation"] a')]
            .map((link) => ({
              label: (link.textContent || "").trim(),
              href: link.href,
            }))
            .filter((entry) => entry.label);

          return {
            index,
            buttonId: button?.id || null,
            buttonLabel,
            options,
          };
        })
        .filter((group) => group.options.length),
    );
    const divisionDropdown =
      dropdownGroups.find((group) => normalizeLabel(group.buttonLabel).includes("division")) ||
      dropdownGroups.find((group) =>
        group.options.some((entry) => normalizeLabel(entry.label) === "all divisions")
      ) ||
      null;
    const divisionOptions = divisionDropdown?.options || [];
    writeTextFile(path.join(outDir, "raw", "results_page.html"), await resultsPage.content());
    writeJsonFile(path.join(outDir, "raw", "dropdown_groups.json"), dropdownGroups);
    writeJsonFile(path.join(outDir, "raw", "division_options.json"), divisionOptions);

    const targetDivisionLabels = new Set(
      ((seriesConfig.targeting && seriesConfig.targeting.divisions) || [])
        .filter((division) => division.enabled !== false)
        .map((division) => normalizeLabel(division.label)),
    );

    const filteredDivisionOptions = divisionOptions.filter((entry) => !isIgnorableDivisionOption(entry));

    let discoveredTargetDivisions = filteredDivisionOptions
      .filter((entry) =>
        targetDivisionLabels.size
          ? targetDivisionLabels.has(normalizeLabel(entry.label))
          : true
      )
      .map((entry) => {
        const divisionLeagueId = extractLeagueId(entry.href) || leagueId;
        const absoluteHref = makeAbsoluteUrl(entry.href);
        const hrefLower = absoluteHref.toLowerCase();
        const resultsUrl =
          hrefLower.includes("viewleagueresults.do") || hrefLower.includes("listmatches.do") || hrefLower.includes("/results")
            ? absoluteHref
            : buildDivisionResultsUrl(namespace, divisionLeagueId, clubId);
        const statsUrl =
          hrefLower.includes("viewleague.do")
            ? absoluteHref
            : buildDivisionStatsUrl(namespace, divisionLeagueId, clubId);
        return {
          label: entry.label,
          href: resultsUrl,
          sourceHref: entry.href,
          leagueId: divisionLeagueId,
          resultsUrl,
          statsUrl,
        };
      });

    if (!discoveredTargetDivisions.length) {
      discoveredTargetDivisions = [
        {
          label: seriesConfig.label || "All Matches",
          href: legacyRoutes.resultsUrl,
          sourceHref: legacyRoutes.resultsUrl,
          leagueId,
          resultsUrl: legacyRoutes.resultsUrl,
          statsUrl: legacyRoutes.leagueUrl,
          isSeriesLevel: true,
        },
      ];
    }

    const result = {
      series: {
        slug: seriesConfig.slug,
        label: seriesConfig.label,
        url: matchedSeries.href,
        namespace,
        clubId,
        leagueId,
      },
      sourceHints: {
        configuredSeriesUrl: seriesConfig.series_url,
        configuredSeriesPageTitle: await configuredSeriesPage.title(),
        matchedSeriesUrl: matchedSeries.href,
      },
      meta: seriesMeta,
      statsPages: {
        batting: legacyRoutes.battingRecordsUrl,
        bowling: legacyRoutes.bowlingRecordsUrl,
        fielding: legacyRoutes.fieldingRecordsUrl,
        rankings: legacyRoutes.rankingsUrl,
        pointsTable: legacyRoutes.pointsTableUrl,
      },
      routes: legacyRoutes,
      divisions: discoveredTargetDivisions,
      allDivisionOptions: divisionOptions,
    };

    writeJsonFile(path.join(outDir, "series_discovery_debug.json"), result);
    return result;
  });
}

module.exports = {
  discoverSeries,
};

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

function makeAbsoluteUrl(href) {
  return new URL(href, ROOT_URL).toString();
}

function getClubId(seriesConfig) {
  return String(
    seriesConfig.source_hints?.legacy_club_id ||
      seriesConfig.source_hints?.club_id ||
      DEFAULT_CLUB_ID,
  );
}

function extractLeagueId(url) {
  return new URL(url).searchParams.get("league");
}

function buildLegacyRoutes(leagueId, clubId) {
  return {
    leagueUrl: `${ROOT_URL}/USACricketJunior/viewLeague.do?league=${leagueId}&clubId=${clubId}`,
    resultsUrl: `${ROOT_URL}/USACricketJunior/listMatches.do?league=${leagueId}&clubId=${clubId}`,
    battingRecordsUrl: `${ROOT_URL}/USACricketJunior/battingRecords.do?league=${leagueId}&clubId=${clubId}`,
    bowlingRecordsUrl: `${ROOT_URL}/USACricketJunior/bowlingRecords.do?league=${leagueId}&clubId=${clubId}`,
    fieldingRecordsUrl: `${ROOT_URL}/USACricketJunior/fieldingRecords.do?league=${leagueId}&clubId=${clubId}`,
    rankingsUrl: `${ROOT_URL}/USACricketJunior/playerRankings.do?league=${leagueId}&clubId=${clubId}`,
    pointsTableUrl: `${ROOT_URL}/USACricketJunior/viewPointsTable.do?league=${leagueId}&clubId=${clubId}`,
  };
}

async function discoverSeries(seriesConfig, options = {}) {
  const outDir = options.outDir || path.resolve(process.cwd(), "storage/exports/discovery");
  ensureDir(outDir);
  const clubId = getClubId(seriesConfig);

  return withBrowser(async (context) => {
    const configuredSeriesPage = await context.newPage();
    await configuredSeriesPage.goto(seriesConfig.series_url, { waitUntil: "domcontentloaded" });
    await configuredSeriesPage.waitForTimeout(3000);
    writeTextFile(
      path.join(outDir, "raw", "configured_series_url.html"),
      await configuredSeriesPage.content(),
    );

    const leagueIndexPage = await context.newPage();
    await leagueIndexPage.goto(`${ROOT_URL}/USACricketJunior/viewAllLeagues.do?clubId=${clubId}`, {
      waitUntil: "domcontentloaded",
    });
    await leagueIndexPage.waitForTimeout(4000);

    const seriesCandidates = await leagueIndexPage.locator("a").evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          label: (node.textContent || "").trim(),
          href: node.href,
        }))
        .filter((entry) => entry.label && entry.href.includes("/viewLeague.do?league=")),
    );

    writeTextFile(path.join(outDir, "raw", "league_index.html"), await leagueIndexPage.content());
    writeJsonFile(path.join(outDir, "raw", "league_index_links.json"), seriesCandidates);

    const desiredSeries = normalizeLabel(seriesConfig.label);
    const bayAreaCandidates = seriesCandidates
      .filter((entry) => normalizeLabel(entry.label).includes("bay area"))
      .sort((left, right) => {
        const leftScore = normalizeLabel(left.label) === desiredSeries ? 2 : 0;
        const rightScore = normalizeLabel(right.label) === desiredSeries ? 2 : 0;
        return rightScore - leftScore || left.label.length - right.label.length;
      });
    const matchedSeries = bayAreaCandidates[0];

    if (!matchedSeries) {
      throw new Error(`Unable to find a public Bay Area series link for "${seriesConfig.label}".`);
    }

    const leagueId = extractLeagueId(matchedSeries.href);
    if (!leagueId) {
      throw new Error(`Unable to extract a league id from ${matchedSeries.href}`);
    }

    const legacyRoutes = buildLegacyRoutes(leagueId, clubId);

    const leaguePage = await context.newPage();
    await leaguePage.goto(legacyRoutes.leagueUrl, { waitUntil: "domcontentloaded" });
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
    await resultsPage.goto(legacyRoutes.resultsUrl, { waitUntil: "domcontentloaded" });
    await resultsPage.waitForTimeout(4000);

    const divisionOptions = await resultsPage.locator('li[role="presentation"] a').evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          label: (node.textContent || "").trim(),
          href: node.href,
        }))
        .filter((entry) => entry.label),
    );
    writeTextFile(path.join(outDir, "raw", "results_page.html"), await resultsPage.content());
    writeJsonFile(path.join(outDir, "raw", "division_options.json"), divisionOptions);

    const targetDivisionLabels = new Set(
      ((seriesConfig.targeting && seriesConfig.targeting.divisions) || [])
        .filter((division) => division.enabled !== false)
        .map((division) => normalizeLabel(division.label)),
    );

    const discoveredTargetDivisions = divisionOptions
      .filter((entry) => targetDivisionLabels.has(normalizeLabel(entry.label)))
      .map((entry) => ({
        label: entry.label,
        href: entry.href,
        leagueId: extractLeagueId(entry.href),
      }));

    const result = {
      series: {
        slug: seriesConfig.slug,
        label: seriesConfig.label,
        url: matchedSeries.href,
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

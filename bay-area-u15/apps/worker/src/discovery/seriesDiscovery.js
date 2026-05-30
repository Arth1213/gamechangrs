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

function decodeSeriesName(value) {
  let decoded = normalizeText(value);

  for (let index = 0; index < 2; index += 1) {
    if (!decoded) {
      return "";
    }

    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        break;
      }
      decoded = normalizeText(next);
    } catch (_) {
      break;
    }
  }

  return decoded;
}

function extractSourceSeriesId(url) {
  const parsed = parseUrlSafe(url);
  if (!parsed) {
    return "";
  }

  return (
    normalizeText(parsed.searchParams.get("series")) ||
    normalizeText(parsed.searchParams.get("seriesId")) ||
    normalizeText(parsed.searchParams.get("league")) ||
    normalizeText(parsed.searchParams.get("leagueId"))
  );
}

function slugifyValue(value) {
  return normalizeLabel(value).replace(/\s+/g, "-") || "source";
}

function buildTargetingOverride(seriesConfig, label) {
  const targeting = seriesConfig?.targeting || {};
  const targetDivisions = Array.isArray(targeting.divisions) ? targeting.divisions : [];
  const normalizedLabel = normalizeLabel(label);

  if (!normalizedLabel || !targetDivisions.length) {
    return targeting;
  }

  const selectedDivisions = targetDivisions.filter(
    (division) => normalizeLabel(division.label) === normalizedLabel
  );

  return {
    ...targeting,
    divisions: selectedDivisions.length ? selectedDivisions : targetDivisions,
  };
}

function buildDiscoverySourceConfigs(seriesConfig) {
  const sourceHints = seriesConfig?.source_hints || {};
  const targetDivisions = Array.isArray(seriesConfig?.targeting?.divisions)
    ? seriesConfig.targeting.divisions
    : [];
  const targetDivisionLabels = targetDivisions.map((division) => normalizeText(division.label)).filter(Boolean);
  const additionalSources = [];

  for (const entry of Array.isArray(sourceHints.additional_sources) ? sourceHints.additional_sources : []) {
    if (typeof entry === "string") {
      additionalSources.push({ series_url: entry });
    } else if (entry && typeof entry === "object") {
      additionalSources.push(entry);
    }
  }

  for (const [index, entry] of (Array.isArray(sourceHints.additional_series_urls)
    ? sourceHints.additional_series_urls
    : []).entries()) {
    if (typeof entry === "string") {
      additionalSources.push({
        label: targetDivisionLabels[index + 1] || "",
        series_url: entry,
      });
      continue;
    }

    if (entry && typeof entry === "object") {
      additionalSources.push(entry);
    }
  }

  const rawSources = [
    {
      label: normalizeText(sourceHints.primary_label) || targetDivisionLabels[0] || normalizeText(seriesConfig.label),
      series_url: normalizeText(seriesConfig.series_url),
      source_hints: {
        ...sourceHints,
      },
    },
    ...additionalSources.map((entry) => ({
      label:
        normalizeText(entry.label) ||
        normalizeText(entry.source_label) ||
        normalizeText(entry.target_label),
      series_url: normalizeText(entry.series_url || entry.url),
      source_hints: {
        ...sourceHints,
        ...(entry.source_hints || {}),
        series_id:
          normalizeText(entry.series_id) ||
          normalizeText(entry.source_hints?.series_id) ||
          extractSourceSeriesId(entry.series_url || entry.url) ||
          undefined,
      },
    })),
  ];

  const seenSeriesUrls = new Set();
  const sourceConfigs = [];

  for (const [index, entry] of rawSources.entries()) {
    const seriesUrl = normalizeText(entry.series_url);
    if (!seriesUrl || seenSeriesUrls.has(seriesUrl)) {
      continue;
    }

    seenSeriesUrls.add(seriesUrl);
    const label = normalizeText(entry.label) || normalizeText(seriesConfig.label);
    sourceConfigs.push({
      ...seriesConfig,
      label,
      series_url: seriesUrl,
      source_hints: {
        ...sourceHints,
        ...(entry.source_hints || {}),
        series_id:
          normalizeText(entry.source_hints?.series_id) ||
          extractSourceSeriesId(seriesUrl) ||
          undefined,
      },
      targeting: buildTargetingOverride(seriesConfig, label),
      _multiSourceIndex: index,
    });
  }

  return sourceConfigs.length ? sourceConfigs : [seriesConfig];
}

function sortDiscoveredDivisions(divisions, seriesConfig) {
  const targetOrder = new Map(
    ((seriesConfig?.targeting && Array.isArray(seriesConfig.targeting.divisions))
      ? seriesConfig.targeting.divisions
      : []
    ).map((division, index) => [normalizeLabel(division.label), index])
  );

  return [...divisions].sort((left, right) => {
    const leftOrder = targetOrder.has(normalizeLabel(left.label))
      ? targetOrder.get(normalizeLabel(left.label))
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = targetOrder.has(normalizeLabel(right.label))
      ? targetOrder.get(normalizeLabel(right.label))
      : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return normalizeText(left.label).localeCompare(normalizeText(right.label));
  });
}

function mergeDiscoveryResults(seriesConfig, sourceResults, outDir) {
  const primary = sourceResults[0];
  const divisionEntries = [];
  const allDivisionOptions = [];
  const seenDivisionKeys = new Set();
  const seenOptionKeys = new Set();

  for (const sourceResult of sourceResults) {
    const sourceSeriesId =
      normalizeText(sourceResult?.sourceHints?.configuredSourceSeriesId) ||
      extractSourceSeriesId(sourceResult?.sourceHints?.configuredSeriesUrl) ||
      normalizeText(sourceResult?.series?.leagueId);

    for (const division of Array.isArray(sourceResult?.divisions) ? sourceResult.divisions : []) {
      const enrichedDivision = {
        ...division,
        sourceSeriesId: sourceSeriesId || undefined,
        sourceSeriesLabel: normalizeText(sourceResult?.series?.label) || undefined,
        sourceSeriesUrl:
          normalizeText(sourceResult?.sourceHints?.configuredSeriesUrl) ||
          normalizeText(sourceResult?.series?.url) ||
          undefined,
      };
      const divisionKey = [
        normalizeLabel(enrichedDivision.label),
        normalizeText(enrichedDivision.resultsUrl || enrichedDivision.href),
        normalizeText(enrichedDivision.leagueId),
        normalizeText(enrichedDivision.filterLabel),
      ].join("|");

      if (seenDivisionKeys.has(divisionKey)) {
        continue;
      }

      seenDivisionKeys.add(divisionKey);
      divisionEntries.push(enrichedDivision);
    }

    for (const option of Array.isArray(sourceResult?.allDivisionOptions)
      ? sourceResult.allDivisionOptions
      : []) {
      const optionKey = [
        normalizeLabel(option.label),
        normalizeText(option.href),
      ].join("|");

      if (seenOptionKeys.has(optionKey)) {
        continue;
      }

      seenOptionKeys.add(optionKey);
      allDivisionOptions.push(option);
    }
  }

  const merged = {
    series: {
      ...(primary?.series || {}),
      slug: seriesConfig.slug,
      label: seriesConfig.label,
      sourceSeries: sourceResults.map((sourceResult) => ({
        label: normalizeText(sourceResult?.series?.label),
        configuredSeriesUrl: normalizeText(sourceResult?.sourceHints?.configuredSeriesUrl),
        matchedSeriesUrl: normalizeText(sourceResult?.sourceHints?.matchedSeriesUrl),
        leagueId: normalizeText(sourceResult?.series?.leagueId),
        clubId: normalizeText(sourceResult?.series?.clubId),
      })),
    },
    sourceHints: {
      configuredSeriesUrl: normalizeText(seriesConfig.series_url),
      configuredSeriesPageTitle: normalizeText(primary?.sourceHints?.configuredSeriesPageTitle),
      matchedSeriesUrl: normalizeText(primary?.sourceHints?.matchedSeriesUrl),
      configuredSourceSeriesId:
        normalizeText(primary?.sourceHints?.configuredSourceSeriesId) ||
        extractSourceSeriesId(seriesConfig.series_url),
      additionalSeriesUrls: sourceResults
        .slice(1)
        .map((sourceResult) => normalizeText(sourceResult?.sourceHints?.configuredSeriesUrl))
        .filter(Boolean),
    },
    meta: {
      title: normalizeText(primary?.meta?.title),
      pageTextSample: normalizeText(primary?.meta?.pageTextSample),
      detailPairs: Array.isArray(primary?.meta?.detailPairs) ? primary.meta.detailPairs : [],
      sourcePages: sourceResults.map((sourceResult) => ({
        label: normalizeText(sourceResult?.series?.label),
        title: normalizeText(sourceResult?.meta?.title),
        leagueId: normalizeText(sourceResult?.series?.leagueId),
        configuredSeriesUrl: normalizeText(sourceResult?.sourceHints?.configuredSeriesUrl),
        matchedSeriesUrl: normalizeText(sourceResult?.sourceHints?.matchedSeriesUrl),
      })),
    },
    statsPages: primary?.statsPages || {},
    routes: {
      ...(primary?.routes || {}),
      additionalResultsUrls: sourceResults
        .slice(1)
        .map((sourceResult) => normalizeText(sourceResult?.routes?.resultsUrl))
        .filter(Boolean),
    },
    divisions: sortDiscoveredDivisions(divisionEntries, seriesConfig),
    allDivisionOptions,
  };

  writeJsonFile(path.join(outDir, "series_discovery_sources.json"), {
    series: seriesConfig.slug,
    sources: sourceResults,
  });
  writeJsonFile(path.join(outDir, "series_discovery_debug.json"), merged);
  return merged;
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

function buildModernSeriesResultsUrl(seriesConfig) {
  const explicitResultsUrl = normalizeText(seriesConfig.source_hints?.results_url);
  if (explicitResultsUrl) {
    return explicitResultsUrl;
  }

  const parsed = parseUrlSafe(seriesConfig.series_url);
  const modernLeagueId = normalizeText(seriesConfig.source_hints?.league_id);
  const modernSeriesId = normalizeText(seriesConfig.source_hints?.series_id);
  if (!parsed || !parsed.pathname.includes("/series-list/") || !modernLeagueId || !modernSeriesId) {
    return "";
  }

  const namespace = getNamespace(seriesConfig);
  const scopedResultsUrl = new URL(`${ROOT_URL}/${namespace}/results`);
  scopedResultsUrl.searchParams.set("leagueId", modernLeagueId);

  const seasonYear = normalizeText(seriesConfig.season_year);
  if (seasonYear) {
    scopedResultsUrl.searchParams.set("year", seasonYear);
  }

  scopedResultsUrl.searchParams.set("series", modernSeriesId);
  scopedResultsUrl.searchParams.set("division", "all");

  const seriesName = decodeSeriesName(parsed.searchParams.get("seriesName"));
  if (seriesName) {
    scopedResultsUrl.searchParams.set("seriesName", seriesName);
  }

  return scopedResultsUrl.toString();
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

async function discoverSingleSeries(seriesConfig, options = {}) {
  const outDir = options.outDir || path.resolve(process.cwd(), "storage/exports/discovery");
  ensureDir(outDir);
  const clubId = getClubId(seriesConfig);
  const namespace = getNamespace(seriesConfig);
  const modernResultsUrl = buildModernSeriesResultsUrl(seriesConfig);

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
    if (modernResultsUrl && hasScopedSeriesQuery(modernResultsUrl)) {
      legacyRoutes.resultsUrl = modernResultsUrl;
    } else if (configuredResultsLink?.href && hasScopedSeriesQuery(configuredResultsLink.href)) {
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
    const legacyDivisionOptions = divisionDropdown?.options || [];

    let modernDivisionOptions = [];
    if (!legacyDivisionOptions.length) {
      const selectEntries = await resultsPage.locator(".ant-select").evaluateAll((nodes) =>
        nodes.map((node, index) => ({
          index,
          label: (node.textContent || "").replace(/\s+/g, " ").trim(),
        }))
      );
      const divisionSelect = selectEntries.find((entry) => /division/i.test(entry.label));
      if (divisionSelect) {
        await resultsPage.locator(".ant-select").nth(divisionSelect.index).click();
        await resultsPage.waitForTimeout(750);
        modernDivisionOptions = await resultsPage
          .locator(".ant-select-dropdown .ant-select-item-option")
          .evaluateAll((nodes) =>
            nodes
              .map((node) => ({
                label: (node.textContent || "").replace(/\s+/g, " ").trim(),
                href: "",
              }))
              .filter((entry) => entry.label)
          );
        await resultsPage.keyboard.press("Escape").catch(() => {});
      }
    }

    const divisionOptions = legacyDivisionOptions.length ? legacyDivisionOptions : modernDivisionOptions;
    writeTextFile(path.join(outDir, "raw", "results_page.html"), await resultsPage.content());
    writeJsonFile(path.join(outDir, "raw", "dropdown_groups.json"), dropdownGroups);
    writeJsonFile(path.join(outDir, "raw", "division_options.json"), divisionOptions);

    const targetDivisionLabels = new Set(
      ((seriesConfig.targeting && seriesConfig.targeting.divisions) || [])
        .filter((division) => division.enabled !== false)
        .map((division) => normalizeLabel(division.label)),
    );

    const filteredDivisionOptions = legacyDivisionOptions.length
      ? divisionOptions.filter((entry) => !isIgnorableDivisionOption(entry))
      : divisionOptions.filter((entry) => normalizeLabel(entry.label) !== "all divisions");

    const selectedDivisionOptions = filteredDivisionOptions.filter((entry) =>
      targetDivisionLabels.size
        ? targetDivisionLabels.has(normalizeLabel(entry.label))
        : true
    );

    let discoveredTargetDivisions = legacyDivisionOptions.length
      ? selectedDivisionOptions.map((entry) => {
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
        })
      : selectedDivisionOptions.map((entry) => ({
          label: entry.label,
          href: legacyRoutes.resultsUrl,
          sourceHref: legacyRoutes.resultsUrl,
          leagueId: "",
          resultsUrl: legacyRoutes.resultsUrl,
          statsUrl: legacyRoutes.leagueUrl,
          filterLabel: entry.label,
        }));

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
        configuredSourceSeriesId:
          normalizeText(seriesConfig.source_hints?.series_id) ||
          extractSourceSeriesId(seriesConfig.series_url),
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

async function discoverSeries(seriesConfig, options = {}) {
  const outDir = options.outDir || path.resolve(process.cwd(), "storage/exports/discovery");
  ensureDir(outDir);

  const sourceConfigs = buildDiscoverySourceConfigs(seriesConfig);
  if (sourceConfigs.length <= 1) {
    return discoverSingleSeries(sourceConfigs[0], options);
  }

  const sourceResults = [];
  for (const [index, sourceConfig] of sourceConfigs.entries()) {
    const sourceOutDir = path.join(
      outDir,
      "sources",
      `${String(index + 1).padStart(2, "0")}-${slugifyValue(sourceConfig.label || sourceConfig.series_url)}`
    );
    sourceResults.push(await discoverSingleSeries(sourceConfig, { ...options, outDir: sourceOutDir }));
  }

  return mergeDiscoveryResults(seriesConfig, sourceResults, outDir);
}

module.exports = {
  discoverSeries,
};

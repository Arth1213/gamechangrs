const path = require("path");
const { withBrowser } = require("../../lib/browser");
const { writeJsonFile, writeTextFile } = require("../../lib/fs");

function makeCapability(status, notes = []) {
  return {
    status,
    notes,
  };
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function classifyVariant(url) {
  const pathname = url.pathname.toLowerCase();

  if (pathname.includes("/series-list/")) {
    return "series-list";
  }

  if (pathname.includes("/viewleague.do")) {
    return "legacy-viewleague";
  }

  if (pathname.includes("/viewallleagues.do")) {
    return "league-index";
  }

  return "custom-or-unknown";
}

function extractSourceSeriesId(url) {
  const directValue =
    url.searchParams.get("series") ||
    url.searchParams.get("league") ||
    url.searchParams.get("seriesId");

  if (directValue) {
    return directValue;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const seriesListIndex = segments.findIndex((segment) => segment.toLowerCase() === "series-list");
  if (seriesListIndex !== -1 && segments[seriesListIndex + 1]) {
    return segments[seriesListIndex + 1];
  }

  return null;
}

function summarizeDivisionHints(links, seriesConfig) {
  const configuredDivisions = (seriesConfig?.targeting?.divisions || [])
    .filter((division) => division.enabled !== false)
    .map((division) => division.label);

  const linkedDivisions = links
    .filter((entry) => {
      const label = normalizeLabel(entry.label);
      return label.includes("division") || label.includes("div ") || label.includes("phase");
    })
    .map((entry) => entry.label);

  return {
    configuredDivisions,
    linkedDivisions,
  };
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}

async function probeCricClubsSeries({ url, label, outDir, seriesConfig }) {
  return withBrowser(async (context) => {
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    const parsedFinalUrl = new URL(finalUrl);
    const html = await page.content();
    const title = await page.title();
    const links = await page.locator("a").evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          label: (node.textContent || "").trim(),
          href: node.href,
        }))
        .filter((entry) => entry.href),
    );

    const htmlLower = html.toLowerCase();
    const linkUrls = links.map((entry) => String(entry.href || "").toLowerCase());
    const variantKey = classifyVariant(parsedFinalUrl);
    const sourceSeriesId = extractSourceSeriesId(parsedFinalUrl) || seriesConfig?.source_hints?.series_id || null;
    const clubId =
      parsedFinalUrl.searchParams.get("clubId") ||
      seriesConfig?.source_hints?.club_id ||
      seriesConfig?.source_hints?.legacy_club_id ||
      null;

    const resultsSignals = linkUrls.filter(
      (href) =>
        href.includes("results") ||
        href.includes("listmatches.do") ||
        href.includes("viewleagueresults.do"),
    );
    const scorecardSignals = linkUrls.filter((href) => href.includes("viewscorecard.do"));
    const playerSignals = linkUrls.filter((href) => href.includes("viewplayer.do"));
    const standingsSignals = linkUrls.filter(
      (href) =>
        href.includes("viewpointstable.do") ||
        href.includes("playerrankings.do") ||
        href.includes("statistics/"),
    );
    const ballByBallSignals = [
      htmlLower.includes("ball by ball coverage") ? "ball-by-ball text" : null,
      htmlLower.includes("bowler.png") ? "ball-by-ball icon" : null,
    ].filter(Boolean);

    const divisionHints = summarizeDivisionHints(links, seriesConfig);

    const scorecardsCapability =
      scorecardSignals.length > 0
        ? makeCapability("confirmed", [`Detected ${scorecardSignals.length} scorecard links on the probed page.`])
        : resultsSignals.length > 0 || variantKey !== "custom-or-unknown"
          ? makeCapability("possible", [
              "No direct scorecard links were found on the landing page, but results or league routes were detected.",
            ])
          : makeCapability("unknown", ["The probed page did not expose direct results or scorecard links."]);

    const ballByBallCapability =
      ballByBallSignals.length > 0
        ? makeCapability("confirmed", ballByBallSignals.map((signal) => `Detected ${signal}.`))
        : scorecardsCapability.status === "confirmed" || scorecardsCapability.status === "possible"
          ? makeCapability("possible", [
              "Ball-by-ball was not confirmed on the landing page. Confirm on a sample scorecard during onboarding.",
            ])
          : makeCapability("unknown", ["Ball-by-ball capability could not be inferred from the landing page."]);

    const playerProfilesCapability =
      playerSignals.length > 0
        ? makeCapability("confirmed", [`Detected ${playerSignals.length} player profile links.`])
        : makeCapability("possible", [
            "Player profile links were not visible on the landing page, but CricClubs usually exposes them on scorecards or player tables.",
          ]);

    const standingsCapability =
      standingsSignals.length > 0
        ? makeCapability("confirmed", [`Detected ${standingsSignals.length} standings or statistics links.`])
        : clubId && sourceSeriesId
          ? makeCapability("possible", [
              "Standings/statistics links were not visible on the landing page, but the URL exposes enough hints to attempt derived routes.",
            ])
          : makeCapability("unknown", ["Standings/statistics routes were not confirmed from the landing page."]);

    const divisionsCapability =
      divisionHints.linkedDivisions.length > 0 || divisionHints.configuredDivisions.length > 0
        ? makeCapability("confirmed", [
            divisionHints.linkedDivisions.length > 0
              ? `Detected ${divisionHints.linkedDivisions.length} linked division or phase labels.`
              : `Using ${divisionHints.configuredDivisions.length} configured division labels from leagues.yaml.`,
          ])
        : parsedFinalUrl.searchParams.get("divisionId")
          ? makeCapability("possible", [
              "The URL includes a division parameter, but linked division labels were not visible on the landing page.",
            ])
          : makeCapability("unknown", ["Division structure was not confirmed from the landing page."]);

    const executiveReportCapability =
      scorecardsCapability.status === "confirmed" || scorecardsCapability.status === "possible"
        ? makeCapability("likely", [
            "Executive report onboarding is likely possible if scorecards and basic player/team mappings continue to resolve.",
          ])
        : makeCapability("blocked", ["Executive report onboarding is blocked until scorecard access is confirmed."]);

    const intelligenceReportCapability =
      ballByBallCapability.status === "confirmed"
        ? makeCapability("possible", [
            "Player intelligence looks achievable if player attributes and commentary reconciliation are adequate.",
          ])
        : ballByBallCapability.status === "possible"
          ? makeCapability("partial", [
              "Player intelligence may be partial until ball-by-ball coverage is confirmed on sample matches.",
            ])
          : makeCapability("blocked", ["Player intelligence is blocked until ball-by-ball support is confirmed."]);

    const requiredOperatorInputs = [];
    if (!sourceSeriesId) {
      requiredOperatorInputs.push("Confirm the source series id or league id before onboarding.");
    }
    if (!clubId) {
      requiredOperatorInputs.push("Confirm the CricClubs clubId or namespace before deriving legacy routes.");
    }
    if (divisionHints.configuredDivisions.length === 0) {
      requiredOperatorInputs.push("Define target divisions or groups before full onboarding.");
    }

    const warnings = [];
    if (parsedFinalUrl.hostname.toLowerCase() !== "cricclubs.com") {
      warnings.push(
        "This looks like a custom-domain CricClubs site. Keep passing --source cricclubs explicitly until signature-based detection is added."
      );
    }
    if (variantKey === "custom-or-unknown") {
      warnings.push("The CricClubs page pattern is not a known first-class variant yet.");
    }

    const artifacts = {
      htmlPath: path.join(outDir, "raw", "probe_page.html"),
      linksPath: path.join(outDir, "raw", "probe_links.json"),
    };

    writeTextFile(artifacts.htmlPath, html);
    writeJsonFile(artifacts.linksPath, links);

    return {
      adapter: {
        key: "cricclubs",
        label: "CricClubs",
        supported: true,
        detectionMethod: "explicit-or-hostname",
        variantKey,
      },
      sourceContext: {
        requestedUrl: url,
        finalUrl,
        pageTitle: title,
        hostname: parsedFinalUrl.hostname,
        pathname: parsedFinalUrl.pathname,
        clubId,
        sourceSeriesId,
      },
      signals: {
        resultsLinkCount: resultsSignals.length,
        scorecardLinkCount: scorecardSignals.length,
        playerLinkCount: playerSignals.length,
        standingsLinkCount: standingsSignals.length,
        linkedDivisionCount: divisionHints.linkedDivisions.length,
        linkedDivisionLabels: uniqueItems(divisionHints.linkedDivisions),
        configuredDivisionLabels: uniqueItems(divisionHints.configuredDivisions),
      },
      capabilities: {
        scorecards: scorecardsCapability,
        ballByBall: ballByBallCapability,
        playerProfiles: playerProfilesCapability,
        standings: standingsCapability,
        divisions: divisionsCapability,
        executiveReport: executiveReportCapability,
        intelligenceReport: intelligenceReportCapability,
      },
      requiredOperatorInputs,
      warnings,
      recommendedNextActions: [
        "Review the probe JSON and raw HTML artifact before editing the local series registry.",
        "If the source series id, clubId, or division hints are missing, fill them in manually before onboarding.",
        "Run discover and inventory only after the probe looks sane.",
      ],
      artifacts,
    };
  });
}

module.exports = {
  probeCricClubsSeries,
};

const path = require("path");

const { withBrowser } = require("../lib/browser");
const { ensureDir, writeJsonFile, writeTextFile } = require("../lib/fs");
const { normalizePlayerProfile, normalizeText } = require("../lib/playerProfile");

const PROFILE_FIELD_LABELS = [
  "CC Player ID",
  "Current Team",
  "Teams",
  "Playing Role",
  "Jersey Number",
  "Batting Style",
  "Bowling Style",
];

function makePlayerProfileOutputDir(outDir, playerId) {
  return path.join(
    outDir || path.resolve(process.cwd(), "storage/exports/run"),
    "raw",
    "player_profiles",
    String(playerId || "unknown-player")
  );
}

async function waitForProfileReady(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText || "";
      return (
        !/just a moment/i.test(document.title || "") &&
        (/CC Player ID/i.test(text) || /Player not found/i.test(text))
      );
    },
    { timeout: 90000 }
  );
}

function parseProfileFields(text) {
  const fields = {};
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (const label of PROFILE_FIELD_LABELS) {
    const pattern = new RegExp(`^${label.replace(/\s+/g, "\\s*")}\\s*:\\s*(.*)$`, "i");
    const line = lines.find((entry) => pattern.test(entry));
    if (!line) {
      continue;
    }

    const match = line.match(pattern);
    fields[label] = normalizeText(match?.[1]);
  }

  return fields;
}

async function capturePlayerProfile(page) {
  return page.evaluate(() => {
    function normalizeLine(value) {
      return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }

    return {
      title: normalizeLine(document.title),
      bodyText: (document.body?.innerText || "")
        .split(/\n+/)
        .map((line) => normalizeLine(line))
        .filter(Boolean)
        .join("\n"),
    };
  });
}

async function fetchPlayerProfileWithContext(context, player, options = {}) {
  const page = await context.newPage();
  const profileUrl = normalizeText(player?.profileUrl);
  const playerOutDir = makePlayerProfileOutputDir(options.outDir, player?.playerId);
  ensureDir(playerOutDir);

  try {
    await page.goto(profileUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await waitForProfileReady(page);
    await page.waitForTimeout(500);

    const html = await page.content();
    const captured = await capturePlayerProfile(page);
    const bodyText = normalizeText(captured.bodyText);
    const notFound = /Player not found/i.test(bodyText);
    const fields = parseProfileFields(captured.bodyText);
    const normalized = normalizePlayerProfile(
      {
        primaryRole: fields["Playing Role"],
        battingStyle: fields["Batting Style"],
        bowlingStyle: fields["Bowling Style"],
      },
      {
        isWicketkeeper: player?.isWicketkeeper === true,
      }
    );

    const result = {
      playerId: player?.playerId || null,
      sourcePlayerId: normalizeText(player?.sourcePlayerId),
      displayName: normalizeText(player?.displayName),
      profileUrl,
      pageTitle: captured.title,
      found: !notFound,
      fields: {
        ccPlayerId: normalizeText(fields["CC Player ID"]),
        currentTeam: normalizeText(fields["Current Team"]),
        teams: normalizeText(fields["Teams"]),
        primaryRole: normalizeText(fields["Playing Role"]),
        jerseyNumber: normalizeText(fields["Jersey Number"]),
        battingStyle: normalizeText(fields["Batting Style"]),
        bowlingStyle: normalizeText(fields["Bowling Style"]),
      },
      normalized,
    };

    writeTextFile(path.join(playerOutDir, "profile.html"), html);
    writeJsonFile(path.join(playerOutDir, "profile.json"), result);

    return result;
  } finally {
    await page.close();
  }
}

async function fetchPlayerProfiles(players, options = {}) {
  const results = [];

  await withBrowser(
    async (context) => {
      for (const player of players) {
        const result = await fetchPlayerProfileWithContext(context, player, options);
        results.push(result);

        if (Number(options.pauseMs) > 0) {
          await new Promise((resolve) => setTimeout(resolve, Number(options.pauseMs)));
        }
      }
    },
    {
      headless: options.headless !== false,
    }
  );

  return results;
}

module.exports = {
  fetchPlayerProfiles,
};

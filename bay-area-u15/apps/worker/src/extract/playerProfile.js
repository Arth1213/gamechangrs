const path = require("path");

const { withBrowser } = require("../lib/browser");
const { ensureDir, writeJsonFile, writeTextFile } = require("../lib/fs");
const { normalizePlayerProfile, normalizeText } = require("../lib/playerProfile");

const PROFILE_FIELD_LABELS = [
  "CC Player ID",
  "Current Team",
  "Current Year Teams",
  "Teams",
  "Playing Role",
  "Jersey Number",
  "Batting Style",
  "Bowling Style",
];

const PROFILE_FIELD_LABEL_LOOKUP = Object.fromEntries(
  PROFILE_FIELD_LABELS.map((label) => [normalizeText(label).toLowerCase(), label])
);

const PROFILE_FIELD_LABEL_ALIASES = {
  "current year teams": "Teams",
};

function canonicalizeProfileFieldLabel(label) {
  const normalized = normalizeText(label).replace(/\s*:\s*$/, "").toLowerCase();
  if (!normalized) {
    return "";
  }

  return PROFILE_FIELD_LABEL_LOOKUP[normalized] || PROFILE_FIELD_LABEL_ALIASES[normalized] || "";
}

function stripHtml(value) {
  return normalizeText(
    String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, "\"")
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
  );
}

function splitProfileField(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const separatorIndex = normalized.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  const label = canonicalizeProfileFieldLabel(normalized.slice(0, separatorIndex));
  const value = normalizeText(normalized.slice(separatorIndex + 1));
  if (!label || !value) {
    return null;
  }

  return {
    label,
    value,
  };
}

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

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const matched = splitProfileField(current);
    if (!matched) {
      continue;
    }

    let value = matched.value;
    if (!value && index + 1 < lines.length) {
      const nextLine = normalizeText(lines[index + 1]);
      if (nextLine && !splitProfileField(nextLine)) {
        value = nextLine;
      }
    }

    if (value && !fields[matched.label]) {
      fields[matched.label] = value;
    }
  }

  return fields;
}

function parseProfileFieldsFromHtml(html) {
  const fields = {};
  const tagPattern = /<(p|td|th|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const match of String(html || "").matchAll(tagPattern)) {
    const text = stripHtml(match[2]);
    const field = splitProfileField(text);
    if (!field || fields[field.label]) {
      continue;
    }
    fields[field.label] = field.value;
  }

  return fields;
}

function mergeProfileFields(...sources) {
  const merged = {};

  for (const source of sources) {
    for (const [label, value] of Object.entries(source || {})) {
      const canonicalLabel = canonicalizeProfileFieldLabel(label);
      const normalizedValue = normalizeText(value);
      if (!canonicalLabel || !normalizedValue || merged[canonicalLabel]) {
        continue;
      }
      merged[canonicalLabel] = normalizedValue;
    }
  }

  return merged;
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
    const fields = mergeProfileFields(
      parseProfileFieldsFromHtml(html),
      parseProfileFields(captured.bodyText)
    );
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
      html,
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

function makeFailedProfileResult(player, error) {
  const message =
    error instanceof Error ? normalizeText(error.message) : normalizeText(error) || "Unknown error";

  return {
    playerId: player?.playerId || null,
    sourcePlayerId: normalizeText(player?.sourcePlayerId),
    displayName: normalizeText(player?.displayName),
    profileUrl: normalizeText(player?.profileUrl),
    html: "",
    pageTitle: "",
    found: false,
    error: message,
    fields: {
      ccPlayerId: "",
      currentTeam: "",
      teams: "",
      primaryRole: "",
      jerseyNumber: "",
      battingStyle: "",
      bowlingStyle: "",
    },
    normalized: normalizePlayerProfile(
      {},
      {
        isWicketkeeper: player?.isWicketkeeper === true,
      }
    ),
  };
}

async function fetchPlayerProfileWithRetry(context, player, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || 2);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchPlayerProfileWithContext(context, player, options);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts) {
        break;
      }

      if (typeof options.log === "function") {
        options.log(
          `Retrying profile fetch for ${normalizeText(player?.displayName) || `player ${player?.playerId || "unknown"}`} (${attempt}/${maxAttempts - 1} retries used).`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  return makeFailedProfileResult(player, lastError);
}

async function fetchPlayerProfiles(players, options = {}) {
  const results = [];

  await withBrowser(
    async (context) => {
      for (const player of players) {
        const result = await fetchPlayerProfileWithRetry(context, player, options);
        results.push(result);

        if (typeof options.onProfile === "function") {
          await options.onProfile(result);
        }

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

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return normalizeText(value).toLowerCase();
}

function toInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePlayerIdFromUrl(url) {
  const raw = normalizeText(url);
  if (!raw) {
    return "";
  }

  try {
    return normalizeText(new URL(raw, "https://cricclubs.com").searchParams.get("playerId"));
  } catch (_) {
    return "";
  }
}

function cleanPlayerDisplayName(value) {
  const normalized = normalizeText(value)
    .replace(/[*†]+/g, " ")
    .replace(/\(\s*sub\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function normalizeAliasKey(value) {
  return cleanPlayerDisplayName(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPlayerAliases(displayName, extras = []) {
  const base = cleanPlayerDisplayName(displayName);
  const extraValues = Array.isArray(extras) ? extras : [];
  const aliases = new Set();

  for (const value of [base, ...extraValues]) {
    const cleaned = cleanPlayerDisplayName(value);
    if (cleaned) {
      aliases.add(cleaned);
    }
  }

  const tokens = base.split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    aliases.add(`${tokens[0][0]} ${tokens.slice(1).join(" ")}`);
    aliases.add(`${tokens[0][0]} ${tokens[tokens.length - 1]}`);
  }

  if (tokens.length >= 3) {
    aliases.add(`${tokens[0][0]} ${tokens.slice(-2).join(" ")}`);
  }

  return [...aliases].map((value) => normalizeText(value)).filter(Boolean);
}

function oversToBalls(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }

  const overs = Number(match[1]);
  const partialBalls = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(overs) || !Number.isFinite(partialBalls)) {
    return null;
  }

  return overs * 6 + partialBalls;
}

function ballsToOversDecimal(legalBalls) {
  const total = toInteger(legalBalls);
  if (total === null) {
    return null;
  }

  const overs = Math.trunc(total / 6);
  const balls = total % 6;
  return Number(`${overs}.${balls}`);
}

function parseExtrasBreakdown(value) {
  const text = normalizeText(value);
  const lookup = {
    byes: 0,
    legByes: 0,
    wides: 0,
    noBalls: 0,
    penaltyRuns: 0,
  };

  for (const [key, pattern] of [
    ["byes", /\bb\s+(\d+)/i],
    ["legByes", /\blb\s+(\d+)/i],
    ["wides", /\bw\s+(\d+)/i],
    ["noBalls", /\bnb\s+(\d+)/i],
    ["penaltyRuns", /\bp\s+(\d+)/i],
  ]) {
    const match = text.match(pattern);
    lookup[key] = match ? Number(match[1]) : 0;
  }

  lookup.extrasTotal =
    lookup.byes + lookup.legByes + lookup.wides + lookup.noBalls + lookup.penaltyRuns;

  return lookup;
}

function splitDidNotBatList(value) {
  const text = normalizeText(value).replace(/^Did not bat:\s*/i, "");
  if (!text) {
    return [];
  }

  return text
    .split(/\s*,\s*/)
    .map((entry) => cleanPlayerDisplayName(entry))
    .filter(Boolean);
}

function parseDismissalInfo(value, links = []) {
  const text = normalizeText(value);
  const normalized = normalizeLabel(text);
  const playerLinks = Array.isArray(links) ? links.filter((link) => normalizeText(link?.name)) : [];
  const firstLink = playerLinks[0] || null;
  const lastLink = playerLinks[playerLinks.length - 1] || null;

  if (!text || normalized === "not out") {
    return {
      dismissalType: "not_out",
      wicketCreditedToBowler: false,
      primaryFielder: null,
      bowler: null,
    };
  }

  if (normalized.includes("retired hurt")) {
    return {
      dismissalType: "retired_hurt",
      wicketCreditedToBowler: false,
      primaryFielder: null,
      bowler: null,
    };
  }

  if (normalized.startsWith("lbw")) {
    return {
      dismissalType: "lbw",
      wicketCreditedToBowler: true,
      primaryFielder: null,
      bowler: lastLink,
    };
  }

  if (normalized.startsWith("b ")) {
    return {
      dismissalType: "bowled",
      wicketCreditedToBowler: true,
      primaryFielder: null,
      bowler: lastLink,
    };
  }

  if (normalized.startsWith("c ") || normalized.includes(" caught")) {
    return {
      dismissalType: "caught",
      wicketCreditedToBowler: true,
      primaryFielder: playerLinks.length >= 2 ? firstLink : null,
      bowler: lastLink,
    };
  }

  if (normalized.startsWith("st ")) {
    return {
      dismissalType: "stumped",
      wicketCreditedToBowler: true,
      primaryFielder: firstLink,
      bowler: lastLink,
    };
  }

  if (normalized.includes("run out")) {
    return {
      dismissalType: "run_out",
      wicketCreditedToBowler: false,
      primaryFielder: firstLink,
      bowler: null,
    };
  }

  if (normalized.includes("hit wicket")) {
    return {
      dismissalType: "hit_wicket",
      wicketCreditedToBowler: true,
      primaryFielder: null,
      bowler: lastLink,
    };
  }

  return {
    dismissalType: text || "other",
    wicketCreditedToBowler: Boolean(lastLink),
    primaryFielder: playerLinks.length >= 2 ? firstLink : null,
    bowler: lastLink,
  };
}

function parseBallLabel(value) {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    overNo: Number(match[1]),
    ballInOver: Number(match[2]),
    ballLabel: raw,
  };
}

function phaseForOver(overNo) {
  const over = toInteger(overNo);
  if (over === null) {
    return "";
  }

  if (over <= 5) {
    return "powerplay";
  }

  if (over <= 14) {
    return "middle";
  }

  return "death";
}

function parseCommentaryOutcome(runToken, commentaryText) {
  const token = normalizeLabel(runToken);
  const text = normalizeText(commentaryText);
  const numericToken = toInteger(token.match(/\d+/)?.[0]);

  let batterRuns = 0;
  let extras = 0;
  let extraType = "";
  let totalRuns = 0;
  let isLegalBall = true;
  let wicketFlag = /\bout!\b/i.test(text) || token === "w";

  if (token.includes("wd") || /\bwide/i.test(text)) {
    extras = numericToken || 1;
    extraType = "wide";
    totalRuns = extras;
    isLegalBall = false;
  } else if (token.includes("nb") || /\bno ball/i.test(text)) {
    totalRuns = numericToken || 1;
    extras = 1;
    batterRuns = Math.max(totalRuns - extras, 0);
    extraType = "no_ball";
    isLegalBall = false;
  } else if (token.includes("lb") || /\bleg bye/i.test(text)) {
    extras = numericToken || 1;
    extraType = "leg_bye";
    totalRuns = extras;
  } else if (/^b\d+/i.test(token) || /\bbyes?\b/i.test(text)) {
    extras = numericToken || 1;
    extraType = "bye";
    totalRuns = extras;
  } else if (token === "w" || token === "0") {
    totalRuns = 0;
  } else if (numericToken !== null) {
    batterRuns = numericToken;
    totalRuns = batterRuns;
  }

  if (/\bfour\b/i.test(text) && totalRuns === 0) {
    batterRuns = 4;
    totalRuns = 4;
  }

  if (/\bsix\b/i.test(text) && totalRuns === 0) {
    batterRuns = 6;
    totalRuns = 6;
  }

  return {
    batterRuns,
    extras,
    extraType,
    totalRuns,
    isLegalBall,
    wicketFlag,
  };
}

module.exports = {
  ballsToOversDecimal,
  buildPlayerAliases,
  cleanPlayerDisplayName,
  normalizeAliasKey,
  normalizeLabel,
  normalizeText,
  oversToBalls,
  parseBallLabel,
  parseCommentaryOutcome,
  parseDismissalInfo,
  parseExtrasBreakdown,
  parsePlayerIdFromUrl,
  phaseForOver,
  splitDidNotBatList,
  toInteger,
  toNumber,
};

"use strict";

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim();
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

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = normalizeLabel(value);
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return Boolean(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function safeDivide(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}

function average(values, fallback = 0) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return fallback;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function roundNumeric(value, digits = 4) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function humanizeRole(roleType, options = {}) {
  const map = {
    batting: options.plural ? "Batters" : "Batter",
    bowling: options.plural ? "Bowlers" : "Bowler",
    batting_all_rounder: options.plural ? "Batting All-Rounders" : "Batting All-Rounder",
    bowling_all_rounder: options.plural ? "Bowling All-Rounders" : "Bowling All-Rounder",
    wicketkeeper_batter: options.plural ? "Wicketkeeper-Batters" : "Wicketkeeper-Batter",
    fielding: options.plural ? "Fielders" : "Fielder",
    wicketkeeping: options.plural ? "Wicketkeepers" : "Wicketkeeper",
  };
  return map[normalizeLabel(roleType)] || normalizeText(roleType) || "Player";
}

function confidenceLabel(score) {
  const numeric = toNumber(score, 0);
  if (numeric >= 85) {
    return "High";
  }
  if (numeric >= 65) {
    return "Medium";
  }
  return "Limited";
}

function recommendationLabel(input) {
  const compositeScore = toNumber(input?.compositeScore, 0);
  const confidenceScore = toNumber(input?.confidenceScore, 0);

  if (compositeScore >= 85 && confidenceScore >= 80) {
    return "Strong Consideration";
  }
  if (compositeScore >= 78 && confidenceScore >= 70) {
    return "Track Closely";
  }
  if (compositeScore >= 70) {
    return "Watch List";
  }
  return "Development Watch";
}

function toneForScore(score) {
  const numeric = toNumber(score, 0);
  if (numeric >= 80) {
    return "good";
  }
  if (numeric >= 65) {
    return "watch";
  }
  return "risk";
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const raw = normalizeText(value);
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(`${raw}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function formatScore(value, digits = 1) {
  const numeric = toNumber(value, null);
  if (numeric === null) {
    return "0";
  }
  return numeric.toFixed(digits);
}

function compact(items) {
  return items.filter(Boolean);
}

module.exports = {
  average,
  clamp,
  compact,
  confidenceLabel,
  escapeHtml,
  formatDate,
  formatScore,
  humanizeRole,
  normalizeLabel,
  normalizeText,
  recommendationLabel,
  roundNumeric,
  safeDivide,
  toBoolean,
  toInteger,
  toNumber,
  toneForScore,
};

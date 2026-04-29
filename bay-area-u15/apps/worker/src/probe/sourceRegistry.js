const { probeCricClubsSeries } = require("./adapters/cricclubs");
const { createUnsupportedAdapter } = require("./adapters/unsupported");

const ADAPTERS = {
  cricclubs: {
    key: "cricclubs",
    label: "CricClubs",
    supported: true,
    probe: probeCricClubsSeries,
  },
  cricheroes: createUnsupportedAdapter("cricheroes", "CricHeroes"),
  espncricinfo: createUnsupportedAdapter("espncricinfo", "ESPNcricinfo"),
  cricbuzz: createUnsupportedAdapter("cricbuzz", "Cricbuzz"),
};

function normalizeSourceSystem(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function detectSourceSystemFromUrl(url) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes("cricclubs")) {
      return "cricclubs";
    }

    if (hostname.includes("cricheroes")) {
      return "cricheroes";
    }

    if (hostname.includes("espncricinfo")) {
      return "espncricinfo";
    }

    if (hostname.includes("cricbuzz")) {
      return "cricbuzz";
    }

    return null;
  } catch (_) {
    return null;
  }
}

function getSourceAdapter(sourceSystem) {
  const normalized = normalizeSourceSystem(sourceSystem);
  if (!normalized) {
    return null;
  }

  return ADAPTERS[normalized] || null;
}

module.exports = {
  detectSourceSystemFromUrl,
  getSourceAdapter,
  normalizeSourceSystem,
};

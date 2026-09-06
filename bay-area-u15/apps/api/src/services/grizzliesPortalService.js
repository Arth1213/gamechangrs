"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { withClient, resolveSeriesContext } = require("./seriesService");

const CONFIG_PATH = path.resolve(__dirname, "../../../../../config/grizzlies-2026-portal.yaml");

function loadPortalConfig() {
  return YAML.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function getConfiguredPlayerId(config, name) {
  const mapping = config?.approvedMappings?.[name];
  if (Number.isInteger(mapping)) return mapping;
  const cluster = (config?.identityClusters || []).find((item) => item?.name === name);
  return Number.isInteger(cluster?.canonicalPlayerId) ? cluster.canonicalPlayerId : null;
}

function getThreatTone(percentileRank) {
  if (percentileRank === null || percentileRank === undefined || percentileRank === "") return "unknown";
  const percentile = Number(percentileRank);
  if (!Number.isFinite(percentile)) return "unknown";
  if (percentile >= 85) return "red";
  if (percentile >= 60) return "amber";
  return "green";
}

async function loadPlayerFacts(config) {
  const playerIds = Object.values(config?.approvedMappings || {})
    .filter((value) => Number.isInteger(value));
  if (!playerIds.length) return new Map();

  return withClient(async (client) => {
    const context = await resolveSeriesContext(client, config.portal.nccaSeriesConfigKey, { ensureReportProfile: false });
    if (!context?.seriesId) return new Map();
    const result = await client.query(
      `
        select
          p.id as player_id,
          p.profile_url,
          max(pcs.percentile_rank) as percentile_rank
        from public.player p
        left join public.player_composite_score pcs
          on pcs.player_id = p.id
          and pcs.series_id = $1
        where p.id = any($2::bigint[])
        group by p.id, p.profile_url
      `,
      [context.seriesId, playerIds]
    );
    return new Map(result.rows.map((row) => [Number(row.player_id), row]));
  });
}

async function getGrizzliesPortalPayload() {
  const config = loadPortalConfig();
  const seriesConfigKey = config.portal.nccaSeriesConfigKey;
  const playerFacts = await loadPlayerFacts(config);
  const teams = Object.entries(config.roster || {}).map(([teamName, roster]) => ({
    name: teamName,
    players: roster.map(([name, rosterCategory]) => {
      const configured = config.approvedMappings?.[name];
      const playerId = Number.isInteger(configured) ? configured : null;
      const facts = playerId ? playerFacts.get(playerId) : null;
      const profileUrl =
        typeof configured === "object"
          ? configured.profileUrl || null
          : config?.profileOverrides?.[name] || facts?.profile_url || null;
      const query = playerId ? `?series=${encodeURIComponent(seriesConfigKey)}` : "";
      return {
        name,
        rosterCategory,
        nccaStatus: playerId || profileUrl ? "matched" : "not_found",
        cricclubsProfileUrl: profileUrl,
        assessmentPath: playerId ? `/analytics/reports/${playerId}${query}` : null,
        threatPath: playerId ? `/analytics/intelligence/${playerId}${query}` : null,
        threatTone: getThreatTone(facts?.percentile_rank),
      };
    }),
  }));

  return {
    title: "Grizzlies 2026 Analytics - Powered by GameChangrs",
    nccaSeriesConfigKey: seriesConfigKey,
    teams,
    analysisStatus: "Match Analysis and AI Recommendations Coming Soon",
  };
}

module.exports = { getGrizzliesPortalPayload, getThreatTone };

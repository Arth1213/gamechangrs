const path = require("path");

const { fetchPlayerProfiles } = require("../extract/playerProfile");
const { ensureDir, writeJsonFile } = require("../lib/fs");
const {
  listSeriesPlayersForProfileEnrichment,
  persistPlayerProfileEnrichment,
} = require("../load/repository");

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

async function runPlayerProfileEnrichment(input = {}) {
  const seriesConfigKey = normalizeText(input?.series?.slug || input?.series);
  if (!seriesConfigKey) {
    throw new Error("runPlayerProfileEnrichment requires a series config key.");
  }

  const outDir =
    input.outDir ||
    path.resolve(process.cwd(), "storage/exports", seriesConfigKey || "series");
  ensureDir(outDir);

  const playerScope = await listSeriesPlayersForProfileEnrichment(seriesConfigKey, {
    limit: input.limit,
    playerIds: input.playerIds,
    force: input.force === true,
  });

  if (typeof input.log === "function") {
    input.log(
      `Player profile enrichment: ${playerScope.players.length} player pages queued for ${seriesConfigKey}.`
    );
  }

  const fetchedProfiles = await fetchPlayerProfiles(playerScope.players, {
    outDir,
    pauseMs: input.pauseMs,
  });

  const summary = {
    series: seriesConfigKey,
    seriesId: playerScope.seriesId,
    playerCountQueued: playerScope.players.length,
    updatedCount: 0,
    notFoundCount: 0,
    failedCount: 0,
    players: [],
  };

  for (const profile of fetchedProfiles) {
    try {
      await persistPlayerProfileEnrichment({
        playerId: profile.playerId,
        profile,
      });

      if (!profile.found) {
        summary.notFoundCount += 1;
      } else {
        summary.updatedCount += 1;
      }

      summary.players.push({
        playerId: profile.playerId,
        displayName: profile.displayName,
        found: profile.found,
        primaryRole: profile.normalized.primaryRole,
        primaryRoleBucket: profile.normalized.primaryRoleBucket,
        battingStyle: profile.normalized.battingStyle,
        battingStyleBucket: profile.normalized.battingStyleBucket,
        bowlingStyle: profile.normalized.bowlingStyle,
        bowlingStyleBucket: profile.normalized.bowlingStyleBucket,
      });
    } catch (error) {
      summary.failedCount += 1;
      summary.players.push({
        playerId: profile.playerId,
        displayName: profile.displayName,
        found: profile.found,
        error: error.message,
      });
    }
  }

  writeJsonFile(path.join(outDir, "player_profile_enrichment_summary.json"), summary);
  return summary;
}

module.exports = {
  runPlayerProfileEnrichment,
};

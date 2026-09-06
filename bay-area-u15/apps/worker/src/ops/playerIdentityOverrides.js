"use strict";

const { toInteger } = require("../lib/cricket");

function createCanonicalPlayerResolver(config = {}) {
  const canonicalBySourcePlayerId = new Map();
  const clusters = Array.isArray(config.identityClusters) ? config.identityClusters : [];

  for (const cluster of clusters) {
    const canonicalPlayerId = toInteger(cluster?.canonicalPlayerId);
    if (!canonicalPlayerId) {
      throw new Error("Canonical identity cluster requires a positive canonicalPlayerId.");
    }

    const sourcePlayerIds = Array.isArray(cluster?.sourcePlayerIds) ? cluster.sourcePlayerIds : [];
    for (const sourceValue of sourcePlayerIds) {
      const sourcePlayerId = toInteger(sourceValue);
      if (!sourcePlayerId) {
        throw new Error("Canonical identity cluster requires positive sourcePlayerIds.");
      }
      const existingCanonicalPlayerId = canonicalBySourcePlayerId.get(sourcePlayerId);
      if (existingCanonicalPlayerId && existingCanonicalPlayerId !== canonicalPlayerId) {
        throw new Error(`Duplicate canonical identity source player ID: ${sourcePlayerId}`);
      }
      canonicalBySourcePlayerId.set(sourcePlayerId, canonicalPlayerId);
    }
  }

  return function resolvePlayerId(playerId) {
    const normalizedPlayerId = toInteger(playerId);
    return canonicalBySourcePlayerId.get(normalizedPlayerId) || normalizedPlayerId;
  };
}

module.exports = { createCanonicalPlayerResolver };

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function normalizeBattingIdentityConflicts(input = {}) {
  const seen = new Set();
  const battingInnings = [];
  const syntheticPlayers = [];
  let droppedDidNotBatCount = 0;

  for (const batting of Array.isArray(input.battingInnings) ? input.battingInnings : []) {
    const playerSourceId = normalizeText(batting.playerSourceId);
    const key = `${batting.inningsNo || 0}:${playerSourceId || normalizeText(batting.playerName)}`;
    if (!seen.has(key)) {
      seen.add(key);
      battingInnings.push(batting);
      continue;
    }
    if (batting.didNotBat === true) {
      droppedDidNotBatCount += 1;
      continue;
    }
    const syntheticSourceId = `synthetic:match:${normalizeText(input.sourceMatchId)}:innings:${batting.inningsNo}:position:${batting.battingPosition}`;
    const synthetic = { ...batting, playerSourceId: syntheticSourceId };
    battingInnings.push(synthetic);
    syntheticPlayers.push({ sourcePlayerId: syntheticSourceId, displayName: `${normalizeText(batting.playerName)} (source conflict)`, aliases: [] });
  }

  return { battingInnings, syntheticPlayers, droppedDidNotBatCount };
}

module.exports = { normalizeBattingIdentityConflicts };

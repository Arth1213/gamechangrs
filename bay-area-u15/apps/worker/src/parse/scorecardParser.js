const {
  buildPlayerAliases,
  cleanPlayerDisplayName,
  normalizeText,
  oversToBalls,
  parseDismissalInfo,
  parseExtrasBreakdown,
  parsePlayerIdFromUrl,
  splitDidNotBatList,
  toInteger,
  toNumber,
} = require("../lib/cricket");

function createRegistry() {
  return new Map();
}

function registryKey(input) {
  const sourcePlayerId = normalizeText(input?.sourcePlayerId);
  const displayName = cleanPlayerDisplayName(input?.displayName);
  return sourcePlayerId ? `id:${sourcePlayerId}` : `name:${displayName.toLowerCase()}`;
}

function resolveRawName(input) {
  return normalizeText(input?.rawName || input?.displayName);
}

function registerPlayer(registry, input = {}) {
  const rawName = resolveRawName(input);
  const displayName = cleanPlayerDisplayName(input.displayName || rawName);
  if (!displayName) {
    return null;
  }

  const sourcePlayerId = normalizeText(input.sourcePlayerId) || parsePlayerIdFromUrl(input.profileUrl);
  const key = registryKey({ sourcePlayerId, displayName });
  const existing = registry.get(key) || {
    sourcePlayerId,
    displayName,
    canonicalName: displayName,
    profileUrl: normalizeText(input.profileUrl),
    isWicketkeeper: false,
    isCaptain: false,
    aliases: new Set(),
  };

  existing.sourcePlayerId = existing.sourcePlayerId || sourcePlayerId;
  existing.displayName = existing.displayName || displayName;
  existing.canonicalName = existing.canonicalName || displayName;
  existing.profileUrl = existing.profileUrl || normalizeText(input.profileUrl);
  existing.isWicketkeeper =
    existing.isWicketkeeper || /†/.test(rawName) || Boolean(input.isWicketkeeper);
  existing.isCaptain = existing.isCaptain || /\*/.test(rawName) || Boolean(input.isCaptain);

  for (const alias of buildPlayerAliases(displayName, input.aliases)) {
    if (alias) {
      existing.aliases.add(alias);
    }
  }

  registry.set(key, existing);
  return existing;
}

function playerFromLink(registry, link, fallbackName) {
  const text = normalizeText(link?.text) || normalizeText(fallbackName);
  return registerPlayer(registry, {
    rawName: text,
    displayName: text,
    sourcePlayerId: normalizeText(link?.playerId),
    profileUrl: normalizeText(link?.href),
  });
}

function extractPlayerLinks(links = []) {
  return links.filter((link) => normalizeText(link?.playerId) || parsePlayerIdFromUrl(link?.href));
}

function parseBattingTeamName(value) {
  const text = normalizeText(value);
  const match = text.match(/^(.*?)\s+innings\b/i);
  return cleanPlayerDisplayName(match ? match[1] : text);
}

function parseTargetRuns(value) {
  const text = normalizeText(value);
  const match = text.match(/target:\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseTotalRow(row) {
  const header = normalizeText(row?.cells?.[0]?.text);
  const totalRuns = toInteger(row?.cells?.[2]?.text);
  const detailText = normalizeText(row?.cells?.[1]?.text) || header;
  const wicketsMatch = detailText.match(/(\d+)\s+wickets?/i);
  const oversMatch = detailText.match(/(\d+(?:\.\d+)?)\s+overs?/i);
  const oversDecimal = toNumber(oversMatch?.[1]);
  const legalBalls = oversMatch ? oversToBalls(oversMatch[1]) : null;

  return {
    totalRuns,
    wickets: wicketsMatch ? Number(wicketsMatch[1]) : null,
    oversDecimal,
    legalBalls,
  };
}

function parseBowlingExtras(value) {
  const text = normalizeText(value);
  if (!text) {
    return {
      wides: 0,
      noBalls: 0,
    };
  }

  const wides = toInteger(text.match(/(\d+)\s*w\b/i)?.[1]) || 0;
  const noBalls = toInteger(text.match(/(\d+)\s*nb\b/i)?.[1]) || 0;
  return {
    wides,
    noBalls,
  };
}

function parseBattingRow(row, registry, teamName, battingPosition) {
  const cells = row?.cells || [];
  if (cells.length < 7) {
    return null;
  }

  const playerLinks = extractPlayerLinks(cells[0]?.links);
  const batterLink = playerLinks[0] || null;
  const batter = playerFromLink(registry, batterLink, cells[0]?.text);
  if (!batter) {
    return null;
  }

  const dismissalLinks = extractPlayerLinks(cells[1]?.links);
  dismissalLinks.forEach((link) => playerFromLink(registry, link, link.text));

  const dismissalText = normalizeText(cells[1]?.text);
  const dismissal = parseDismissalInfo(dismissalText, dismissalLinks);

  return {
    playerSourceId: batter.sourcePlayerId,
    playerName: batter.displayName,
    teamName,
    battingPosition,
    isNotOut: dismissal.dismissalType === "not_out",
    dismissalType: dismissal.dismissalType,
    dismissalText,
    dismissedBySourcePlayerId: dismissal.bowler?.playerId || parsePlayerIdFromUrl(dismissal.bowler?.href),
    primaryFielderSourcePlayerId:
      dismissal.primaryFielder?.playerId || parsePlayerIdFromUrl(dismissal.primaryFielder?.href),
    runs: toInteger(cells[2]?.text) || 0,
    ballsFaced: toInteger(cells[3]?.text) || 0,
    fours: toInteger(cells[4]?.text) || 0,
    sixes: toInteger(cells[5]?.text) || 0,
    strikeRate: toNumber(cells[6]?.text),
    retiredHurt: dismissal.dismissalType === "retired_hurt",
    didNotBat: false,
  };
}

function parseDidNotBatRows(row, registry, teamName, startingPosition) {
  const entry = row?.cells?.[0];
  if (!entry) {
    return [];
  }

  const links = extractPlayerLinks(entry.links);
  links.forEach((link) => playerFromLink(registry, link, link.text));

  return splitDidNotBatList(entry.text).map((name, index) => {
    const matchingLink =
      links.find((link) => cleanPlayerDisplayName(link.text) === name) ||
      links.find((link) => cleanPlayerDisplayName(link.text).endsWith(name));
    const player = playerFromLink(registry, matchingLink, name);
    if (!player) {
      return null;
    }

    return {
      playerSourceId: player.sourcePlayerId,
      playerName: player.displayName,
      teamName,
      battingPosition: startingPosition + index,
      isNotOut: null,
      dismissalType: null,
      dismissalText: null,
      dismissedBySourcePlayerId: null,
      primaryFielderSourcePlayerId: null,
      runs: null,
      ballsFaced: null,
      fours: null,
      sixes: null,
      strikeRate: null,
      retiredHurt: false,
      didNotBat: true,
    };
  }).filter(Boolean);
}

function parseBowlingRows(table, registry, teamName) {
  const rows = table?.rows || [];
  return rows
    .slice(1)
    .map((row, index) => {
      const cells = row.cells || [];
      if (cells.length < 8) {
        return null;
      }

      const bowlerLink = extractPlayerLinks(cells[1]?.links)[0] || null;
      const bowler = playerFromLink(registry, bowlerLink, cells[1]?.text);
      if (!bowler) {
        return null;
      }

      const oversDecimal = toNumber(cells[2]?.text);
      const legalBalls = oversToBalls(cells[2]?.text);
      const extras = parseBowlingExtras(cells[8]?.text);

      return {
        playerSourceId: bowler.sourcePlayerId,
        playerName: bowler.displayName,
        teamName,
        oversDecimal,
        legalBalls,
        maidens: toInteger(cells[3]?.text) || 0,
        dotBalls: toInteger(cells[4]?.text) || 0,
        runsConceded: toInteger(cells[5]?.text) || 0,
        wickets: toInteger(cells[6]?.text) || 0,
        economy: toNumber(cells[7]?.text),
        wides: extras.wides,
        noBalls: extras.noBalls,
        bestFigures: `${toInteger(cells[6]?.text) || 0}/${toInteger(cells[5]?.text) || 0}`,
        spellSequence: index + 1,
      };
    })
    .filter(Boolean);
}

function findInningsGroups(tables = []) {
  const groups = [];

  for (let index = 0; index < tables.length; index += 1) {
    const table = tables[index];
    const headerText = normalizeText(table?.rows?.[0]?.cells?.[0]?.text);
    if (!/\sinnings\b/i.test(headerText)) {
      continue;
    }

    groups.push({
      battingTable: table,
      didNotBatTable: tables[index + 1] || null,
      bowlingTable: tables[index + 2] || null,
    });
    index += 2;
  }

  return groups;
}

function parseScorecard(rawScorecard) {
  const registry = createRegistry();
  const groups = findInningsGroups(rawScorecard?.tables || []);

  if (!groups.length) {
    return {
      match: null,
      innings: [],
      battingInnings: [],
      bowlingSpells: [],
      fieldingEvents: [],
      playerRegistry: [],
      notes: ["Scorecard parser could not find innings tables in the fetched payload."],
    };
  }

  const battingTeamNames = groups.map((group) =>
    parseBattingTeamName(group.battingTable?.rows?.[0]?.cells?.[0]?.text)
  );

  const innings = [];
  const battingInnings = [];
  const bowlingSpells = [];

  groups.forEach((group, index) => {
    const inningsNo = index + 1;
    const battingTable = group.battingTable;
    const dnbTable = group.didNotBatTable;
    const bowlingTable = group.bowlingTable;
    const headerText = normalizeText(battingTable?.rows?.[0]?.cells?.[0]?.text);
    const battingTeamName = battingTeamNames[index];
    const bowlingTeamName = battingTeamNames.find((_, entryIndex) => entryIndex !== index) || "";
    const battingRows = (battingTable?.rows || []).slice(1);
    const extrasRow = battingRows.find((row) =>
      normalizeText(row?.cells?.[0]?.text).startsWith("Extras")
    );
    const totalRow = battingRows.find((row) =>
      normalizeText(row?.cells?.[0]?.text).startsWith("Total")
    );
    const actualBattingRows = battingRows.filter((row) => {
      const label = normalizeText(row?.cells?.[0]?.text);
      return label && !label.startsWith("Extras") && !label.startsWith("Total");
    });

    const extras = parseExtrasBreakdown(extrasRow?.cells?.[0]?.text || extrasRow?.cells?.[1]?.text);
    const totals = parseTotalRow(totalRow);
    const targetRuns = parseTargetRuns(headerText);

    innings.push({
      inningsNo,
      battingTeamName,
      bowlingTeamName,
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      oversDecimal: totals.oversDecimal,
      legalBalls: totals.legalBalls,
      extrasTotal: toInteger(extrasRow?.cells?.[2]?.text) || extras.extrasTotal || 0,
      byes: extras.byes,
      legByes: extras.legByes,
      wides: extras.wides,
      noBalls: extras.noBalls,
      penaltyRuns: extras.penaltyRuns,
      targetRuns,
    });

    actualBattingRows.forEach((row, battingIndex) => {
      const parsed = parseBattingRow(row, registry, battingTeamName, battingIndex + 1);
      if (parsed) {
        battingInnings.push({
          inningsNo,
          ...parsed,
        });
      }
    });

    parseDidNotBatRows(dnbTable?.rows?.[0], registry, battingTeamName, actualBattingRows.length + 1).forEach(
      (parsed) => {
        battingInnings.push({
          inningsNo,
          ...parsed,
        });
      }
    );

    parseBowlingRows(bowlingTable, registry, bowlingTeamName).forEach((parsed) => {
      bowlingSpells.push({
        inningsNo,
        ...parsed,
      });
    });
  });

  return {
    match: {
      title: normalizeText(rawScorecard?.title),
      headings: rawScorecard?.headings || [],
    },
    innings,
    battingInnings,
    bowlingSpells,
    fieldingEvents: [],
    playerRegistry: [...registry.values()].map((entry) => ({
      sourcePlayerId: entry.sourcePlayerId,
      displayName: entry.displayName,
      canonicalName: entry.canonicalName,
      profileUrl: entry.profileUrl,
      isWicketkeeper: entry.isWicketkeeper,
      isCaptain: entry.isCaptain,
      aliases: [...entry.aliases],
    })),
    notes: [],
  };
}

module.exports = {
  parseScorecard,
};

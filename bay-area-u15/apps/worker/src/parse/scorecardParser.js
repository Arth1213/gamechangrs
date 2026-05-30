const {
  buildPlayerAliases,
  buildSyntheticPlayerId,
  cleanPlayerDisplayName,
  normalizeAliasKey,
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

function isSyntheticPlayerId(value) {
  return normalizeText(value).startsWith("synthetic:");
}

function uniqueRegistryEntries(registry) {
  const unique = [];
  const seen = new Set();

  for (const entry of registry.values()) {
    if (seen.has(entry)) {
      continue;
    }

    seen.add(entry);
    unique.push(entry);
  }

  return unique;
}

function entryAliasKeys(entry) {
  return new Set(
    [entry?.displayName, entry?.canonicalName, ...(entry?.aliases || [])]
      .map((value) => normalizeAliasKey(value))
      .filter(Boolean)
  );
}

function findMatchingRegistryEntry(registry, input = {}) {
  const displayName = cleanPlayerDisplayName(input.displayName || input.rawName);
  const sourcePlayerId = normalizeText(input.sourcePlayerId);
  const candidateAliasKeys = new Set(
    buildPlayerAliases(displayName, input.aliases)
      .map((value) => normalizeAliasKey(value))
      .filter(Boolean)
  );

  if (displayName) {
    candidateAliasKeys.add(normalizeAliasKey(displayName));
  }

  for (const entry of uniqueRegistryEntries(registry)) {
    if (sourcePlayerId && normalizeText(entry.sourcePlayerId) === sourcePlayerId) {
      return entry;
    }

    const existingAliasKeys = entryAliasKeys(entry);
    for (const aliasKey of candidateAliasKeys) {
      if (existingAliasKeys.has(aliasKey)) {
        return entry;
      }
    }
  }

  return null;
}

function syncRegistryEntry(registry, entry) {
  const nextKey = registryKey({
    sourcePlayerId: entry.sourcePlayerId,
    displayName: entry.displayName,
  });

  for (const [key, current] of registry.entries()) {
    if (current === entry && key !== nextKey) {
      registry.delete(key);
    }
  }

  registry.set(nextKey, entry);
  return entry;
}

function registerPlayer(registry, input = {}) {
  const rawName = resolveRawName(input);
  const displayName = cleanPlayerDisplayName(input.displayName || rawName);
  if (!displayName) {
    return null;
  }

  const explicitSourcePlayerId =
    normalizeText(input.sourcePlayerId) || parsePlayerIdFromUrl(input.profileUrl);
  const fallbackSourcePlayerId = buildSyntheticPlayerId(displayName);
  const existing =
    findMatchingRegistryEntry(registry, {
      sourcePlayerId: explicitSourcePlayerId,
      displayName,
      aliases: input.aliases,
    }) ||
    findMatchingRegistryEntry(registry, {
      sourcePlayerId: fallbackSourcePlayerId,
      displayName,
      aliases: input.aliases,
    }) || {
      sourcePlayerId: explicitSourcePlayerId || fallbackSourcePlayerId,
      displayName,
      canonicalName: displayName,
      profileUrl: normalizeText(input.profileUrl),
      isWicketkeeper: false,
      isCaptain: false,
      aliases: new Set(),
    };

  if (!existing.sourcePlayerId) {
    existing.sourcePlayerId = explicitSourcePlayerId || fallbackSourcePlayerId;
  } else if (explicitSourcePlayerId && isSyntheticPlayerId(existing.sourcePlayerId)) {
    existing.sourcePlayerId = explicitSourcePlayerId;
  }

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

  syncRegistryEntry(registry, existing);
  return existing;
}

function resolveRegistryPlayer(registry, candidate) {
  const aliasKey = normalizeAliasKey(candidate);
  if (!aliasKey) {
    return null;
  }

  for (const entry of uniqueRegistryEntries(registry)) {
    if (entryAliasKeys(entry).has(aliasKey)) {
      return entry;
    }
  }

  return null;
}

function resolveOrRegisterAlias(registry, candidate) {
  const resolved = resolveRegistryPlayer(registry, candidate);
  if (resolved) {
    return resolved;
  }

  return registerPlayer(registry, {
    rawName: candidate,
    displayName: candidate,
  });
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

function parseTotalRow(row, fallbackText = "") {
  const cells = row?.cells || [];
  const legacyTotalRuns = toInteger(cells?.[2]?.text);
  const legacyDetailText =
    normalizeText(cells?.[1]?.text) || normalizeText(cells?.[0]?.text) || normalizeText(fallbackText);

  if (legacyTotalRuns !== null || cells.length >= 3) {
    const wicketsMatch = legacyDetailText.match(/(\d+)\s+wickets?/i);
    const oversMatch = legacyDetailText.match(/(\d+(?:\.\d+)?)\s+overs?/i);

    return {
      totalRuns: legacyTotalRuns,
      wickets: wicketsMatch ? Number(wicketsMatch[1]) : null,
      oversDecimal: toNumber(oversMatch?.[1]),
      legalBalls: oversMatch ? oversToBalls(oversMatch[1]) : null,
    };
  }

  const text = normalizeText(cells?.[0]?.text || fallbackText);
  const totalRuns = toInteger(text.match(/^Total\s*(\d+)/i)?.[1]) || toInteger(text.match(/(\d+)-\d+/)?.[1]);
  const wicketsMatch = text.match(/-(\d+)/);
  const oversMatch = text.match(/\((\d+(?:\.\d+)?)\s*Ov\)/i);
  const oversValue = oversMatch?.[1];

  return {
    totalRuns,
    wickets: wicketsMatch ? Number(wicketsMatch[1]) : null,
    oversDecimal: toNumber(oversValue),
    legalBalls: oversValue ? oversToBalls(oversValue) : null,
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

function splitModernBattingCell(value) {
  const text = normalizeText(value);
  if (!text) {
    return {
      playerName: "",
      dismissalText: "",
    };
  }

  for (const pattern of [
    /^(.*?)(not out)$/i,
    /^(.*?)(retired hurt)$/i,
    /^(.*?)(run out(?:\s*\([^)]*\))?.*)$/i,
    /^(.*?)(st\s+.*\s+b\s+.*)$/i,
    /^(.*?)(c\s+.*\s+b\s+.*)$/i,
    /^(.*?)(lbw\s+b\s+.*)$/i,
    /^(.*?)(hit wicket.*)$/i,
    /^(.*?)(b\s+.*)$/i,
  ]) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    return {
      playerName: cleanPlayerDisplayName(match[1]),
      dismissalText: normalizeText(match[2]),
    };
  }

  return {
    playerName: cleanPlayerDisplayName(text),
    dismissalText: "",
  };
}

function resolveDismissalParticipantsFromText(registry, dismissalText) {
  const text = normalizeText(dismissalText);
  if (!text) {
    return {
      bowler: null,
      primaryFielder: null,
    };
  }

  let match = text.match(/^c\s+(.+?)\s+b\s+(.+)$/i);
  if (match) {
    return {
      primaryFielder: resolveOrRegisterAlias(registry, match[1]),
      bowler: resolveOrRegisterAlias(registry, match[2]),
    };
  }

  match = text.match(/^st\s+(.+?)\s+b\s+(.+)$/i);
  if (match) {
    return {
      primaryFielder: resolveOrRegisterAlias(registry, match[1]),
      bowler: resolveOrRegisterAlias(registry, match[2]),
    };
  }

  match = text.match(/^lbw\s+b\s+(.+)$/i);
  if (match) {
    return {
      primaryFielder: null,
      bowler: resolveOrRegisterAlias(registry, match[1]),
    };
  }

  match = text.match(/^b\s+(.+)$/i);
  if (match) {
    return {
      primaryFielder: null,
      bowler: resolveOrRegisterAlias(registry, match[1]),
    };
  }

  match = text.match(/^run out(?:\s*\((.+)\))?$/i);
  if (match) {
    return {
      primaryFielder: match[1] ? resolveOrRegisterAlias(registry, match[1]) : null,
      bowler: null,
    };
  }

  return {
    bowler: null,
    primaryFielder: null,
  };
}

function enrichDismissalParticipants(registry, dismissalText, dismissal) {
  const resolved = resolveDismissalParticipantsFromText(registry, dismissalText);
  return {
    ...dismissal,
    bowler: dismissal?.bowler || resolved.bowler,
    primaryFielder: dismissal?.primaryFielder || resolved.primaryFielder,
  };
}

function parseLegacyBattingRow(row, registry, teamName, battingPosition) {
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
  const dismissal = enrichDismissalParticipants(
    registry,
    dismissalText,
    parseDismissalInfo(dismissalText, dismissalLinks)
  );

  return {
    playerSourceId: batter.sourcePlayerId,
    playerName: batter.displayName,
    teamName,
    battingPosition,
    isNotOut: dismissal.dismissalType === "not_out",
    dismissalType: dismissal.dismissalType,
    dismissalText,
    dismissedBySourcePlayerId: dismissal.bowler?.sourcePlayerId || parsePlayerIdFromUrl(dismissal.bowler?.href),
    primaryFielderSourcePlayerId:
      dismissal.primaryFielder?.sourcePlayerId || parsePlayerIdFromUrl(dismissal.primaryFielder?.href),
    runs: toInteger(cells[2]?.text) || 0,
    ballsFaced: toInteger(cells[3]?.text) || 0,
    fours: toInteger(cells[4]?.text) || 0,
    sixes: toInteger(cells[5]?.text) || 0,
    strikeRate: toNumber(cells[6]?.text),
    retiredHurt: dismissal.dismissalType === "retired_hurt",
    didNotBat: false,
  };
}

function parseModernBattingRow(row, registry, teamName, battingPosition) {
  const cells = row?.cells || [];
  if (cells.length < 6) {
    return null;
  }

  const parts = splitModernBattingCell(cells[0]?.text);
  const batter = registerPlayer(registry, {
    rawName: parts.playerName,
    displayName: parts.playerName,
  });
  if (!batter) {
    return null;
  }

  const dismissalText = normalizeText(parts.dismissalText) || "not out";
  const dismissal = enrichDismissalParticipants(
    registry,
    dismissalText,
    parseDismissalInfo(dismissalText, [])
  );

  return {
    playerSourceId: batter.sourcePlayerId,
    playerName: batter.displayName,
    teamName,
    battingPosition,
    isNotOut: dismissal.dismissalType === "not_out",
    dismissalType: dismissal.dismissalType,
    dismissalText,
    dismissedBySourcePlayerId: dismissal.bowler?.sourcePlayerId || parsePlayerIdFromUrl(dismissal.bowler?.href),
    primaryFielderSourcePlayerId:
      dismissal.primaryFielder?.sourcePlayerId || parsePlayerIdFromUrl(dismissal.primaryFielder?.href),
    runs: toInteger(cells[1]?.text) || 0,
    ballsFaced: toInteger(cells[2]?.text) || 0,
    fours: toInteger(cells[3]?.text) || 0,
    sixes: toInteger(cells[4]?.text) || 0,
    strikeRate: toNumber(cells[5]?.text),
    retiredHurt: dismissal.dismissalType === "retired_hurt",
    didNotBat: false,
  };
}

function parseBattingRow(row, registry, teamName, battingPosition) {
  const cells = row?.cells || [];
  const label = normalizeText(cells?.[0]?.text);
  if (!cells.length || !label || /^extras/i.test(label) || /^total/i.test(label) || /^did not bat/i.test(label)) {
    return null;
  }

  return cells.length === 6
    ? parseModernBattingRow(row, registry, teamName, battingPosition)
    : parseLegacyBattingRow(row, registry, teamName, battingPosition);
}

function parseDidNotBatRows(row, registry, teamName, startingPosition) {
  const entry = row?.cells?.[0];
  if (!entry) {
    return [];
  }

  const links = extractPlayerLinks(entry.links);
  links.forEach((link) => playerFromLink(registry, link, link.text));

  return splitDidNotBatList(entry.text)
    .map((name, index) => {
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
    })
    .filter(Boolean);
}

function parseBowlingRows(table, registry, teamName) {
  const rows = table?.rows || [];
  const modernLayout = normalizeText(rows?.[0]?.cells?.[0]?.text) === "Bowler";

  return rows
    .slice(1)
    .map((row, index) => {
      const cells = row.cells || [];

      if (modernLayout) {
        if (cells.length < 8) {
          return null;
        }

        const bowler = registerPlayer(registry, {
          rawName: cells[0]?.text,
          displayName: cells[0]?.text,
        });
        if (!bowler) {
          return null;
        }

        const oversText = normalizeText(cells[1]?.text);
        const extras = parseBowlingExtras(cells[7]?.text);

        return {
          playerSourceId: bowler.sourcePlayerId,
          playerName: bowler.displayName,
          teamName,
          oversDecimal: toNumber(oversText),
          legalBalls: oversToBalls(oversText),
          maidens: toInteger(cells[2]?.text) || 0,
          dotBalls: toInteger(cells[3]?.text) || 0,
          runsConceded: toInteger(cells[4]?.text) || 0,
          wickets: toInteger(cells[5]?.text) || 0,
          economy: toNumber(cells[6]?.text),
          wides: extras.wides,
          noBalls: extras.noBalls,
          bestFigures: `${toInteger(cells[5]?.text) || 0}/${toInteger(cells[4]?.text) || 0}`,
          spellSequence: index + 1,
        };
      }

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

function extractModernHeadingGroups(rawScorecard) {
  const headings = rawScorecard?.headings || [];
  const groups = [];

  for (let index = 0; index < headings.length; index += 1) {
    const headingText = normalizeText(headings[index]);
    if (!/\sinnings\b/i.test(headingText)) {
      continue;
    }

    groups.push({
      headingText,
      totalHeading: normalizeText(headings[index + 1]),
      battingTeamName: parseBattingTeamName(headingText),
    });
  }

  return groups;
}

function findInningsGroups(tables = [], rawScorecard = {}) {
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
      fallOfWicketsTable: null,
      headingText: headerText,
      totalHeading: "",
      battingTeamName: parseBattingTeamName(headerText),
    });
    index += 2;
  }

  if (groups.length) {
    return groups;
  }

  const headingGroups = extractModernHeadingGroups(rawScorecard);
  let tableIndex = 0;

  for (const headingGroup of headingGroups) {
    while (tableIndex < tables.length) {
      const header = normalizeText(tables[tableIndex]?.rows?.[0]?.cells?.[0]?.text);
      if (header === "Batter") {
        break;
      }
      tableIndex += 1;
    }

    const battingTable = tables[tableIndex] || null;
    const bowlingTable = tables[tableIndex + 1] || null;
    const battingHeader = normalizeText(battingTable?.rows?.[0]?.cells?.[0]?.text);
    const bowlingHeader = normalizeText(bowlingTable?.rows?.[0]?.cells?.[0]?.text);

    if (battingHeader !== "Batter" || bowlingHeader !== "Bowler") {
      continue;
    }

    let fallOfWicketsTable = null;
    const wicketsHeader = normalizeText(tables[tableIndex + 2]?.rows?.[0]?.cells?.[0]?.text);
    if (wicketsHeader === "Fall of Wickets") {
      fallOfWicketsTable = tables[tableIndex + 2];
      tableIndex += 3;
    } else {
      tableIndex += 2;
    }

    groups.push({
      battingTable,
      didNotBatTable: null,
      bowlingTable,
      fallOfWicketsTable,
      headingText: headingGroup.headingText || "",
      totalHeading: headingGroup.totalHeading || "",
      battingTeamName: headingGroup.battingTeamName || "",
    });
  }

  return groups;
}

function registerFallOfWicketPlayers(table, registry) {
  for (const row of (table?.rows || []).slice(1)) {
    const entryCell = row?.cells?.[0];
    if (!entryCell) {
      continue;
    }

    const links = extractPlayerLinks(entryCell.links);
    if (links.length) {
      links.forEach((link) => playerFromLink(registry, link, link.text));
      continue;
    }

    const text = normalizeText(entryCell.text);
    if (text) {
      registerPlayer(registry, {
        rawName: text,
        displayName: text,
      });
    }
  }
}

function buildPlayerRegistryPayload(registry) {
  return uniqueRegistryEntries(registry).map((entry) => ({
    sourcePlayerId: entry.sourcePlayerId,
    displayName: entry.displayName,
    canonicalName: entry.canonicalName,
    profileUrl: entry.profileUrl,
    isWicketkeeper: entry.isWicketkeeper,
    isCaptain: entry.isCaptain,
    aliases: [...entry.aliases],
  }));
}

function parseScorecard(rawScorecard) {
  const registry = createRegistry();
  if (rawScorecard?.scorecardUnavailable === true) {
    return {
      match: {
        title: normalizeText(rawScorecard?.title),
        headings: rawScorecard?.headings || [],
      },
      innings: [],
      battingInnings: [],
      bowlingSpells: [],
      fieldingEvents: [],
      playerRegistry: [],
      notes: [
        normalizeText(rawScorecard?.unavailableReason) || "Scorecard not available on CricClubs for this match.",
      ],
    };
  }

  const groups = findInningsGroups(rawScorecard?.tables || [], rawScorecard);
  if (!groups.length) {
    return {
      match: {
        title: normalizeText(rawScorecard?.title),
        headings: rawScorecard?.headings || [],
      },
      innings: [],
      battingInnings: [],
      bowlingSpells: [],
      fieldingEvents: [],
      playerRegistry: [],
      notes: ["Scorecard parser could not find innings tables in the fetched payload."],
    };
  }

  groups.forEach((group) => registerFallOfWicketPlayers(group.fallOfWicketsTable, registry));

  const battingTeamNames = groups.map((group, index) =>
    group.battingTeamName ||
    parseBattingTeamName(group.headingText || group.battingTable?.rows?.[0]?.cells?.[0]?.text) ||
    `Innings ${index + 1}`
  );

  const innings = [];
  const battingInnings = [];
  const bowlingSpells = [];

  groups.forEach((group, index) => {
    const inningsNo = index + 1;
    const battingTable = group.battingTable;
    const headerText = normalizeText(group.headingText || battingTable?.rows?.[0]?.cells?.[0]?.text);
    const battingTeamName = battingTeamNames[index];
    const bowlingTeamName = battingTeamNames.find((_, entryIndex) => entryIndex !== index) || "";
    const battingRows = (battingTable?.rows || []).slice(1);
    const extrasRow = battingRows.find((row) => normalizeText(row?.cells?.[0]?.text).startsWith("Extras"));
    const totalRow = battingRows.find((row) => normalizeText(row?.cells?.[0]?.text).startsWith("Total"));
    const inlineDidNotBatRows = battingRows.filter((row) =>
      normalizeText(row?.cells?.[0]?.text).startsWith("Did not bat")
    );
    const didNotBatRows = inlineDidNotBatRows.length
      ? inlineDidNotBatRows
      : (group.didNotBatTable?.rows || []).filter((row) =>
          normalizeText(row?.cells?.[0]?.text).startsWith("Did not bat")
        );
    const actualBattingRows = battingRows.filter((row) => {
      const label = normalizeText(row?.cells?.[0]?.text);
      return label && !/^extras/i.test(label) && !/^total/i.test(label) && !/^did not bat/i.test(label);
    });
    const extrasText = normalizeText(extrasRow?.cells?.[0]?.text || extrasRow?.cells?.[1]?.text);
    const extras = parseExtrasBreakdown(extrasText);
    const totals = parseTotalRow(totalRow, group.totalHeading);
    const extrasTotal =
      toInteger(extrasText.match(/^Extras\s*(\d+)/i)?.[1]) ||
      toInteger(extrasRow?.cells?.[2]?.text) ||
      extras.extrasTotal ||
      0;

    const parsedBowlingRows = parseBowlingRows(group.bowlingTable, registry, bowlingTeamName);
    const targetRuns = parseTargetRuns(headerText);

    innings.push({
      inningsNo,
      battingTeamName,
      bowlingTeamName,
      totalRuns: totals.totalRuns,
      wickets: totals.wickets,
      oversDecimal: totals.oversDecimal,
      legalBalls: totals.legalBalls,
      extrasTotal,
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

    let didNotBatPosition = actualBattingRows.length + 1;
    didNotBatRows.forEach((row) => {
      const parsedRows = parseDidNotBatRows(row, registry, battingTeamName, didNotBatPosition);
      didNotBatPosition += parsedRows.length;
      parsedRows.forEach((parsed) => {
        battingInnings.push({
          inningsNo,
          ...parsed,
        });
      });
    });

    parsedBowlingRows.forEach((parsed) => {
      bowlingSpells.push({
        inningsNo,
        ...parsed,
      });
    });
  });

  if (
    innings.length >= 2 &&
    !Number.isFinite(innings[1]?.targetRuns) &&
    Number.isFinite(innings[0]?.totalRuns)
  ) {
    innings[1].targetRuns = Number(innings[0].totalRuns) + 1;
  }

  return {
    match: {
      title: normalizeText(rawScorecard?.title),
      headings: rawScorecard?.headings || [],
    },
    innings,
    battingInnings,
    bowlingSpells,
    fieldingEvents: [],
    playerRegistry: buildPlayerRegistryPayload(registry),
    notes: [],
  };
}

module.exports = {
  parseScorecard,
};

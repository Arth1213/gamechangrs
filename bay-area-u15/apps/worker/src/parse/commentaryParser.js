const {
  normalizeAliasKey,
  normalizeText,
  parseBallLabel,
  parseCommentaryOutcome,
  phaseForOver,
} = require("../lib/cricket");

function buildPlayerResolver(parsedScorecard) {
  const players = Array.isArray(parsedScorecard?.playerRegistry) ? parsedScorecard.playerRegistry : [];
  const bySourceId = new Map();
  const aliasEntries = [];

  for (const player of players) {
    const sourcePlayerId = normalizeText(player?.sourcePlayerId);
    if (sourcePlayerId) {
      bySourceId.set(sourcePlayerId, player);
    }

    for (const alias of player?.aliases || []) {
      const aliasKey = normalizeAliasKey(alias);
      if (aliasKey) {
        aliasEntries.push({
          aliasKey,
          aliasLength: aliasKey.length,
          player,
        });
      }
    }
  }

  aliasEntries.sort((left, right) => right.aliasLength - left.aliasLength);
  return {
    bySourceId,
    aliasEntries,
  };
}

function resolveFromLinks(resolver, links = []) {
  for (const link of links) {
    const sourcePlayerId = normalizeText(link?.playerId);
    if (sourcePlayerId && resolver.bySourceId.has(sourcePlayerId)) {
      return resolver.bySourceId.get(sourcePlayerId);
    }
  }

  return null;
}

function resolveFromPrefix(resolver, value) {
  const normalized = normalizeAliasKey(value);
  if (!normalized) {
    return null;
  }

  for (const entry of resolver.aliasEntries) {
    if (!normalized.startsWith(entry.aliasKey)) {
      continue;
    }

    const nextChar = normalized.slice(entry.aliasKey.length, entry.aliasKey.length + 1);
    if (!nextChar || nextChar === " ") {
      return entry.player;
    }
  }

  return null;
}

function resolvePlayer(resolver, candidate, links = []) {
  return resolveFromLinks(resolver, links) || resolveFromPrefix(resolver, candidate);
}

function parseAttackChange(text, resolver) {
  const normalized = normalizeText(text);
  const match = normalized.match(/^(.*?)(?:\s+\(\d+\))?,?\s+comes into the attack\.?$/i);
  if (!match) {
    return null;
  }

  return resolveFromPrefix(resolver, match[1]);
}

function inferDismissal(text, links, striker, resolver) {
  const normalized = normalizeText(text);
  const lower = normalized.toLowerCase();
  const linkedPlayers = links
    .map((link) => resolvePlayer(resolver, link?.text, [link]))
    .filter(Boolean);
  const playerOut = linkedPlayers[0] || striker || null;
  const second = linkedPlayers[1] || null;
  const last = linkedPlayers[linkedPlayers.length - 1] || null;

  if (/retired/i.test(lower)) {
    return {
      dismissalType: "retired_hurt",
      wicketCreditedToBowler: false,
      playerOut,
      primaryFielder: null,
      bowler: null,
      wicketFlag: false,
    };
  }

  if (/run out/i.test(lower)) {
    return {
      dismissalType: "run_out",
      wicketCreditedToBowler: false,
      playerOut,
      primaryFielder: second,
      bowler: null,
      wicketFlag: true,
    };
  }

  if (/stumped/i.test(lower)) {
    return {
      dismissalType: "stumped",
      wicketCreditedToBowler: true,
      playerOut,
      primaryFielder: second,
      bowler: last,
      wicketFlag: true,
    };
  }

  if (/lbw/i.test(lower)) {
    return {
      dismissalType: "lbw",
      wicketCreditedToBowler: true,
      playerOut,
      primaryFielder: null,
      bowler: last,
      wicketFlag: true,
    };
  }

  if (/caught/i.test(lower) || /\bc\b/i.test(lower)) {
    return {
      dismissalType: "caught",
      wicketCreditedToBowler: true,
      playerOut,
      primaryFielder: second,
      bowler: last,
      wicketFlag: true,
    };
  }

  if (/bowled/i.test(lower) || /\bb\s+[a-z]/i.test(lower)) {
    return {
      dismissalType: "bowled",
      wicketCreditedToBowler: true,
      playerOut,
      primaryFielder: null,
      bowler: last,
      wicketFlag: true,
    };
  }

  return {
    dismissalType: "other",
    wicketCreditedToBowler: Boolean(last),
    playerOut,
    primaryFielder: second,
    bowler: last,
    wicketFlag: /\bout!\b/i.test(normalized),
  };
}

function parseDeliveryRow(row, resolver, currentBowler, innings) {
  const leftText = normalizeText(row?.leftText);
  const commentaryText = normalizeText(row?.commentaryText);
  const attackChange = parseAttackChange(commentaryText, resolver);
  if (attackChange) {
    return {
      currentBowler: attackChange,
      event: null,
    };
  }

  const deliveryMatch = leftText.match(/^(?:(.+?)\s+)?(\d+\.\d+)$/);
  if (!deliveryMatch) {
    return {
      currentBowler,
      event: null,
    };
  }

  const runToken = normalizeText(deliveryMatch[1]) || "0";
  const parsedLabel = parseBallLabel(deliveryMatch[2]);
  if (!parsedLabel) {
    return {
      currentBowler,
      event: null,
    };
  }

  let bowler = currentBowler;
  let striker = null;
  let strikerText = commentaryText;

  if (commentaryText.includes(" to ")) {
    const [bowlerText, remainder] = commentaryText.split(/\s+to\s+/, 2);
    bowler = resolveFromPrefix(resolver, bowlerText) || currentBowler;
    strikerText = remainder;
    striker = resolveFromPrefix(resolver, remainder);
  } else {
    striker = resolveFromPrefix(resolver, commentaryText);
  }

  const outcome = parseCommentaryOutcome(runToken, commentaryText);
  const dismissal = inferDismissal(commentaryText, row?.links || [], striker, resolver);
  const wicketFlag = dismissal.dismissalType === "retired_hurt" ? false : outcome.wicketFlag || dismissal.wicketFlag;

  return {
    currentBowler: bowler || currentBowler,
    event: {
      inningsNo: innings.inningsNo,
      battingTeamName: innings.battingTeamName,
      bowlingTeamName: innings.bowlingTeamName,
      overNo: parsedLabel.overNo,
      ballInOver: parsedLabel.ballInOver,
      ballLabel: parsedLabel.ballLabel,
      phase: phaseForOver(parsedLabel.overNo),
      strikerSourcePlayerId: normalizeText(striker?.sourcePlayerId),
      strikerName: striker?.displayName || normalizeText(strikerText.split(",")[0]),
      nonStrikerSourcePlayerId: null,
      bowlerSourcePlayerId: normalizeText(bowler?.sourcePlayerId),
      bowlerName: bowler?.displayName || null,
      batterRuns: outcome.batterRuns,
      extras: outcome.extras,
      extraType: outcome.extraType || null,
      totalRuns: outcome.totalRuns,
      isLegalBall: outcome.isLegalBall,
      wicketFlag,
      dismissalType: dismissal.dismissalType === "other" ? null : dismissal.dismissalType,
      playerOutSourcePlayerId:
        normalizeText(dismissal.playerOut?.sourcePlayerId) || normalizeText(striker?.sourcePlayerId),
      primaryFielderSourcePlayerId: normalizeText(dismissal.primaryFielder?.sourcePlayerId),
      wicketCreditedToBowler:
        dismissal.dismissalType === "retired_hurt" ? false : dismissal.wicketCreditedToBowler,
      commentaryText,
      parseConfidence:
        striker && (bowler || commentaryText.includes(" to ")) ? 0.95 : striker || bowler ? 0.75 : 0.55,
    },
  };
}

function buildOverSummaries(ballEvents) {
  const buckets = new Map();

  for (const event of ballEvents) {
    const key = `${event.inningsNo}:${event.overNo}`;
    const bucket = buckets.get(key) || {
      inningsNo: event.inningsNo,
      overNo: event.overNo,
      bowlerSourcePlayerId: event.bowlerSourcePlayerId,
      legalBalls: 0,
      runsInOver: 0,
      wicketsInOver: 0,
      dotsInOver: 0,
      boundariesInOver: 0,
      overStateText: "",
    };

    bucket.bowlerSourcePlayerId = bucket.bowlerSourcePlayerId || event.bowlerSourcePlayerId;
    bucket.legalBalls += event.isLegalBall ? 1 : 0;
    bucket.runsInOver += event.totalRuns || 0;
    bucket.wicketsInOver += event.wicketFlag ? 1 : 0;
    bucket.dotsInOver += event.isLegalBall && (event.totalRuns || 0) === 0 ? 1 : 0;
    bucket.boundariesInOver += [4, 6].includes(event.batterRuns) ? 1 : 0;
    bucket.overStateText = `End ${event.scoreAfterRuns}/${event.wicketsAfter}`;

    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort(
    (left, right) => left.inningsNo - right.inningsNo || left.overNo - right.overNo
  );
}

function buildFieldingEvents(ballEvents, resolver) {
  const playerById = resolver.bySourceId;

  return ballEvents
    .filter((event) => event.wicketFlag)
    .map((event) => {
      const fielder = playerById.get(normalizeText(event.primaryFielderSourcePlayerId));
      return {
        inningsNo: event.inningsNo,
        overNo: event.overNo,
        ballNo: Number(`${event.overNo}.${event.ballInOver}`),
        playerOutSourcePlayerId: event.playerOutSourcePlayerId,
        bowlerSourcePlayerId: event.bowlerSourcePlayerId,
        fielderSourcePlayerId: event.primaryFielderSourcePlayerId,
        dismissalType: event.dismissalType || "other",
        isDirectRunOut: event.dismissalType === "run_out" ? null : false,
        isIndirectRunOut: event.dismissalType === "run_out" ? null : false,
        isWicketkeeperEvent: Boolean(fielder?.isWicketkeeper),
        notes: event.commentaryText,
      };
    });
}

function parseCommentary(rawCommentary, parsedScorecard) {
  const resolver = buildPlayerResolver(parsedScorecard);
  const inningsLookup = new Map(
    (parsedScorecard?.innings || []).map((innings) => [innings.inningsNo, innings])
  );
  const ballEvents = [];

  for (const section of rawCommentary?.sections || []) {
    const innings = inningsLookup.get(section.inningsNo);
    if (!innings) {
      continue;
    }

    let currentBowler = null;
    let scoreAfterRuns = 0;
    let wicketsAfter = 0;
    let eventIndex = 0;

    for (const row of section.rows || []) {
      const parsed = parseDeliveryRow(row, resolver, currentBowler, innings);
      currentBowler = parsed.currentBowler;

      if (!parsed.event) {
        continue;
      }

      eventIndex += 1;
      scoreAfterRuns += parsed.event.totalRuns || 0;
      wicketsAfter += parsed.event.wicketFlag ? 1 : 0;

      ballEvents.push({
        eventIndex,
        scoreAfterRuns,
        wicketsAfter,
        ...parsed.event,
      });
    }
  }

  return {
    ballEvents,
    overSummaries: buildOverSummaries(ballEvents),
    fieldingEvents: buildFieldingEvents(ballEvents, resolver),
    notes: [],
  };
}

module.exports = {
  parseCommentary,
};

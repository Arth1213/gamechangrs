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

  const matches = [];
  for (const entry of resolver.aliasEntries) {
    if (!normalized.startsWith(entry.aliasKey)) {
      continue;
    }

    const nextChar = normalized.slice(entry.aliasKey.length, entry.aliasKey.length + 1);
    if (!nextChar || nextChar === " ") {
      matches.push(entry);
    }
  }

  const longest = matches[0]?.aliasLength;
  const players = [...new Set(matches.filter(entry => entry.aliasLength === longest).map(entry => entry.player))];
  return players.length === 1 ? players[0] : null;
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
  const isDismissal = /\bout!/i.test(normalized)
    || /\b(?:retired|run out|stumped|lbw|caught|bowled)\b/i.test(normalized);

  // Player initials in ordinary delivery text (for example "C Le Roux" or
  // "B Basheer") must never be interpreted as scorecard dismissal notation.
  if (!isDismissal) {
    return {
      dismissalType: "other",
      wicketCreditedToBowler: false,
      playerOut: null,
      primaryFielder: null,
      bowler: null,
      wicketFlag: false,
    };
  }
  const linkedPlayers = links
    .map((link) => resolvePlayer(resolver, link?.text, [link]))
    .filter(Boolean);
  const runOutName = normalized.match(/\bOUT!\s*RUN OUT\s+(.+?)\s+run out\b/i)?.[1];
  const namedRunOut = runOutName ? resolveFromPrefix(resolver, runOutName) : null;
  const playerOut = namedRunOut || linkedPlayers[0] || striker || null;
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

  if (/\b(?:caught|catch)\b/i.test(lower)) {
    return {
      dismissalType: "caught",
      wicketCreditedToBowler: true,
      playerOut,
      primaryFielder: second,
      bowler: last,
      wicketFlag: true,
    };
  }

  if (/\bbowled\b/i.test(lower)) {
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
  const attackChange = parseAttackChange(commentaryText, resolver.bowlers || resolver);
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
    bowler = resolveFromPrefix(resolver.bowlers || resolver, bowlerText) || currentBowler;
    strikerText = remainder;
    striker = resolveFromPrefix(resolver.batters || resolver, remainder);
  } else {
    striker = resolveFromPrefix(resolver.batters || resolver, commentaryText);
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
        wicketFlag
          ? normalizeText(dismissal.playerOut?.sourcePlayerId) || normalizeText(striker?.sourcePlayerId)
          : null,
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
    const scopeResolver = rows => {
      const ids = new Set((rows || []).filter(r => r.inningsNo === innings.inningsNo).map(r => r.playerSourceId));
      return ids.size ? buildPlayerResolver({ playerRegistry: parsedScorecard.playerRegistry.filter(p => ids.has(p.sourcePlayerId)) }) : resolver;
    };
    const inningsResolver = { ...resolver,
      batters: scopeResolver(parsedScorecard.battingInnings?.filter(b => !b.didNotBat)),
      bowlers: scopeResolver(parsedScorecard.bowlingSpells),
    };

    let currentBowler = null;
    let scoreAfterRuns = 0;
    let wicketsAfter = 0;
    let eventIndex = 0;

    for (const row of section.rows || []) {
      const parsed = parseDeliveryRow(row, inningsResolver, currentBowler, innings);
      currentBowler = parsed.currentBowler;

      if (!parsed.event) {
        continue;
      }

      const previous = ballEvents[ballEvents.length - 1];
      // CricClubs can emit a separate dismissal annotation for the same
      // no-ball. Keep the wicket on that delivery, not on an invented ball.
      if (
        previous?.inningsNo === innings.inningsNo &&
        previous.ballLabel === parsed.event.ballLabel &&
        previous.extraType === "no_ball" && !previous.isLegalBall && !previous.wicketFlag &&
        parsed.event.dismissalType === "run_out" && parsed.event.wicketFlag &&
        parsed.event.totalRuns === 0 && !/\s+to\s+/i.test(parsed.event.commentaryText)
      ) {
        wicketsAfter += 1;
        Object.assign(previous, {
          wicketFlag: true,
          dismissalType: "run_out",
          playerOutSourcePlayerId: parsed.event.playerOutSourcePlayerId,
          primaryFielderSourcePlayerId: parsed.event.primaryFielderSourcePlayerId,
          wicketCreditedToBowler: false,
          wicketsAfter,
          commentaryText: `${previous.commentaryText} | ${parsed.event.commentaryText}`,
        });
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

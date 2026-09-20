"use strict";

const T20_PHASES = Object.freeze({
  powerplay: Object.freeze({ firstOver: 1, lastOver: 6 }),
  middle: Object.freeze({ firstOver: 7, lastOver: 15 }),
  death: Object.freeze({ firstOver: 16, lastOver: 20 }),
});

const RECOVERY_THRESHOLDS = Object.freeze({
  minimumPartnershipRuns: 15,
  minimumPartnershipBalls: 9,
  earlyWickets: 2,
});

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value) {
  return Math.min(1, Math.max(0, toNumber(value)));
}

function getEventInnings(event) {
  return toNumber(event?.innings ?? event?.inningsNo ?? event?.innings_no);
}

function getEventIndex(event) {
  return toNumber(event?.eventIndex ?? event?.event_index, Number.MAX_SAFE_INTEGER);
}

function getOver(event) {
  return toNumber(event?.over ?? event?.overNo ?? event?.over_no);
}

function getBallInOver(event) {
  return toNumber(event?.ballInOver ?? event?.ball_in_over);
}

function isLegal(event) {
  return event?.legal === true || event?.isLegalBall === true || event?.is_legal_ball === true;
}

function eventRuns(event) {
  return toNumber(event?.runs ?? event?.totalRuns ?? event?.total_runs);
}

function eventWicket(event) {
  return event?.wicket === true || event?.wicketFlag === true || event?.wicket_flag === true;
}

function playerId(event, camel, snake) {
  const value = event?.[camel] ?? event?.[snake];
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sortBallEvents(events) {
  return (Array.isArray(events) ? events : []).slice().sort((left, right) =>
    getEventInnings(left) - getEventInnings(right)
    || getEventIndex(left) - getEventIndex(right)
    || getOver(left) - getOver(right)
    || getBallInOver(left) - getBallInOver(right)
  );
}

function phaseForOver(over) {
  return Object.entries(T20_PHASES).find(([, range]) => over >= range.firstOver && over <= range.lastOver)?.[0] || "unknown";
}

function battingPlayerId(row) {
  return playerId(row, "playerId", "player_id");
}

function battingInnings(row) {
  return toNumber(row?.innings ?? row?.inningsNo ?? row?.innings_no);
}

function battingPosition(row) {
  return toNumber(row?.battingPosition ?? row?.batting_position, Number.MAX_SAFE_INTEGER);
}

function isDidNotBat(row) {
  return row?.didNotBat === true || row?.did_not_bat === true;
}

function cleanPlayerName(value) {
  return String(value || "")
    .replace(/^did not bat/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+c&\s*$/i, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function playerNameKeys(value) {
  const normalized = cleanPlayerName(value);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!normalized) return [];
  return [...new Set([
    normalized,
    tokens.length >= 2 ? `${tokens[0][0]} ${tokens[tokens.length - 1]}` : normalized,
  ])];
}

function commentaryStrikerName(event) {
  const commentary = String(event?.commentaryText ?? event?.commentary_text ?? "");
  const match = commentary.match(/\s+to\s+(.+)$/i);
  return String(match?.[1] || "")
    .replace(/\s+OUT!.*$/i, "")
    .replace(/,.*$/, "")
    .replace(/\s+(?:\d+\s+)?(?:wides?|no\s+balls?|leg\s+byes?|byes?)\s*$/i, "")
    .trim();
}

function hasExplicitDismissal(event) {
  const commentary = String(event?.commentaryText ?? event?.commentary_text ?? "").trim();
  return commentary ? /\bOUT!/i.test(commentary) : eventWicket(event);
}

/**
 * Repairs historical commentary rows before analytical use. Older persisted
 * rows may contain false wicket flags and no non-striker identity. The batting
 * order and the observed striker sequence provide a deterministic active pair;
 * explicit OUT commentary remains the only wicket signal when commentary is
 * present.
 */
function normalizePersistedBallEvents(ballEvents, batting = []) {
  const battingOrders = new Map();
  const battingAliases = new Map();
  for (const row of Array.isArray(batting) ? batting : []) {
    const innings = battingInnings(row);
    const id = battingPlayerId(row);
    if (!innings || !id || isDidNotBat(row)) continue;
    if (!battingOrders.has(innings)) battingOrders.set(innings, []);
    battingOrders.get(innings).push({ id, position: battingPosition(row) });
    if (!battingAliases.has(innings)) battingAliases.set(innings, new Map());
    for (const key of playerNameKeys(row?.playerName ?? row?.player_name)) {
      if (!battingAliases.get(innings).has(key)) battingAliases.get(innings).set(key, id);
    }
  }
  for (const rows of battingOrders.values()) rows.sort((left, right) => left.position - right.position);

  const canonicalEvents = (Array.isArray(ballEvents) ? ballEvents : []).map((event) => {
    const innings = getEventInnings(event);
    const aliases = battingAliases.get(innings) || new Map();
    const name = event?.strikerName ?? event?.striker_name ?? commentaryStrikerName(event);
    const canonicalStriker = playerNameKeys(name).map((key) => aliases.get(key)).find(Boolean)
      || playerId(event, "strikerPlayerId", "striker_player_id");
    const wicket = hasExplicitDismissal(event);
    return {
      ...event,
      strikerPlayerId: canonicalStriker,
      playerOutId: wicket ? canonicalStriker : null,
    };
  });
  const sortedEvents = sortBallEvents(canonicalEvents);
  const observedStrikers = new Map();
  for (const event of sortedEvents) {
    const innings = getEventInnings(event);
    const striker = playerId(event, "strikerPlayerId", "striker_player_id");
    if (!observedStrikers.has(innings)) observedStrikers.set(innings, new Set());
    if (striker) observedStrikers.get(innings).add(striker);
  }

  const states = new Map();
  function stateFor(innings) {
    if (!states.has(innings)) {
      const order = (battingOrders.get(innings) || []).map((row) => row.id);
      const observed = observedStrikers.get(innings) || new Set();
      const usesBattingIds = order.some((id) => observed.has(id));
      states.set(innings, {
        order,
        usesBattingIds,
        nextIndex: usesBattingIds ? Math.min(2, order.length) : 0,
        active: usesBattingIds ? order.slice(0, 2) : [],
        segmentIndexes: [],
        score: 0,
        wickets: 0,
      });
    }
    return states.get(innings);
  }

  const normalizedEvents = [];
  for (const event of sortedEvents) {
    const innings = getEventInnings(event);
    const state = stateFor(innings);
    const striker = playerId(event, "strikerPlayerId", "striker_player_id");
    if (striker && !state.active.includes(striker)) {
      if (state.active.length < 2) state.active.push(striker);
      else if (state.usesBattingIds && state.order.includes(striker)) state.active[1] = striker;
    }
    const storedNonStriker = playerId(event, "nonStrikerPlayerId", "non_striker_player_id");
    const inferredNonStriker = storedNonStriker
      || state.active.find((id) => id !== striker)
      || null;
    const wicket = hasExplicitDismissal(event);
    const playerOut = wicket
      ? playerId(event, "playerOutId", "player_out_id") || striker
      : null;
    state.score += eventRuns(event);
    if (wicket) state.wickets += 1;

    const normalized = {
      ...event,
      phase: event?.phase || phaseForOver(getOver(event)),
      nonStrikerPlayerId: inferredNonStriker,
      playerOutId: playerOut,
      wicket,
      scoreAfterRuns: state.score,
      wicketsAfter: state.wickets,
    };
    normalizedEvents.push(normalized);

    if (!state.usesBattingIds) {
      state.segmentIndexes.push(normalizedEvents.length - 1);
      if (state.active.length === 2) {
        for (const index of state.segmentIndexes) {
          const segmentEvent = normalizedEvents[index];
          const segmentStriker = playerId(segmentEvent, "strikerPlayerId", "striker_player_id");
          segmentEvent.nonStrikerPlayerId = state.active.find((id) => id !== segmentStriker) || null;
        }
      }
    }

    if (wicket && playerOut) {
      state.active = state.active.filter((id) => id !== playerOut);
      while (state.usesBattingIds && state.active.length < 2 && state.nextIndex < state.order.length) {
        const next = state.order[state.nextIndex];
        state.nextIndex += 1;
        if (!state.active.includes(next)) state.active.push(next);
      }
      state.segmentIndexes = [];
    }
  }
  return normalizedEvents;
}

function buildPhaseMetrics(ballEvents) {
  const buckets = new Map();
  for (const event of sortBallEvents(ballEvents)) {
    const innings = getEventInnings(event);
    const phase = event?.phase || phaseForOver(getOver(event));
    const key = `${innings}:${phase}`;
    if (!buckets.has(key)) {
      buckets.set(key, { innings, phase, runs: 0, wickets: 0, legalBalls: 0, dots: 0, boundaries: 0 });
    }
    const row = buckets.get(key);
    const runs = eventRuns(event);
    row.runs += runs;
    if (eventWicket(event)) row.wickets += 1;
    if (isLegal(event)) {
      row.legalBalls += 1;
      if (runs === 0) row.dots += 1;
    }
    const batterRuns = toNumber(event?.batterRuns ?? event?.batter_runs);
    if (batterRuns === 4 || batterRuns === 6) row.boundaries += 1;
  }
  return [...buckets.values()].map((row) => ({
    ...row,
    runRate: row.legalBalls ? round((row.runs * 6) / row.legalBalls) : null,
    dotBallRate: row.legalBalls ? round((row.dots * 100) / row.legalBalls) : null,
    boundaryRate: row.legalBalls ? round((row.boundaries * 100) / row.legalBalls) : null,
  }));
}

function pairForEvent(event) {
  const pair = [
    playerId(event, "strikerPlayerId", "striker_player_id"),
    playerId(event, "nonStrikerPlayerId", "non_striker_player_id"),
  ].filter(Number.isInteger);
  return pair.length === 2 ? pair.sort((left, right) => left - right) : [];
}

function samePair(left, right) {
  return left.length === 2 && right.length === 2 && left[0] === right[0] && left[1] === right[1];
}

function inningsRowFor(innings, inningsNumber) {
  return (Array.isArray(innings) ? innings : []).find(
    (row, index) => toNumber(row?.innings ?? row?.inningsNo ?? row?.innings_no, index + 1) === inningsNumber
  ) || {};
}

function requiredRate(target, score, legalBallsUsed, maximumBalls) {
  const ballsRemaining = Math.max(maximumBalls - legalBallsUsed, 0);
  const runsRemaining = Math.max(target - score, 0);
  if (runsRemaining === 0) return 0;
  return ballsRemaining > 0 ? round((runsRemaining * 6) / ballsRemaining) : null;
}

function buildPartnerships(innings, ballEvents, playersById = new Map()) {
  const events = sortBallEvents(ballEvents);
  const partnerships = [];
  let active = null;
  const stateByInnings = new Map();

  function stateFor(inningsNumber) {
    if (!stateByInnings.has(inningsNumber)) {
      stateByInnings.set(inningsNumber, { score: 0, wickets: 0, legalBalls: 0 });
    }
    return stateByInnings.get(inningsNumber);
  }

  function closeActive(complete, final = false) {
    if (!active) return;
    const row = inningsRowFor(innings, active.innings);
    const officialFinalScore = toNumber(row.runs ?? row.totalRuns ?? row.total_runs);
    if (final && officialFinalScore > active.endScore) active.endScore = officialFinalScore;
    const target = toNumber(row.targetRuns ?? row.target_runs, active.innings === 2 ? toNumber(inningsRowFor(innings, 1).runs ?? inningsRowFor(innings, 1).totalRuns ?? inningsRowFor(innings, 1).total_runs) + 1 : 0);
    const maximumBalls = toNumber(row.maximumBalls ?? row.maximum_balls, 120);
    partnerships.push({
      innings: active.innings,
      batterIds: active.batterIds,
      batterNames: active.batterIds.map((id) => playersById.get(id) || `Player ${id}`),
      startScore: active.startScore,
      startWickets: active.startWickets,
      startLegalBalls: active.startLegalBalls,
      endScore: active.endScore,
      endWickets: active.endWickets,
      endLegalBalls: active.startLegalBalls + active.legalBalls,
      runs: active.endScore - active.startScore,
      legalBalls: active.legalBalls,
      entryRequiredRate: active.innings === 2 && target > 0
        ? requiredRate(target, active.startScore, active.startLegalBalls, maximumBalls)
        : null,
      exitRequiredRate: active.innings === 2 && target > 0
        ? requiredRate(target, active.endScore, active.startLegalBalls + active.legalBalls, maximumBalls)
        : null,
      complete,
    });
    active = null;
  }

  for (const event of events) {
    const inningsNumber = getEventInnings(event);
    const state = stateFor(inningsNumber);
    const pair = pairForEvent(event);
    if (active && (active.innings !== inningsNumber || (pair.length === 2 && !samePair(active.batterIds, pair)))) {
      closeActive(true, active.innings !== inningsNumber);
    }
    if (!active && pair.length === 2) {
      active = {
        innings: inningsNumber,
        batterIds: pair,
        startScore: state.score,
        startWickets: state.wickets,
        startLegalBalls: state.legalBalls,
        endScore: state.score,
        endWickets: state.wickets,
        legalBalls: 0,
      };
    }

    const runs = eventRuns(event);
    state.score = Number.isFinite(Number(event?.scoreAfterRuns ?? event?.score_after_runs))
      ? toNumber(event?.scoreAfterRuns ?? event?.score_after_runs)
      : state.score + runs;
    if (isLegal(event)) state.legalBalls += 1;
    state.wickets = Number.isFinite(Number(event?.wicketsAfter ?? event?.wickets_after))
      ? toNumber(event?.wicketsAfter ?? event?.wickets_after)
      : state.wickets + (eventWicket(event) ? 1 : 0);

    if (active) {
      active.endScore = state.score;
      active.endWickets = state.wickets;
      if (isLegal(event)) active.legalBalls += 1;
    }
    if (active && eventWicket(event)) closeActive(true);
  }
  // An unbeaten stand at the end of a completed innings is still a complete
  // analytical passage and can be the match-winning partnership.
  closeActive(true, true);
  return partnerships;
}

function partnershipCandidate(partnership, innings) {
  if (!partnership?.complete || partnership.legalBalls <= 0) return null;
  if (
    partnership.runs < RECOVERY_THRESHOLDS.minimumPartnershipRuns
    && partnership.legalBalls < RECOVERY_THRESHOLDS.minimumPartnershipBalls
  ) return null;
  const inningsRow = inningsRowFor(innings, partnership.innings);
  const target = toNumber(inningsRow.targetRuns ?? inningsRow.target_runs);
  const inningsRuns = toNumber(inningsRow.runs ?? inningsRow.totalRuns ?? inningsRow.total_runs, target);
  const partnershipRunRate = (partnership.runs * 6) / partnership.legalBalls;
  const names = partnership.batterNames.join(" and ");
  const evidenceLabel = `${partnership.runs}-run ${partnership.batterNames.join("–")} partnership`;
  let type = "target_setting_platform";
  let requiredRateRelief = 0;
  let phaseLeverage = clamp(partnership.startLegalBalls / 120);

  if (partnership.innings === 2) {
    const chaseSucceeded = target > 0 && inningsRuns >= target;
    const rateDelta = toNumber(partnership.entryRequiredRate) - toNumber(partnership.exitRequiredRate);
    requiredRateRelief = clamp(rateDelta / Math.max(toNumber(partnership.entryRequiredRate), 1));
    if (!chaseSucceeded && toNumber(partnership.exitRequiredRate) > toNumber(partnership.entryRequiredRate)) {
      type = "chase_pressure_partnership";
    } else if (partnership.startWickets >= RECOVERY_THRESHOLDS.earlyWickets || toNumber(partnership.entryRequiredRate) >= 8.5) {
      type = "chase_recovery_partnership";
    } else {
      type = "front_running_chase";
    }
  } else if (partnership.startLegalBalls >= 90) {
    type = "death_over_surge";
    phaseLeverage = 1;
  }

  const baselineRate = inningsRow.legalBalls
    ? (inningsRuns * 6) / toNumber(inningsRow.legalBalls)
    : 6;
  const components = {
    requiredRateRelief,
    runRateSwing: clamp((partnershipRunRate - baselineRate + 3) / 9),
    wicketPreservation: clamp(1 - ((partnership.endWickets - partnership.startWickets) / 3)),
    inningsShare: clamp(partnership.runs / Math.max(target || inningsRuns, 1)),
    phaseLeverage,
  };
  const impactScore = round(
    components.requiredRateRelief * 0.30
    + components.runRateSwing * 0.20
    + components.wicketPreservation * 0.20
    + components.inningsShare * 0.15
    + components.phaseLeverage * 0.15,
    4
  );

  return {
    type,
    innings: partnership.innings,
    startBall: partnership.startLegalBalls,
    endBall: partnership.endLegalBalls,
    evidenceLabel,
    statementFacts: {
      batterNames: partnership.batterNames,
      names,
      runs: partnership.runs,
      legalBalls: partnership.legalBalls,
      startScore: partnership.startScore,
      startWickets: partnership.startWickets,
      endScore: partnership.endScore,
      endWickets: partnership.endWickets,
      entryRequiredRate: partnership.entryRequiredRate,
      exitRequiredRate: partnership.exitRequiredRate,
    },
    evidenceRefs: [`partnership:${partnership.innings}:${partnership.startLegalBalls}-${partnership.endLegalBalls}`],
    confidence: "high",
    components,
    impactScore,
  };
}

function phaseCandidate(row) {
  if (!row || row.legalBalls <= 0) return null;
  let type = null;
  if (row.wickets >= 5) type = "collapse";
  else if (row.innings === 2 && row.phase === "middle" && row.wickets >= 3 && row.runRate < 6) type = "middle_overs_squeeze";
  if (!type) return null;
  const components = {
    wicketCluster: clamp(row.wickets / 5),
    scoringSuppression: clamp((8 - toNumber(row.runRate)) / 8),
    phaseLeverage: row.phase === "death" ? 1 : row.phase === "middle" ? 0.65 : 0.4,
  };
  const impactScore = round(
    components.wicketCluster * 0.5
    + components.scoringSuppression * 0.3
    + components.phaseLeverage * 0.2,
    4
  );
  return {
    type,
    innings: row.innings,
    startBall: row.phase === "powerplay" ? 0 : row.phase === "middle" ? 36 : 90,
    endBall: row.phase === "powerplay" ? 36 : row.phase === "middle" ? 90 : 120,
    evidenceLabel: `${row.wickets}-wicket ${row.phase} passage`,
    statementFacts: { phase: row.phase, runs: row.runs, wickets: row.wickets, runRate: row.runRate },
    evidenceRefs: [`phase:${row.innings}:${row.phase}`],
    confidence: "high",
    components,
    impactScore,
  };
}

function rankTurningPoints(input = {}) {
  const innings = Array.isArray(input.innings) ? input.innings : [];
  return [
    ...(Array.isArray(input.partnerships) ? input.partnerships : []).map((row) => partnershipCandidate(row, innings)),
    ...(Array.isArray(input.phaseMetrics) ? input.phaseMetrics : []).map(phaseCandidate),
  ]
    .filter(Boolean)
    .sort((left, right) => right.impactScore - left.impactScore || left.innings - right.innings || left.startBall - right.startBall);
}

function buildT20MatchIntelligence(input = {}) {
  const innings = Array.isArray(input.innings) ? input.innings : [];
  const ballEvents = Array.isArray(input.ballEvents) ? input.ballEvents : [];
  const partnerships = buildPartnerships(innings, ballEvents, input.playersById || new Map());
  const phaseMetrics = buildPhaseMetrics(ballEvents);
  return {
    phaseMetrics,
    partnerships,
    criticalMoments: [],
    turningPointCandidates: rankTurningPoints({ innings, partnerships, phaseMetrics }),
    dataQuality: {
      inningsAvailable: innings.length > 0,
      ballEventsAvailable: ballEvents.length > 0,
      partnershipIdentitiesAvailable: partnerships.some((row) => row.batterIds.length === 2),
    },
  };
}

module.exports = {
  RECOVERY_THRESHOLDS,
  T20_PHASES,
  buildPartnerships,
  buildPhaseMetrics,
  buildT20MatchIntelligence,
  normalizePersistedBallEvents,
  rankTurningPoints,
  sortBallEvents,
};

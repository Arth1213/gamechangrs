"use strict";

const crypto = require("node:crypto");
const { buildT20MatchIntelligence } = require("./t20MatchIntelligence");

const ANALYSIS_MODEL_VERSION = "t20-context-v4";

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")} ]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function calculateEvidenceChecksum(input) {
  return crypto.createHash("sha256").update(stableJson(input)).digest("hex");
}

function buildInningsEvidence(innings, ballEvents) {
  return innings.map((row, index) => {
    const inningNumber = index + 1;
    const events = ballEvents.filter((event) => toNumber(event.innings) === inningNumber && event.legal !== false);
    const legalBalls = toNumber(row.legalBalls);
    const dots = events.filter((event) => toNumber(event.runs) === 0).length;
    const boundaries = events.filter((event) => event.boundary === true).length;
    return {
      innings: inningNumber,
      battingTeam: String(row.battingTeam || ""),
      runs: toNumber(row.runs),
      wickets: toNumber(row.wickets),
      legalBalls,
      runRate: legalBalls ? round((toNumber(row.runs) * 6) / legalBalls) : null,
      dotBallRate: events.length ? round((dots * 100) / events.length) : null,
      boundaryRate: events.length ? round((boundaries * 100) / events.length) : null,
    };
  });
}

function buildMomentum(ballEvents) {
  return ballEvents
    .filter((event) => event.legal !== false)
    .map((event) => {
      const runs = toNumber(event.runs);
      const wicket = event.wicket === true;
      return {
        innings: toNumber(event.innings),
        over: toNumber(event.over),
        event: wicket ? "wicket" : event.boundary === true ? "boundary" : "scoring",
        runs,
        wicket,
        impactScore: wicket ? 12 : runs >= 6 ? 8 : runs >= 4 ? 6 : runs,
      };
    })
    .filter((event) => event.impactScore > 0)
    .sort((left, right) => right.impactScore - left.impactScore || left.innings - right.innings || left.over - right.over)
    .slice(0, 5);
}

function buildGrizzliesMatchEvidence(input) {
  const match = input?.match || {};
  const innings = Array.isArray(input?.innings) ? input.innings : [];
  const ballEvents = Array.isArray(input?.ballEvents) ? input.ballEvents : [];
  const missing = [];
  if (!innings.length) missing.push("innings");
  if (!ballEvents.length) missing.push("ball_events");
  const teams = Array.isArray(match.teams) ? match.teams.map(String) : [];
  const grizzliesTeamName = String(input?.grizzliesTeamName || "San Ramon Grizzlies");
  const intelligence = buildT20MatchIntelligence({
    innings,
    ballEvents,
    playersById: input?.playersById instanceof Map ? input.playersById : new Map(),
  });
  return {
    complete: missing.length === 0,
    missing,
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    match: {
      id: match.id ?? null,
      sourceMatchId: match.sourceMatchId || null,
      resultText: match.resultText || null,
    },
    teams,
    grizzliesParticipated: teams.includes(grizzliesTeamName),
    innings: buildInningsEvidence(innings, ballEvents),
    momentum: buildMomentum(ballEvents),
    phaseMetrics: intelligence.phaseMetrics,
    partnerships: intelligence.partnerships,
    criticalMoments: intelligence.criticalMoments.length ? intelligence.criticalMoments : buildMomentum(ballEvents),
    turningPointCandidates: intelligence.turningPointCandidates,
    dataQuality: intelligence.dataQuality,
    checksum: calculateEvidenceChecksum({ match, innings, ballEvents }),
  };
}

function buildTurningPointStatement(candidate) {
  const facts = candidate?.statementFacts || {};
  if (Array.isArray(facts.batterNames) && facts.batterNames.length === 2) {
    const pressure = facts.entryRequiredRate != null && facts.exitRequiredRate != null
      && Number.isFinite(Number(facts.entryRequiredRate)) && Number.isFinite(Number(facts.exitRequiredRate))
      ? Number(facts.exitRequiredRate) === 0
        ? `, taking control from a required rate of ${Number(facts.entryRequiredRate).toFixed(2)} and completing the chase`
        : `, moving the required rate from ${Number(facts.entryRequiredRate).toFixed(2)} to ${Number(facts.exitRequiredRate).toFixed(2)}`
      : "";
    return `${facts.batterNames[0]} and ${facts.batterNames[1]} added ${facts.runs} from ${facts.legalBalls} balls${pressure}.`;
  }
  if (facts.phase) {
    return `The ${facts.phase} phase produced ${facts.runs} runs and ${facts.wickets} wickets at ${Number(facts.runRate).toFixed(2)} runs per over.`;
  }
  return "Verified match-state evidence identified the decisive passage.";
}

function inningsNumber(row) {
  return toNumber(row?.innings ?? row?.inningsNo ?? row?.innings_no);
}

function topBattingPerformance(rows, inningsNo) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => inningsNumber(row) === inningsNo && Number.isFinite(Number(row?.runs)))
    .sort((left, right) => toNumber(right.runs) - toNumber(left.runs) || toNumber(right.strike_rate) - toNumber(left.strike_rate))[0] || null;
}

function topBowlingPerformance(rows, inningsNo) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => inningsNumber(row) === inningsNo && Number.isFinite(Number(row?.wickets)))
    .sort((left, right) => toNumber(right.wickets) - toNumber(left.wickets) || toNumber(left.economy) - toNumber(right.economy))[0] || null;
}

function performanceSentence(team, inningsNo, batting, bowling) {
  const batter = topBattingPerformance(batting, inningsNo);
  const bowler = topBowlingPerformance(bowling, inningsNo);
  const parts = [];
  if (batter) {
    const name = String(batter.player_name ?? batter.playerName ?? "Top batter");
    const balls = toNumber(batter.balls_faced ?? batter.ballsFaced);
    parts.push(`${name} led ${team} with ${toNumber(batter.runs)}${balls ? ` off ${balls}` : ""}`);
  }
  if (bowler && toNumber(bowler.wickets) > 0) {
    const name = String(bowler.player_name ?? bowler.playerName ?? "The leading bowler");
    parts.push(`${name} returned ${toNumber(bowler.wickets)}/${toNumber(bowler.runs_conceded ?? bowler.runsConceded)}`);
  }
  return parts.length ? `${parts.join(", while ")}.` : "";
}

function formatOvers(legalBalls) {
  const balls = toNumber(legalBalls);
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function topPerformanceSummary(row, kind) {
  if (!row) return null;
  const playerName = String(row.player_name ?? row.playerName ?? "").trim();
  if (!playerName) return null;
  if (kind === "batting") {
    const balls = toNumber(row.balls_faced ?? row.ballsFaced);
    return `${playerName}'s ${toNumber(row.runs)}${balls ? ` off ${balls}` : ""}`;
  }
  return `${playerName}'s ${toNumber(row.wickets)}/${toNumber(row.runs_conceded ?? row.runsConceded)}`;
}

function findWinner(teams, resultText) {
  const normalizedResult = String(resultText || "").toLowerCase();
  return teams.find((team) => normalizedResult.includes(String(team).toLowerCase()) && /\bwon\b/i.test(resultText || "")) || null;
}

function turningPointForTeam(turningPoint, teamInnings) {
  return turningPoint && toNumber(turningPoint.innings) === toNumber(teamInnings) ? turningPoint : null;
}

function buildTeamNarratives(evidence, turningPoint, batting, bowling) {
  const innings = Array.isArray(evidence?.innings) ? evidence.innings : [];
  const teams = innings.map((row) => String(row.battingTeam || "")).filter(Boolean);
  const winner = findWinner(teams, evidence?.match?.resultText);

  return innings.map((teamInnings, index) => {
    const inningsNo = toNumber(teamInnings.innings, index + 1);
    const opponentInnings = innings.find((row) => toNumber(row.innings) !== inningsNo) || null;
    const opponent = String(opponentInnings?.battingTeam || "the opposition");
    const batter = topBattingPerformance(batting, inningsNo);
    const bowler = opponentInnings ? topBowlingPerformance(bowling, toNumber(opponentInnings.innings)) : null;
    const batterSummary = topPerformanceSummary(batter, "batting");
    const bowlerSummary = topPerformanceSummary(bowler, "bowling");
    const runRate = Number(teamInnings.runRate);
    const boundaryRate = Number(teamInnings.boundaryRate);
    const dotBallRate = Number(teamInnings.dotBallRate);
    const dotBalls = Number.isFinite(dotBallRate) ? Math.round((dotBallRate * toNumber(teamInnings.legalBalls)) / 100) : null;
    const teamTurningPoint = turningPointForTeam(turningPoint, inningsNo);
    const facts = teamTurningPoint?.statementFacts || {};
    const performanceClause = [batterSummary, bowlerSummary].filter(Boolean).join(" and ");
    const strength = `${teamInnings.battingTeam} produced ${teamInnings.runs}/${teamInnings.wickets} at ${Number.isFinite(runRate) ? runRate.toFixed(2) : "a verified"} runs per over${Number.isFinite(boundaryRate) ? ` with a ${boundaryRate.toFixed(2)}% boundary-ball rate` : ""}. ${performanceClause ? `${performanceClause} supplied the clearest individual impact.` : "The innings total provides the verified performance baseline."}${teamTurningPoint ? ` Their ${facts.runs}-run stand from ${facts.legalBalls} balls controlled the decisive pressure passage.` : ""}`;

    let weakness;
    if (teamInnings.battingTeam !== winner && inningsNo === 1 && opponentInnings) {
      weakness = `${teamInnings.battingTeam} lost ${teamInnings.wickets} wickets while setting ${teamInnings.runs} and then could not defend the total, allowing ${opponent} to reach ${opponentInnings.runs}/${opponentInnings.wickets} in ${formatOvers(opponentInnings.legalBalls)} overs. The main opening for Grizzlies is sustained wicket pressure followed by an attack on the closing overs.`;
    } else if (teamInnings.battingTeam !== winner) {
      weakness = `${teamInnings.battingTeam} lost ${teamInnings.wickets} wickets and finished at ${teamInnings.runs}/${teamInnings.wickets}${dotBalls != null ? ` after absorbing approximately ${dotBalls} dot balls` : ""}. Grizzlies can exploit that pressure by protecting boundary options, forcing rotation, and attacking new batters before they settle.`;
    } else if (teamTurningPoint && toNumber(facts.startWickets) >= 3 && toNumber(facts.startScore) <= toNumber(teamInnings.runs) * 0.35) {
      weakness = `${teamInnings.battingTeam} still exposed an early top-order risk by falling to ${facts.startScore}/${facts.startWickets} before the decisive partnership repaired the chase${dotBalls != null ? `, with approximately ${dotBalls} dot balls across the innings` : ""}. Grizzlies should attack that vulnerable entry point before the middle order can establish another recovery stand.`;
    } else if (teamTurningPoint) {
      weakness = `${teamInnings.battingTeam} left the chase under pressure at ${facts.startScore}/${facts.startWickets}, still requiring ${facts.runs} runs at ${Number(facts.entryRequiredRate).toFixed(2)} per over before the decisive stand. Grizzlies can exploit this by denying boundary access earlier and preserving their best matchup bowlers for the final four overs.`;
    } else {
      weakness = `${teamInnings.battingTeam} recorded ${dotBalls != null ? `approximately ${dotBalls} dot balls and ` : ""}${teamInnings.wickets} wickets lost despite the result. Grizzlies should use disciplined fields and pace changes to turn those stalled deliveries into clustered wicket opportunities.`;
    }

    const keyThreats = [batterSummary, bowlerSummary].filter(Boolean).join(" plus ");
    const watchOut = `Against ${teamInnings.battingTeam}, Grizzlies must account for ${keyThreats || "the verified scoring and wicket-taking core"}. Their evidence shows they can ${teamTurningPoint ? "recover or finish a chase through a sustained partnership" : `score at ${Number.isFinite(runRate) ? runRate.toFixed(2) : "competitive"} runs per over`}, so passive middle-overs cricket will allow their main threats to dictate the game.`;
    const gamePlan = `The Grizzlies plan against ${teamInnings.battingTeam} should target the demonstrated opening: ${weakness.replace(`${teamInnings.battingTeam} `, "they ")} Set attacking fields for new batters, control their preferred boundary zones, and reserve matchup bowling for the players who produced the verified top performances.`;

    return {
      team: teamInnings.battingTeam,
      strength: { team: teamInnings.battingTeam, statement: strength, confidence: "high" },
      weakness: { team: teamInnings.battingTeam, statement: weakness, confidence: "high" },
      watchOut: { team: teamInnings.battingTeam, statement: watchOut, confidence: "high" },
      gamePlan: { team: teamInnings.battingTeam, statement: gamePlan, confidence: "high" },
    };
  });
}

function buildCriticalMomentNarrative(evidence, turningPoint, batting) {
  const innings = Array.isArray(evidence?.innings) ? evidence.innings : [];
  const moments = Array.isArray(evidence?.criticalMoments) ? evidence.criticalMoments : [];
  const wicketClusters = new Map();
  for (const moment of moments.filter((item) => item?.event === "wicket")) {
    const key = `${toNumber(moment.innings)}:${toNumber(moment.over)}`;
    wicketClusters.set(key, (wicketClusters.get(key) || 0) + 1);
  }
  const clusterDescriptions = [...wicketClusters.entries()]
    .filter(([, wickets]) => wickets > 1)
    .map(([key, wickets]) => {
      const [inningsNo, over] = key.split(":").map(Number);
      const team = innings.find((row) => toNumber(row.innings) === inningsNo)?.battingTeam || `innings ${inningsNo}`;
      const teamPossessive = /s$/i.test(team) ? `${team}'` : `${team}'s`;
      return `${wickets} wickets in over ${over} of ${teamPossessive} innings`;
    });
  const facts = turningPoint?.statementFacts || {};
  const chasePressure = Number(facts.exitRequiredRate) === 0
    ? `from a required rate of ${Number(facts.entryRequiredRate).toFixed(2)} through to a completed chase`
    : `while reducing the required rate from ${Number(facts.entryRequiredRate).toFixed(2)} to ${Number(facts.exitRequiredRate).toFixed(2)}`;
  const partnership = Array.isArray(facts.batterNames) && facts.batterNames.length === 2
    ? `${facts.batterNames[0]} and ${facts.batterNames[1]} then turned the decisive passage: from ${facts.startScore}/${facts.startWickets}, they scored ${facts.runs} runs from ${facts.legalBalls} balls${Number.isFinite(Number(facts.entryRequiredRate)) ? `, carrying the chase ${chasePressure}` : ""}.`
    : "";
  const firstTopBatter = topBattingPerformance(batting, 1);
  const recovery = firstTopBatter
    ? `${topPerformanceSummary(firstTopBatter, "batting")} was the main counterattack for the first-innings side.`
    : "";
  const pressure = clusterDescriptions.length
    ? `The match first shifted through ${clusterDescriptions.join(" and ")}, which repeatedly interrupted the innings.`
    : "The early wicket passages created the initial pressure in the match.";
  return `${pressure} ${recovery} ${partnership}`.replace(/\s+/g, " ").trim();
}

function buildMatchSummary(evidence, turningPoint, batting = [], bowling = []) {
  const innings = Array.isArray(evidence?.innings) ? evidence.innings : [];
  const resultText = String(evidence?.match?.resultText || "Verified result available").trim();
  if (innings.length < 2) return `${resultText}. Detailed innings context is incomplete.`;
  const first = innings[0];
  const second = innings[1];
  const firstTeam = String(first.battingTeam || "The first innings side");
  const secondTeam = String(second.battingTeam || "The chasing side");
  const base = `${firstTeam} set ${first.runs}/${first.wickets}, and ${secondTeam} replied with ${second.runs}/${second.wickets}.`;
  const performances = [
    performanceSentence(firstTeam, 1, batting, bowling),
    performanceSentence(secondTeam, 2, batting, bowling),
  ].filter(Boolean).join(" ");
  if (!turningPoint) return `${resultText}. ${base}`;
  const facts = turningPoint.statementFacts || {};
  if (Array.isArray(facts.batterNames) && facts.batterNames.length === 2) {
    const entryPressure = facts.entryRequiredRate != null && Number.isFinite(Number(facts.entryRequiredRate))
      ? ` with the required rate at ${Number(facts.entryRequiredRate).toFixed(2)}`
      : "";
    const exitRate = Number(facts.exitRequiredRate);
    const exitState = facts.exitRequiredRate != null && Number.isFinite(exitRate)
      ? exitRate === 0
        ? " and completed the chase"
        : ` and reduced it to ${exitRate.toFixed(2)}`
      : "";
    return `${base}${performances ? ` ${performances}` : ""} The ${turningPoint.evidenceLabel} began at ${facts.startScore}/${facts.startWickets}${entryPressure}${exitState}, making it the decisive sustained passage. ${resultText}.`;
  }
  return `${base} The ${turningPoint.evidenceLabel} was the highest-impact sustained passage. ${resultText}.`;
}

function buildGrizzliesMatchAnalysis(input) {
  const evidence = input?.evidence;
  if (!evidence?.complete) throw new Error("A complete evidence bundle is required before analysis generation.");
  const turningPoint = Array.isArray(evidence.turningPointCandidates) ? evidence.turningPointCandidates[0] : null;
  const turningPoints = turningPoint
    ? [{ ...turningPoint, statement: buildTurningPointStatement(turningPoint) }]
    : [];
  const teamNarratives = buildTeamNarratives(evidence, turningPoint, input?.batting, input?.bowling);
  const opponentNarratives = evidence.grizzliesParticipated
    ? teamNarratives.filter((item) => !/san ramon grizzlies/i.test(item.team))
    : teamNarratives;
  return {
    schemaVersion: "grizzlies-match-analysis-v4",
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    grizzliesParticipated: evidence.grizzliesParticipated,
    strengths: teamNarratives.map((item) => item.strength),
    weaknesses: teamNarratives.map((item) => item.weakness),
    criticalMoments: evidence.criticalMoments || evidence.momentum || [],
    criticalMomentNarrative: buildCriticalMomentNarrative(evidence, turningPoint, input?.batting),
    turningPoints,
    grizzliesWatchOut: opponentNarratives.map((item) => item.watchOut),
    grizzliesGamePlan: opponentNarratives.map((item) => item.gamePlan),
    evidenceNotes: evidence.dataQuality?.partnershipIdentitiesAvailable
      ? []
      : ["Partnership identities were incomplete; the narrative uses verified innings or phase evidence only."],
    confidence: turningPoint?.confidence || "insufficient",
    matchSummary: buildMatchSummary(evidence, turningPoint, input?.batting, input?.bowling),
  };
}

module.exports = {
  ANALYSIS_MODEL_VERSION,
  buildGrizzliesMatchAnalysis,
  buildGrizzliesMatchEvidence,
  calculateEvidenceChecksum,
};

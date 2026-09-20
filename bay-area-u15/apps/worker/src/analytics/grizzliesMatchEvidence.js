"use strict";

const crypto = require("node:crypto");
const { buildT20MatchIntelligence } = require("./t20MatchIntelligence");

const ANALYSIS_MODEL_VERSION = "t20-context-v2";

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
    const pressure = Number.isFinite(Number(facts.entryRequiredRate)) && Number.isFinite(Number(facts.exitRequiredRate))
      ? `, moving the required rate from ${Number(facts.entryRequiredRate).toFixed(2)} to ${Number(facts.exitRequiredRate).toFixed(2)}`
      : "";
    return `${facts.batterNames[0]} and ${facts.batterNames[1]} added ${facts.runs} from ${facts.legalBalls} balls${pressure}.`;
  }
  if (facts.phase) {
    return `The ${facts.phase} phase produced ${facts.runs} runs and ${facts.wickets} wickets at ${Number(facts.runRate).toFixed(2)} runs per over.`;
  }
  return "Verified match-state evidence identified the decisive passage.";
}

function buildMatchSummary(evidence, turningPoint) {
  const innings = Array.isArray(evidence?.innings) ? evidence.innings : [];
  const resultText = String(evidence?.match?.resultText || "Verified result available").trim();
  if (innings.length < 2) return `${resultText}. Detailed innings context is incomplete.`;
  const first = innings[0];
  const second = innings[1];
  const firstTeam = String(first.battingTeam || "The first innings side");
  const secondTeam = String(second.battingTeam || "The chasing side");
  const base = `${firstTeam} set ${first.runs}/${first.wickets}, and ${secondTeam} replied with ${second.runs}/${second.wickets}.`;
  if (!turningPoint) return `${resultText}. ${base}`;
  const facts = turningPoint.statementFacts || {};
  if (Array.isArray(facts.batterNames) && facts.batterNames.length === 2) {
    const entryPressure = Number.isFinite(Number(facts.entryRequiredRate))
      ? ` with the required rate at ${Number(facts.entryRequiredRate).toFixed(2)}`
      : "";
    const exitState = Number.isFinite(Number(facts.exitRequiredRate))
      ? ` and left it at ${Number(facts.exitRequiredRate).toFixed(2)}`
      : "";
    return `${base} The ${turningPoint.evidenceLabel} began at ${facts.startScore}/${facts.startWickets}${entryPressure}${exitState}, making it the decisive sustained passage. ${resultText}.`;
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
  return {
    schemaVersion: "grizzlies-match-analysis-v2",
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    grizzliesParticipated: evidence.grizzliesParticipated,
    strengths: [],
    weaknesses: [],
    criticalMoments: evidence.criticalMoments || evidence.momentum || [],
    turningPoints,
    grizzliesWatchOut: [],
    grizzliesGamePlan: [],
    evidenceNotes: evidence.dataQuality?.partnershipIdentitiesAvailable
      ? []
      : ["Partnership identities were incomplete; the narrative uses verified innings or phase evidence only."],
    confidence: turningPoint?.confidence || "insufficient",
    matchSummary: buildMatchSummary(evidence, turningPoint),
  };
}

module.exports = {
  ANALYSIS_MODEL_VERSION,
  buildGrizzliesMatchAnalysis,
  buildGrizzliesMatchEvidence,
  calculateEvidenceChecksum,
};

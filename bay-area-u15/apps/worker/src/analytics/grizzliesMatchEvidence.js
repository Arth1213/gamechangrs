"use strict";

const crypto = require("node:crypto");

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
  return {
    complete: missing.length === 0,
    missing,
    match: {
      id: match.id ?? null,
      sourceMatchId: match.sourceMatchId || null,
      resultText: match.resultText || null,
    },
    teams,
    grizzliesParticipated: teams.includes(grizzliesTeamName),
    innings: buildInningsEvidence(innings, ballEvents),
    momentum: buildMomentum(ballEvents),
    checksum: calculateEvidenceChecksum({ match, innings, ballEvents }),
  };
}

function buildGrizzliesMatchAnalysis(input) {
  const evidence = input?.evidence;
  if (!evidence?.complete) throw new Error("A complete evidence bundle is required before analysis generation.");
  return {
    schemaVersion: "grizzlies-match-analysis-v1",
    grizzliesParticipated: evidence.grizzliesParticipated,
    strengths: [],
    weaknesses: [],
    criticalMoments: evidence.momentum,
    turningPoints: [],
    grizzliesWatchOut: [],
    grizzliesGamePlan: [],
    evidenceNotes: [],
    confidence: "insufficient",
  };
}

module.exports = {
  buildGrizzliesMatchAnalysis,
  buildGrizzliesMatchEvidence,
  calculateEvidenceChecksum,
};

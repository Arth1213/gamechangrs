const CURRENT = {
  srg: { forRuns: 433, forOvers: 56.667, againstRuns: 416, againstOvers: 60.0 },
  svs: { forRuns: 441, forOvers: 58.167, againstRuns: 443, againstOvers: 58.667 },
};

const MATCH_OVERS = 20;

function assertScore(score, label) {
  if (!Number.isInteger(score) || score < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
}

function ballsToCricketOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function nrr({ forRuns, forOvers, againstRuns, againstOvers }) {
  return forRuns / forOvers - againstRuns / againstOvers;
}

export function srgBatsFirst(grizzliesScore, totals = CURRENT) {
  assertScore(grizzliesScore, "Grizzlies score");

  const { srg, svs } = totals;
  const siliconValleyTarget = grizzliesScore + 1;
  const p =
    (srg.forRuns + grizzliesScore) / (srg.forOvers + MATCH_OVERS) +
    (svs.againstRuns + grizzliesScore) / (svs.againstOvers + MATCH_OVERS);
  const q = srg.againstRuns + siliconValleyTarget;
  const r = svs.forRuns + siliconValleyTarget;
  const a = p;
  const b = p * (srg.againstOvers + svs.forOvers) - q - r;
  const c =
    p * srg.againstOvers * svs.forOvers -
    q * svs.forOvers -
    r * srg.againstOvers;
  const boundaryOvers = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  const minimumSiliconValleyBalls = Math.floor(boundaryOvers * 6 + 1e-8) + 1;
  const projectedGrizzliesNRR = nrr({
    forRuns: srg.forRuns + grizzliesScore,
    forOvers: srg.forOvers + MATCH_OVERS,
    againstRuns: srg.againstRuns + siliconValleyTarget,
    againstOvers: srg.againstOvers + minimumSiliconValleyBalls / 6,
  });
  const projectedSiliconValleyNRR = nrr({
    forRuns: svs.forRuns + siliconValleyTarget,
    forOvers: svs.forOvers + minimumSiliconValleyBalls / 6,
    againstRuns: svs.againstRuns + grizzliesScore,
    againstOvers: svs.againstOvers + MATCH_OVERS,
  });

  return {
    scenario: "Grizzlies bat first",
    grizzliesScore,
    siliconValleyTarget,
    minimumSiliconValleyBalls,
    minimumSiliconValleyOvers: ballsToCricketOvers(minimumSiliconValleyBalls),
    boundaryOversDecimal: Number(boundaryOvers.toFixed(6)),
    projectedGrizzliesNRR: Number(projectedGrizzliesNRR.toFixed(3)),
    projectedSiliconValleyNRR: Number(projectedSiliconValleyNRR.toFixed(3)),
  };
}

export function svsBatsFirst(siliconValleyScore, totals = CURRENT) {
  assertScore(siliconValleyScore, "Silicon Valley score");

  const { srg, svs } = totals;
  const denominator =
    1 / (srg.forOvers + MATCH_OVERS) +
    1 / (svs.againstOvers + MATCH_OVERS);
  const scoreCoefficient =
    (1 / (srg.againstOvers + MATCH_OVERS) +
      1 / (svs.forOvers + MATCH_OVERS)) /
    denominator;
  const currentDifferenceAfterFixedOvers =
    srg.forRuns / (srg.forOvers + MATCH_OVERS) -
    srg.againstRuns / (srg.againstOvers + MATCH_OVERS) -
    (svs.forRuns / (svs.forOvers + MATCH_OVERS) -
      svs.againstRuns / (svs.againstOvers + MATCH_OVERS));
  const scoreBoundary =
    scoreCoefficient * siliconValleyScore -
    currentDifferenceAfterFixedOvers / denominator;
  const minimumGrizzliesScore = Math.max(0, Math.floor(scoreBoundary) + 1);

  if (minimumGrizzliesScore >= siliconValleyScore) {
    return {
      scenario: "Silicon Valley bats first",
      siliconValleyScore,
      possible: false,
      message: "Grizzlies cannot remain ahead on NRR while losing at this Silicon Valley score.",
    };
  }

  return {
    scenario: "Silicon Valley bats first",
    siliconValleyScore,
    minimumGrizzliesScore,
    maximumSiliconValleyWinningMargin: siliconValleyScore - minimumGrizzliesScore,
  };
}

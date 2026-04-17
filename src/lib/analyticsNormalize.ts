import type { CricClubsAnalyticsResponse } from "@/data/analyticsPlayers";

// Parse cricket overs notation: 202.4 means 202 overs and 4 balls (NOT decimal).
// Returns total balls bowled, or null if invalid.
export function parseOversToBalls(overs: string | number | null | undefined): number | null {
  if (overs === null || overs === undefined || overs === "") return null;
  const str = String(overs).trim();
  const match = str.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    const num = Number(str);
    if (!Number.isFinite(num)) return null;
    const whole = Math.trunc(num);
    const frac = Math.round((num - whole) * 10);
    if (frac > 5 || frac < 0) return null;
    return whole * 6 + frac;
  }
  const wholeOvers = Number(match[1]);
  const balls = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(wholeOvers) || !Number.isFinite(balls)) return null;
  if (balls > 5) return null; // invalid: a partial over has 0-5 balls
  return wholeOvers * 6 + balls;
}

function valuesAgree(values: number[], tolerance: number): boolean {
  if (values.length === 0) return false;
  if (values.length === 1) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min <= tolerance;
}

// Derive missing pathwayBatting.runs from balls*SR/100 and average*(innings-notOuts).
// Only return derived value if the available formulas agree within ~2 runs.
export function deriveBattingRuns(
  pb: NonNullable<CricClubsAnalyticsResponse["pathwayBatting"]>,
): number | null {
  if (pb.runs !== null && pb.runs !== undefined) return pb.runs;

  const candidates: number[] = [];

  if (pb.balls !== null && pb.balls !== undefined && pb.strikeRate !== null && pb.strikeRate !== undefined) {
    const v = (pb.balls * pb.strikeRate) / 100;
    if (Number.isFinite(v) && v >= 0) candidates.push(v);
  }

  if (
    pb.average !== null && pb.average !== undefined &&
    pb.innings !== null && pb.innings !== undefined
  ) {
    const notOuts = pb.notOuts ?? 0;
    const dismissals = pb.innings - notOuts;
    if (dismissals > 0) {
      const v = pb.average * dismissals;
      if (Number.isFinite(v) && v >= 0) candidates.push(v);
    }
  }

  if (candidates.length === 0) return null;
  if (!valuesAgree(candidates, 2)) return null;

  const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
  return Math.round(avg);
}

// Derive missing pathwayBowling.wickets from runs/average and ballsBowled/strikeRate.
// Only return derived value if formulas agree within ~2 wickets.
export function deriveBowlingWickets(
  pb: NonNullable<CricClubsAnalyticsResponse["pathwayBowling"]>,
): number | null {
  if (pb.wickets !== null && pb.wickets !== undefined) return pb.wickets;

  const candidates: number[] = [];

  if (
    pb.runs !== null && pb.runs !== undefined &&
    pb.average !== null && pb.average !== undefined && pb.average > 0
  ) {
    const v = pb.runs / pb.average;
    if (Number.isFinite(v) && v >= 0) candidates.push(v);
  }

  const totalBalls = parseOversToBalls(pb.overs);
  if (totalBalls !== null && pb.strikeRate !== null && pb.strikeRate !== undefined && pb.strikeRate > 0) {
    const v = totalBalls / pb.strikeRate;
    if (Number.isFinite(v) && v >= 0) candidates.push(v);
  }

  if (candidates.length === 0) return null;
  if (!valuesAgree(candidates, 2)) return null;

  const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
  return Math.round(avg);
}

// Normalize an analytics result so derived pathway runs/wickets propagate
// to careerTotals, stats, and matching formatSplits rows.
export function normalizeAnalyticsResult(
  data: CricClubsAnalyticsResponse,
): CricClubsAnalyticsResponse {
  const next: CricClubsAnalyticsResponse = {
    ...data,
    pathwayBatting: data.pathwayBatting ? { ...data.pathwayBatting } : data.pathwayBatting,
    pathwayBowling: data.pathwayBowling ? { ...data.pathwayBowling } : data.pathwayBowling,
    careerTotals: data.careerTotals ? { ...data.careerTotals } : data.careerTotals,
    stats: { ...data.stats },
    formatSplits: data.formatSplits ? data.formatSplits.map((row) => ({ ...row })) : data.formatSplits,
  };

  if (next.pathwayBatting) {
    const derivedRuns = deriveBattingRuns(next.pathwayBatting);
    if (derivedRuns !== null && (next.pathwayBatting.runs === null || next.pathwayBatting.runs === undefined)) {
      next.pathwayBatting.runs = derivedRuns;
    }
  }

  if (next.pathwayBowling) {
    const derivedWickets = deriveBowlingWickets(next.pathwayBowling);
    if (derivedWickets !== null && (next.pathwayBowling.wickets === null || next.pathwayBowling.wickets === undefined)) {
      next.pathwayBowling.wickets = derivedWickets;
    }
  }

  // Backfill careerTotals with the recovered pathway numbers if the totals are missing.
  if (next.careerTotals) {
    if ((next.careerTotals.runs === null || next.careerTotals.runs === undefined) && next.pathwayBatting?.runs != null) {
      next.careerTotals.runs = next.pathwayBatting.runs;
    }
    if ((next.careerTotals.wickets === null || next.careerTotals.wickets === undefined) && next.pathwayBowling?.wickets != null) {
      next.careerTotals.wickets = next.pathwayBowling.wickets;
    }
  } else if (next.pathwayBatting?.runs != null || next.pathwayBowling?.wickets != null) {
    next.careerTotals = {
      matches: next.stats?.matches ?? null,
      runs: next.pathwayBatting?.runs ?? null,
      wickets: next.pathwayBowling?.wickets ?? null,
    };
  }

  // Backfill stats.runs / stats.wickets if missing so summary cards render.
  if ((next.stats.runs === null || next.stats.runs === undefined) && next.pathwayBatting?.runs != null) {
    next.stats.runs = next.pathwayBatting.runs;
  }
  if ((next.stats.wickets === null || next.stats.wickets === undefined) && next.pathwayBowling?.wickets != null) {
    next.stats.wickets = next.pathwayBowling.wickets;
  }

  // Mirror into matching formatSplits rows.
  if (next.formatSplits && next.pathwayBatting?.runs != null) {
    for (const row of next.formatSplits) {
      if (row.format === next.pathwayBatting.seriesType && (row.runs === null || row.runs === undefined)) {
        row.runs = next.pathwayBatting.runs;
      }
    }
  }
  if (next.formatSplits && next.pathwayBowling?.wickets != null) {
    for (const row of next.formatSplits) {
      if (row.format === next.pathwayBowling.seriesType && (row.wickets === null || row.wickets === undefined)) {
        row.wickets = next.pathwayBowling.wickets;
      }
    }
  }

  return next;
}

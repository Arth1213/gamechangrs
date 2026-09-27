export type CoachDecision = {
  title: string; trigger: string; actions: string[]; evidence: string;
  confidence: string; sourceIds: string[];
};
export type GrizzliesCoachPlanData = {
  schemaVersion: 1; version: string; updatedThrough: string; opponent: string;
  headline: string; boundaryMatch: string; boundarySourceId: string;
  phases: Array<{name: string; overs: string; boundaries: number; legalBalls: number; cue: string}>;
  sections: Array<{title: string; cards: CoachDecision[]}>;
  sources: Array<{id: string; label: string; detail: string; url?: string}>;
  limitations: string[];
};
export function boundaryPercentage(boundaries: number, legalBalls: number): number | null;
export function isStrongPartnership(runs: number, legalBalls: number, benchmark: number): boolean;
export function coachPlanHref(matchId: number | string): string | null;
export function validateCoachPlan(plan: unknown): string[];
export function historicalMatchSummary(report: {analysisModelVersion: string; matchSummary: string; analysis?: {matchSummary?: string}}): string;

export function boundaryPercentage(boundaries, legalBalls) {
  if (!Number.isInteger(boundaries) || !Number.isInteger(legalBalls) || boundaries < 0 || legalBalls <= 0 || boundaries > legalBalls) return null;
  return Math.round(boundaries / legalBalls * 1000) / 10;
}

export function isStrongPartnership(runs, legalBalls, benchmark) {
  return Number.isFinite(runs) && Number.isFinite(legalBalls) && Number.isFinite(benchmark)
    && runs >= 0 && legalBalls > 30 && benchmark > 0 && runs * 6 / legalBalls >= benchmark;
}

export function coachPlanHref(matchId) {
  const id = Number(matchId);
  return Number.isSafeInteger(id) && id > 0 ? `/analytics/grizzlies/2026/matches/${id}?view=game-plan` : null;
}

export function historicalMatchSummary(report) {
  // This release copies the reviewed v3 narrative without changing match facts.
  // For every other model, leave the API's version-aware decision untouched.
  return report.analysisModelVersion === 'coach-plan-20260926-v1' && report.analysis?.matchSummary
    ? report.analysis.matchSummary : report.matchSummary;
}

// The same gate is used by the publisher and the browser. Invalid data is never
// presented as an approved plan. Advice is curated, not a predictive model output.
export function validateCoachPlan(plan) {
  const errors = [];
  const text = (value, max = 250) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!plan || typeof plan !== 'object') return ['Missing coaching plan'];
  if (plan.schemaVersion !== 1) errors.push('Unsupported schema');
  for (const key of ['version', 'opponent', 'headline', 'boundaryMatch']) if (!text(plan[key])) errors.push(`Missing ${key}`);
  if (typeof plan.updatedThrough !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.updatedThrough)) errors.push('Missing evidence date');
  if (/\u2014/.test(JSON.stringify(plan))) errors.push('Em dash is not allowed');
  const sources = Array.isArray(plan.sources) ? plan.sources : [];
  const sourceIds = new Set(sources.map(s => s?.id));
  if (!sources.length || sourceIds.size !== sources.length) errors.push('Missing or duplicate sources');
  for (const source of sources) {
    if (!text(source?.id) || !text(source?.label) || !text(source?.detail, 1000)) errors.push('Invalid source');
    if (source?.url !== undefined && (typeof source.url !== 'string' || !/^https:\/\//.test(source.url))) errors.push('Invalid source URL');
  }
  if (!sourceIds.has(plan.boundarySourceId)) errors.push('Missing boundary source');
  const phases = plan.phases;
  if (!Array.isArray(phases) || phases.length !== 3 || phases.map(p => typeof p?.overs === 'string' ? p.overs : '').join('|') !== '1-6|7-15|16-20') errors.push('Invalid phases');
  for (const phase of Array.isArray(phases) ? phases : []) {
    if (!text(phase?.name) || !text(phase?.cue) || boundaryPercentage(phase?.boundaries, phase?.legalBalls) === null) errors.push('Invalid phase counts');
  }
  if (!Array.isArray(plan.sections) || !plan.sections.length) errors.push('Missing decisions');
  for (const section of Array.isArray(plan.sections) ? plan.sections : []) {
    if (!text(section?.title) || !Array.isArray(section?.cards) || !section.cards.length) { errors.push('Invalid section'); continue; }
    for (const card of section.cards) {
      if (!text(card?.title) || !text(card?.trigger) || !text(card?.evidence, 600) || !text(card?.confidence)) errors.push('Invalid card');
      if (!Array.isArray(card?.actions) || card.actions.length < 1 || card.actions.length > 3 || card.actions.some(a => !text(a, 220))) errors.push('Invalid action bullets');
      if (!Array.isArray(card?.sourceIds) || !card.sourceIds.length || card.sourceIds.some(id => !sourceIds.has(id))) errors.push('Missing card source');
    }
  }
  if (!Array.isArray(plan.limitations) || !plan.limitations.length || plan.limitations.some(l => !text(l, 650))) errors.push('Missing limitations');
  return errors;
}

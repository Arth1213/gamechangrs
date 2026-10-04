'use strict';
const { buildMatchProfile, normalizeRunEvidence, classifyPartnership } = require('./t20TacticalIntelligence');
const FOCAL = 'San Ramon Grizzlies';
const PHASES = ['powerplay', 'middle', 'death'];
const clean = value => String(value).replace(/\([^)]*\)/g, '').trim();
const date = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const stats = () => ({ runs: 0, balls: 0, wickets: 0, dots: 0 });
function add(target, source) { for (const k of Object.keys(stats())) target[k] += Number(source[k] || 0); }

// Offline evidence collection only. Names do not establish identity across
// source accounts; duplicates are excluded, not silently pooled.
function collectTeam(profiles, team) {
  const bats = new Map(), bowls = new Map(), identities = new Map(), stands = [], matches = [];
  const remember = p => { const name = clean(p.name); if (!identities.has(name)) identities.set(name, new Set()); identities.get(name).add(p.id); };
  for (const m of profiles.filter(p => p.teams.includes(team))) {
    if (!m.innings.every(i => i.reconciled)) continue;
    matches.push(m.matchId);
    for (const inn of m.innings) {
      for (const b of inn.batters.filter(b => b.team === team && b.reconciled)) {
        remember(b); const name = clean(b.name);
        if (!bats.has(b.id)) bats.set(b.id, { id: b.id, name, runs: 0, balls: 0, innings: 0, earlyDismissals: 0, first6: { runs: 0, balls: 0 }, phases: {}, samples: [] });
        const s = bats.get(b.id); s.runs += b.scorecardRuns; s.balls += b.scorecardBalls; s.innings += 1;
        s.earlyDismissals += b.dismissed && b.scorecardBalls <= 6 ? 1 : 0;
        s.first6.runs += b.first6.runs; s.first6.balls += b.first6.balls;
        for (const phase of PHASES) if (b.phases[phase]) { s.phases[phase] ||= stats(); add(s.phases[phase], b.phases[phase]); }
        s.samples.push({ matchId: m.matchId, date: m.date, runs: b.scorecardRuns, balls: b.scorecardBalls, entryScore: b.entryScore, entryWickets: b.entryWickets, first6: b.first6, position: b.position });
      }
      for (const b of inn.bowlers.filter(b => b.team === team && b.reconciled && b.scorecardBalls > 0)) {
        remember(b); const name = clean(b.name);
        if (!bowls.has(b.id)) bowls.set(b.id, { id: b.id, name, ...stats(), spells: 0, wicketSpells: 0, phases: {}, matchIds: [] });
        const s = bowls.get(b.id); s.runs += b.scorecardRuns; s.balls += b.scorecardBalls; s.wickets += b.scorecardWickets; s.spells += 1; s.wicketSpells += Number(b.scorecardWickets > 0); s.matchIds.push(m.matchId);
        for (const phase of PHASES) if (b.phases[phase]) { s.phases[phase] ||= { ...stats(), matches: 0 }; add(s.phases[phase], b.phases[phase]); s.phases[phase].matches += 1; s.dots += b.phases[phase].dots || 0; }
      }
    }
    for (const p of m.partnerships || []) {
      const inn = m.innings.find(i => Number(i.innings) === Number(p.innings));
      if (inn?.battingTeam !== team || !p.batterIds.every(id => inn.batters.some(b => b.id === id && b.reconciled))) continue;
      stands.push({ ...p, ...classifyPartnership(p), matchId: m.matchId, date: m.date });
    }
  }
  const ambiguousNames = [...identities].filter(([, ids]) => ids.size > 1).map(([name]) => name);
  return { matches, ambiguousNames, batters: [...bats.values()].filter(p => !ambiguousNames.includes(p.name)).sort((a, b) => b.runs - a.runs), bowlers: [...bowls.values()].filter(p => !ambiguousNames.includes(p.name)).sort((a, b) => b.wickets - a.wickets), partnerships: stands.filter(p => p.batterNames.every(n => !ambiguousNames.includes(clean(n)))).sort((a, b) => b.runs - a.runs) };
}

function collectPlayoffEvidence(rows, { opponent, cutoff, seriesId = 16 }) {
  const exclusions = [], profiles = [], accepted = [];
  const selections = new Map();
  const unique = [...new Map(rows.map(r => [Number(r.match_id), r])).values()];
  for (const row of unique) {
    if (Number(row.series_id) !== seriesId || date(row.match_date).slice(0, 4) !== '2026' || date(row.match_date) > cutoff || ![row.home_team, row.away_team].some(t => [opponent, FOCAL].includes(t))) continue;
    // Selection evidence and phase eligibility are separate. Rain changes the
    // phase denominator, not who appeared on the latest parsed scorecard.
    if (row.match_status === 'completed' && row.parse_status === 'parsed') {
      for (const team of [opponent, FOCAL].filter(t => [row.home_team, row.away_team].includes(t))) {
        const innings = row.innings_json || [];
        const ownInnings = innings.filter(i => i.battingTeam === team).map(i => Number(i.innings));
        const otherInnings = innings.filter(i => i.battingTeam !== team).map(i => Number(i.innings));
        const members = [...(row.batting_json || []).filter(p => ownInnings.includes(Number(p.innings_no))), ...(row.bowling_json || []).filter(p => otherInnings.includes(Number(p.innings_no)))];
        const players = [...new Map(members.map(p => [Number(p.player_id), { id: Number(p.player_id), name: clean(p.player_name).replace(/^did not bat\s*/i, '') }])).values()].filter(p => p.id && p.name);
        const previous = selections.get(team);
        if (players.length && (!previous || date(row.match_date) > previous.date || date(row.match_date) === previous.date && Number(row.match_id) > previous.matchId)) selections.set(team, { matchId: Number(row.match_id), date: date(row.match_date), url: `https://cricclubs.com/MiLC/results/${encodeURIComponent(row.source_match_id)}`, players });
      }
    }
    let reason = row.match_status !== 'completed' || row.parse_status !== 'parsed' || row.analytics_status !== 'computed' ? 'not_ready' : /D\/?L|Duckworth|revised target/i.test(row.result_text || '') ? 'rain_adjusted' : null;
    const profile = buildMatchProfile(row);
    reason ||= profile.excludedReason || (!profile.innings.length || profile.innings.some(i => !i.reconciled) ? 'unreconciled_innings' : null);
    if (reason) { exclusions.push({ matchId: profile.matchId, reason }); continue; }
    profiles.push(profile); accepted.push(row);
  }
  const latest = [...profiles].filter(p => p.teams.includes(opponent)).sort((a, b) => b.date.localeCompare(a.date) || b.matchId - a.matchId)[0];
  let boundary = null;
  if (latest) {
    const row = accepted.find(r => Number(r.match_id) === latest.matchId);
    const inn = latest.innings.find(i => i.battingTeam === opponent);
    const events = row.ball_events_json.map(normalizeRunEvidence).filter(e => Number(e.innings) === Number(inn.innings));
    const zeroBased = events.some(e => Number(e.over) === 0);
    boundary = { matchId: latest.matchId, date: latest.date, opponent: latest.teams.find(t => t !== opponent), runs: inn.runs, wickets: inn.wickets,
      phases: PHASES.map((phase, index) => {
        const legal = events.filter(e => e.legal === true && (Number(e.over) + Number(zeroBased) <= 6 ? 0 : Number(e.over) + Number(zeroBased) <= 15 ? 1 : 2) === index);
        return { name: ['Powerplay', 'Middle', 'Death'][index], overs: ['1-6', '7-15', '16-20'][index], boundaries: legal.filter(e => [4, 6].includes(Number(e.batterRuns))).length, legalBalls: legal.length, dots: legal.filter(e => Number(e.runs) === 0).length };
      }) };
  }
  return { cutoff, opponentName: opponent, opponent: collectTeam(profiles, opponent), own: collectTeam(profiles, FOCAL), latestSelections: { opponent: selections.get(opponent) || null, own: selections.get(FOCAL) || null }, boundary, exclusions, sources: accepted.map(r => ({ id: Number(r.match_id), date: date(r.match_date), teams: [r.home_team, r.away_team], url: `https://cricclubs.com/MiLC/results/${encodeURIComponent(r.source_match_id)}` })) };
}
module.exports = { collectPlayoffEvidence };

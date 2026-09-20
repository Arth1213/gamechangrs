"use strict";

// Scouting recommendations are conditional coaching judgments. Never present
// cross-opponent phase evidence as an observed head-to-head matchup.
const VERSION = "t20-tactics-v1";
const { buildPartnerships, normalizePersistedBallEvents } = require("./t20MatchIntelligence");
const PHASES = ["powerplay", "middle", "death"];
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const round = (v) => Math.round(v * 100) / 100;
const rate = (runs, balls, scale = 6) => balls > 0 ? round(runs * scale / balls) : null;
const nameOf = (r) => String(r?.player_name ?? r?.playerName ?? "").replace(/^did not bat\s*/i, "").replace(/\([^)]*\)/g, "").replace(/\s+c&\s*$/i, "").trim();
const keyOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const innOf = (r) => n(r.innings ?? r.innings_no ?? r.inningsNo);
const playerOf = (r) => n(r.player_id ?? r.playerId);
const legal = (e) => e.legal === true;
const wide = (e) => /\bwide\b|\bwides\b/i.test(`${e.extraType || ""} ${e.commentaryText || ""}`);
const wicket = (e) => e.commentaryText ? /\bOUT!/i.test(e.commentaryText) : e.wicket === true;
const bowlerWicket = (e) => wicket(e) && !/run\s*out|retired|obstruct/i.test(`${e.dismissalType || ""} ${e.commentaryText || ""}`);
const charge = (e) => /^(leg[_ ]?byes?|byes?|penalty)$/i.test(String(e.extraType || "")) ? Math.max(0, n(e.runs) - n(e.extras)) : n(e.runs);
const phaseFor = (over) => over <= 6 ? "powerplay" : over <= 15 ? "middle" : "death";
const dateOf = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "").slice(0, 10);
const empty = () => ({ runs: 0, balls: 0, wickets: 0, dots: 0, boundaries: 0 });
const finish = (r) => ({ ...r, economy: rate(r.runs, r.balls), strikeRate: rate(r.runs, r.balls, 100) });

function normalizeRunEvidence(event) {
  const text = String(event.commentaryText || "");
  // Historical parser kept only the penalty on no-balls hit for runs. Repair
  // only when the source explicitly states the total, never from final scores.
  const total = text.match(/,\s*(\d+)\s+runs?\b/i);
  if (/\bNO\s*BALL\b/i.test(text) && total && !/BYE/i.test(text)) {
    const runs = Number(total[1]); const extras = Math.max(1, n(event.extras));
    return { ...event, runs, batterRuns: Math.max(0, runs - extras), extras, extraType: "no_ball", legal: false };
  }
  return event;
}

function aliases(rows) {
  const map = new Map();
  for (const r of rows) {
    const name = nameOf(r); const tokens = name.split(/\s+/);
    for (const alias of [name, `${tokens[0]?.[0]} ${tokens.slice(1).join(" ")}`, `${tokens[0]?.[0]} ${tokens.at(-1)}`]) {
      const key = keyOf(alias); const id = playerOf(r);
      if (!key || !id) continue;
      if (!map.has(key)) map.set(key, id);
      else if (map.get(key) !== id) map.set(key, null);
    }
  }
  return map;
}

function resolvePlayer(event, rows, map, kind) {
  const commentary = String(event.commentaryText || "");
  const observed = kind === "bowler" ? commentary.split(/\s+to\s+/i)[0]
    : (commentary.split(/\s+to\s+/i)[1] || "").split(/\s+OUT!|,|\s+(?:\d+\s+)?WIDES?|\s+NO\s*BALL/i)[0];
  const resolved = map.get(keyOf(observed));
  if (resolved) return resolved;
  // Ambiguous commentary aliases must not silently pick an arbitrary player.
  if (map.has(keyOf(observed)) && resolved === null) return null;
  const id = n(event[kind === "bowler" ? "bowlerPlayerId" : "strikerPlayerId"]);
  return rows.some((r) => playerOf(r) === id) ? id : null;
}

function buildMatchProfile(row) {
  const batting = row.batting_json || []; const bowling = row.bowling_json || [];
  const innings = row.innings_json || [];
  const events = [...(row.ball_events_json || [])].map(normalizeRunEvidence).sort((a, b) => innOf(a) - innOf(b) || n(a.eventIndex) - n(b.eventIndex));
  const result = { matchId: n(row.match_id), date: dateOf(row.match_date), result: row.result_text, teams: [row.home_team, row.away_team], innings: [] };
  const first = innings.find((i) => innOf(i) === 1);
  // Do not treat a reduced-overs powerplay as a standard six-over T20 phase.
  result.excludedReason = first && n(first.legalBalls) < 120 && n(first.wickets) < 10 ? "shortened_or_incomplete_first_innings" : null;
  for (const inningsRow of innings) {
    const inningsNo = innOf(inningsRow);
    const bats = batting.filter((r) => innOf(r) === inningsNo);
    const bowls = bowling.filter((r) => innOf(r) === inningsNo);
    const balls = events.filter((e) => innOf(e) === inningsNo);
    const battingAliases = aliases(bats); const bowlingAliases = aliases(bowls);
    const zeroBased = balls.some((e) => n(e.over) === 0);
    const batters = new Map(); const bowlers = new Map(); const overs = new Map(); const pairs = new Map();
    let score = 0; let wickets = 0; let legalBalls = 0; let unmapped = 0; const unmappedEvents = [];
    for (const e of balls) {
      const over = n(e.over) + (zeroBased ? 1 : 0); const phase = phaseFor(over);
      const batterId = resolvePlayer(e, bats, battingAliases, "batter");
      const bowlerId = resolvePlayer(e, bowls, bowlingAliases, "bowler");
      if (!batterId || !bowlerId) { unmapped += 1; unmappedEvents.push({ index: e.eventIndex, batterId, bowlerId, text: e.commentaryText }); }
      if (!overs.has(over)) overs.set(over, { ...empty(), over, phase, bowlerId, startScore: score, startWickets: wickets });
      const o = overs.get(over); o.runs += n(e.runs); o.balls += legal(e) ? 1 : 0; o.wickets += wicket(e) ? 1 : 0;
      if (legal(e) && n(e.runs) === 0) o.dots += 1;
      if ([4, 6].includes(n(e.batterRuns))) o.boundaries += 1;
      if (batterId) {
        if (!batters.has(batterId)) {
          const b = bats.find((r) => playerOf(r) === batterId);
          batters.set(batterId, { id: batterId, name: nameOf(b), team: inningsRow.battingTeam, position: n(b.batting_position), entryScore: score, entryWickets: wickets, entryOver: over, scorecardRuns: n(b.runs), scorecardBalls: n(b.balls_faced), dismissed: !b.is_not_out, deliveries: [], phases: {}, firstBoundaryBall: null });
        }
        const b = batters.get(batterId);
        if (!wide(e)) {
          b.deliveries.push({ runs: n(e.batterRuns), phase, bowlerId, wicket: wicket(e), over });
          if ([4, 6].includes(n(e.batterRuns)) && b.firstBoundaryBall === null) b.firstBoundaryBall = b.deliveries.length;
          if (!b.phases[phase]) b.phases[phase] = empty();
          b.phases[phase].runs += n(e.batterRuns); b.phases[phase].balls += 1;
        }
      }
      if (bowlerId) {
        if (!bowlers.has(bowlerId)) {
          const b = bowls.find((r) => playerOf(r) === bowlerId);
          bowlers.set(bowlerId, { id: bowlerId, name: nameOf(b), team: result.teams.find((t) => t !== inningsRow.battingTeam), scorecardRuns: n(b.runs_conceded), scorecardBalls: n(b.legal_balls), scorecardWickets: n(b.wickets), phases: {}, overs: [] });
        }
        const b = bowlers.get(bowlerId);
        if (!b.phases[phase]) b.phases[phase] = empty();
        const p = b.phases[phase]; p.runs += charge(e); p.balls += legal(e) ? 1 : 0; p.wickets += bowlerWicket(e) ? 1 : 0;
        p.dots += legal(e) && n(e.runs) === 0 ? 1 : 0;
        p.boundaries += [4, 6].includes(n(e.batterRuns)) ? 1 : 0;
      }
      if (batterId && bowlerId) {
        const key = `${batterId}:${bowlerId}`;
        if (!pairs.has(key)) pairs.set(key, { ...empty(), batterId, bowlerId });
        const p = pairs.get(key); p.runs += n(e.batterRuns); p.balls += wide(e) ? 0 : 1; p.wickets += bowlerWicket(e) ? 1 : 0;
      }
      score += n(e.runs); wickets += wicket(e) ? 1 : 0; legalBalls += legal(e) ? 1 : 0;
      o.endScore = score; o.endWickets = wickets;
    }
    const reconciled = score === n(inningsRow.runs) && wickets === n(inningsRow.wickets) && legalBalls === n(inningsRow.legalBalls) && unmapped === 0;
    const batterProfiles = [...batters.values()].map((b) => {
      const sum = (arr) => arr.reduce((a, e) => a + e.runs, 0);
      return { ...b, reconciled: b.deliveries.length === b.scorecardBalls && sum(b.deliveries) === b.scorecardRuns,
        first6: { runs: sum(b.deliveries.slice(0, 6)), balls: Math.min(b.deliveries.length, 6) },
        first12: { runs: sum(b.deliveries.slice(0, 12)), balls: Math.min(b.deliveries.length, 12) },
        phases: Object.fromEntries(Object.entries(b.phases).map(([k, v]) => [k, finish(v)])) };
    });
    const bowlerProfiles = [...bowlers.values()].map((b) => {
      const sums = Object.values(b.phases).reduce((a, p) => ({ runs: a.runs + p.runs, balls: a.balls + p.balls, wickets: a.wickets + p.wickets }), { runs: 0, balls: 0, wickets: 0 });
      return { ...b, reconciled: sums.runs === b.scorecardRuns && sums.balls === b.scorecardBalls && sums.wickets === b.scorecardWickets,
        phases: Object.fromEntries(Object.entries(b.phases).map(([k, v]) => [k, finish(v)])),
        overs: [...overs.values()].filter((o) => o.bowlerId === b.id).map(finish) };
    });
    result.innings.push({ ...inningsRow, reconciled, coverage: { eventRuns: score, eventWickets: wickets, eventLegalBalls: legalBalls, unmapped }, unmappedEvents, batters: batterProfiles, bowlers: bowlerProfiles, overs: [...overs.values()].map(finish), matchups: [...pairs.values()].map(finish) });
  }
  result.partnerships = buildPartnerships(innings, normalizePersistedBallEvents(events, batting), new Map(batting.map(b => [playerOf(b),nameOf(b)])));
  return result;
}

function classifyPartnership(p) {
  const runRate = rate(n(p.runs),n(p.legalBalls));
  const minimumRunRate = n(p.innings) === 2 && n(p.entryRequiredRate) > 0 ? n(p.entryRequiredRate) : 8;
  return { runRate, minimumRunRate, classification: n(p.legalBalls) <= 30 ? "short_impact" : runRate >= minimumRunRate ? "strong" : "recovery_below_rate" };
}

function partnershipPlans(profiles, reviewed, currentNames, focalTeam, direct) {
  const result = [];
  const opponentNames = new Set(reviewed.innings.filter(i => i.battingTeam !== focalTeam).flatMap(i => i.batters.map(b => keyOf(b.name))));
  for (const m of profiles) for (const p of m.partnerships) {
    const i = m.innings.find(i => innOf(i) === n(p.innings) && i.reconciled);
    if (!i || p.batterIds.some(id => !i.batters.some(b => b.id === id && b.reconciled))) continue;
    const own = i.battingTeam === focalTeam;
    if (!own && !reviewed.teams.includes(i.battingTeam)) continue;
    if (!p.batterNames.every(name => (own ? currentNames : opponentNames).has(keyOf(name)))) continue;
    const classification = classifyPartnership(p);
    if (classification.classification !== "strong" && !(m.matchId === reviewed.matchId && p.runs >= 35)) continue;
    const phase = phaseFor(Math.floor(p.startLegalBalls/6)+1);
    const options = bowlingChoices(profiles,focalTeam,phase,currentNames,i.battingTeam);
    const pairs = direct.filter(d => d.team === i.battingTeam && d.role === "bowl" && p.batterNames.some(name => keyOf(name) === keyOf(d.batter)) && options.some(o => o.name === d.bowler));
    const best = pairs.find(d => d.wickets > 0) || pairs[0];
    const bowler = options.find(o => o.name === best?.bowler) || options[0];
    const second = options.find(o => o !== bowler);
    const evidence = `${p.batterNames.join(" + ")}: ${p.runs} off ${p.legalBalls} legal balls (${classification.runRate} RPO), from ${p.startScore}/${p.startWickets} to ${p.endScore}/${p.endWickets}, ${m.date}.${p.entryRequiredRate !== null ? ` Required rate ${p.entryRequiredRate} → ${p.exitRequiredRate}.` : ""}`;
    result.push(claim(`${own ? "Build around" : "Break"}: ${p.batterNames.join(" + ")}`, evidence,
      own ? `Preserve this pairing when both are available and the chase context fits. This is observed partnership evidence, not proof the same pair suits every required rate. Review progress every over against the target; keep one batter attacking while the other rotates strike.`
        : `${bowler ? `Consider ${bowler.name} as the ${phase} change${second ? `, with ${second.name} as the alternative` : ""}.` : "No current-XI bowling recommendation is supported."}${best ? ` Direct sample: ${best.batter} ${best.runs} off ${best.balls} against ${best.bowler}, ${best.wickets} dismissal(s); small sample, not a guaranteed matchup.` : " This is phase-role transfer, not a measured head-to-head edge."} Do not wait for five overs to elapse before acting: reassess after two consecutive overs above the desired rate.`,
      [reference(m,i,`:stand:${p.startLegalBalls}-${p.endLegalBalls}`), ...(best?.evidenceRefs || [])],
      { team: i.battingTeam, role: own ? "build" : "break", matchId: m.matchId, date: m.date, batters: p.batterNames, runs: p.runs, balls: p.legalBalls, ...classification, player: bowler?.name }));
  }
  return result.sort((a,b) => Number(b.matchId === reviewed.matchId)-Number(a.matchId === reviewed.matchId) || b.runs-a.runs).slice(0,18);
}

function reference(match, innings, suffix = "") { return `match:${match.matchId}:innings:${innOf(innings)}${suffix}`; }
function claim(title, observation, action, refs, extra = {}) {
  return { title, observation, action, evidenceRefs: refs, confidence: "limited", basis: "Observed sample; tactical recommendation", ...extra };
}
function oversText(balls) { return `${Math.floor(balls / 6)}.${balls % 6}`; }
function spellText(b) { return `${b.name} ${b.scorecardWickets}/${b.scorecardRuns} from ${oversText(b.scorecardBalls)} overs`; }

function passageInsights(profile) {
  const findings = [];
  for (const inn of profile.innings.filter((i) => i.reconciled)) {
    const phaseTotals = PHASES.map((phase) => {
      const os = inn.overs.filter((o) => o.phase === phase);
      return finish(os.reduce((a, o) => ({ ...a, runs: a.runs + o.runs, balls: a.balls + o.balls, wickets: a.wickets + o.wickets }), { ...empty(), phase }));
    });
    for (let i = 1; i < phaseTotals.length; i += 1) {
      const before = phaseTotals[i - 1]; const after = phaseTotals[i];
      if (before.balls < 12 || after.balls < 12 || Math.abs(after.economy - before.economy) < 1.5) continue;
      const bowlers = inn.bowlers.filter((b) => b.reconciled && b.phases[after.phase]?.balls >= 6)
        .map((b) => `${b.name} ${b.phases[after.phase].wickets}/${b.phases[after.phase].runs} in ${oversText(b.phases[after.phase].balls)}`);
      const batters = inn.batters.filter((b) => b.reconciled && b.phases[after.phase]?.balls >= 6)
        .sort((a, b) => b.phases[after.phase].balls - a.phases[after.phase].balls).slice(0, 3)
        .map((b) => `${b.name} ${b.phases[after.phase].runs} off ${b.phases[after.phase].balls}`);
      findings.push(claim(`${inn.battingTeam}: ${before.phase} to ${after.phase}`,
        `Scoring ${after.economy < before.economy ? "fell" : "rose"} from ${before.economy} to ${after.economy} runs/over; ${after.wickets} wickets fell in the ${after.phase} phase. Batters: ${batters.join("; ")}. Bowling: ${bowlers.join("; ")}.`,
        "Use these named phase comparisons to choose the next bowling change. The change coincided with different batters and bowlers; this one game cannot isolate a causal bowling-style effect.", [reference(profile, inn, `:phase:${after.phase}`)]));
    }
    for (const b of inn.bowlers.filter((x) => x.reconciled)) {
      const os = b.overs.filter((o) => o.balls === 6);
      // Find an expensive later over only after an earlier completed over.
      const spike = os.find((o, idx) => idx > 0 && o.runs >= 12 && o.runs - os.slice(0, idx).reduce((a, v) => a + v.runs, 0) / idx >= 4);
      if (!spike) continue;
      const earlier = os.filter((o) => o.over < spike.over); const earlierRuns = earlier.reduce((a, o) => a + o.runs, 0);
      const attackers = inn.batters.filter((p) => p.reconciled).map((p) => ({ name: p.name, runs: p.deliveries.filter((d) => d.over === spike.over).reduce((a, d) => a + d.runs, 0) })).filter((p) => p.runs > 0);
      findings.push(claim(`${b.name}: pressure changed in over ${spike.over}`,
        `${earlierRuns} team runs in his previous ${earlier.length} completed over(s), then ${spike.runs} in over ${spike.over}; ${attackers.map((p) => `${p.name} contributed ${p.runs}`).join(", ")}.`,
        `If ${b.name} is bowling and this pattern returns, reassess after the over instead of extending the spell automatically. Batters should identify and attack the current option without assuming the expensive over proves a permanent weakness.`, [reference(profile, inn, `:over:${spike.over}`)]));
    }
  }
  return findings;
}

function teamBatters(profiles, team, eligibleNames) {
  const players = new Map();
  for (const m of profiles) for (const i of m.innings.filter((r) => r.reconciled)) {
    for (const b of i.batters.filter((r) => r.reconciled && eligibleNames.has(keyOf(r.name)))) {
      const key = keyOf(b.name); if (!players.has(key)) players.set(key, { name: b.name, samples: [] });
      players.get(key).samples.push({ ...b, ref: reference(m, i, `:batter:${b.id}`), matchId: m.matchId, date: m.date });
    }
  }
  return [...players.values()].map((p) => {
    const starts = p.samples.filter((s) => s.first6.balls === 6);
    const total = starts.reduce((a, s) => a + s.first6.runs, 0);
    const earlyDismissals = p.samples.filter((s) => s.dismissed && s.scorecardBalls <= 6).length;
    const startRuns = p.samples.reduce((a, s) => a + s.first6.runs, 0);
    const startBalls = p.samples.reduce((a, s) => a + s.first6.balls, 0);
    const runs = p.samples.map((s) => s.scorecardRuns).sort((a, b) => a - b);
    const middle = Math.floor(runs.length / 2);
    return { ...p, innings: p.samples.length, completeStarts: starts.length, first6Runs: starts.length ? round(total / starts.length) : null,
      earlyDismissals, first6StrikeRate: rate(startRuns, startBalls, 100), first6Balls: startBalls,
      survivedFirst6: p.samples.filter(s => s.scorecardBalls > 6).length,
      medianRuns: p.samples.length >= 3 ? (runs.length % 2 ? runs[middle] : (runs[middle - 1] + runs[middle]) / 2) : null,
      bySeason: Object.fromEntries([...new Set(p.samples.map(s => s.date.slice(0,4)))].map(year => {
        const ss = p.samples.filter(s => s.date.startsWith(year));
        const rs = ss.reduce((a,s) => a+s.scorecardRuns,0); const bs = ss.reduce((a,s) => a+s.scorecardBalls,0);
        return [year, { innings: ss.length, runs: rs, balls: bs, strikeRate: rate(rs,bs,100), earlyDismissals: ss.filter(s => s.dismissed && s.scorecardBalls <= 6).length }];
      })),
      consistency: p.samples.length >= 3 ? "descriptive sample only" : "insufficient innings" };
  });
}

function bowlingChoices(profiles, team, phase, eligibleNames, opponent) {
  const choices = new Map();
  for (const m of profiles) for (const i of m.innings.filter((r) => r.battingTeam !== team && r.reconciled)) {
    for (const b of i.bowlers.filter((r) => eligibleNames.has(keyOf(r.name)) && r.reconciled && r.phases[phase]?.balls >= 6)) {
      const key = keyOf(b.name); const p = b.phases[phase];
      if (!choices.has(key)) choices.set(key, { name: b.name, ...empty(), refs: [], matchIds: [], spells: [], direct: empty(), bySeason: {} });
      const c = choices.get(key); for (const k of ["runs", "balls", "wickets", "dots", "boundaries"]) c[k] += p[k];
      c.refs.push(reference(m, i, `:bowler:${b.id}:phase:${phase}`)); c.matchIds.push(m.matchId); c.spells.push(spellText(b));
      const year = m.date.slice(0,4); c.bySeason[year] ||= empty();
      for (const k of ["runs", "balls", "wickets", "dots", "boundaries"]) {
        c.bySeason[year][k] += p[k];
        if (i.battingTeam === opponent) c.direct[k] += p[k];
      }
    }
  }
  // Prefer wicket creation, then run control, within the SAME phase only.
  return [...choices.values()].filter(c => c.balls >= 12).map((c) => {
    // Shrink sparse phase evidence toward a neutral 1/32 from four overs.
    // Opponent samples add specificity, never a claimed causal advantage.
    const score = (c.wickets + 1) * 24 / (c.balls + 24) - (c.runs + 32) * 6 / (c.balls + 24) / 8;
    const direct = c.direct; const directScore = direct.balls >= 12
      ? (direct.wickets + c.wickets / c.balls * 24) * 24 / (direct.balls + 24) - (direct.runs + c.runs / c.balls * 24) * 6 / (direct.balls + 24) / 8 : score;
    return { ...finish(c), direct: finish(direct), bySeason: Object.fromEntries(Object.entries(c.bySeason).map(([y,v]) => [y,finish(v)])), matchCount: new Set(c.matchIds).size,
      score: round((score + directScore) / 2) };
  })
    .sort((a, b) => b.score - a.score || b.balls - a.balls || a.name.localeCompare(b.name));
}

function directPlayerMatchups(profiles, opponents, eligibleNames) {
  const results = new Map();
  for (const m of profiles) for (const i of m.innings.filter(i => i.reconciled)) {
    for (const p of i.matchups) {
      const batter = i.batters.find(b => b.id === p.batterId && b.reconciled);
      const bowler = i.bowlers.find(b => b.id === p.bowlerId && b.reconciled);
      if (!batter || !bowler) continue;
      const bowlingCase = eligibleNames.has(keyOf(bowler.name)) && opponents.includes(i.battingTeam);
      const battingCase = eligibleNames.has(keyOf(batter.name)) && opponents.includes(bowler.team);
      if (!bowlingCase && !battingCase) continue;
      const team = bowlingCase ? i.battingTeam : bowler.team;
      const key = `${team}:${keyOf(batter.name)}:${keyOf(bowler.name)}`;
      if (!results.has(key)) results.set(key, { ...empty(), team, batter: batter.name, bowler: bowler.name, role: bowlingCase ? "bowl" : "bat", evidenceRefs: [], bySeason: {} });
      const r = results.get(key); const year = m.date.slice(0,4); r.bySeason[year] ||= empty();
      for (const k of ["runs", "balls", "wickets"]) { r[k] += p[k]; r.bySeason[year][k] += p[k]; }
      r.evidenceRefs.push(reference(m,i,`:matchup:${batter.id}:${bowler.id}`));
    }
  }
  return [...results.values()].map(r => ({ ...finish(r), bySeason: Object.fromEntries(Object.entries(r.bySeason).map(([y,s]) => [y,finish(s)])), confidence: r.balls < 30 ? "exploratory" : "limited" }))
    .sort((a,b) => b.wickets-a.wickets || b.balls-a.balls);
}

function strikeBowlerProfiles(profiles, rosters, focalTeam) {
  const cards = [];
  for (const [team, names] of rosters) {
    const players = new Map();
    for (const m of profiles) for (const inn of m.innings.filter(i => i.reconciled)) {
      for (const b of inn.bowlers.filter(b => b.reconciled && names.has(keyOf(b.name)) && b.scorecardBalls > 0)) {
        const key = keyOf(b.name);
        if (!players.has(key)) players.set(key, { name: b.name, runs: 0, balls: 0, wickets: 0, spells: 0, wicketSpells: 0, phases: {}, bySeason: {}, refs: [] });
        const s = players.get(key); const year = m.date.slice(0,4);
        s.spells += 1; s.wicketSpells += b.scorecardWickets > 0 ? 1 : 0;
        s.bySeason[year] ||= { runs: 0, balls: 0, wickets: 0, spells: 0 };
        s.bySeason[year].spells += 1;
        for (const [k,v] of Object.entries({ runs: b.scorecardRuns, balls: b.scorecardBalls, wickets: b.scorecardWickets })) { s[k] += v; s.bySeason[year][k] += v; }
        for (const [phase, p] of Object.entries(b.phases)) {
          s.phases[phase] ||= { phase, runs: 0, balls: 0, wickets: 0 };
          for (const k of ["runs", "balls", "wickets"]) s.phases[phase][k] += p[k];
        }
        s.refs.push(reference(m,inn,`:bowler:${b.id}`));
      }
    }
    const ranked = [...players.values()].filter(s => s.wickets > 0 && s.balls >= 12)
      .sort((a,b) => Number(b.spells >= 3)-Number(a.spells >= 3) || b.wickets-a.wickets || b.wicketSpells/b.spells-a.wicketSpells/a.spells).slice(0,3);
    for (const s of ranked) {
      const phases = Object.values(s.phases).filter(p => p.balls >= 12).map(finish);
      const weakest = phases.length >= 2 ? [...phases].sort((a,b) => b.economy-a.economy)[0] : null;
      const best = [...phases].sort((a,b) => b.wickets/b.balls-a.wickets/a.balls)[0];
      const stats = { ...s, economy: rate(s.runs,s.balls), bowlingStrikeRate: s.wickets ? round(s.balls/s.wickets) : null, weakestPhase: weakest, phases,
        bySeason: Object.fromEntries(Object.entries(s.bySeason).map(([year,v]) => [year, { ...v, economy: rate(v.runs,v.balls) }])) };
      const repeat = s.spells >= 3 && s.wicketSpells/s.spells >= 2/3;
      const first = `${s.name}: ${s.wickets} wickets in ${s.spells} spells; wickets in ${s.wicketSpells}/${s.spells}. Economy ${stats.economy}.`;
      const second = weakest
        ? `Highest observed economy: ${weakest.phase}, ${weakest.economy} over ${oversText(weakest.balls)} overs.${weakest.economy < 8 ? " Still controlled—not a clear weakness." : team === focalTeam ? " Reconsider extending his spell into this phase." : " Test with measured pressure, not a blind attack."}`
        : "Too little phase coverage to identify a reliable weak phase; reassess after each over.";
      cards.push(claim(`${team} · ${s.name}`, `${first} Bowling strike rate: ${stats.bowlingStrikeRate} balls/wicket.${best ? ` Highest observed wicket-rate phase: ${best.phase}.` : ""} Weakest means highest observed economy among phases with at least 12 balls; phase context differs, so it is not an automatic weakness. Historical totals follow this current-XI player across clubs.`,
        `${first} ${second} ${team === focalTeam ? "Avoid automatically extending a spell into a more expensive phase." : "Rotate strike against the wicket-taking option; attack execution errors, not the reputation."}`,
        s.refs, { team, player: s.name, statistics: stats, bullets: [first,second], classification: s.spells < 3 ? "provisional_small_sample" : repeat ? "repeat_wicket_taker" : "wicket_threat_mixed_consistency" }));
    }
  }
  return cards;
}

function buildTacticalPlan({ opponentMatch, contextMatches = [], focalTeam = "San Ramon Grizzlies", asOfDate, currentPlayerNames }) {
  const profile = buildMatchProfile(opponentMatch);
  const cutoff = dateOf(asOfDate || opponentMatch.match_date);
  if (profile.date > cutoff) throw new Error("Reviewed match is after the scouting cutoff.");
  // Its scorecard can identify the XI, but shortened-match passages cannot
  // support standard six-over powerplay / death-over claims.
  if (profile.excludedReason) profile.innings = [];
  const eligible = [opponentMatch, ...contextMatches].filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(dateOf(r.match_date)) && dateOf(r.match_date) <= cutoff);
  const unique = [...new Map(eligible.map((r) => [n(r.match_id), r])).values()];
  const allProfiles = unique.map(buildMatchProfile);
  const profiles = allProfiles.filter(p => !p.excludedReason);
  const latestOwn = [...allProfiles].filter(p => p.teams.includes(focalTeam)).sort((a,b) => b.date.localeCompare(a.date) || b.matchId-a.matchId)[0];
  const latestOwnRow = unique.find(r => n(r.match_id) === latestOwn?.matchId);
  const ownInnings = latestOwn?.innings.find(i => i.battingTeam === focalTeam);
  const roster = currentPlayerNames || (latestOwnRow?.batting_json || []).filter(b => innOf(b) === innOf(ownInnings || {})).map(nameOf);
  // Bowling-only/DNB players are still eligible members of the latest XI.
  const inferredBowlers = currentPlayerNames ? [] : latestOwn?.innings.flatMap(i => i.bowlers.filter(b => b.team === focalTeam).map(b => b.name)) || [];
  const eligibleNames = new Set([...roster,...inferredBowlers].map(keyOf));
  const ownMatches = profiles;
  const opponents = profile.innings.filter((i) => i.battingTeam !== focalTeam);
  const bowling = []; const batting = []; const fields = []; const opposition = []; const matchups = [];
  const pressure = []; const phaseThreats = [];
  for (const inn of opponents) {
    if (!inn.reconciled) continue;
    const batters = [...inn.batters].filter((b) => b.reconciled).sort((a, b) => b.scorecardRuns - a.scorecardRuns);
    const threat = batters[0];
    for (const phase of PHASES) {
      const choices = bowlingChoices(ownMatches, focalTeam, phase, eligibleNames, inn.battingTeam);
      const choice = choices[0]; if (!choice) continue;
      const phaseBatters = batters.filter((b) => b.phases[phase]?.balls >= 12).sort((a, b) => b.phases[phase].strikeRate - a.phases[phase].strikeRate);
      const target = phaseBatters[0] || threat;
      const sample = target?.phases[phase];
      const os = inn.overs.filter(o => o.phase === phase);
      const phaseStats = os.reduce((a,o) => ({ runs:a.runs+o.runs,balls:a.balls+o.balls,dots:a.dots+o.dots }), {runs:0,balls:0,dots:0});
      if (phaseStats.balls >= 12) {
        const dotPercentage = rate(phaseStats.dots,phaseStats.balls,100);
        const bullets = [`${inn.battingTeam}: ${phaseStats.dots}/${phaseStats.balls} legal balls were dots in the ${phase} (${dotPercentage}%).`, `Try ${choice.name} in this phase; build pressure without offering release boundaries.`];
        pressure.push(claim(`${inn.battingTeam} · ${phase} dot-ball pressure`, `${bullets[0]} Scoring rate ${rate(phaseStats.runs,phaseStats.balls)} RPO. One-match observation, not a stable team weakness; dot balls alone do not establish wicket causation.`, bullets.join(" "), [reference(profile,inn,`:phase:${phase}`),...choice.refs], {team:inn.battingTeam,phase,bullets,statistics:{...phaseStats,dotPercentage}}));
      }
      if (sample?.balls >= 12) {
        const bullets = [`${target.name}: ${sample.runs} off ${sample.balls} in the ${phase} (SR ${sample.strikeRate}).`, `Counter with ${choice.name}${choices[1] ? `; ${choices[1].name} is the alternative` : ""}. Reassess after one over.`];
        phaseThreats.push(claim(`${inn.battingTeam} · ${phase}: ${target.name}`, `${bullets[0]} Leading observed scoring rate among this innings' batters with at least 12 balls in the phase. The bowling counter uses 2025/2026 phase evidence, not an inferred bowling-style advantage.`,bullets.join(" "),[reference(profile,inn,`:batter:${target.id}:phase:${phase}`),...choice.refs],{team:inn.battingTeam,phase,player:target.name,bullets,statistics:sample}));
      }
      bowling.push(claim(`${inn.battingTeam} · ${phase}: ${choice.name}`,
        `${choice.name} took ${choice.wickets}/${choice.runs} in ${oversText(choice.balls)} ${phase} overs across ${choice.matchCount} match(es) (economy ${choice.economy}).${choice.direct.balls ? ` Specifically against ${inn.battingTeam}: ${choice.direct.wickets}/${choice.direct.runs} in ${oversText(choice.direct.balls)} ${phase} overs.` : " No direct opponent sample."}${sample ? ` ${target.name} made ${sample.runs} off ${sample.balls} in this phase of the reviewed game.` : ""}`,
        `Use ${choice.name} as the first ${phase} option${target ? ` when ${target.name} is in` : ""}.${choices[1] ? ` ${choices[1].name} is the alternative (${choices[1].wickets}/${choices[1].runs} in ${oversText(choices[1].balls)} ${phase} overs).` : ""} Reassess after one over against the current required rate; retain any unused overs for the next pressure passage.`,
        [...choice.refs, reference(profile, inn)], { team: inn.battingTeam, phase, player: choice.name, basis: "2025 + 2026 phase evidence; conditional recommendation, not a calibrated prediction", statistics: choice, alternatives: choices.slice(1, 3) }));
    }
    for (const target of batters.slice(0, 3)) {
      const direct = inn.matchups.filter((p) => p.batterId === target.id && p.balls >= 6)
        .map((p) => ({ ...p, bowler: inn.bowlers.find((b) => b.id === p.bowlerId) })).filter((p) => p.bowler?.reconciled)
        .sort((a, b) => a.strikeRate - b.strikeRate);
      if (direct.length) {
        const best = direct[0];
        matchups.push(claim(`${target.name}: observed control matchup`,
          `${target.name} scored ${best.runs} off ${best.balls} against ${best.bowler.name}${best.wickets ? `, with ${best.wickets} bowler-credited dismissal(s)` : ""}.`,
          "Use this as the reference for run control, not proof that a Grizzlies bowler of an unverified style will reproduce it. No directional field or bowling-type weakness is inferred from this pairing.", [reference(profile, inn, `:matchup:${target.id}:${best.bowlerId}`)], { team: inn.battingTeam }));
      }
    }
    if (threat) {
      const runs = threat.scorecardRuns; const balls = threat.scorecardBalls;
      fields.push(claim(`${inn.battingTeam} · field trial against ${threat.name}`,
        `${threat.name} scored ${runs} off ${balls}; shot direction, bowling line/length and handedness are not verified by this feed.`,
        `Trial an off-stump channel with deep third and deep cover as the two boundary riders in the powerplay; keep point and extra cover saving one. After the powerplay, a five-out protection option is deep third, deep cover, long-off, long-on and deep midwicket. These positions are a proposed field for the chosen line, not a measured ${threat.name} scoring map. Confirm handedness, boundary dimensions and competition restrictions, then adjust after the first over.`,
        [reference(profile, inn, `:batter:${threat.id}`)], { team: inn.battingTeam, basis: "Conditional field experiment; no shot-map evidence", confidence: "low" }));
    }
  }
  // The opposition's bowling innings belongs to the OTHER team's batting innings.
  for (const opponent of profile.teams.filter((t) => t !== focalTeam)) {
    const bowlInn = profile.innings.find((i) => i.battingTeam !== opponent && i.reconciled);
    if (!bowlInn) continue;
    const bs = bowlInn.bowlers.filter((b) => b.team === opponent && b.reconciled);
    const danger = [...bs].sort((a, b) => b.scorecardWickets - a.scorecardWickets || rate(a.scorecardRuns, a.scorecardBalls) - rate(b.scorecardRuns, b.scorecardBalls))[0];
    const target = [...bs].filter((b) => b.scorecardBalls >= 12).sort((a, b) => rate(b.scorecardRuns, b.scorecardBalls) - rate(a.scorecardRuns, a.scorecardBalls))[0];
    if (danger && target) opposition.push(claim(`${opponent} · choose the bowling change to attack`,
      `${spellText(danger)} supplied the strongest wicket threat; ${spellText(target)} had the highest economy among bowlers with at least two overs.`,
      `Against ${danger.name}, prioritize singles and punish clear errors rather than forcing a boundary to recover a quiet over. Review ${target.name}'s next over as an acceleration opportunity, while recognizing that${danger.name === target.name ? " the same bowler was also taking wickets" : " a previous expensive spell does not guarantee an easy matchup"}.`, [reference(profile, bowlInn)], { team: opponent }));
  }
  const ownBatters = teamBatters(ownMatches, focalTeam, eligibleNames);
  const viable = ownBatters.filter((p) => p.completeStarts > 0 && p.samples.some(s => s.position <= 7));
  const quick = [...viable].filter(p => p.completeStarts >= 3).sort((a, b) => b.first6StrikeRate - a.first6StrikeRate || b.innings - a.innings)[0];
  const recovery = [...viable].filter((p) => p.samples.some((s) => s.entryWickets >= 2 && s.scorecardBalls >= 12))
    .sort((a, b) => Math.max(...b.samples.filter(s => s.entryWickets >= 2).map(s => s.scorecardRuns)) - Math.max(...a.samples.filter(s => s.entryWickets >= 2).map(s => s.scorecardRuns)))[0];
  const partner = [...viable].filter((p) => p !== recovery && p.samples.some((s) => s.entryWickets >= 2 && s.scorecardBalls >= 18))
    .sort((a, b) => b.samples.reduce((v, s) => Math.max(v, s.scorecardBalls), 0) - a.samples.reduce((v, s) => Math.max(v, s.scorecardBalls), 0))[0];
  const observed = (p) => `${p.name}: ${p.innings} reconciled innings; first-six-ball SR ${p.first6StrikeRate} over ${p.first6Balls} balls (includes early dismissals); ${p.earlyDismissals} dismissed within six balls.${p.medianRuns !== null ? ` Median innings ${p.medianRuns} runs.` : ""} Latest: ${[...p.samples].sort((a,b) => b.date.localeCompare(a.date)).slice(0,2).map((s) => `${s.date}: ${s.scorecardRuns} off ${s.scorecardBalls}, first faced at ${s.entryScore}/${s.entryWickets}; first ${s.first6.balls} balls ${s.first6.runs} runs`).join("; ")}.`;
  if (recovery) batting.push(claim("Two early wickets: recovery option", observed(recovery),
    `Send ${recovery.name} next if still available.${partner ? ` Pair with ${partner.name} if another wicket falls while the required rate remains manageable.` : ""} Give the incoming player a six-ball review window; if the required rate is rising, change the scoring intent rather than treating survival alone as success.`,
    recovery.samples.map((s) => s.ref), { player: recovery.name, basis: `${recovery.innings} innings; ${recovery.consistency}` }));
  if (quick) batting.push(claim("Required rate rising: fastest observed starter", observed(quick),
    `If still unbatted, consider ${quick.name} ahead of a slower starter when the chase needs immediate scoring; weigh the early-dismissal risk above. This shortlist requires at least three completed six-ball starts and uses all starting balls, including early dismissals. An opener cannot be promoted after already batting.`, quick.samples.map((s) => s.ref), { player: quick.name, basis: `${quick.innings} innings; ${quick.consistency}` }));
  if (partner) batting.push(claim("Manageable chase: stabilizing partner", observed(partner),
    `${partner.name} is an option to accompany the established aggressor after early wickets. Do not promote this role into a steep-rate chase just because the innings ended not out; review the first six balls and the required-rate movement.`, partner.samples.map((s) => s.ref), { player: partner.name, basis: `${partner.innings} innings; ${partner.consistency}` }));
  const direct = directPlayerMatchups(profiles, profile.teams.filter(t => t !== focalTeam), eligibleNames);
  const rosters = new Map([[focalTeam, eligibleNames]]);
  for (const team of profile.teams.filter(t => t !== focalTeam)) {
    const latest = [...allProfiles].filter(p => p.teams.includes(team)).sort((a,b) => b.date.localeCompare(a.date) || b.matchId-a.matchId)[0];
    const row = unique.find(r => n(r.match_id) === latest?.matchId);
    const ownInn = latest?.innings.find(i => i.battingTeam === team);
    rosters.set(team, new Set([...(row?.batting_json || []).filter(b => innOf(b) === innOf(ownInn || {})).map(nameOf), ...(latest?.innings.flatMap(i => i.bowlers.filter(b => b.team === team).map(b => b.name)) || [])].map(keyOf)));
  }
  return { version: VERSION, asOfDate: cutoff, focalTeam, rosterBasis: currentPlayerNames ? "explicit current roster" : `latest observed XI, match ${latestOwn?.matchId || "unavailable"}; confirm selection`, sourceMatchIds: allProfiles.map((m) => m.matchId),
    coverage: allProfiles.map((m) => ({ matchId: m.matchId, date: m.date, excludedReason: m.excludedReason, innings: m.innings.map((i) => ({ team: i.battingTeam, reconciled: i.reconciled, ...i.coverage })) })),
    matchPassages: passageInsights(profile), bowlingPlan: bowling, battingScenarios: batting, fieldPlans: fields, oppositionBowling: opposition, observedMatchups: matchups,
    directMatchups: direct,
    strikeBowlers: strikeBowlerProfiles(profiles,rosters,focalTeam),
    dotBallPressure: pressure,
    phaseBattingThreats: phaseThreats,
    partnershipDefinition: "Strong = more than 30 legal balls together, at least 8 RPO when setting a target or at least the entry required rate when chasing. Five overs exactly does not qualify. Shorter explosive stands remain tactical threats.",
    partnershipPlans: partnershipPlans(profiles,profile,eligibleNames,focalTeam,direct),
    batterReadiness: ownBatters.map(({ samples, ...p }) => ({ ...p, evidenceRefs: samples.map((s) => s.ref) })),
    limitations: ["Bowler options are alternatives by phase, not a 20-over allocation: confirm the XI, four-over quota and no consecutive overs before use.", "One innings can describe a start or a recovery; it cannot establish batting consistency. Median runs are shown only with at least three innings.", "Cross-opponent recommendations are hypotheses; player style and shot direction are not inferred from names or scoring rates.", "Only fully reconciled innings and player figures contribute to detailed tactical claims."],
  };
}

module.exports = { VERSION, buildMatchProfile, buildTacticalPlan, normalizeRunEvidence, classifyPartnership, strikeBowlerProfiles };

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createGrizzliesPortalAccessMiddleware,
  requireGrizzliesPortalAccess,
} = require("../src/lib/auth");
const {
  getConfiguredPlayerId,
  getThreatTone,
  buildGrizzliesMatchSummary,
  mapGrizzliesWestFixtures,
  isGrizzliesMatchAnalysisAvailable,
  resolveGrizzliesMatchSummary,
  selectVisibleGrizzliesReportRow,
  withPortalPhaseTimeout,
  mapGrizzliesPlayoffTeams,
} = require("../src/services/grizzliesPortalService");
const { MILC_2026_KEY, MILC_THREAT_VERSION } = require('../../../shared/milcPlayoffThreat');

test('playoff buttons use only the MiLC model and the same minimum-sample tiers as reports', () => {
  const base = { team_name: 'Dallas Xforia Giants', player_id: 1, player_name: 'Player', source_player_id: 'one', has_aggregate: true, has_composite: true, has_intelligence: true, matches_played: 3, threat_score_version: MILC_THREAT_VERSION, total_matches: 3 };
  for (const [percentile, tone] of [[85,'red'], [84.999,'amber'], [60,'amber'], [59.999,'green'], [null,'unknown']]) {
    const input = { ...base, league_percentile_rank: percentile };
    assert.equal(mapGrizzliesPlayoffTeams([input], MILC_2026_KEY)[0].players[0].threatTone, tone);
    assert.equal(mapGrizzliesPlayoffTeams([{ ...input, total_matches: 2, matches_played: 2 }], MILC_2026_KEY)[0].players[0].threatTone, 'unknown');
    assert.equal(mapGrizzliesPlayoffTeams([{ ...input, threat_score_version: 'ncca-league-threat-v1' }], MILC_2026_KEY)[0].players[0].threatTone, 'unknown');
    assert.equal(mapGrizzliesPlayoffTeams([input], 'milc-2025')[0].players[0].threatTone, 'unknown');
  }
});

test("playoff cards link verified players to MiLC reports, never NCCA threat tiers", () => {
  const teams = mapGrizzliesPlayoffTeams([
    { team_name: "Dallas Xforia Giants", player_id: 8973, player_name: "Smit Patel", source_player_id: "source-1", profile_url: "/MiLC/user/source-1", has_aggregate: true, has_composite: true, has_intelligence: true, matches_played: 5, latest_match: "2026-09-26", league_percentile_rank: 99 },
  ], "milc-2026");
  assert.deepEqual(teams.map(team => team.name), ["Dallas Xforia Giants", "Baltimore Royals", "Manhattan Yorkers"]);
  const player = teams[0].players[0];
  assert.equal(teams[0].section, "playoffs");
  assert.equal(player.assessmentPath, "/analytics/reports/8973?series=milc-2026&from=grizzlies-2026");
  assert.equal(player.threatPath, "/analytics/intelligence/8973?series=milc-2026&from=grizzlies-2026");
  assert.equal(player.cricclubsProfileUrl, "https://cricclubs.com/MiLC/user/source-1");
  assert.equal(player.dataStatus, "ready");
  assert.equal(player.threatTone, "unknown");
  assert.equal(teams[0].latestMatchDate, "2026-09-26");
});

test("playoff cards distinguish scorecard-only players from limited evidence", () => {
  const teams = mapGrizzliesPlayoffTeams([
    { team_name: "Dallas Xforia Giants", player_id: 1, player_name: "Scorecard Only", source_player_id: "one", has_aggregate: false, has_composite: false, has_intelligence: false, matches_played: 0 },
    { team_name: "Dallas Xforia Giants", player_id: 2, player_name: "One Match", source_player_id: "two", has_aggregate: true, has_composite: true, has_intelligence: true, matches_played: 1 },
    { team_name: "Dallas Xforia Giants", player_id: 3, player_name: "Assessment Only", source_player_id: "three", has_aggregate: true, has_composite: true, has_intelligence: false, matches_played: 4 },
  ], "milc-2026");
  const byName = new Map(teams[0].players.map(player => [player.name, player]));
  assert.equal(byName.get("Scorecard Only").assessmentPath, null);
  assert.equal(byName.get("Scorecard Only").threatPath, null);
  assert.equal(byName.get("Scorecard Only").dataStatus, "not_found");
  assert.match(byName.get("Scorecard Only").dataNote, /No batting or bowling analytics/);
  assert.equal(byName.get("One Match").dataStatus, "limited");
  assert.ok(byName.get("One Match").threatPath);
  assert.ok(byName.get("Assessment Only").assessmentPath);
  assert.equal(byName.get("Assessment Only").threatPath, null);
  assert.match(byName.get("Assessment Only").dataNote, /Threat intelligence unavailable/);
});

test("same-name playoff source accounts are flagged rather than merged or double-listed", () => {
  const row = { team_name: "Baltimore Royals", player_name: "Prannav Chettipalayam", has_aggregate: true, has_composite: true, has_intelligence: true, matches_played: 3 };
  const team = mapGrizzliesPlayoffTeams([
    { ...row, player_id: 8439, source_player_id: "source-a" },
    { ...row, player_id: 8817, source_player_id: "source-b" },
  ], "milc-2026")[1];
  assert.equal(team.players.length, 1);
  assert.equal(team.players[0].dataStatus, "identity_review");
  assert.equal(team.players[0].assessmentPath, null);
  assert.equal(team.players[0].threatPath, null);
  assert.equal(team.players[0].cricclubsProfileUrl, null);
  assert.match(team.players[0].dataNote, /2 source accounts/);
});

test("playoff mapping fails closed for synthetic identities and unavailable team data", () => {
  const teams = mapGrizzliesPlayoffTeams([
    { team_name: "Manhattan Yorkers", player_id: 9, player_name: "Unresolved", source_player_id: "synthetic:9", has_aggregate: true, has_composite: true, has_intelligence: true },
    { team_name: "Other Team", player_id: 10, player_name: "Not on this roster", source_player_id: "ten" },
  ], "milc-2026");
  assert.equal(teams[2].players[0].threatPath, null);
  assert.equal(teams[2].players[0].dataStatus, "identity_review");
  assert.equal(teams[0].dataStatus, "unavailable");
  assert.deepEqual(teams[0].players, []);
});

test("match summary explains the result through verified innings totals and run rates", () => {
  const summary = buildGrizzliesMatchSummary({
    match: {
      homeTeam: "East Bay Blazers",
      awayTeam: "Silicon Valley Strikers",
      resultText: "Silicon Valley Strikers won by 6 Wickets",
    },
    evidence: {
      innings: [
        { battingTeam: "East Bay Blazers", runs: 166, wickets: 7, legalBalls: 120, runRate: 8.3 },
        { battingTeam: "Silicon Valley Strikers", runs: 167, wickets: 4, legalBalls: 114, runRate: 8.79 },
      ],
    },
  });

  assert.equal(
    summary,
    "Silicon Valley Strikers completed a six-wicket chase of 167/4 in 19.0 overs after East Bay Blazers posted 166/7. Their 8.79 run rate exceeded East Bay Blazers' 8.30, deciding the match."
  );
});

test("match summary names both teams' leading performers and the player who decided the chase", () => {
  const summary = buildGrizzliesMatchSummary({
    match: {
      homeTeam: "East Bay Blazers",
      awayTeam: "Silicon Valley Strikers",
      resultText: "Silicon Valley Strikers won by 6 Wickets",
    },
    evidence: {
      innings: [
        { battingTeam: "East Bay Blazers", runs: 166, wickets: 7, legalBalls: 120, runRate: 8.3 },
        { battingTeam: "Silicon Valley Strikers", runs: 167, wickets: 4, legalBalls: 114, runRate: 8.79 },
      ],
    },
    scorecard: {
      topBatting: [
        { playerName: "Saideep Ganesh", teamName: "East Bay Blazers", runs: 54, ballsFaced: 25, strikeRate: 216 },
        { playerName: "Bilal Basheer", teamName: "Silicon Valley Strikers", runs: 48, ballsFaced: 30, strikeRate: 160 },
      ],
      topBowling: [
        { playerName: "Aarnav Iyer", teamName: "Silicon Valley Strikers", wickets: 3, runsConceded: 38, economy: 9.5 },
        { playerName: "East Bay Bowler", teamName: "East Bay Blazers", wickets: 2, runsConceded: 27, economy: 6.75 },
      ],
    },
  });

  assert.equal(
    summary,
    "Silicon Valley Strikers completed a six-wicket chase of 167/4 in 19.0 overs after East Bay Blazers posted 166/7. Saideep Ganesh drove East Bay Blazers to that total with 54 off 25, while East Bay Bowler led their bowling with 2/27. Bilal Basheer then led Silicon Valley Strikers' reply with 48 off 30, backed by Aarnav Iyer's 3/38. Bilal Basheer's innings was decisive: it helped Silicon Valley Strikers sustain 8.79 runs per over, above East Bay Blazers' 8.30, and finish with six wickets in hand."
  );
});

test("Grizzlies portal accepts an approved Gmail address regardless of casing", async () => {
  const req = { cricketActor: { userId: "user-1", email: "NIRAVSH@GMAIL.COM" } };
  const actor = await requireGrizzliesPortalAccess(req);
  assert.equal(actor.email, "niravsh@gmail.com");
});

test("portal threat colors use persisted league-wide tiers and the evidence gate", () => {
  assert.equal(getThreatTone({ leaguePercentileRank: 85, totalMatches: 3 }), "red");
  assert.equal(getThreatTone({ leaguePercentileRank: 99, totalMatches: 2 }), "amber");
  assert.equal(getThreatTone({ leaguePercentileRank: 60, totalMatches: 1 }), "amber");
  assert.equal(getThreatTone({ leaguePercentileRank: 59.99, totalMatches: 8 }), "green");
  assert.equal(getThreatTone(null), "unknown");
});

test("portal resolves an approved identity cluster to its canonical report player", () => {
  const config = {
    approvedMappings: {
      "Sreehaas Krishna": {
        profileUrl: "https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=2102795&clubId=1191",
      },
    },
    identityClusters: [{ name: "Sreehaas Krishna", canonicalPlayerId: 4569 }],
  };

  assert.equal(getConfiguredPlayerId(config, "Sreehaas Krishna"), 4569);
});

test("Grizzlies portal rejects authenticated users outside the allow-list", async () => {
  await assert.rejects(
    () => requireGrizzliesPortalAccess({ cricketActor: { userId: "user-2", email: "other@example.com" } }),
    { message: "You do not have access to Grizzlies 2026 Analytics.", statusCode: 403 }
  );
});

test("Grizzlies portal middleware advances to the route after its asynchronous access check", async () => {
  const req = {};
  let nextError = "not-called";
  const middleware = createGrizzliesPortalAccessMiddleware(async (request) => {
    request.cricketActor = { userId: "user-1", email: "helloarth09@gmail.com" };
  });

  await middleware(req, {}, (error) => {
    nextError = error || null;
  });

  assert.equal(nextError, null);
  assert.equal(req.cricketActor.email, "helloarth09@gmail.com");
});

test("portal lists every West fixture but exposes analysis only for reviewed fact-complete matches", () => {
  const fixtures = mapGrizzliesWestFixtures([
    {
      id: 42,
      source_match_id: "west-completed",
      division_label: "West",
      match_date: "2026-09-19",
      team1_name: "Silicon Valley Strikers",
      team2_name: "East Bay Blazers",
      match_status: "completed",
      result_text: "Silicon Valley Strikers won by 6 wickets",
      parse_status: "parsed",
      analytics_status: "computed",
      ball_event_count: 244,
      report_status: "reviewed",
    },
    {
      id: 43,
      source_match_id: "west-scheduled",
      division_label: "West",
      match_date: "2026-09-26",
      team1_name: "San Ramon Grizzlies",
      team2_name: "Silicon Valley Strikers",
      match_status: "scheduled",
      result_text: null,
      parse_status: "pending",
      analytics_status: "pending",
      ball_event_count: 0,
      report_status: null,
    },
    {
      id: 44,
      source_match_id: "central-completed",
      division_label: "Central",
      match_date: "2026-09-19",
      team1_name: "Dallas Xforia Giants",
      team2_name: "MetroPlex",
      match_status: "completed",
      result_text: "Dallas Xforia Giants won",
      parse_status: "parsed",
      analytics_status: "computed",
      ball_event_count: 200,
      report_status: "reviewed",
    },
    {
      id: 45,
      source_match_id: "west-incomplete",
      division_label: "West",
      match_date: "2026-09-27",
      team1_name: "Team A",
      team2_name: "Team B",
      match_status: "completed",
      result_text: "Team A won",
      parse_status: "skipped",
      analytics_status: "pending",
      ball_event_count: 0,
      report_status: "reviewed",
    },
  ]);

  assert.equal(fixtures.length, 3);
  assert.deepEqual(fixtures.map((fixture) => fixture.matchId), [42, 43, 45]);
  assert.equal(fixtures[0].report.path, "/analytics/grizzlies/2026/matches/42");
  assert.equal(fixtures[1].report.path, null);
  assert.equal(fixtures[2].report.path, null);
  assert.equal(isGrizzliesMatchAnalysisAvailable(fixtures[0]), true);
  assert.equal(isGrizzliesMatchAnalysisAvailable(fixtures[2]), false);
});

test("portal phase timeout returns a clear retryable error instead of waiting forever", async () => {
  await assert.rejects(
    () => withPortalPhaseTimeout("West Division fixtures", new Promise(() => {}), 10),
    { message: "Grizzlies portal West Division fixtures timed out. Retry shortly.", statusCode: 503, code: "grizzlies_portal_timeout" }
  );
});

test("generated v2 remains hidden until published and visible selection is deterministic", () => {
  const legacy = {
    id: 1,
    analysis_model_version: "legacy-v1",
    status: "published",
    published_at: "2026-09-19T20:00:00Z",
  };
  const generatedV2 = {
    id: 2,
    analysis_model_version: "t20-context-v2",
    status: "generated",
    generated_at: "2026-09-20T01:00:00Z",
  };
  assert.equal(selectVisibleGrizzliesReportRow([legacy, generatedV2]).id, 1);

  const publishedV2 = {
    ...generatedV2,
    status: "published",
    published_at: "2026-09-20T02:00:00Z",
  };
  assert.equal(selectVisibleGrizzliesReportRow([legacy, publishedV2]).id, 2);
});

test("v4 detail uses its stored tactical summary and never rebuilds the legacy narrative", () => {
  const row = {
    analysis_model_version: "t20-context-v4",
    analysis_json: { matchSummary: "A verified partnership decided this chase." },
  };
  const summary = resolveGrizzliesMatchSummary(row, {
    match: { resultText: "Legacy fallback" },
    evidence: { innings: [] },
  });
  assert.equal(summary, "A verified partnership decided this chase.");
});

test("fixture mapping collapses duplicate visible report rows to one fixture", () => {
  const base = {
    id: 42,
    source_match_id: "west-completed",
    division_label: "West",
    match_date: "2026-09-19",
    team1_name: "Silicon Valley Strikers",
    team2_name: "East Bay Blazers",
    match_status: "completed",
    parse_status: "parsed",
    analytics_status: "computed",
    ball_event_count: 244,
  };
  const fixtures = mapGrizzliesWestFixtures([
    { ...base, report_status: "reviewed", analysis_model_version: "legacy-v1" },
    { ...base, report_status: "published", analysis_model_version: "t20-context-v2" },
  ]);
  assert.equal(fixtures.length, 1);
  assert.equal(fixtures[0].report.analysisModelVersion, "t20-context-v2");
});

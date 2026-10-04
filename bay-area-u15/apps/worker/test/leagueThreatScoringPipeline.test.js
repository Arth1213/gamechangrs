const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runLeagueThreatScoring } = require("../src/pipeline/runLeagueThreatScoring");
const { runDownstreamOperations } = require("../src/ops/localRefresh");
const { MILC_2026_KEY, MILC_THREAT_VERSION } = require('../../../shared/milcPlayoffThreat');

test('MiLC pipeline filters active model, writes only playoff rows and leaves other score versions intact', async () => {
  for (const dryRun of [true, false]) {
    const calls = [];
    const client = { async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes('from public.series_source_config')) return { rows: [{ config_key: MILC_2026_KEY, series_id: 16, series_name: 'MiLC 2026', version_label: 'v1' }] };
      if (sql.includes('from public.player_composite_score')) return { rows: [
        { player_id: 1, player_name: 'Player One', source_player_id: 'one', team_name: 'Dallas Xforia Giants', division_label: 'Central', composite_score: 80, matches_played: 4 },
        { player_id: 2, player_name: 'Player Two', source_player_id: 'two', team_name: 'San Ramon Grizzlies', division_label: 'West', composite_score: 60, matches_played: 4 },
      ] };
      return { rows: [] };
    } };
    const result = await runLeagueThreatScoring({ series: { slug: MILC_2026_KEY }, outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'milc-threat-')), dryRun, log: () => {}, withTransactionFn: async work => work(client) });
    assert.equal(result.scoreVersion, MILC_THREAT_VERSION);
    assert.equal(result.eligiblePlayerCount, 2);
    assert.equal(result.playerSeriesThreatScoreRowCount, 1);
    const inputQuery = calls.find(call => call.sql.includes('from public.player_composite_score'));
    assert.deepEqual(inputQuery.params, [16, 'v1']);
    assert.match(inputQuery.sql, /pcs.score_version = \$2/);
    const deletes = calls.filter(call => call.sql.includes('delete from'));
    const inserts = calls.filter(call => call.sql.includes('insert into'));
    if (dryRun) { assert.equal(deletes.length, 0); assert.equal(inserts.length, 0); }
    else {
      assert.deepEqual(deletes[0].params, [16, MILC_THREAT_VERSION]);
      assert.match(deletes[0].sql, /score_version = \$2/);
      assert.equal(inserts[0].params.length, 7);
      assert.equal(inserts[0].params[1], 1);
      assert.equal(inserts[0].params[6], MILC_THREAT_VERSION);
    }
  }
});

test("replaces only one series' league-threat rows and writes its summary", async () => {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("from public.series_source_config")) {
        return { rows: [{ config_key: "ncca-2026", series_id: 10, series_name: "NCCA", version_label: "v1" }] };
      }
      if (sql.includes("from public.player_composite_score")) {
        return {
          rows: [
            { division_label: "2026 Premier A", player_id: 1, composite_score: 80, matches_played: 4 },
            { division_label: "2026 Premier B", player_id: 2, composite_score: 90, matches_played: 1 },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "league-threat-"));

  const result = await runLeagueThreatScoring({
    series: { slug: "ncca-2026" },
    outDir,
    log: () => {},
    withTransactionFn: async (work) => work(client),
  });

  const deleteCall = calls.find((call) => call.sql.includes("delete from public.player_series_threat_score"));
  const insertCall = calls.find((call) => call.sql.includes("insert into public.player_series_threat_score"));
  assert.deepEqual(deleteCall.params, [10]);
  assert.ok(insertCall);
  assert.equal(result.playerSeriesThreatScoreRowCount, 2);
  assert.equal(fs.existsSync(path.join(outDir, "league_threat_scoring_summary.json")), true);
});

test("runs league threat scoring between composite and intelligence during refresh", async () => {
  const order = [];
  await runDownstreamOperations(
    {
      series: { slug: "ncca-2026" },
      outDir: "/tmp/league-threat-refresh",
      log: () => {},
      operations: {
        runSeasonAggregation: async () => order.push("season"),
        runCompositeScoring: async () => order.push("composite"),
        runLeagueThreatScoring: async () => order.push("league-threat"),
        runPlayerIntelligence: async () => order.push("intelligence"),
      },
    },
    { pipeline: { processedMatchCount: 1 } }
  );
  assert.deepEqual(order, ["season", "composite", "league-threat", "intelligence"]);
});

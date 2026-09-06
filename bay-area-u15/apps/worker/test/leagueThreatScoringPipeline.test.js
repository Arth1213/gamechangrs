const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runLeagueThreatScoring } = require("../src/pipeline/runLeagueThreatScoring");
const { runDownstreamOperations } = require("../src/ops/localRefresh");

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

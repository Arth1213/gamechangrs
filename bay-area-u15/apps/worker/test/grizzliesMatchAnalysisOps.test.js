"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ANALYSIS_MODEL_VERSION,
  generateGrizzliesMatchAnalysis,
  reviewGrizzliesMatchAnalysis,
} = require("../src/ops/grizzliesMatchAnalysis");

function event(index, overrides = {}) {
  return {
    innings: 1,
    eventIndex: index,
    over: Math.ceil(index / 6),
    ballInOver: ((index - 1) % 6) + 1,
    strikerPlayerId: 10,
    nonStrikerPlayerId: 11,
    playerOutId: null,
    batterRuns: 1,
    runs: 1,
    legal: true,
    wicket: false,
    boundary: false,
    scoreAfterRuns: index,
    wicketsAfter: 0,
    ...overrides,
  };
}

function eligibleRow(overrides = {}) {
  return {
    series_id: 7,
    match_id: 2376,
    source_match_id: "2376",
    match_status: "completed",
    result_text: "Silicon Valley Strikers won by 6 wickets",
    division_label: "West",
    parse_status: "parsed",
    analytics_status: "computed",
    home_team: "East Bay Blazers",
    away_team: "Silicon Valley Strikers",
    innings_json: [
      { innings: 1, battingTeam: "East Bay Blazers", runs: 12, wickets: 0, legalBalls: 12 },
      { innings: 2, battingTeam: "Silicon Valley Strikers", runs: 13, wickets: 0, legalBalls: 8, targetRuns: 13 },
    ],
    batting_json: [],
    bowling_json: [],
    players_json: [{ id: 10, displayName: "Vivaan Jagtiani" }, { id: 11, displayName: "Bilal Basheer" }],
    ball_events_json: [
      ...Array.from({ length: 12 }, (_, index) => event(index + 1)),
      ...Array.from({ length: 8 }, (_, index) => event(index + 1, {
        innings: 2,
        runs: index < 5 ? 2 : 1,
        batterRuns: index < 5 ? 2 : 1,
        scoreAfterRuns: index < 5 ? (index + 1) * 2 : 10 + (index - 4),
      })),
    ],
    existing_v2_checksum: null,
    existing_v2_status: null,
    ...overrides,
  };
}

class FakeClient {
  constructor(rows) {
    this.rows = rows;
    this.writes = [];
    this.transaction = [];
    this.reports = [{
      matchId: 2376,
      model: "legacy-v1",
      status: "published",
      checksum: "legacy-checksum",
    }];
  }

  async query(sql, params = []) {
    const text = String(sql);
    if (/^\s*(begin|commit|rollback)\s*$/i.test(text)) {
      this.transaction.push(text.trim().toUpperCase());
      return { rows: [], rowCount: 0 };
    }
    if (text.includes("grizzlies-match-analysis:load")) {
      return { rows: this.rows, rowCount: this.rows.length };
    }
    if (text.includes("grizzlies-match-analysis:upsert")) {
      this.writes.push({ sql: text, params });
      const row = this.rows.find((item) => Number(item.match_id) === Number(params[1]));
      if (row) {
        row.existing_v2_checksum = params[5];
        row.existing_v2_status = "generated";
      }
      this.reports.push({ matchId: Number(params[1]), model: params[3], status: "generated", checksum: params[5] });
      return { rows: [{ id: 99, status: "generated" }], rowCount: 1 };
    }
    if (text.includes("grizzlies-match-analysis:lock")) {
      return { rows: [{ id: 99, series_id: 7, match_id: Number(params[0]), report_type: "grizzlies_match_analysis", status: this.targetStatus || "generated" }], rowCount: 1 };
    }
    if (text.includes("grizzlies-match-analysis:review")) {
      this.targetStatus = "reviewed";
      return { rows: [{ id: 99, status: "reviewed" }], rowCount: 1 };
    }
    if (text.includes("grizzlies-match-analysis:supersede")) {
      this.reports.forEach((report) => {
        if (report.matchId === Number(params[1]) && report.model !== ANALYSIS_MODEL_VERSION) report.status = "superseded";
      });
      return { rows: [], rowCount: 1 };
    }
    if (text.includes("grizzlies-match-analysis:publish")) {
      this.targetStatus = "published";
      return { rows: [{ id: 99, status: "published" }], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${text}`);
  }
}

test("generation rejects ineligible matches before any write", async () => {
  const client = new FakeClient([
    eligibleRow({ match_id: 1, match_status: "scheduled" }),
    eligibleRow({ match_id: 2, division_label: "Central" }),
    eligibleRow({ match_id: 3, parse_status: "pending" }),
    eligibleRow({ match_id: 4, analytics_status: "pending" }),
    eligibleRow({ match_id: 5, ball_events_json: [] }),
  ]);

  const result = await generateGrizzliesMatchAnalysis({
    seriesConfigKey: "milc-2026",
    divisionLabel: "West",
    client,
  });

  assert.equal(result.generated.length, 0);
  assert.deepEqual(result.rejected.map((row) => row.reason), [
    "match_not_completed",
    "division_mismatch",
    "match_not_parsed",
    "analytics_not_computed",
    "ball_events_missing",
  ]);
  assert.equal(client.writes.length, 0);
});

test("dry-run returns a complete v2 candidate without writes", async () => {
  const client = new FakeClient([eligibleRow()]);
  const result = await generateGrizzliesMatchAnalysis({
    seriesConfigKey: "milc-2026",
    divisionLabel: "West",
    dryRun: true,
    client,
  });

  assert.equal(result.generated.length, 1);
  assert.equal(result.generated[0].analysisModelVersion, ANALYSIS_MODEL_VERSION);
  assert.equal(result.generated[0].evidence.complete, true);
  assert.equal(client.writes.length, 0);
});

test("generation is idempotent by checksum and model while legacy remains published", async () => {
  const client = new FakeClient([eligibleRow()]);
  const first = await generateGrizzliesMatchAnalysis({ seriesConfigKey: "milc-2026", divisionLabel: "West", client });
  const second = await generateGrizzliesMatchAnalysis({ seriesConfigKey: "milc-2026", divisionLabel: "West", client });

  assert.equal(first.generated[0].status, "generated");
  assert.equal(second.generated[0].status, "unchanged");
  assert.equal(client.writes.length, 1);
  assert.equal(client.reports.some((row) => row.model === "legacy-v1" && row.status === "published"), true);
});

test("review and publish use valid transitions and supersede legacy in one transaction", async () => {
  const client = new FakeClient([eligibleRow()]);
  await assert.rejects(
    () => reviewGrizzliesMatchAnalysis({ matchId: 2376, analysisModelVersion: ANALYSIS_MODEL_VERSION, action: "review", client }),
    /reviewerUserId/i,
  );

  const reviewed = await reviewGrizzliesMatchAnalysis({
    matchId: 2376,
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    action: "review",
    reviewerUserId: "5ffa7fd5-37b9-4505-b819-8357be68de8f",
    client,
  });
  assert.equal(reviewed.status, "reviewed");

  const published = await reviewGrizzliesMatchAnalysis({
    matchId: 2376,
    analysisModelVersion: ANALYSIS_MODEL_VERSION,
    action: "publish",
    reviewerUserId: "5ffa7fd5-37b9-4505-b819-8357be68de8f",
    client,
  });
  assert.equal(published.status, "published");
  assert.deepEqual(client.transaction, ["BEGIN", "COMMIT", "BEGIN", "COMMIT"]);
  assert.equal(client.reports.find((row) => row.model === "legacy-v1").status, "superseded");
});

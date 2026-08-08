"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  NCCA_TOP_PLAYERS_CONFIG_KEY,
  buildNccaTopPlayersPayload,
} = require("../src/services/reportService");
const { renderNccaTopPlayersPage } = require("../src/render/pages");

const context = {
  configKey: NCCA_TOP_PLAYERS_CONFIG_KEY,
  seriesId: 42,
  seriesName: "NCCA Summer 2026",
  targetAgeGroup: "NCCA",
  reportProfile: { name: "Player Assessment", theme_name: "Game-Changrs Player Assessment" },
};

const rows = [
  { player_id: 101, division_id: 11, display_name: "Bea", team_name: "Tigers", division_label: "Premier A", role_type: "all_rounder", composite_score: 88.5, percentile_rank: 94, confidence_score: 85 },
  { player_id: 102, division_id: 11, display_name: "Asha", team_name: "Tigers", division_label: "Premier A", role_type: "batter", composite_score: 88.5, percentile_rank: 96, confidence_score: 75 },
  { player_id: 103, division_id: 11, display_name: "Zed", team_name: "Lions", division_label: "Premier A", role_type: "bowler", composite_score: 80, percentile_rank: 90, confidence_score: 60 },
  { player_id: 201, division_id: 12, display_name: "Cia", team_name: "Hawks", division_label: "2026 Premier B", role_type: "batter", composite_score: 91, percentile_rank: 99, confidence_score: 90 },
];

test("NCCA top-player payload keeps divisions separate and orders score ties by percentile", () => {
  const payload = buildNccaTopPlayersPayload(context, rows);

  assert.deepEqual(payload.divisions.map((division) => division.label), ["Premier A", "Premier B", "Premier C"]);
  assert.deepEqual(payload.divisions[0].players.map((player) => player.displayName), ["Asha", "Bea", "Zed"]);
  assert.equal(payload.divisions[0].players[0].rank, 1);
  assert.equal(payload.divisions[1].players[0].rank, 1);
  assert.equal(payload.divisions[2].players.length, 0);
});

test("NCCA top-player payload caps every division at 20 and creates both existing report links", () => {
  const manyRows = Array.from({ length: 21 }, (_, index) => ({
    player_id: 300 + index,
    division_id: 13,
    display_name: `Player ${String(index).padStart(2, "0")}`,
    team_name: "Falcons",
    division_label: "Premier C",
    role_type: "batter",
    composite_score: 100 - index,
    percentile_rank: 100 - index,
    confidence_score: 80,
  }));
  const payload = buildNccaTopPlayersPayload(context, manyRows);
  const player = payload.divisions[2].players[0];

  assert.equal(payload.divisions[2].players.length, 20);
  assert.equal(player.reportPath, `/series/${NCCA_TOP_PLAYERS_CONFIG_KEY}/players/300/report?divisionId=13`);
  assert.equal(player.intelligencePath, `/series/${NCCA_TOP_PLAYERS_CONFIG_KEY}/players/300/intelligence?divisionId=13`);
});

test("NCCA top-player page uses report-system visuals and gives each row both report links", () => {
  const html = renderNccaTopPlayersPage(buildNccaTopPlayersPayload(context, rows));

  assert.match(html, /Plus Jakarta Sans/);
  assert.match(html, /Barlow Condensed/);
  assert.match(html, /Premier A/);
  assert.match(html, /Premier B/);
  assert.match(html, /Premier C/);
  assert.match(html, /Player Assessment/);
  assert.match(html, /Threat Report/);
  assert.match(html, /players\/102\/report\?divisionId=11/);
  assert.match(html, /players\/102\/intelligence\?divisionId=11/);
  assert.doesNotMatch(html, /Top Batters|Top Bowlers/);
});

test("NCCA top-player page explains when refresh recomputation has no rankings", () => {
  const html = renderNccaTopPlayersPage(buildNccaTopPlayersPayload(context, []));
  assert.match(html, /Rankings will appear after the NCCA refresh and recomputation complete\./);
});

import test from "node:test";
import assert from "node:assert/strict";
import { groupGrizzliesSquads, playerReportNote, sortPlayersByReportAvailability } from "./grizzliesSquadSections.js";

test("playoffs precede division while the Grizzlies squad remains separately accessible", () => {
  const groups = groupGrizzliesSquads([
    { name: "East Bay Blazers", players: [] },
    { name: "San Ramon Grizzlies", players: [] },
    { name: "Silicon Valley Strikers", players: [] },
    { name: "Baltimore Royals", section: "playoffs", players: [{ name: "Player" }] },
  ]);
  assert.deepEqual(groups.map(group => group.title), ["Playoffs", "Division", "Grizzlies squad"]);
  assert.deepEqual(groups[0].teams.map(team => team.name), ["Dallas Xforia Giants", "Baltimore Royals", "Manhattan Yorkers"]);
  assert.equal(groups[0].teams[1].players[0].name, "Player");
  assert.equal(groups[0].teams[0].dataStatus, "unavailable");
  assert.deepEqual(groups[1].teams.map(team => team.name), ["Silicon Valley Strikers", "East Bay Blazers"]);
  assert.equal(groups[2].teams[0].name, "San Ramon Grizzlies");
});

test("report-ready players sort ahead of profile-only and identity-review entries without mutation", () => {
  const players = [{ name: "Profile Only", nccaStatus: "matched", cricclubsProfileUrl: "https://cricclubs.com/MiLC/user/1" }, { name: "Ready", threatPath: "/analytics/intelligence/2" }];
  assert.deepEqual(sortPlayersByReportAvailability(players).map(player => player.name), ["Ready", "Profile Only"]);
  assert.equal(players[0].name, "Profile Only");
});

test("player availability messages respect the report source and never label MiLC as missing NCCA", () => {
  assert.equal(playerReportNote({ dataSource: "MiLC 2026", dataNote: "Identity review required." }), "Identity review required.");
  assert.equal(playerReportNote({ dataSource: "MiLC 2026" }), "MiLC 2026 analytics unavailable");
  assert.equal(playerReportNote({ nccaStatus: "not_found" }), "NCCA data not found");
  assert.equal(playerReportNote({ threatPath: "/report" }), null);
});

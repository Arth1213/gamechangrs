import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";

const componentPath = fileURLToPath(new URL("./GrizzliesMatchSchedule.tsx", import.meta.url));
let component;
function renderSchedule(fixtures = []) {
  assert.ok(existsSync(componentPath), "The approved upcoming/completed schedule component must exist");
  if (!component) {
    const bundle = buildSync({
      entryPoints: [componentPath], bundle: true, write: false, platform: "node", format: "cjs",
      jsx: "automatic", external: ["react", "react-dom", "react-router-dom"],
      alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
    });
    const compiled = { exports: {} };
    new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
    component = compiled.exports.GrizzliesMatchSchedule;
  }
  return renderToStaticMarkup(React.createElement(StaticRouter, { location: "/analytics/grizzlies/2026?tab=analysis" },
    React.createElement(component, { schedule: { fixtures, seriesConfigKey: "milc-2026", officialScheduleUrl: "https://cricclubs.com/MiLC/schedules" } })));
}

function fixture(matchId, startsAt, reportPath = null) {
  return { matchId, sourceMatchId: String(matchId), startsAt, dateLabel: startsAt, venue: null,
    homeTeam: "Silicon Valley Strikers", awayTeam: "San Ramon Grizzlies", divisionLabel: "West",
    status: "completed", resultText: "San Ramon Grizzlies won by 4 Wickets", scoreline: null,
    report: { status: reportPath ? "published" : "unavailable", path: reportPath } };
}

test("renders supplied playoff fixtures above completed games without inventing confirmed times or report links", () => {
  const html = renderSchedule();
  assert.ok(html.indexOf("Upcoming Games") < html.indexOf("Completed Games"));
  assert.ok(html.indexOf("Upcoming Games") < html.indexOf("West Division complete"));
  assert.ok(html.indexOf("West Division complete") < html.indexOf("Completed Games"));
  const upcoming = html.split('id="grizzlies-completed"')[0];
  for (const label of ["Oct 21, 2026", "Oct 22, 2026", "Oct 23, 2026", "Dallas Xforia Giants", "Baltimore Royals", "Manhattan Yorkers"]) assert.ok(upcoming.includes(label), label);
  assert.equal((upcoming.match(/PVCC 5/g) || []).length, 3);
  assert.equal((upcoming.match(/10:00\/15 AM/g) || []).length, 2);
  assert.ok(upcoming.includes("2:30/45 PM"));
  assert.match(upcoming, /unconfirmed/i);
  assert.doesNotMatch(upcoming, /href="[^"]*\/matches\//);
  assert.match(html, /4 wins, 0 losses/);
});

test("keeps both existing analysis and archived Strikers plan links inside completed games", () => {
  const html = renderSchedule([fixture(2375, "2026-09-19", "/analytics/grizzlies/2026/matches/2375"), fixture(2423, "2026-09-27")]);
  const completed = html.split('id="grizzlies-completed"')[1];
  assert.ok(completed.indexOf("Sep 27, 2026") < completed.indexOf("Sep 19, 2026"));
  assert.match(completed, /href="\/analytics\/grizzlies\/2026\/matches\/2375"/);
  assert.match(completed, /href="\/analytics\/grizzlies\/2026\/matches\/2375\?view=game-plan"/);
  assert.match(completed, /Archived Strikers game plan/);
  assert.doesNotMatch(html, /For the next meeting|Current and future West/);
  assert.doesNotMatch(completed, /href="[^"]*matches\/2423/);
});

test("renders every completed result without an artificial limit and keeps the service-failure empty state", () => {
  const html = renderSchedule(Array.from({ length: 12 }, (_, i) => fixture(2400 + i, `2026-09-${String(17 + i).padStart(2, "0")}`)));
  assert.equal((html.match(/San Ramon Grizzlies won by 4 Wickets/g) || []).length, 12);
  assert.match(renderSchedule(), /Completed results are currently unavailable/);
});

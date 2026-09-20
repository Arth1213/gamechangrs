import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as presentation from "./grizzliesMatchPresentation.js";

const { formatGrizzliesFixtureDate } = presentation;

test("formats date-only fixture values without leaking time or timezone text", () => {
  assert.equal(formatGrizzliesFixtureDate("2026-09-19"), "Sep 19, 2026");
  assert.equal(formatGrizzliesFixtureDate("2026-09-19T00:00:00.000Z"), "Sep 19, 2026");
  assert.equal(formatGrizzliesFixtureDate(""), "Date pending");
  assert.equal(formatGrizzliesFixtureDate("not-a-date"), "Date pending");
  assert.doesNotMatch(formatGrizzliesFixtureDate("2026-09-19T00:00:00.000Z"), /GMT|00:00:00|Coordinated Universal Time/);
});

test("formats the same calendar date in positive and negative UTC offsets", () => {
  const modulePath = fileURLToPath(new URL("./grizzliesMatchPresentation.js", import.meta.url));
  const script = `import { pathToFileURL } from "node:url"; const mod = await import(pathToFileURL(process.argv[1]).href); process.stdout.write(mod.formatGrizzliesFixtureDate("2026-09-19T00:00:00.000Z"));`;
  for (const timezone of ["Pacific/Honolulu", "Pacific/Kiritimati"]) {
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script, modulePath], {
      env: { ...process.env, TZ: timezone },
      encoding: "utf8",
    });
    assert.equal(output, "Sep 19, 2026", timezone);
  }
});

test("report source omits redundant hero labels", () => {
  const reportPath = fileURLToPath(new URL("../pages/AnalyticsGrizzliesMatchReport.tsx", import.meta.url));
  const source = fs.readFileSync(reportPath, "utf8");
  assert.doesNotMatch(source, />Match narrative</i);
  assert.doesNotMatch(source, />Scorecard snapshot</i);
  assert.doesNotMatch(source, />Match intelligence</i);
  assert.match(source, />The deciding story</i);
  assert.match(source, />Top performances</i);
});

test("report content is enclosed by a responsive gold perimeter frame", () => {
  const reportPath = fileURLToPath(new URL("../pages/AnalyticsGrizzliesMatchReport.tsx", import.meta.url));
  const source = fs.readFileSync(reportPath, "utf8");
  assert.match(source, /data-testid="grizzlies-report-frame"/);
  assert.match(source, /border-amber-300\/60/);
  assert.match(source, /shadow-\[0_0_0_1px_rgba\(251,191,36,0\.12\),0_0_36px_rgba\(245,158,11,0\.10\)\]/);
  assert.match(source, /p-3 sm:p-6 lg:p-8/);
});

test("formats the verified innings as compact hero score cards", () => {
  assert.equal(typeof presentation.formatGrizzliesMatchScores, "function");
  assert.deepEqual(presentation.formatGrizzliesMatchScores([
    { battingTeam: "East Bay Blazers", runs: 166, wickets: 7, legalBalls: 120 },
    { battingTeam: "Silicon Valley Strikers", runs: 167, wickets: 4, legalBalls: 114 },
  ]), [
    { teamName: "East Bay Blazers", score: "166/7", overs: "20.0 overs" },
    { teamName: "Silicon Valley Strikers", score: "167/4", overs: "19.0 overs" },
  ]);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { formatGrizzliesFixtureDate } from "./grizzliesMatchPresentation.js";

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
  assert.match(source, />The deciding story</i);
  assert.match(source, />Top performances</i);
});

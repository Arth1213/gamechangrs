import assert from "node:assert/strict";
import test from "node:test";
import { getGrizzliesReportContext } from "./grizzliesReportContext.js";

test("adds Grizzlies report context only for the 2026 NCCA series", () => {
  assert.deepEqual(
    getGrizzliesReportContext("bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a"),
    {
      backPath: "/analytics/grizzlies/2026",
      titlePrefix: "2026",
      titleAccent: "Grizzlies",
      titleSuffix: "Analytics",
    }
  );
  assert.equal(getGrizzliesReportContext("bay-area-usac-hub-2026"), null);
});

test("MiLC playoff player reports retain the Grizzlies portal return link", () => {
  const context = getGrizzliesReportContext("bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug", "grizzlies-2026");
  assert.equal(context?.backPath, "/analytics/grizzlies/2026");
  assert.equal(context?.titleAccent, "Grizzlies");
});

test("ordinary MiLC reports retain general Analytics navigation", () => {
  const key = "bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug";
  assert.equal(getGrizzliesReportContext(key), null);
  assert.equal(getGrizzliesReportContext(key, "other"), null);
});

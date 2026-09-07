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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./GrizzliesPlayoffCalculator.tsx", import.meta.url), "utf8");

test("makes the required SVS chase time the primary Grizzlies-first result", () => {
  assert.match(source, /SVS chase time/);
  assert.match(source, /result\.minimumSiliconValleyOvers/);
  assert.doesNotMatch(source, /Uses the current aggregate totals through the latest table/);
});

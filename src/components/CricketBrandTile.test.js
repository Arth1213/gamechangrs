import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tileSource = readFileSync(new URL("./CricketBrandTile.tsx", import.meta.url), "utf8");

test("CricketBrandTile uses the versioned crisp GameChangrs icon", () => {
  assert.match(tileSource, /src="\/brand\/gamechangrs-icon-crisp\.png"/);
  assert.doesNotMatch(tileSource, /gamechangrs-cricket-analytics-logo-v2\.png\.asset\.json/);
});

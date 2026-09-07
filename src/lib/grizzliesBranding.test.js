import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { grizzliesPoweredBy } from "./grizzliesBranding.js";

const grizzliesPageSource = readFileSync(new URL("../pages/AnalyticsGrizzlies2026.tsx", import.meta.url), "utf8");

test("renders Powered by GameChangrs without a gap inside the brand name", () => {
  assert.equal(grizzliesPoweredBy.prefix, "Powered by Game");
  assert.equal(grizzliesPoweredBy.accent, "Changrs");
  assert.match(grizzliesPageSource, /\{grizzliesPoweredBy\.prefix\}<\/span><span className="text-gradient-primary">/);
});

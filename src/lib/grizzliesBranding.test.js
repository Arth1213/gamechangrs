import assert from "node:assert/strict";
import test from "node:test";
import { grizzliesPoweredBy } from "./grizzliesBranding.js";

test("uses the navbar logo word split for the Grizzlies powered-by label", () => {
  assert.equal(grizzliesPoweredBy.prefix, "Powered by Game");
  assert.equal(grizzliesPoweredBy.accent, "Changrs");
});

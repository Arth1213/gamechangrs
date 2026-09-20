import test from "node:test";
import assert from "node:assert/strict";
import { tacticalActionBullets } from "./grizzliesTacticalPresentation.js";

test("tactical cards lead with two short action bullets without breaking decimal figures", () => {
  assert.deepEqual(tacticalActionBullets("Use Ayan against Saideep. Adnesh is the alternative (3.5 overs). Reassess the sample."), [
    "Use Ayan against Saideep.", "Adnesh is the alternative (3.5 overs).",
  ]);
  assert.deepEqual(tacticalActionBullets(""), []);
});

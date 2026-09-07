import assert from "node:assert/strict";
import test from "node:test";
import { assessmentButtonClass, squadActionOrder } from "./grizzliesSquadActions.js";

test("places Threat before gold-outline Assessment in squad intelligence", () => {
  assert.deepEqual(squadActionOrder, ["threat", "assessment"]);
  assert.match(assessmentButtonClass, /border-amber-400/);
  assert.match(assessmentButtonClass, /text-white/);
  assert.match(assessmentButtonClass, /bg-transparent/);
});

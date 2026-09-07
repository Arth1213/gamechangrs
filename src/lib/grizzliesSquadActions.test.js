import assert from "node:assert/strict";
import test from "node:test";
import { assessmentButtonClass, squadActionOrder } from "./grizzliesSquadActions.js";

test("places Threat before neutral-outline Assessment in squad intelligence", () => {
  assert.deepEqual(squadActionOrder, ["threat", "assessment"]);
  assert.match(assessmentButtonClass, /border-border/);
  assert.doesNotMatch(assessmentButtonClass, /amber/);
  assert.match(assessmentButtonClass, /text-white/);
  assert.match(assessmentButtonClass, /bg-transparent/);
});

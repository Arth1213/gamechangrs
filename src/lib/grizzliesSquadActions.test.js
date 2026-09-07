import assert from "node:assert/strict";
import test from "node:test";
import { assessmentButtonClass, squadActionOrder } from "./grizzliesSquadActions.js";

test("places Threat before visible light-neutral Assessment in squad intelligence", () => {
  assert.deepEqual(squadActionOrder, ["threat", "assessment"]);
  assert.match(assessmentButtonClass, /border-white\/45/);
  assert.doesNotMatch(assessmentButtonClass, /amber/);
  assert.match(assessmentButtonClass, /text-white/);
  assert.match(assessmentButtonClass, /bg-transparent/);
  assert.match(assessmentButtonClass, /hover:bg-white\/10/);
});

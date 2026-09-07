import assert from "node:assert/strict";
import test from "node:test";
import { assessmentButtonClass, squadActionOrder, threatButtonClass } from "./grizzliesSquadActions.js";

test("renders Assessment as a neutral filled button", () => {
  assert.deepEqual(squadActionOrder, ["threat", "assessment"]);
  assert.match(assessmentButtonClass, /border-white\/60/);
  assert.doesNotMatch(assessmentButtonClass, /amber/);
  assert.match(assessmentButtonClass, /text-white/);
  assert.match(assessmentButtonClass, /bg-slate-700/);
  assert.match(assessmentButtonClass, /shadow/);
});

test("renders Threat as a colored button with a visible white outline", () => {
  for (const tone of ["red", "amber", "green", "unknown"]) {
    const className = threatButtonClass(tone);
    assert.match(className, /border-white\/70/);
    assert.match(className, /shadow/);
    assert.match(className, /text-white/);
  }
  assert.match(threatButtonClass("red"), /bg-red-500\/25/);
  assert.match(threatButtonClass("amber"), /bg-amber-400\/20/);
  assert.match(threatButtonClass("green"), /bg-emerald-500\/20/);
});

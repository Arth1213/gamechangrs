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

test("renders Threat with a severity-colored outline and label", () => {
  const red = threatButtonClass("red");
  assert.match(red, /border-red-400\/85/);
  assert.match(red, /text-red-200/);
  assert.match(red, /bg-red-500\/25/);
  assert.match(red, /hover:bg-red-500\/45/);
  assert.match(red, /hover:text-white/);

  const amber = threatButtonClass("amber");
  assert.match(amber, /border-amber-300\/85/);
  assert.match(amber, /text-amber-200/);
  assert.match(amber, /bg-amber-400\/20/);
  assert.match(amber, /hover:bg-amber-400\/40/);
  assert.match(amber, /hover:text-white/);

  const green = threatButtonClass("green");
  assert.match(green, /border-emerald-300\/85/);
  assert.match(green, /text-emerald-200/);
  assert.match(green, /bg-emerald-500\/20/);
  assert.match(green, /hover:bg-emerald-500\/40/);
  assert.match(green, /hover:text-white/);

  assert.match(threatButtonClass("unknown"), /border-emerald-300\/85/);
});

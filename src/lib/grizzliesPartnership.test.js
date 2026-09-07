import assert from "node:assert/strict";
import test from "node:test";
import { grizzliesPartnership } from "./grizzliesPartnership.js";

test("publishes the approved Grizzlies partnership statement", () => {
  assert.equal(grizzliesPartnership.prefix, "Official Analytics Partner of the");
  assert.equal(grizzliesPartnership.teamName, "Grizzlies");
  assert.equal(grizzliesPartnership.logoSrc, "/grizzlies-2026-logo.png");
  assert.equal(grizzliesPartnership.websiteUrl, "https://grizzlies.us");
});

"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { requireGrizzliesPortalAccess } = require("../src/lib/auth");
const { getThreatTone } = require("../src/services/grizzliesPortalService");

test("Grizzlies portal accepts an approved Gmail address regardless of casing", async () => {
  const req = { cricketActor: { userId: "user-1", email: "NIRAVSH@GMAIL.COM" } };
  const actor = await requireGrizzliesPortalAccess(req);
  assert.equal(actor.email, "niravsh@gmail.com");
});

test("portal threat colors use persisted league-wide tiers and the evidence gate", () => {
  assert.equal(getThreatTone({ leaguePercentileRank: 85, totalMatches: 3 }), "red");
  assert.equal(getThreatTone({ leaguePercentileRank: 99, totalMatches: 2 }), "amber");
  assert.equal(getThreatTone({ leaguePercentileRank: 60, totalMatches: 1 }), "amber");
  assert.equal(getThreatTone({ leaguePercentileRank: 59.99, totalMatches: 8 }), "green");
  assert.equal(getThreatTone(null), "unknown");
});

test("Grizzlies portal rejects authenticated users outside the allow-list", async () => {
  await assert.rejects(
    () => requireGrizzliesPortalAccess({ cricketActor: { userId: "user-2", email: "other@example.com" } }),
    { message: "You do not have access to Grizzlies 2026 Analytics.", statusCode: 403 }
  );
});

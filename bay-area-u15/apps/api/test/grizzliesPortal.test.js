"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { requireGrizzliesPortalAccess } = require("../src/lib/auth");
const { getGrizzliesPortalPayload } = require("../src/services/grizzliesPortalService");

test("Grizzlies portal accepts an approved Gmail address regardless of casing", async () => {
  const req = { cricketActor: { userId: "user-1", email: "NIRAVSH@GMAIL.COM" } };
  const actor = await requireGrizzliesPortalAccess(req);
  assert.equal(actor.email, "niravsh@gmail.com");
});

test("portal payload keeps unresolved players unlinked", () => {
  const payload = getGrizzliesPortalPayload();
  const player = payload.teams.flatMap((team) => team.players).find((item) => item.name === "Carmi Le Roux");
  assert.equal(player.nccaStatus, "not_found");
  assert.equal(player.assessmentPath, null);
  assert.equal(player.threatPath, null);
});

test("Grizzlies portal rejects authenticated users outside the allow-list", async () => {
  await assert.rejects(
    () => requireGrizzliesPortalAccess({ cricketActor: { userId: "user-2", email: "other@example.com" } }),
    { message: "You do not have access to Grizzlies 2026 Analytics.", statusCode: 403 }
  );
});

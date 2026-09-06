"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { requireGrizzliesPortalAccess } = require("../src/lib/auth");

test("Grizzlies portal accepts an approved Gmail address regardless of casing", async () => {
  const req = { cricketActor: { userId: "user-1", email: "NIRAVSH@GMAIL.COM" } };
  const actor = await requireGrizzliesPortalAccess(req);
  assert.equal(actor.email, "niravsh@gmail.com");
});

test("Grizzlies portal rejects authenticated users outside the allow-list", async () => {
  await assert.rejects(
    () => requireGrizzliesPortalAccess({ cricketActor: { userId: "user-2", email: "other@example.com" } }),
    { message: "You do not have access to Grizzlies 2026 Analytics.", statusCode: 403 }
  );
});

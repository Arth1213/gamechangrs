"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createCanonicalPlayerResolver,
} = require("../src/ops/playerIdentityOverrides");

test("canonical resolver merges Husnain scorecard IDs into the approved profile identity", () => {
  const resolvePlayerId = createCanonicalPlayerResolver({
    identityClusters: [{ canonicalPlayerId: 8174, sourcePlayerIds: [8130, 8349, 8174] }],
  });

  assert.equal(resolvePlayerId(8130), 8174);
  assert.equal(resolvePlayerId(8349), 8174);
  assert.equal(resolvePlayerId(8174), 8174);
});

test("canonical resolver keeps unconfigured source IDs separate", () => {
  const resolvePlayerId = createCanonicalPlayerResolver({ identityClusters: [] });

  assert.equal(resolvePlayerId(9999), 9999);
});

test("canonical resolver refuses source IDs assigned to two identities", () => {
  assert.throws(
    () => createCanonicalPlayerResolver({
      identityClusters: [
        { canonicalPlayerId: 8174, sourcePlayerIds: [8130] },
        { canonicalPlayerId: 4077, sourcePlayerIds: [8130] },
      ],
    }),
    /Duplicate canonical identity source player ID: 8130/
  );
});

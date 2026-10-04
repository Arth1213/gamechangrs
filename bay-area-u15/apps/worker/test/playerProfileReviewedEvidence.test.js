const assert = require("node:assert/strict");
const test = require("node:test");
const db = require("../src/lib/db");

const wrongProfile = {
  playerId: 9345,
  found: true,
  displayName: "Harmeet Singh",
  html: "<main>Fresh public profile</main>",
  normalized: {
    primaryRole: "All Rounder",
    primaryRoleBucket: "all_rounder",
    battingStyle: "Right Handed Batter",
    battingHand: "right",
    battingStyleBucket: "right_hand_batter",
    bowlingStyle: "Right Arm Medium",
    bowlingArm: "right",
    bowlingStyleBucket: "right_arm_pace",
    bowlingStyleDetail: "right_arm_medium",
  },
};

async function captureRepositoryCall(method, input) {
  const calls = [];
  const client = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.includes("from public.series_source_config")) {
      return { rows: [{ series_source_config_id: 1, config_key: "test-season", series_id: 16 }] };
    }
    if (sql.includes("with series_players")) {
      return { rows: [{ target_player_id: 9345, target_name: "Harmeet Singh", candidate_player_id: 99,
        candidate_name: "Harmeet Singh", batting_style: "Right Handed Batter", bowling_style: "Right Arm Medium" }] };
    }
    return { rows: sql.includes("update public.player") ? [{ id: 9345 }] : [] };
  } };
  const mock = test.mock.method(db, "withClient", async work => work(client));
  const modulePath = require.resolve("../src/load/repository");
  delete require.cache[modulePath];
  try {
    const result = await require(modulePath)[method](input);
    return { calls, result };
  } finally {
    mock.mock.restore();
    delete require.cache[modulePath];
  }
}

function assignment(sql, column) {
  const match = sql.match(new RegExp(`\\b${column} = case([\\s\\S]*?)\\bend,`));
  assert.ok(match, `${column} must be conditionally updated`);
  return match[1].replace(/\s+/g, " ").trim();
}

// Removing a guard, using the incoming value first, or coalescing an existing NULL
// with a fetched style must fail this SQL-boundary contract.
test("refresh atomically preserves all seven reviewed style columns, including NULLs", async () => {
  const { calls, result } = await captureRepositoryCall("persistPlayerProfileEnrichment", { playerId: 9345, profile: wrongProfile });
  const writes = calls.filter(call => call.sql.includes("update public.player"));
  assert.equal(writes.length, 1);
  assert.deepEqual(result, { id: 9345 });
  const { sql, params } = writes[0];
  for (const [column, parameter] of [
    ["batting_style", 3], ["bowling_style", 4], ["batting_hand", 6],
    ["batting_style_bucket", 7], ["bowling_arm", 8],
    ["bowling_style_bucket", 9], ["bowling_style_detail", 10],
  ]) {
    const clause = assignment(sql, column);
    assert.ok(clause.startsWith(`when nullif(btrim(public_profile_snapshot #>> '{styleEvidence,reviewedAt}'), '') is not null then ${column} `), `${column}: existing value, even NULL, must win only for a nonblank review marker`);
    assert.ok(clause.includes(`when $${parameter}::text is not null then $${parameter}::text`), `${column}: unreviewed refresh must retain its incoming-value branch`);
    assert.ok(clause.endsWith(`else ${column}`));
  }
  assert.equal(params[0], 9345);
  assert.equal(params[2], "Right Handed Batter");
  assert.equal(params[3], "Right Arm Medium");
  assert.equal(calls.filter(call => /^\s*select\b/i.test(call.sql)).length, 0, "protection must not depend on a stale preliminary read");
});

// Replacing the cache wholesale or letting incoming evidence overwrite the review
// must fail, while roles, HTML and the rest of the fresh snapshot remain writable.
test("refresh retains reviewed provenance while updating roles and other public cache fields", async () => {
  const incoming = { ...wrongProfile, styleEvidence: { reviewedAt: "replacement", notes: "untrusted refresh" } };
  const { calls } = await captureRepositoryCall("persistPlayerProfileEnrichment", { playerId: 9345, profile: incoming });
  const { sql, params } = calls.find(call => call.sql.includes("update public.player"));
  const snapshot = assignment(sql, "public_profile_snapshot");
  assert.ok(snapshot.startsWith("when nullif(btrim(public_profile_snapshot #>> '{styleEvidence,reviewedAt}'), '') is not null then"));
  assert.match(snapshot, /coalesce\(\$11::jsonb, public_profile_snapshot\) \|\| jsonb_build_object\('styleEvidence', public_profile_snapshot -> 'styleEvidence'\)/);
  assert.ok(snapshot.endsWith("else coalesce($11::jsonb, public_profile_snapshot)"));
  for (const column of ["primary_role", "primary_role_bucket"]) assert.doesNotMatch(assignment(sql, column), /styleEvidence/);
  assert.match(sql, /public_profile_html = coalesce\(nullif\(\$12, ''\), public_profile_html\)/);
  assert.match(sql, /profile_last_enriched_at = now\(\)/);
  assert.equal(params[1], "All Rounder");
  assert.equal(params[11], "<main>Fresh public profile</main>");
  assert.equal(JSON.parse(params[10]).html, undefined);
  assert.equal(JSON.parse(params[10]).found, true);
});

// Candidate filtering alone is insufficient: a reviewed update can race the
// selection, so the final name-backfill UPDATE must recheck the stored marker.
test("name backfill excludes reviewed targets both during selection and at the atomic update", async () => {
  const { calls } = await captureRepositoryCall("backfillSeriesPlayerProfilesFromKnownPlayers", "test-season");
  const selection = calls.find(call => call.sql.includes("with series_players"));
  const update = calls.find(call => call.sql.includes("update public.player"));
  assert.match(selection.sql, /nullif\(btrim\(p\.public_profile_snapshot #>> '\{styleEvidence,reviewedAt\}'\), ''\) is null/);
  assert.match(update.sql, /where id = \$1\s+and nullif\(btrim\(public_profile_snapshot #>> '\{styleEvidence,reviewedAt\}'\), ''\) is null/);
  assert.deepEqual(selection.params, [16]);
  assert.equal(update.params[0], 9345);
});

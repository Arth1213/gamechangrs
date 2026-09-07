import assert from "node:assert/strict";
import test from "node:test";
import { grizzliesWelcome } from "./grizzliesWelcome.js";

test("uses the authenticated profile name in the Grizzlies welcome", () => {
  assert.equal(
    grizzliesWelcome({ user_metadata: { full_name: "Arth Arun" }, email: "helloarth09@gmail.com" }),
    "Welcome Arth Arun to the 2026 Grizzlies Season.",
  );
});

test("uses the email name when an authenticated profile name is unavailable", () => {
  assert.equal(
    grizzliesWelcome({ user_metadata: {}, email: "samirnshah@gmail.com" }),
    "Welcome samirnshah to the 2026 Grizzlies Season.",
  );
});

test("keeps the generic welcome for signed-out visitors", () => {
  assert.equal(grizzliesWelcome(null), "Welcome to the 2026 Grizzlies Season.");
});

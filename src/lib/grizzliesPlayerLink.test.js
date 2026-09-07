import assert from "node:assert/strict";
import test from "node:test";
import { cricclubsPlayerNameHref } from "./grizzliesPlayerLink.js";

test("uses the matched CricClubs profile as the player-name link", () => {
  assert.equal(
    cricclubsPlayerNameHref({ cricclubsProfileUrl: "https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=1" }),
    "https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=1",
  );
});

test("keeps unmatched player names non-clickable", () => {
  assert.equal(cricclubsPlayerNameHref({ cricclubsProfileUrl: null }), null);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageRoot = new URL("../src/arth-profile/pages/", import.meta.url);

test("Wharton Moneyball has a routed profile page with all supplied artifacts", async () => {
  const [runtime, page] = await Promise.all([
    readFile(new URL("../src/arth-profile/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("moneyball.html", pageRoot), "utf8"),
  ]);

  assert.match(runtime, /import moneyballHtml from "\.\/pages\/moneyball\.html\?raw";/);
  assert.match(runtime, /"\/arth\/moneyball\.html": moneyballHtml,/);
  assert.match(page, /Wharton Moneyball Experience/);
  assert.match(page, /Arth-Wharton-Moneyball-Certificate\.pdf/);
  assert.match(page, /Arth-Wharton-Moneyball Final Presentation\.pdf/);
  assert.match(page, /Arth-Wharton-Moneyball Final Presentation\.pptx/);
  assert.match(page, /Arth-Wharton-Image-20260808_105223\.jpg/);
});

test("the profile home and academics archive link to Wharton Moneyball", async () => {
  const [index, academics] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("academics.html", pageRoot), "utf8"),
  ]);

  assert.match(index, /Completed the Wharton Moneyball Experience/);
  assert.match(index, /href="\.\/moneyball\.html"/);
  assert.match(academics, /Wharton Moneyball Experience/);
  assert.match(academics, /href="\.\/moneyball\.html"/);
});

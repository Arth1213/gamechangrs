import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const pageRoot = new URL("../src/arth-profile/pages/", import.meta.url);
const publicProfileRoot = new URL("../public/arth/", import.meta.url);

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

  assert.match(index, /Wharton Moneyball Experience/);
  assert.match(index, /href="\.\/moneyball\.html"/);
  assert.match(academics, /Wharton Moneyball Experience/);
  assert.match(academics, /href="\.\/moneyball\.html"/);
});

test("the production-served Arth pages include the Wharton profile update", async () => {
  const [index, academics, moneyball] = await Promise.all([
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
    readFile(new URL("academics.html", publicProfileRoot), "utf8"),
    readFile(new URL("moneyball.html", publicProfileRoot), "utf8"),
  ]);

  assert.match(index, /Wharton Moneyball Experience/);
  assert.match(index, /href="\.\/moneyball\.html"/);
  assert.match(academics, /Wharton Moneyball Experience/);
  assert.match(academics, /href="\.\/moneyball\.html"/);
  assert.match(moneyball, /Arth-Wharton-Moneyball-Certificate\.pdf/);
});

test("the Program Completion card displays a certificate thumbnail", async () => {
  const [moneyball] = await Promise.all([
    readFile(new URL("moneyball.html", publicProfileRoot), "utf8"),
    access(new URL("assets/accomp-thumbs/moneyball/arth-wharton-moneyball-certificate.png", publicProfileRoot)),
  ]);

  assert.match(moneyball, /src="\.\/assets\/accomp-thumbs\/moneyball\/arth-wharton-moneyball-certificate\.png"/);
  assert.match(moneyball, /alt="Wharton Moneyball Experience completion certificate"/);
});

test("the Signals Wharton Moneyball link opens the internal program archive", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    const signals = index.slice(index.indexOf('<h2>Signals</h2>'), index.indexOf('id="accomplishments"'));
    assert.match(signals, /href="\.\/moneyball\.html"/);
    assert.doesNotMatch(signals, /globalyouth\.wharton\.upenn\.edu/);
  }
});

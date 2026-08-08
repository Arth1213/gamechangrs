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

  assert.match(index, /Wharton Moneyball/);
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

  assert.match(index, /Wharton Moneyball/);
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

test("the Wharton Moneyball signal opens the internal program archive", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    const signals = index.slice(index.indexOf('class="signal-ribbon"'), index.indexOf('id="about"'));
    assert.match(signals, /href="\.\/moneyball\.html"/);
    assert.doesNotMatch(signals, /globalyouth\.wharton\.upenn\.edu/);
  }
});

test("the Portfolio groups Wharton Moneyball under Academics instead of a standalone card", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    const portfolio = index.slice(index.indexOf('id="accomplishments"'), index.indexOf('id="contact"'));
    assert.match(portfolio, /Wharton, Berkeley, coursework, certificates/);
    assert.doesNotMatch(portfolio, /<span>Wharton Moneyball<\/span>/);
  }
});

test("the main profile distinguishes completed APs from APs being pursued", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    assert.match(index, /Completed APs/);
    assert.match(index, /AP Chem, AP World, AP Calc AB/);
    assert.match(index, /Current APs/);
    assert.match(index, /AP Computer Science, AP US History, AP Psychology, AP Calc BC/);
  }
});

test("the main profile identifies Arth as a junior", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    assert.match(index, /Junior at DVHS/);
    assert.doesNotMatch(index, /Sophomore at DVHS|a sophomore at DVHS/i);
  }
});

test("the homepage hero uses the updated Arth portrait", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
    access(new URL("assets/arth-headshot-20260808.png", publicProfileRoot)),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    assert.match(index, /src="\.\/assets\/arth-headshot-20260808\.png"/);
  }
});

test("the homepage uses the editorial hero and compact signal ribbon", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    assert.match(index, /class="hero-intro"/);
    assert.match(index, /class="signal-ribbon"/);
    assert.match(index, /Wharton Moneyball/);
    assert.match(index, /Berkeley M\.E\.T\. Innovation Academy/);
    assert.doesNotMatch(index, /class="hero-signals"|class="focus-panel"/);
  }
});

test("the homepage presents compact Portfolio sections without numeric rails", async () => {
  const [sourceIndex, publicIndex] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    const journey = index.slice(index.indexOf('id="journey"'), index.indexOf('id="accomplishments"'));
    const portfolio = index.slice(index.indexOf('id="accomplishments"'), index.indexOf('id="contact"'));

    assert.match(index, /<a href="#accomplishments">Portfolio<\/a>/);
    assert.match(portfolio, /<h2>Portfolio<\/h2>/);
    assert.match(index, /class="about-copy-grid"/);
    assert.match(index, /class="journey-card-grid"/);
    assert.match(journey, /href="\.\/moneyball\.html"/);
    assert.match(journey, /href="\.\/berkeley-metia\.html"/);
    assert.match(portfolio, /href="\.\/scouts\.html"/);
    assert.match(portfolio, /href="\.\/others\.html"/);
    assert.doesNotMatch(index, /01\s*\//);
    assert.doesNotMatch(index, /02\s*\//);
    assert.doesNotMatch(index, /03\s*\//);
  }
});

test("the homepage uses a tighter portrait crop and supplied signal marks", async () => {
  const [sourceIndex, publicIndex, styles] = await Promise.all([
    readFile(new URL("index.html", pageRoot), "utf8"),
    readFile(new URL("index.html", publicProfileRoot), "utf8"),
    readFile(new URL("styles.css", publicProfileRoot), "utf8"),
  ]);

  for (const index of [sourceIndex, publicIndex]) {
    const signals = index.slice(index.indexOf('class="signal-ribbon"'), index.indexOf('id="about"'));
    assert.match(signals, /assets\/brand\/wharton-shield\.png/);
    assert.match(signals, /assets\/brand\/berkeley-b\.png/);
    assert.match(signals, /gamechangrs-hex-ball-mark\.webp/);
    assert.match(signals, /class="signal-mark" alt=""/);
  }

  assert.match(styles, /\.portrait-frame img\s*\{[^}]*transform:\s*scale\(/s);
  assert.match(styles, /\.signal-mark\s*\{/);
});

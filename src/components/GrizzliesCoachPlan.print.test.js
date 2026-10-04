import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '../../bay-area-u15/node_modules/playwright/index.mjs';

const componentPath = fileURLToPath(new URL('./GrizzliesCoachPlan.tsx', import.meta.url));
const output = buildSync({ entryPoints: [componentPath], bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', external: ['react', 'react-dom'], loader: { '.css': 'empty' }, alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const card = { title: 'Bowler to batter', trigger: 'Powerplay', confidence: 'Phase-based trial', actions: ['Use one over.'], evidence: '12 balls reviewed.', sourceIds: ['one'] };
const plan = {
  schemaVersion: 1, version: 'print-test', updatedThrough: '2026-10-04', opponent: 'Dallas Xforia Giants', headline: 'Use the new ball', boundaryMatch: 'Latest full T20', boundarySourceId: 'one',
  phases: [{ name: 'Powerplay', overs: '1-6', boundaries: 8, legalBalls: 36, cue: 'First spell' }, { name: 'Middle', overs: '7-15', boundaries: 7, legalBalls: 54, cue: 'Change' }, { name: 'Death', overs: '16-20', boundaries: 2, legalBalls: 11, cue: 'Finish' }],
  sections: ['Who bowls to whom', 'Break the partnership', 'Batting decisions'].map(title => ({ title, cards: [card] })),
  sources: [{ id: 'one', label: 'Scorecard', detail: 'Reviewed data' }], limitations: ['Confirm XI.'],
};
let browser;
let page;
let utilityCSS;
before(async () => {
  const css = await postcss([tailwindcss({
    config: fileURLToPath(new URL('../../tailwind.config.ts', import.meta.url)),
    content: [{ raw: readFileSync(componentPath, 'utf8'), extension: 'tsx' }],
  })]).process('@tailwind base; @tailwind utilities;', { from: undefined });
  utilityCSS = css.css;
  const reportCSS = readFileSync(new URL('../styles/grizzliesCoachPlan.css', import.meta.url), 'utf8');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.setContent(`<style>${css.css}\n${reportCSS}</style><body style="color:#f3f4f6;background:#0e1014"><main>${renderToStaticMarkup(React.createElement(compiled.exports.GrizzliesCoachPlan, { plan }))}</main></body>`);
  await page.emulateMedia({ media: 'print' });
});
after(async () => { await browser?.close(); });

test('printed report retains dark surfaces and readable light text', async () => {
  const styles = await page.locator('.grizzlies-coach-plan, .gcp-phase-card, .gcp-decision-card').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return { background: style.backgroundColor, color: style.color, adjust: style.printColorAdjust };
  }));
  for (const style of styles) {
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    assert.ok(rgb(style.background).every(channel => channel < 80), `Print surface became light: ${style.background}`);
    assert.ok(rgb(style.color).every(channel => channel > 200), `Print text became dark: ${style.color}`);
    assert.equal(style.adjust, 'exact');
  }
});

test('printed sections flow without forced page skips while individual cards stay together', async () => {
  const breaks = await page.locator('.gcp-decision-section').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).breakBefore));
  assert.deepEqual(breaks, ['auto', 'auto', 'auto']);
  const cards = await page.locator('.gcp-decision-card').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).breakInside));
  assert.ok(cards.every(value => value === 'avoid'));
  assert.equal(await page.locator('.gcp-print-button').isVisible(), false);
});

test('the evidence appendix stays on screen and never prints, even when expanded', async () => {
  await page.emulateMedia({ media: 'screen' });
  await page.locator('.gcp-screen-evidence summary').click();
  assert.equal(await page.locator('.gcp-screen-evidence .gcp-source').isVisible(), true);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.gcp-source:visible, .gcp-limits:visible, .gcp-version:visible').count(), 0);
  assert.equal(await page.locator('.gcp-card-evidence').first().isVisible(), true);
});

test('late app utility CSS cannot inflate printed cards and force extra pages', async () => {
  const layout = () => page.locator('.gcp-phase-card, .gcp-decision-card, .gcp-card-evidence').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return { font: style.fontSize, line: style.lineHeight, padding: style.padding, margin: style.margin, border: style.borderWidth };
  }));
  const expected = await layout();
  await page.addStyleTag({ content: utilityCSS });
  assert.deepEqual(await layout(), expected);
});

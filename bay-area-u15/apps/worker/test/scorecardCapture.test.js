const assert = require("node:assert/strict");
const test = require("node:test");
const { chromium } = require("playwright");
const { captureScorecard } = require("../src/extract/matchDetail");

test("scorecard capture preserves non-anchor player IDs embedded in modern table row keys", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<h2>Strikers Innings</h2><table><tr><th>Batter</th></tr><tr data-row-key="bat-2-aPcCEWPWFTirk5mtFeLaJg"><td>Bilal Basheer not out</td><td>48</td></tr></table>');
    const raw = await captureScorecard(page);
    assert.equal(raw.tables[0].rows[1].rowKey, "bat-2-aPcCEWPWFTirk5mtFeLaJg");
    assert.equal(raw.tables[0].rows[1].cells[0].text, "Bilal Basheer not out");
  } finally { await browser.close(); }
});

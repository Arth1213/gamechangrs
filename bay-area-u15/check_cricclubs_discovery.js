const { chromium } = require('playwright');

(async() => {
  const url = 'https://cricclubs.com/USACricketJunior/series-list/uMgpWfOUngCk4uXJEGyssQ?divisionId=Bo-G1A7_UwgUN13_EOMC7g%3Fyear%3Dundefined&seriesName=2026%2520Bay%2520Area%2520USAC%2520Hub';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const title = await page.title();
  const finalUrl = page.url();
  const text = await page.locator('body').innerText();
  const links = await page.locator('a').evaluateAll(els => els.map(a => ({ text: (a.innerText || '').trim(), href: a.href })).filter(x => x.href));
  console.log(JSON.stringify({
    title,
    finalUrl,
    textSample: text.slice(0, 4000),
    linkCount: links.length,
    links: links.slice(0, 200)
  }, null, 2));
  await browser.close();
})();

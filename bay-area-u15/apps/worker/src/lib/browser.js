const { chromium } = require("playwright");

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function withBrowser(task) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  try {
    return await task(context);
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = {
  withBrowser,
  DEFAULT_USER_AGENT,
};

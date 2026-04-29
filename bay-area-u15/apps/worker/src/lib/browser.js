const { chromium } = require("playwright");

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

async function withBrowser(task, options = {}) {
  const browser = await chromium.launch({
    headless: options.headless !== undefined ? options.headless : true,
    slowMo: Number.isFinite(options.slowMo) ? options.slowMo : 0,
  });
  const context = await browser.newContext({
    userAgent: options.userAgent || DEFAULT_USER_AGENT,
    viewport: options.viewport || { width: 1440, height: 1080 },
  });
  try {
    return await task(context, browser);
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = {
  withBrowser,
  DEFAULT_USER_AGENT,
};

const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require(path.resolve(
  __dirname,
  "../bay-area-u15/node_modules/playwright"
));

async function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3];
  const htmlPath = inputArg
    ? path.resolve(process.cwd(), inputArg)
    : path.resolve(__dirname, "../docs/GAMECHANGRS_SYSTEM_MAP_CURRENT.html");
  const pdfPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(__dirname, "../docs/GAMECHANGRS_SYSTEM_MAP_CURRENT.pdf");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 940,
    },
    deviceScaleFactor: 1.5,
  });

  await page.goto(pathToFileURL(htmlPath).href, {
    waitUntil: "networkidle",
  });

  await page.pdf({
    path: pdfPath,
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
    scale: 0.78,
    margin: {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    },
  });

  await browser.close();
  process.stdout.write(`${pdfPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

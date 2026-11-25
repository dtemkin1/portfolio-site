// Prints the built /cv/ page to dist/cv.pdf with the installed Google Chrome, after `astro build`.
/* global URL, console, document */
import { fileURLToPath } from "node:url";

import { preview } from "astro";
import { chromium } from "playwright-core";

const out = fileURLToPath(new URL("../dist/cv.pdf", import.meta.url));

const server = await preview({ logLevel: "error" });
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" }).catch((cause) => {
    throw new Error(
      "Printing the CV needs Google Chrome installed (Playwright looks for it in the usual place).",
      { cause },
    );
  });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.port}/cv/`, {
    waitUntil: "networkidle",
  });
  // the PDF would otherwise fall back to a system font if Overpass is still loading
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: out, preferCSSPageSize: true });
  console.log("Printed the CV to dist/cv.pdf");
} finally {
  await browser?.close();
  await server.stop();
}

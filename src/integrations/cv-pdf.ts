import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { type AstroIntegration, preview } from "astro";
import { chromium } from "playwright-core";

// After `astro build`, prints the built /cv/ page to cv.pdf with the installed Google Chrome.
export default function cvPdf(): AstroIntegration {
  let root: URL;
  return {
    name: "cv-pdf",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = config.root;
      },
      "astro:build:done": async ({ dir, logger }) => {
        const server = await preview({
          root: fileURLToPath(root),
          logLevel: "error",
        });
        let browser;
        try {
          browser = await chromium
            .launch({ channel: "chrome" })
            .catch((cause) => {
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
          const pdf = await page.pdf({ preferCSSPageSize: true });
          await writeFile(new URL("cv.pdf", dir), pdf);
          logger.info("Printed the CV to cv.pdf");
        } finally {
          await browser?.close();
          await server.stop();
        }
      },
    },
  };
}

import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import { COLORS, pageTitle } from "./site";

test("the copied colors match the global.css tokens", () => {
  const css = readFileSync(
    new URL("../styles/global.css", import.meta.url),
    "utf8",
  );
  for (const [name, value] of Object.entries(COLORS)) {
    expect(css).toContain(`--${name}: ${value};`);
  }
});

test("page titles end with the name, and the home page is just the name", () => {
  expect(pageTitle("About")).toBe("About | Diego Temkin");
  expect(pageTitle()).toBe("Diego Temkin");
});

import { expect, test } from "vitest";

import { projectCard, shortDescription, titleSize } from "./card";

test("long titles get smaller type", () => {
  expect(titleSize("U.S. DOT Volpe Center")).toBe(64);
  expect(titleSize("JTL-Transit Lab: K-12 Student Ridership")).toBe(52);
  expect(titleSize("A".repeat(60))).toBeLessThan(52);
});

test("a long description is cut at a word", () => {
  const text =
    "Built validation pipelines for the Work Zone Data Exchange, ".repeat(5);
  const short = shortDescription(text);
  expect(short.length).toBeLessThanOrEqual(171);
  expect(short).toMatch(/[a-z]…$/);
  expect(shortDescription("Short.")).toBe("Short.");
});

test("the card shows the title, time, and description", () => {
  const card = JSON.stringify(
    projectCard({ title: "WMATA", when: "Aug 2025", description: "Rail." }),
  );
  for (const text of ["Diego Temkin", "WMATA", "Aug 2025", "Rail."]) {
    expect(card).toContain(text);
  }
});

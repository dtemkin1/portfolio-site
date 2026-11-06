import { expect, test } from "vitest";

import { hasPage, onHomeBoard, publishedNewestFirst, timeLabel } from "./work";

const e = (d: string, extra = {}) => ({
  data: { publishDate: new Date(d), ...extra },
});

test("removes drafts and sorts newest first", () => {
  const out = publishedNewestFirst([
    e("2023-02-01"),
    e("2026-08-01"),
    e("2025-08-01", { draft: true }),
  ]);
  expect(out.map((x) => x.data.publishDate.toISOString().slice(0, 7))).toEqual([
    "2026-08",
    "2023-02",
  ]);
});

test("when wins over the date", () => {
  expect(timeLabel({ publishDate: new Date("2026-08-01"), when: "Now" })).toBe(
    "Now",
  );
});

test("falls back to month and year in UTC", () => {
  expect(timeLabel({ publishDate: new Date("2026-05-01T00:00:00Z") })).toBe(
    "May 2026",
  );
});

test("a project gets its own page only with text or an image", () => {
  expect(hasPage({ body: "Some text.", data: {} })).toBe(true);
  expect(hasPage({ body: "", data: { img: {} } })).toBe(true);
  expect(hasPage({ data: { publications: [{}] } })).toBe(true);
  expect(hasPage({ data: { publications: [] } })).toBe(false);
  expect(hasPage({ body: "  \n", data: {} })).toBe(false);
  expect(hasPage({ data: {} })).toBe(false);
});

test("work from before MIT stays off the home board", () => {
  expect(onHomeBoard({ data: { earlier: true } })).toBe(false);
  expect(onHomeBoard({ data: {} })).toBe(true);
});

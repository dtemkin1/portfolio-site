import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import {
  awarderLine,
  dateRange,
  lastCommit,
  newestFirst,
  resumeDate,
  resumePublication,
} from "./cv";

test("JSON Resume dates read as a month and year, or a year", () => {
  expect(resumeDate("2026-09")).toBe("Sep 2026");
  expect(resumeDate("2026-09-01")).toBe("Sep 2026");
  expect(resumeDate("2026")).toBe("2026");
});

test("a role with no end date runs to the present", () => {
  expect(dateRange("2025-08", "2026-05")).toBe("Aug 2025 – May 2026");
  expect(dateRange("2026-08")).toBe("Aug 2026 – present");
});

test("an ORCID work becomes a JSON Resume publication", () =>
  expect(
    resumePublication({
      type: "chapter",
      title: "NbS and Policy Communication",
      author: [{ family: "Temkin", given: "Diego" }],
      issued: { "date-parts": [[2025]] },
      "container-title": "Nature-Based Solutions",
      publisher: "Elsevier",
      DOI: "10.1016/x",
    }),
  ).toEqual({
    name: "NbS and Policy Communication",
    publisher: "Chapter in Nature-Based Solutions, Elsevier",
    releaseDate: "2025",
    url: "https://doi.org/10.1016/x",
    summary: undefined,
  }));

test("a month and day are padded the way JSON Resume writes dates", () =>
  expect(
    resumePublication({
      type: "speech",
      title: "Talk",
      author: [{ family: "Temkin" }],
      issued: { "date-parts": [[2026, 6, 4]] },
    }).releaseDate,
  ).toBe("2026-06-04"));

test("the CV file points editors at the collection's generated schema", () => {
  const cv = JSON.parse(
    readFileSync(
      new URL("../../content/cv/resume.json", import.meta.url),
      "utf8",
    ),
  );
  expect(cv.$schema).toBe("../../../.astro/collections/cv.schema.json");
});

test("an honor names its awarder only when the title doesn't already", () => {
  expect(
    awarderLine({ title: "MIT Karl Taylor Compton Prize", awarder: "MIT" }),
  ).toBeUndefined();
  expect(
    awarderLine({
      title: "MIT DUSP Outstanding Undergraduate Thesis",
      awarder: "MIT Department of Urban Studies and Planning",
    }),
  ).toBeUndefined();
  expect(
    awarderLine({ title: "HSF Scholar", awarder: "Hispanic Scholarship Fund" }),
  ).toBe("Hispanic Scholarship Fund");
  expect(awarderLine({ title: "Some Prize" })).toBeUndefined();
});

test("honors go newest first, keeping the order of a tie, with undated ones last", () =>
  expect(
    newestFirst([
      { id: "a", date: "2021" },
      { id: "b" },
      { id: "c", date: "2026" },
      { id: "d", date: "2021" },
    ]).map(({ id }) => id),
  ).toEqual(["c", "a", "d", "b"]));

test("a file's last change is a real date, even when it was never committed", () => {
  expect(lastCommit("src/content/cv/resume.json").getTime()).not.toBeNaN();
  expect(lastCommit("no/such/file.json").getTime()).not.toBeNaN();
});

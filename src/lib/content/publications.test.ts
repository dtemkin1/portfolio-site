import { expect, test } from "vitest";

import {
  coauthors,
  dateLabel,
  isPresentation,
  link,
  newestFirst,
  parseName,
  type Publication,
  venueLine,
} from "./publications";

const temkin = { family: "Temkin", given: "Diego" };

const thesis: Publication & { id: string } = {
  id: "thesis",
  type: "thesis",
  author: [temkin],
  issued: { "date-parts": [[2026, 5]] },
  title: "A Co-Design Framework for School Bus Network Redesign",
  genre: "Bachelor's thesis",
  publisher: "Massachusetts Institute of Technology",
  URL: "https://dspace.mit.edu/handle/1721.1/176348",
  note: "MIT DUSP Outstanding Undergraduate Thesis award.",
};

const chapter: Publication & { id: string } = {
  id: "chapter",
  type: "chapter",
  author: [{ family: "Cong", given: "Cong" }, temkin],
  issued: { "date-parts": [[2025]] },
  title: "NbS and Policy Communication",
  "container-title":
    "Nature-Based Solutions in Supporting Sustainable Development Goals",
  publisher: "Elsevier",
  DOI: "10.1016/B978-0-443-21782-1.00008-7",
  URL: "https://www.elsevier.com/",
};

const talk: Publication & { id: string } = {
  id: "talk",
  type: "speech",
  author: [temkin, { family: "Zardini", given: "Gioele" }],
  issued: { "date-parts": [[2026, 6, 24]] },
  title: "Urban Bus Network Co-Design",
  genre: "Conference presentation",
  "event-title": "TransitData 2026",
  "event-place": "Toronto, ON, Canada",
};

test("plain-text names take the last word as the family name", () => {
  expect(parseName("Diego Temkin")).toEqual(temkin);
  expect(parseName(" Anson Forest Stewart ")).toEqual({
    family: "Stewart",
    given: "Anson Forest",
  });
  expect(parseName("Plato")).toEqual({ family: "Plato" });
});

test("dates show the month and year, or just the year when that's all there is", () => {
  expect(dateLabel(talk)).toBe("Jun 2026");
  expect(dateLabel(chapter)).toBe("2025");
});

test("a thesis: its kind, the school, and the date", () =>
  expect(venueLine(thesis)).toBe(
    "Bachelor's thesis, Massachusetts Institute of Technology, May 2026",
  ));

test("a chapter: the book it's in, the publisher, and the year", () =>
  expect(venueLine(chapter)).toBe(
    "Chapter in Nature-Based Solutions in Supporting Sustainable Development Goals, Elsevier, 2025",
  ));

test("a talk: its kind, the event, the place, and the date", () =>
  expect(venueLine(talk)).toBe(
    "Conference presentation, TransitData 2026, Toronto, ON, Canada, Jun 2026",
  ));

test("a work with no genre says what kind it is", () =>
  expect(
    venueLine({
      ...talk,
      type: "paper-conference",
      genre: undefined,
      "container-title": "TRB Annual Meeting",
      "event-title": undefined,
    }),
  ).toBe(
    "Conference paper, TRB Annual Meeting, Toronto, ON, Canada, Jun 2026",
  ));

test("authors show only with co-authors, and my name is marked", () => {
  expect(coauthors(thesis, temkin)).toEqual([]);
  expect(coauthors(chapter, temkin)).toEqual([
    ["Cong Cong", false],
    ["Diego Temkin", true],
  ]);
});

test("the title links to the DOI, or else the URL", () => {
  expect(link(chapter)).toBe(
    "https://doi.org/10.1016/B978-0-443-21782-1.00008-7",
  );
  expect(link(thesis)).toBe(thesis.URL);
  expect(link({})).toBeUndefined();
});

test("talks and posters are presentations; the rest are publications", () => {
  expect(isPresentation(talk)).toBe(true);
  expect([thesis, chapter].some(isPresentation)).toBe(false);
});

test("the newest work comes first, and a bare year sorts after dates in it", () =>
  expect(
    newestFirst([
      chapter,
      { ...chapter, id: "bare", issued: { "date-parts": [[2026]] } },
      thesis,
      talk,
    ]).map(({ id }) => id),
  ).toEqual(["talk", "thesis", "bare", "chapter"]));

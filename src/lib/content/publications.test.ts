import { expect, test } from "vitest";

import {
  authorName,
  newestFirst,
  parseName,
  type Publication,
  references,
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
  issued: { "date-parts": [[2024]] },
  title: "NbS and Policy Communication",
  "container-title":
    "Nature-Based Solutions in Supporting Sustainable Development Goals: Theory and Practice",
  editor: [
    { family: "Pan", given: "Haozhi" },
    { family: "Cong", given: "Cong" },
  ],
  page: "153-172",
  publisher: "Elsevier",
  DOI: "10.1016/B978-0-443-21782-1.00008-7",
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

// The reference as a reader sees it, without the markup.
function text(html: string) {
  let previous;
  do {
    previous = html;
    html = html.replace(/<[^>]+>/g, "");
  } while (html !== previous);
  return html.replace(/&#38;/g, "&").trim();
}
const [thesisRef, chapterRef, talkRef] = references(
  [thesis, chapter, talk],
  temkin,
);

test("plain-text names take the last word as the family name", () => {
  expect(parseName("Diego Temkin")).toEqual(temkin);
  expect(parseName(" Anson Forest Stewart ")).toEqual({
    family: "Stewart",
    given: "Anson Forest",
  });
  expect(parseName("Plato")).toEqual({ family: "Plato" });
});

test("authors are written the way APA writes them", () => {
  expect(authorName(temkin)).toBe("Temkin, D.");
  expect(authorName({ family: "Stewart", given: "Anson Forest" })).toBe(
    "Stewart, A. F.",
  );
  expect(authorName({ family: "Plato" })).toBe("Plato");
});

test("a thesis: the year, then the kind of work and school in brackets, with no URL or note", () =>
  expect(text(thesisRef.html)).toBe(
    "Temkin, D. (2026). A Co-Design Framework for School Bus Network Redesign [Bachelor’s thesis, Massachusetts Institute of Technology].",
  ));

test("a chapter: the editors, the book in italics, the pages, and the publisher, with no DOI typed out", () => {
  expect(text(chapterRef.html)).toBe(
    "Cong, C., & Temkin, D. (2024). NbS and Policy Communication. In H. Pan & C. Cong (Eds.), Nature-Based Solutions in Supporting Sustainable Development Goals: Theory and Practice (pp. 153–172). Elsevier.",
  );
  expect(chapterRef.html).toContain(
    "<i>Nature-Based Solutions in Supporting Sustainable Development Goals: Theory and Practice</i>",
  );
});

test("a talk: the full date, the label APA uses, then the event and place", () =>
  expect(text(talkRef.html)).toBe(
    "Temkin, D., & Zardini, G. (2026, June 24). Urban Bus Network Co-Design [Conference presentation]. TransitData 2026, Toronto, ON, Canada.",
  ));

test("my name is bold among the authors, and nowhere else", () => {
  expect(chapterRef.html).toContain(
    "Cong, C., &#38; <strong>Temkin, D.</strong>",
  );
  expect(chapterRef.html.match(/<strong>/g)).toHaveLength(1);
});

test("the title links to the DOI, or else the URL", () => {
  expect(chapterRef.html).toContain(
    '<a href="https://doi.org/10.1016/B978-0-443-21782-1.00008-7">NbS and Policy Communication</a>',
  );
  expect(thesisRef.html).toContain(
    '<i><a href="https://dspace.mit.edu/handle/1721.1/176348">A Co-Design Framework for School Bus Network Redesign</a></i>',
  );
  expect(chapterRef.html.match(/<a /g)).toHaveLength(1);
});

test("a title with ?, parentheses, or & is still found and linked", () =>
  expect(
    references(
      [{ ...chapter, title: "Why Did Ridership Fall? (Buses & Trains)" }],
      temkin,
    )[0].html,
  ).toContain(
    '<a href="https://doi.org/10.1016/B978-0-443-21782-1.00008-7">Why Did Ridership Fall? (Buses &#38; Trains)</a>',
  ));

test("a work with no DOI or URL has an unlinked title", () =>
  expect(talkRef.html).not.toContain("<a "));

test("a title keeps the curly quotes APA gives it, and stays linked", () =>
  expect(
    references(
      [{ ...chapter, title: `The "Last Mile" and Students' Trips` }],
      temkin,
    )[0].html,
  ).toMatch(/<a href="[^"]+">The “Last Mile” and Students’ Trips<\/a>/));

test("references keep the order they're given, under their own ids", () =>
  expect(references([talk, thesis], temkin).map(({ id }) => id)).toEqual([
    "talk",
    "thesis",
  ]));

test("the newest work comes first, and a bare year sorts after dates in it", () =>
  expect(
    newestFirst([
      chapter,
      { ...chapter, id: "bare", issued: { "date-parts": [[2026]] } },
      thesis,
      talk,
    ]).map(({ id }) => id),
  ).toEqual(["talk", "thesis", "bare", "chapter"]));

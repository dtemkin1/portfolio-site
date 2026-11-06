import { expect, test, vi } from "vitest";

import { fromOrcid, orcidLoader, type OrcidWork, orcidWorks } from "./orcid";

// Small works in the shape the ORCID API returns, with only the fields each test needs.
const person = (name: string, role: string | null = null) => ({
  "credit-name": { value: name },
  "contributor-attributes": { "contributor-role": role },
});
const bibtex = (value: string) => ({
  "citation-type": "bibtex",
  "citation-value": value,
});
const work = (fields: Partial<OrcidWork>): OrcidWork => ({
  "put-code": 1,
  type: "book-chapter",
  title: { title: { value: "Title" } },
  contributors: { contributor: [person("Diego Temkin")] },
  ...fields,
});

const SUPERVISION = "http://credit.niso.org/contributor-roles/supervision/";
const temkin = { family: "Temkin", given: "Diego" };

const thesis = work({
  "put-code": 229097402,
  type: "dissertation-thesis",
  title: {
    title: { value: "A Co-Design Framework" },
    subtitle: { value: "Applying Category Theory" },
  },
  "short-description": "Outstanding Undergraduate Thesis award.",
  url: { value: "https://dspace.mit.edu/handle/1721.1/176348" },
  "publication-date": { year: { value: "2026" }, month: { value: "05" } },
  contributors: {
    contributor: [person("Diego Temkin"), person("Jim Aloisi", SUPERVISION)],
  },
  citation: bibtex(
    "@phdthesis{t, type = {Bachelor's Thesis}, school = {Massachusetts Institute of Technology}}",
  ),
});

const chapter = work({
  "put-code": 232377834,
  "journal-title": { value: "Nature-Based Solutions" },
  "publication-date": { year: { value: "2024" } },
  "external-ids": {
    "external-id": [
      { "external-id-type": "doi", "external-id-value": "10.1016/b978" },
    ],
  },
  contributors: {
    contributor: [person("Cong Cong", "author"), person("Diego Temkin")],
  },
  citation: bibtex(`@incollection{c,
    booktitle = {Nature-Based Solutions: Theory and Practice},
    editor = {Pan, Haozhi and Cong, Cong},
    publisher = {Elsevier},
    pages = {153--172}
  }`),
});

const talk = work({
  type: "conference-presentation",
  "journal-title": { value: "TransitData 2026" },
  url: { value: "https://www.transitdata2026.ca/" },
  "publication-date": {
    year: { value: "2026" },
    month: { value: "06" },
    day: { value: "24" },
  },
  country: { value: "CA" },
  contributors: {
    contributor: [person("Diego Temkin"), person("Gioele Zardini")],
  },
  citation: bibtex("@misc{p, address = {Toronto, ON, Canada}}"),
});

test("a thesis: the subtitle joins the title, BibTeX says what kind it is, and the description is the note", () =>
  expect(fromOrcid(thesis)).toEqual({
    id: "t",
    type: "thesis",
    genre: "Bachelor's thesis",
    author: [temkin],
    issued: { "date-parts": [[2026, 5]] },
    title: "A Co-Design Framework: Applying Category Theory",
    publisher: "Massachusetts Institute of Technology",
    URL: "https://dspace.mit.edu/handle/1721.1/176348",
    note: "Outstanding Undergraduate Thesis award.",
  }));

test("a chapter: the DOI, and the book, editors, publisher, and pages come from BibTeX", () =>
  expect(fromOrcid(chapter)).toEqual({
    id: "c",
    type: "chapter",
    author: [{ family: "Cong", given: "Cong" }, temkin],
    issued: { "date-parts": [[2024]] },
    title: "Title",
    DOI: "10.1016/b978",
    "container-title": "Nature-Based Solutions: Theory and Practice",
    editor: [
      { family: "Pan", given: "Haozhi" },
      { family: "Cong", given: "Cong" },
    ],
    publisher: "Elsevier",
    page: "153-172",
  }));

test("a talk: the event ORCID calls a journal is where it was given, and BibTeX has the city", () =>
  expect(fromOrcid(talk)).toMatchObject({
    type: "speech",
    genre: "Conference presentation",
    author: [temkin, { family: "Zardini", given: "Gioele" }],
    issued: { "date-parts": [[2026, 6, 24]] },
    "event-title": "TransitData 2026",
    "event-place": "Toronto, ON, Canada",
    URL: "https://www.transitdata2026.ca/",
  }));

test("a poster gets APA's label for one", () =>
  expect(fromOrcid({ ...talk, type: "conference-poster" })?.genre).toBe(
    "Poster presentation",
  ));

test("without BibTeX, a talk's place is its country, and its put code names it", () =>
  expect(fromOrcid({ ...talk, "put-code": 42, citation: null })).toMatchObject({
    id: "42",
    "event-place": "Canada",
  }));

test("ORCID's roles decide the authors: a supervisor isn't one", () =>
  expect(fromOrcid(thesis)?.author).toEqual([temkin]));

test("someone listed once per CRediT role is one author, in the place they first appear", () => {
  const credit = (role: string) =>
    `http://credit.niso.org/contributor-roles/${role}/`;
  const me = (role: string) => ({
    ...person("Diego Temkin", credit(role)),
    "contributor-orcid": { path: "0009-0007-6324-8029" },
  });
  expect(
    fromOrcid({
      ...thesis,
      contributors: {
        contributor: [
          person("Cong Cong"),
          me("software"),
          me("visualization"),
          person("Jim Aloisi", SUPERVISION),
        ],
      },
    })?.author,
  ).toEqual([{ family: "Cong", given: "Cong" }, temkin]);
});

test("a thesis's school can come from ORCID, and isn't treated as a book", () => {
  const entry = fromOrcid({
    ...thesis,
    "journal-title": { value: "Massachusetts Institute of Technology" },
    citation: null,
  });
  expect(entry).toMatchObject({
    genre: "Thesis",
    publisher: "Massachusetts Institute of Technology",
  });
  expect(entry).not.toHaveProperty("container-title");
});

test("a thesis type is lowercased, except for words like PhD", () => {
  const withType = (type: string) =>
    fromOrcid({
      ...thesis,
      citation: bibtex(`@phdthesis{t, type = {${type}}, school = {MIT}}`),
    })?.genre;
  expect(withType("Master's Thesis")).toBe("Master's thesis");
  expect(withType("PhD Dissertation")).toBe("PhD dissertation");
});

test("BibTeX that can't be read names the ORCID work it came from", () =>
  expect(() => fromOrcid({ ...chapter, citation: bibtex("@book{") })).toThrow(
    "ORCID work 232377834",
  ));

test("an unknown kind of work is skipped", () =>
  expect(fromOrcid({ ...thesis, type: "patent" })).toBeNull());

test("the loader reads the work list, then each work in full", async () => {
  const works: Record<string, OrcidWork> = {
    "work/229097402": thesis,
    "work/232377834": chapter,
  };
  const asked: string[] = [];
  const entries = await orcidWorks(async (path) => {
    asked.push(path);
    return path === "works"
      ? {
          group: [229097402, 232377834].map((code) => ({
            "work-summary": [{ "put-code": code }],
          })),
        }
      : works[path];
  });
  expect(asked).toEqual(["works", "work/229097402", "work/232377834"]);
  expect(entries.map(({ type }) => type)).toEqual(["thesis", "chapter"]);
});

// Runs the loader against a fake ORCID API that answers from `responses`.
async function load(responses: Record<string, unknown>) {
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.split("/0000-0000-0000-0000/")[1];
    return { ok: true, json: async () => responses[path] };
  });
  const entries = new Map<string, unknown>();
  const warnings: string[] = [];
  const context = {
    store: {
      clear: () => entries.clear(),
      has: (id: string) => entries.has(id),
      set: ({ id, data }: { id: string; data: unknown }) =>
        entries.set(id, data),
    },
    parseData: async ({ data }: { data: unknown }) => data,
    logger: {
      info: () => {},
      warn: (message: string) => warnings.push(message),
    },
  };
  try {
    await orcidLoader("https://orcid.org/0000-0000-0000-0000").load(
      context as never,
    );
  } finally {
    vi.unstubAllGlobals();
  }
  return { entries, warnings };
}

test("a record with no public works warns, and loads nothing", async () => {
  const { entries, warnings } = await load({ works: { group: [] } });
  expect(entries.size).toBe(0);
  expect(warnings[0]).toMatch(/no public works/);
});

test("two works with the same BibTeX key stop the build", async () => {
  const summary = (code: number) => ({
    "work-summary": [{ "put-code": code }],
  });
  await expect(
    load({
      works: { group: [summary(1), summary(2)] },
      "work/1": { ...chapter, "put-code": 1 },
      "work/2": { ...chapter, "put-code": 2 },
    }),
  ).rejects.toThrow("Two ORCID works share the BibTeX key c");
});

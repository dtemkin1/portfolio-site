import { expect, test, vi } from "vitest";

import {
  fromOrcid,
  orcidLoader,
  type OrcidWork,
  orcidWorks,
} from "./orcid-loader";

// Small works in the shape the ORCID API returns, with only the fields each test needs.
const person = (name: string) => ({ "credit-name": { value: name } });
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
    contributor: [person("Diego Temkin"), person("Jim Aloisi")],
  },
  citation: bibtex(
    "@phdthesis{t, author = {Temkin, Diego}, type = {Bachelor's Thesis}, school = {Massachusetts Institute of Technology}}",
  ),
});

const chapter = work({
  "put-code": 232377834,
  "journal-title": { value: "Nature-Based Solutions" },
  "publication-date": { year: { value: "2024" } },
  "external-ids": {
    "external-id": [
      {
        "external-id-type": "doi",
        "external-id-value": "10.1016/b978",
        "external-id-relationship": "self",
      },
    ],
  },
  contributors: {
    contributor: [person("Cong Cong"), person("Diego Temkin")],
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

test("BibTeX names the authors, so an advisor ORCID lists isn't one", () =>
  expect(fromOrcid(thesis)?.author).toEqual([temkin]));

test("without BibTeX, everyone ORCID lists is an author, once each, in order", () =>
  expect(
    fromOrcid({
      ...thesis,
      citation: null,
      contributors: {
        contributor: [
          person("Cong Cong"),
          person("Diego Temkin"),
          person("Diego Temkin"),
        ],
      },
    })?.author,
  ).toEqual([{ family: "Cong", given: "Cong" }, temkin]));

test("conference papers, preprints, and reports are cited, with the right kind", () => {
  const kind = (type: string) => {
    const entry = fromOrcid({ ...chapter, type, citation: null });
    return entry && [entry.type, entry.genre];
  };
  expect(kind("conference-paper")).toEqual(["paper-conference", undefined]);
  expect(kind("preprint")).toEqual(["article", "Preprint"]);
  expect(kind("report")).toEqual(["report", undefined]);
  expect(kind("working-paper")).toEqual(["report", "Working paper"]);
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

const summary = (code: number, star = "0") => ({
  "put-code": code,
  "display-index": star,
});
const list = (codes: number[], modified = 1) => ({
  "last-modified-date": { value: modified },
  group: codes.map((code) => ({ "work-summary": [summary(code)] })),
});
const bulk = (...works: OrcidWork[]) => ({
  bulk: works.map((work) => ({ work })),
});

test("the loader reads the work list, then every work in one request, in list order", async () => {
  const asked: string[] = [];
  const { works } = await orcidWorks(async (path) => {
    asked.push(path);
    return path === "works"
      ? list([229097402, 232377834])
      : bulk(chapter, thesis);
  });
  expect(asked).toEqual(["works", "works/229097402,232377834"]);
  expect(works).toEqual([thesis, chapter]);
});

test("when sources disagree, the loader reads the one starred on ORCID", async () => {
  const asked: string[] = [];
  await orcidWorks(async (path) => {
    asked.push(path);
    return path === "works"
      ? { group: [{ "work-summary": [summary(1, "0"), summary(2, "1")] }] }
      : bulk();
  });
  expect(asked).toEqual(["works", "works/2"]);
});

test("more than 100 works take more than one request", async () => {
  const asked: string[] = [];
  const codes = Array.from({ length: 150 }, (_, i) => i + 1);
  await orcidWorks(async (path) => {
    asked.push(path);
    return path === "works" ? list(codes) : bulk();
  });
  expect(asked).toHaveLength(3);
});

test("a record that hasn't changed isn't fetched again", async () => {
  const asked: string[] = [];
  const result = await orcidWorks(async (path) => {
    asked.push(path);
    return list([1], 5);
  }, 5);
  expect(asked).toEqual(["works"]);
  expect(result).toEqual({ modified: 5 });
});

test("a DOI that's part-of another work, like the book's, isn't the chapter's", () =>
  expect(
    fromOrcid({
      ...chapter,
      "external-ids": {
        "external-id": [
          {
            "external-id-type": "doi",
            "external-id-value": "10.1016/book",
            "external-id-relationship": "part-of",
          },
        ],
      },
    })?.DOI,
  ).toBeUndefined());

// Runs the loader against a fake ORCID API that answers from `responses`
// (or fails, when it's null), with `saved` as the last build's cache.
async function load(
  responses: Record<string, unknown> | null,
  saved?: { modified?: number; works: OrcidWork[] },
) {
  vi.stubGlobal("fetch", async (url: string) => {
    if (!responses) throw new Error("offline");
    const path = url.split("/0000-0000-0000-0000/")[1];
    return { ok: true, json: async () => responses[path] };
  });
  const entries = new Map<string, unknown>();
  const cache = new Map<string, string>();
  if (saved) cache.set("works", JSON.stringify(saved));
  const warnings: string[] = [];
  const context = {
    store: {
      clear: () => entries.clear(),
      has: (id: string) => entries.has(id),
      set: ({ id, data }: { id: string; data: unknown }) =>
        entries.set(id, data),
    },
    meta: {
      get: (key: string) => cache.get(key),
      set: (key: string, value: string) => cache.set(key, value),
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
  return { entries, warnings, cache };
}

test("a record with no public works warns, and loads nothing", async () => {
  const { entries, warnings } = await load({ works: list([]) });
  expect(entries.size).toBe(0);
  expect(warnings[0]).toMatch(/no public works/);
});

test("a work of a type the site doesn't cite is skipped with a warning", async () => {
  const { entries, warnings } = await load({
    works: list([7]),
    "works/7": bulk({ ...chapter, "put-code": 7, type: "patent" }),
  });
  expect(entries.size).toBe(0);
  expect(warnings[0]).toMatch(/Skipped ORCID work 7: its type, patent/);
});

test("two works with the same BibTeX key stop the build", async () => {
  await expect(
    load({
      works: list([1, 2]),
      "works/1,2": bulk(
        { ...chapter, "put-code": 1 },
        { ...chapter, "put-code": 2 },
      ),
    }),
  ).rejects.toThrow("Two ORCID works share the BibTeX key c");
});

test("the works are saved, and an unchanged record loads them from there", async () => {
  const first = await load({
    works: list([232377834], 9),
    "works/232377834": bulk(chapter),
  });
  const saved = JSON.parse(first.cache.get("works")!);
  expect(saved).toEqual({ modified: 9, works: [chapter] });

  const { entries } = await load({ works: list([232377834], 9) }, saved);
  expect([...entries.keys()]).toEqual(["c"]);
});

test("when ORCID can't be reached, the last build's works are used, with a warning", async () => {
  const { entries, warnings } = await load(null, { works: [chapter] });
  expect([...entries.keys()]).toEqual(["c"]);
  expect(warnings[0]).toMatch(/Couldn't reach ORCID \(offline\)/);
});

test("when ORCID can't be reached and nothing was saved, the build stops", async () =>
  expect(load(null)).rejects.toThrow("offline"));

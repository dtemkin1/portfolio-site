import type { Loader } from "astro/loaders";

import { parseName } from "./publications";

import {
  Cite,
  type CSL,
  type CSLDate,
  type CSLName,
  type CSLType,
} from "@citation-js/core";
import "@citation-js/plugin-bibtex";

// id used to link work to publication
export type OrcidEntry = Omit<Partial<CSL>, "id"> & {
  id: string;
};

type Value = { value?: string } | null;

export type OrcidWork = {
  "put-code": number;
  type: string;
  title?: { title?: Value; subtitle?: Value };
  "journal-title"?: Value;
  "short-description"?: string | null;
  url?: Value;
  "publication-date"?: { year?: Value; month?: Value; day?: Value } | null;
  "external-ids"?: {
    "external-id"?: {
      "external-id-type": string;
      "external-id-value": string;
      "external-id-relationship"?: string | null;
    }[];
  } | null;
  contributors?: { contributor?: { "credit-name"?: Value }[] } | null;
  citation?: { "citation-type"?: string; "citation-value"?: string } | null;
  country?: Value;
};

// orcid to csl types
const TYPES: Record<string, { type: CSLType; genre?: string } | undefined> = {
  "journal-article": { type: "article-journal" },
  "conference-paper": { type: "paper-conference" },
  preprint: { type: "article", genre: "Preprint" },
  report: { type: "report" },
  "working-paper": { type: "report", genre: "Working paper" },
  "book-chapter": { type: "chapter" },
  "dissertation-thesis": { type: "thesis" },
  "conference-poster": { type: "speech", genre: "Poster presentation" },
  "conference-presentation": {
    type: "speech",
    genre: "Conference presentation",
  },
  "lecture-speech": { type: "speech", genre: "Presentation" },
};

const COUNTRIES = new Intl.DisplayNames(["en"], { type: "region" });

// BibTeX (from Zotero) says who the authors are; without it, everyone ORCID lists, once each
function authorsOf(work: OrcidWork, csl: Partial<CSL>): CSLName[] {
  if (csl.author?.length) return csl.author;
  const names = (work.contributors?.contributor ?? []).flatMap(
    (person) => person["credit-name"]?.value?.trim() || [],
  );
  return [...new Set(names)].map(parseName);
}

function bibtex(work: OrcidWork): Partial<CSL> {
  const { "citation-type": kind, "citation-value": value } =
    work.citation ?? {};
  if (kind !== "bibtex" || !value) return {};
  try {
    return new Cite(value).data[0];
  } catch (cause) {
    throw new Error(
      `ORCID work ${work["put-code"]} has BibTeX that can't be read.`,
      { cause },
    );
  }
}

// sentence case, mostly for thesis types
const sentenceCase = (text: string) =>
  text.replace(/(?<=\s)[A-Z][a-z']*\b/g, (word) => word.toLowerCase());

// only keeps keys with defined vals
const defined = <T extends object>(entry: T) =>
  Object.fromEntries(
    Object.entries(entry).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined,
    ),
  ) as T;

export function fromOrcid(work: OrcidWork): OrcidEntry | null {
  const kind = TYPES[work.type];
  if (!kind) return null;
  const { type } = kind;
  const csl = bibtex(work);
  const event = type === "speech";
  const partOf = type === "chapter" || type === "article-journal";

  const title =
    [work.title?.title?.value, work.title?.subtitle?.value]
      .filter(Boolean)
      .join(": ") || csl.title;
  const { year, month, day } = work["publication-date"] ?? {};
  const date = [year, month, day].flatMap((part) =>
    part?.value ? [Number(part.value)] : [],
  );

  // use bibtex doi if available
  const doi =
    csl.DOI ??
    work["external-ids"]?.["external-id"]?.find(
      (id) =>
        id["external-id-type"] === "doi" &&
        id["external-id-relationship"] === "self",
    )?.["external-id-value"];

  // orcid journal title field means different things for some reason...
  const journal = work["journal-title"]?.value;
  const container = partOf ? (csl["container-title"] ?? journal) : undefined;

  return defined({
    id: csl["citation-key"] ?? String(work["put-code"]),
    type,
    genre:
      type === "thesis"
        ? sentenceCase(csl.genre ?? "Thesis")
        : (kind.genre ?? csl.genre),
    author: authorsOf(work, csl),
    issued: {
      "date-parts": [
        date.length
          ? date
          : (csl.issued?.["date-parts"]?.[0] ?? []).map(Number),
      ] as NonNullable<CSLDate["date-parts"]>,
    },
    title: title || undefined,
    "container-title": container,
    editor: container ? csl.editor : undefined,
    page: container ? csl.page : undefined,
    publisher:
      type === "thesis"
        ? (csl.publisher ?? journal)
        : container
          ? csl.publisher
          : undefined,
    "event-title": event ? journal : undefined,
    "event-place": event
      ? (csl["publisher-place"] ??
        (work.country?.value && COUNTRIES.of(work.country.value)))
      : undefined,
    DOI: doi,
    URL: doi ? undefined : (work.url?.value ?? csl.URL),
    note: work["short-description"]?.trim() || undefined,
  });
}

type Summary = { "put-code": number; "display-index"?: string | null };
type WorkList = {
  "last-modified-date"?: { value?: number } | null;
  group?: { "work-summary": Summary[] }[];
};
type Bulk = { bulk?: ({ work: OrcidWork } | { error: unknown })[] };

// ORCID returns at most 100 works per request
const BULK = 100;

// Reads every public work, taking the copy starred on ORCID when sources disagree.
// Returns no works when the record hasn't changed since `since`.
export async function orcidWorks(
  fetchJson: (path: string) => Promise<unknown>,
  since?: number,
): Promise<{ modified?: number; works?: OrcidWork[] }> {
  const list = (await fetchJson("works")) as WorkList;
  const modified = list["last-modified-date"]?.value ?? undefined;
  if (since !== undefined && modified === since) return { modified };

  const index = (summary: Summary) => Number(summary["display-index"] ?? 0);
  const codes = (list.group ?? []).map(
    ({ "work-summary": summaries }) =>
      summaries.reduce((a, b) => (index(b) > index(a) ? b : a))["put-code"],
  );
  const works = new Map<number, OrcidWork>();
  for (let i = 0; i < codes.length; i += BULK) {
    const batch = codes.slice(i, i + BULK);
    const { bulk = [] } = (await fetchJson(`works/${batch.join(",")}`)) as Bulk;
    for (const item of bulk) {
      if ("error" in item) {
        throw new Error(
          `ORCID couldn't return one of works ${batch.join(", ")}.`,
        );
      }
      works.set(item.work["put-code"], item.work);
    }
  }
  // bulk answers come back in their own order
  return { modified, works: codes.flatMap((code) => works.get(code) ?? []) };
}

type Cache = { modified?: number; works: OrcidWork[] };

export function orcidLoader(profile: string): Loader {
  const id = new URL(profile).pathname.slice(1);
  return {
    name: "orcid",
    load: async ({ store, meta, parseData, logger }) => {
      const fetchJson = async (path: string) => {
        const response = await fetch(
          `https://pub.orcid.org/v3.0/${id}/${path}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) throw new Error(`ORCID ${path}: ${response.status}`);
        return response.json();
      };

      // The raw works are kept between local builds, so an unchanged record isn't refetched,
      // and `astro dev` still works offline. CI starts empty, so it always fetches.
      const saved = meta.get("works");
      const cache: Cache | undefined = saved ? JSON.parse(saved) : undefined;
      let all: OrcidWork[];
      try {
        const { modified, works } = await orcidWorks(
          fetchJson,
          cache?.modified,
        );
        all = works ?? cache!.works;
        meta.set("works", JSON.stringify({ modified, works: all }));
      } catch (cause) {
        if (!cache) throw cause;
        logger.warn(
          `Couldn't reach ORCID (${(cause as Error).message}), so using the works from the last build.`,
        );
        all = cache.works;
      }
      const works: OrcidEntry[] = [];
      for (const work of all) {
        const entry = fromOrcid(work);
        if (entry) works.push(entry);
        else
          logger.warn(
            `Skipped ORCID work ${work["put-code"]}: its type, ${work.type}, isn't handled yet (see TYPES in lib/content/orcid-loader.ts).`,
          );
      }
      store.clear();
      for (const { id: key, ...work } of works) {
        if (store.has(key)) {
          throw new Error(
            `Two ORCID works share the BibTeX key ${key}. Give one of them a different key on ORCID.`,
          );
        }
        store.set({ id: key, data: await parseData({ id: key, data: work }) });
      }
      if (works.length) {
        logger.info(`Loaded ${works.length} works from ORCID ${id}`);
      } else {
        logger.warn(
          `ORCID ${id} has no public works. Check each work's visibility on ORCID.`,
        );
      }
    },
  };
}

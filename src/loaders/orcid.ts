import type { Loader } from "astro/loaders";

import { parseName } from "../lib/publications";

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
  contributors?: {
    contributor?: {
      "credit-name"?: Value;
      "contributor-orcid"?: { path?: string | null } | null;
      "contributor-attributes"?: { "contributor-role"?: string | null } | null;
    }[];
  } | null;
  citation?: { "citation-type"?: string; "citation-value"?: string } | null;
  country?: Value;
};

// orcid to csl types
const TYPES: Record<string, { type: CSLType; genre?: string } | undefined> = {
  "journal-article": { type: "article-journal" },
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

// credit roles that don't mean author
const NOT_AUTHOR = new Set([
  "supervision",
  "editor",
  "chair-or-translator",
  "support-staff",
]);
const roleName = (role: string) =>
  role.toLowerCase().split("/").filter(Boolean).pop() ?? "";

// orcid lists person once per role for some reason...
function authorsOf(work: OrcidWork): CSLName[] {
  const people = new Map<string, { name: string; author: boolean }>();
  for (const person of work.contributors?.contributor ?? []) {
    const name = person["credit-name"]?.value?.trim();
    if (!name) continue;
    const key = person["contributor-orcid"]?.path ?? name;
    const role = person["contributor-attributes"]?.["contributor-role"];
    const author = !role || !NOT_AUTHOR.has(roleName(role));
    people.set(key, {
      name: people.get(key)?.name ?? name,
      author: Boolean(people.get(key)?.author) || author,
    });
  }
  return [...people.values()]
    .filter(({ author }) => author)
    .map(({ name }) => parseName(name));
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
    author: authorsOf(work),
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

// work list only has summaries, so yoink highest priority for full info.
export async function orcidWorks(
  fetchJson: (path: string) => Promise<unknown>,
): Promise<OrcidWork[]> {
  const { group = [] } = (await fetchJson("works")) as {
    group?: { "work-summary": Summary[] }[];
  };
  const index = (summary: Summary) => Number(summary["display-index"] ?? 0);
  return Promise.all(
    group.map(({ "work-summary": summaries }) => {
      const preferred = summaries.reduce((a, b) =>
        index(b) > index(a) ? b : a,
      );
      return fetchJson(`work/${preferred["put-code"]}`) as Promise<OrcidWork>;
    }),
  );
}

export function orcidLoader(profile: string): Loader {
  const id = new URL(profile).pathname.slice(1);
  return {
    name: "orcid",
    load: async ({ store, parseData, logger }) => {
      const all = await orcidWorks(async (path) => {
        const response = await fetch(
          `https://pub.orcid.org/v3.0/${id}/${path}`,
          {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          },
        );
        if (!response.ok) throw new Error(`ORCID ${path}: ${response.status}`);
        return response.json();
      });
      const works: OrcidEntry[] = [];
      for (const work of all) {
        const entry = fromOrcid(work);
        if (entry) works.push(entry);
        else
          logger.warn(
            `Skipped ORCID work ${work["put-code"]}: its type, ${work.type}, isn't handled yet (see TYPES in loaders/orcid.ts).`,
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

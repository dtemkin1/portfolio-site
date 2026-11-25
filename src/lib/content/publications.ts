import type { CSLName } from "@citation-js/core";
import { z } from "astro/zod";

import { monthYearLabel } from "./work";

// family name is required <3
const name = z.looseObject({
  family: z.string().min(1),
  given: z.string().optional(),
});

// things here are checked/needed, rest of type from CSL
export const publicationSchema = z.looseObject({
  type: z.string().min(1),
  // the title links to the doi if there is one, else the url
  title: z.string().min(1),
  author: z.array(name).min(1),
  // year, month, day
  issued: z.object({
    "date-parts": z.tuple([z.array(z.number().int()).min(1).max(3)]),
  }),
  genre: z.string().optional(),
  "container-title": z.string().optional(),
  "event-title": z.string().optional(),
  "event-place": z.string().optional(),
  publisher: z.string().optional(),
  note: z.string().optional(),
  bibtex: z.string().optional(),
  DOI: z.string().optional(),
  URL: z.url().optional(),
});

export type Publication = z.infer<typeof publicationSchema>;

export function parseName(text: string): CSLName {
  const words = text.trim().split(/\s+/);
  const family = words.pop()!;
  return words.length ? { family, given: words.join(" ") } : { family };
}

const fullName = ({ given, family }: CSLName) =>
  [given, family].filter(Boolean).join(" ");

// "Jun 2026", or "2025" when ORCID has only the year
export function dateLabel({ issued }: Pick<Publication, "issued">): string {
  const [year, month] = issued["date-parts"][0];
  return monthYearLabel(year, month);
}

// what the work is, when the genre doesn't say
const KINDS: Record<string, string> = {
  "article-journal": "Journal article",
  "paper-conference": "Conference paper",
  chapter: "Chapter",
  thesis: "Thesis",
  report: "Report",
  speech: "Presentation",
};

// "Conference presentation, TransitData 2026, Toronto, ON, Canada"
export function venue(
  publication: Pick<
    Publication,
    | "type"
    | "genre"
    | "publisher"
    | "container-title"
    | "event-title"
    | "event-place"
  >,
): string {
  const { type, genre, publisher } = publication;
  const kind = genre ?? KINDS[type];
  const where = publication["container-title"] ?? publication["event-title"];
  return [
    type === "chapter" && where ? `${kind} in ${where}` : [kind, where],
    publisher,
    publication["event-place"],
  ]
    .flat()
    .filter(Boolean)
    .join(", ");
}

export const venueLine = (publication: Publication) =>
  `${venue(publication)}, ${dateLabel(publication)}`;

// The authors when there are co-authors, as [name, isMe]; nothing when I wrote it alone.
export function coauthors(
  { author }: Pick<Publication, "author">,
  self: CSLName,
): [string, boolean][] {
  const me = fullName(self);
  const names = author.map((person) => fullName(person));
  if (names.length === 1 && names[0] === me) return [];
  return names.map((name) => [name, name === me]);
}

export const isPresentation = ({ type }: Pick<Publication, "type">) =>
  type === "speech";

// the Publications and Presentations sections a list of works fills, in that order, each keeping its order
export const writingSections = <T extends { data: Pick<Publication, "type"> }>(
  works: T[],
) =>
  [
    {
      title: "Publications",
      entries: works.filter(({ data }) => !isPresentation(data)),
    },
    {
      title: "Presentations",
      entries: works.filter(({ data }) => isPresentation(data)),
    },
  ].filter(({ entries }) => entries.length > 0);

export const link = ({ DOI, URL }: Pick<Publication, "DOI" | "URL">) =>
  DOI ? `https://doi.org/${DOI}` : URL;

export function newestFirst<T extends Pick<Publication, "issued">>(
  publications: T[],
): T[] {
  const parts = (publication: T) => publication.issued["date-parts"][0];
  return [...publications].sort((a, b) => {
    const [x, y] = [parts(a), parts(b)];
    for (let i = 0; i < 3; i++) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
    }
    return 0;
  });
}

import { Cite, type CSLName } from "@citation-js/core";
import "@citation-js/plugin-csl";
import { z } from "astro/zod";

// family name is required <3
const name = z.looseObject({
  family: z.string().min(1),
  given: z.string().optional(),
});

// things here are checked/needed, rest of type from CSL
export const publicationSchema = z.looseObject({
  // the title links to the doi if there is one, else the url
  title: z.string().min(1),
  author: z.array(name).min(1),
  // year, month, day
  issued: z.object({
    "date-parts": z.tuple([z.array(z.number().int()).min(1).max(3)]),
  }),
  note: z.string().optional(),
  DOI: z.string().optional(),
  URL: z.url().optional(),
});

export type Publication = z.infer<typeof publicationSchema>;

export function parseName(text: string): CSLName {
  const words = text.trim().split(/\s+/);
  const family = words.pop()!;
  return words.length ? { family, given: words.join(" ") } : { family };
}

export function authorName({ family = "", given = "" }: CSLName): string {
  const initials = given
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join(" ");
  return initials ? `${family}, ${initials}` : family;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

// citeproc curls quotes and escapes &, so either form matches
const titlePattern = (title: string) =>
  new RegExp(
    title
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/&/g, "&#38;")
      .replace(/'/g, "['’]")
      .replace(/"/g, '["“”]'),
  );

// apa reference as html (my name bolded + title links instead of raw doi/url)
export function references(
  publications: (Publication & { id: string })[],
  self: CSLName,
): { id: string; html: string }[] {
  if (!publications.length) return [];

  const me = escape(authorName(self));
  const entries = new Cite(publications).format("bibliography", {
    format: "html",
    style: "apa",
    lang: "en-US",
    nosort: true,
    asEntryArray: true,
  }) as [string, string][];

  return entries.map(([, html], i) => {
    const { id, title, DOI, URL } = publications[i];
    const href = DOI ? `https://doi.org/${DOI}` : URL;
    html = html.trim();
    // authors come before the date, the title after it
    const date = html.indexOf("(");
    const authors = html
      .slice(0, date)
      .replaceAll(me, `<strong>${me}</strong>`);
    const rest = href
      ? html
          .slice(date)
          .replace(` ${escape(href)}`, "")
          .replace(
            titlePattern(title),
            (match) => `<a href="${escape(href)}">${match}</a>`,
          )
      : html.slice(date);
    return { id, html: authors + rest };
  });
}

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

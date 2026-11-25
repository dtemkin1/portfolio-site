import { execFileSync } from "node:child_process";

import { link, type Publication, venue } from "./publications";
import { monthYearLabel } from "./work";

// a JSON Resume date ("2026", "2026-09", or "2026-09-01"; the standard's schema checks the form)
export function resumeDate(text: string): string {
  const [year, month] = text.split("-").map(Number);
  return monthYearLabel(year, month);
}

// a JSON Resume location, which is free text or its parts, as text: "Cambridge, MA"
export type Place =
  | string
  | {
      city?: string | undefined;
      region?: string | undefined;
      countryCode?: string | undefined;
    };
export const placeName = (place?: Place): string | undefined =>
  typeof place === "string"
    ? place
    : [place?.city, place?.region ?? place?.countryCode]
        .filter(Boolean)
        .join(", ") || undefined;

// "Aug 2025 – May 2026", or "Aug 2026 – present" with no end date
export const dateRange = (start: string, end?: string) =>
  `${resumeDate(start)} – ${end ? resumeDate(end) : "present"}`;

export const resumePublication = (publication: Publication) => ({
  name: publication.title,
  publisher: venue(publication),
  releaseDate: publication.issued["date-parts"][0]
    .map((part) => String(part).padStart(2, "0"))
    .join("-"),
  url: link(publication),
  summary: publication.note,
});

// the awarder, unless the title already names it ("MIT Karl Taylor Compton Prize" from MIT)
export const awarderLine = ({
  title,
  awarder,
}: {
  title: string;
  awarder?: string;
}) => (awarder && !title.includes(awarder.split(" ")[0]) ? awarder : undefined);

// when a file last changed: its last commit, or now without git or a commit
export function lastCommit(file: string): Date {
  try {
    const date = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", file],
      {
        encoding: "utf8",
      },
    ).trim();
    if (date) return new Date(date);
  } catch {
    // not a git checkout
  }
  return new Date();
}

// dated items newest first, undated ones last, otherwise in the order given
export const newestFirst = <T extends { date?: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

import { type CollectionEntry, getCollection } from "astro:content";

import { monthYear } from "./work";

export async function getNotes(): Promise<CollectionEntry<"notes">[]> {
  return (await getCollection("notes")).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

// "MIT News, Dec 2025"
export const sourceLine = ({ source, date }: { source: string; date: Date }) =>
  `${source}, ${monthYear.format(date)}`;

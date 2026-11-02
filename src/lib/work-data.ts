import { type CollectionEntry, getCollection } from "astro:content";

import { publishedNewestFirst } from "./work";

export async function getPublishedWork(): Promise<CollectionEntry<"work">[]> {
  return publishedNewestFirst(await getCollection("work"));
}

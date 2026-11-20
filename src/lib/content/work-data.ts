import { type CollectionEntry, getCollection } from "astro:content";

import { hasPage, publishedNewestFirst } from "./work";

export async function getPublishedWork(): Promise<CollectionEntry<"work">[]> {
  return publishedNewestFirst(await getCollection("work"));
}

// published work that has a page of its own
export async function getWorkPages(): Promise<CollectionEntry<"work">[]> {
  return (await getPublishedWork()).filter(hasPage);
}

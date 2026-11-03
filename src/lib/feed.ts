type FeedEntry = { description: string; status?: "in-development" };

// Feed readers often skip the description, so unfinished work carries it in the full text.
export function feedMarkdown(
  { description, status }: FeedEntry,
  body: string | undefined,
): string | undefined {
  const text = body?.trim();
  if (status !== "in-development") return text || undefined;
  return ["In development.", description, text].filter(Boolean).join("\n\n");
}

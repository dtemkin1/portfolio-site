type FeedEntry = { description: string; inDevelopment?: boolean };

// Feed readers often skip the description, so unfinished work carries it in the full text.
export function feedMarkdown(
  { description, inDevelopment }: FeedEntry,
  body: string | undefined,
): string | undefined {
  const text = body?.trim();
  if (!inDevelopment) return text || undefined;
  return ["In development.", description, text].filter(Boolean).join("\n\n");
}

export type WorkLike = {
  data: { publishDate: Date; draft?: boolean; when?: string };
};

const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const hasPage = (entry: {
  body?: string;
  data: { img?: unknown };
}): boolean => Boolean(entry.body?.trim() || entry.data.img);

export function publishedNewestFirst<T extends WorkLike>(entries: T[]): T[] {
  return entries
    .filter((entry) => !entry.data.draft)
    .sort(
      (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf(),
    );
}

export function timeLabel(data: { publishDate: Date; when?: string }): string {
  return data.when ?? monthYear.format(data.publishDate);
}

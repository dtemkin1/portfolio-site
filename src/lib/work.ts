export type WorkLike = {
  data: { publishDate: Date; draft?: boolean; now?: boolean };
};

export const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const hasPage = (entry: {
  body?: string;
  data: { img?: unknown; publications?: unknown[] };
}): boolean =>
  Boolean(
    entry.body?.trim() || entry.data.img || entry.data.publications?.length,
  );

export const workHref = (id: string): string => `/work/${id}/`;

export const pageLink = ({
  id,
  data,
}: {
  id: string;
  data: { title: string };
}): { title: string; href: string } => ({
  title: data.title,
  href: workHref(id),
});

export const onHomeBoard = (entry: { data: { earlier?: boolean } }): boolean =>
  !entry.data.earlier;

// ongoing work first, then everything newest first
export function publishedNewestFirst<T extends WorkLike>(entries: T[]): T[] {
  return entries
    .filter((entry) => !entry.data.draft)
    .sort(
      (a, b) =>
        Number(Boolean(b.data.now)) - Number(Boolean(a.data.now)) ||
        b.data.publishDate.valueOf() - a.data.publishDate.valueOf(),
    );
}

export function timeLabel(data: { publishDate: Date; now?: boolean }): string {
  return data.now ? "Now" : monthYear.format(data.publishDate);
}

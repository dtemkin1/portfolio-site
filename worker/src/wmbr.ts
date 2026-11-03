import type { Radio } from "../../src/lib/live";

// Structured info (show name and hosts), separate from the HTML-heavy dynamic feed.
export const WMBR_INFO = "https://wmbr.org/cgi-bin/xmlinfo";
export const WMBR_PLAYS = "https://wmbr.org/dynamic.xml";
export const wmbrShowPage = (id: string) =>
  `https://wmbr.org/cgi-bin/show?id=${encodeURIComponent(id)}`;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-z]+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const hex = name[1]?.toLowerCase() === "x";
      const code = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

const clean = (html: string) =>
  decode(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? match[1] : null;
}

export function readInfo(
  xml: string,
): { show: string; hosts: string; id: string } | null {
  const show = clean(tag(xml, "showname") ?? "");
  const hosts = clean(tag(xml, "showhosts") ?? "");
  const id = clean(tag(xml, "showid") ?? "");
  return show && hosts && id ? { show, hosts, id } : null;
}

export function hostedBy(hosts: string, dj: string): boolean {
  const name = dj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${name}\\b`, "i").test(hosts);
}

const toMinutes = (hour: string, minute: string, half: string) =>
  ((Number(hour) % 12) + (/^p/i.test(half) ? 12 : 0)) * 60 + Number(minute);

// The show page lists episodes newest first, so the first date is the one on air.
export function episodeStart(html: string): number | null {
  const match = clean(html).match(
    /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} (\d{1,2}):(\d{2}) (am|pm)\b/i,
  );
  return match ? toMinutes(match[1], match[2], match[3]) : null;
}

// A track counts if it was logged within twelve hours after the start, which covers midnight.
export function currentTrack(
  playsXml: string,
  start: number | null,
): string | null {
  if (start === null) return null;
  const html = decode(tag(playsXml, "wmbr_plays") ?? "");
  const entries = html.matchAll(
    /<p class="recent">\s*(\d{1,2}):(\d{2})\s*([ap])[\s\S]*?<b>([\s\S]*?)<\/b>:([\s\S]*?)<\/p>/gi,
  );
  for (const [, hour, minute, half, artist, title] of entries) {
    const since = (toMinutes(hour, minute, half) - start + 1440) % 1440;
    if (since < 12 * 60) return `${clean(artist)}: ${clean(title)}`;
  }
  return null;
}

export async function liveRadio(
  infoXml: string,
  dj: string,
  read: (url: string) => Promise<string>,
): Promise<Radio | null> {
  const info = readInfo(infoXml);
  if (!info || !hostedBy(info.hosts, dj)) return null;

  // The show is live either way; the track is a bonus if both pages load.
  const track = await Promise.all([
    read(wmbrShowPage(info.id)),
    read(WMBR_PLAYS),
  ])
    .then(([page, plays]) => currentTrack(plays, episodeStart(page)))
    .catch(() => null);
  return { show: info.show, track };
}

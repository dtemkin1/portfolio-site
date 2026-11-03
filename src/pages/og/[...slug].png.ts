import type { APIRoute, GetStaticPaths } from "astro";
import {
  type CssVariable,
  experimental_getFontFileURL,
  fontData,
} from "astro:assets";
import type { CollectionEntry } from "astro:content";
import satori from "satori";
import sharp from "sharp";

import { CARD, projectCard } from "../../lib/card";
import { timeLabel } from "../../lib/work";
import { getPublishedWork } from "../../lib/work-data";

export const getStaticPaths = (async () => {
  const work = await getPublishedWork();
  return work.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}) satisfies GetStaticPaths;

type Weight = 500 | 800 | 900;

// the card-only WOFF files from astro.config.mjs, since Satori can't read WOFF2 or variable fonts
async function font(
  name: string,
  variable: CssVariable,
  weight: Weight,
  requestUrl: URL,
) {
  const src = fontData[variable]
    ?.filter(
      (face) => face.subset === "latin" && face.weight === String(weight),
    )
    .flatMap((face) => face.src)
    .find((file) => file.format === "woff");
  if (!src) throw new Error(`No WOFF file for ${name} ${weight}`);
  const response = await fetch(
    experimental_getFontFileURL(src.url, requestUrl),
  );
  if (!response.ok) throw new Error(`${name} ${weight}: ${response.status}`);
  const data = await response.arrayBuffer();
  return { name, data, weight, style: "normal" as const };
}

let fonts: ReturnType<typeof loadFonts> | undefined;
const loadFonts = (requestUrl: URL) =>
  Promise.all([
    font("Overpass", "--font-card-overpass", 500, requestUrl),
    font("Overpass", "--font-card-overpass", 800, requestUrl),
    font("Doto", "--font-card-doto", 900, requestUrl),
  ]);

export const GET: APIRoute<{ entry: CollectionEntry<"work"> }> = async ({
  props,
  url,
}) => {
  const { data } = props.entry;
  const svg = await satori(
    projectCard({ ...data, when: timeLabel(data) }) as never,
    { ...CARD, fonts: await (fonts ??= loadFonts(url)) },
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};

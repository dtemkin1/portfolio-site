import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import {
  currentTrack,
  episodeStart,
  hostedBy,
  liveRadio,
  readInfo,
} from "../src/wmbr";

// Real copies of WMBR's feeds, saved during "The Willows" and "Bats in the Belfry".
const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url).href),
    "utf8",
  );
const info = fixture("xmlinfo.xml");
const plays = fixture("dynamic.xml");
const showPage = fixture("show.html");

const hostedAs = (host: string) =>
  info.replace(
    /<showhosts>[^<]*<\/showhosts>/,
    `<showhosts>${host}</showhosts>`,
  );
const playsAt = (...entries: [string, string][]) =>
  `<wmbr_plays>${entries
    .map(
      ([time, track]) =>
        `&lt;p class=&quot;recent&quot;&gt;${time}&amp;nbsp;&lt;b&gt;${track.split(": ")[0]}&lt;/b&gt;: ${track.split(": ")[1]}&lt;/p&gt;`,
    )
    .join("\n")}</wmbr_plays>`;

test("reads the show and its hosts from the info feed", () =>
  expect(readInfo(info)).toEqual({
    show: "The Willows",
    hosts: "Jay Sitter",
    id: "9573",
  }));

test("encoded tags in the feed come out as plain text", () => {
  const tagged = info.replace(
    /<showname>[^<]*<\/showname>/,
    "<showname>&lt;script&gt;The Willows&lt;/script&gt;</showname>",
  );
  expect(readInfo(tagged)!.show).toBe("The Willows");
});

test("the DJ has to be a whole word in the hosts", () => {
  expect(hostedBy("Diego Temkin and friends", "temkin")).toBe(true);
  expect(hostedBy("Temkinson", "Temkin")).toBe(false);
  expect(hostedBy("Jay Sitter", "Temkin")).toBe(false);
});

test("a show title containing the DJ's name doesn't make it theirs", () => {
  const titled = info.replace(
    /<showname>[^<]*<\/showname>/,
    "<showname>Breakfast with Temkin</showname>",
  );
  expect(hostedBy(readInfo(titled)!.hosts, "Temkin")).toBe(false);
});

test("reads when the current episode started", () =>
  expect(episodeStart(showPage)).toBe(22 * 60));

test("an unexpected show page has no start time", () =>
  expect(episodeStart("<html>no schedule</html>")).toBeNull());

test("the newest track logged since the episode started is current", () =>
  expect(currentTrack(plays, 21 * 60)).toBe("The Cure: Disintegration"));

test("tracks from the show before don't count", () =>
  expect(
    currentTrack(
      playsAt(["9:58p", "Previous DJ: Their Song"], ["9:40p", "Older: Song"]),
      22 * 60,
    ),
  ).toBeNull());

test("a track logged after midnight still counts for a late show", () =>
  expect(currentTrack(playsAt(["12:10a", "Late: Night"]), 23 * 60)).toBe(
    "Late: Night",
  ));

test("with no start time, no track is shown", () =>
  expect(currentTrack(plays, null)).toBeNull());

test("entities in titles are decoded", () =>
  expect(
    currentTrack(
      playsAt(["10:05p", "Simon &amp;amp; Garfunkel: Mrs. Robinson&amp;#39;s"]),
      22 * 60,
    ),
  ).toBe("Simon & Garfunkel: Mrs. Robinson's"));

test.each(["&amp;#99999999;", "&amp;#x110000;", "&amp;#xZZ;"])(
  "a bad character code (%s) is skipped, not fatal",
  (entity) =>
    expect(
      currentTrack(playsAt(["10:05p", `Artist: Song ${entity}`]), 22 * 60),
    ).toMatch(/^Artist: Song/),
);

test("someone else's show is not live", async () =>
  expect(await liveRadio(info, "Temkin", async () => "")).toBeNull());

test("the DJ's show is live, with the track logged since it started", async () => {
  const pages: string[] = [];
  const radio = await liveRadio(
    hostedAs("Diego Temkin").replace("The Willows", "Evacuate the Station!"),
    "Temkin",
    async (url) => {
      pages.push(url);
      return url.includes("show?id=9573")
        ? showPage
        : playsAt(["10:05p", "Mine: First"], ["9:58p", "Previous DJ: Theirs"]);
    },
  );
  expect(radio).toEqual({
    show: "Evacuate the Station!",
    track: "Mine: First",
  });
  expect(pages.some((url) => url.includes("id=9573"))).toBe(true);
});

test("the DJ's show stays live if the track sources fail", async () =>
  expect(
    await liveRadio(hostedAs("Temkin"), "Temkin", async () => {
      throw new Error("down");
    }),
  ).toEqual({ show: "The Willows", track: null }));

test.each(["", "<html>not the feed</html>", "<wmbrinfo></wmbrinfo>"])(
  "an unexpected info feed is not live (%j)",
  async (xml) =>
    expect(await liveRadio(xml, "Temkin", async () => "")).toBeNull(),
);

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import worker, { type Env } from "../src/index";
import { MUSIC_COOLDOWN_SECONDS, resetSpotifyToken } from "../src/spotify";
import { LIVE_CONFIG, type LiveFeed } from "../../src/lib/live";

const fixture = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url).href),
    "utf8",
  );
// WMBR says Temkin is on air.
const info = fixture("xmlinfo.xml")
  .replace(
    /<showname>[^<]*<\/showname>/,
    "<showname>Evacuate the Station!</showname>",
  )
  .replace(/<showhosts>[^<]*<\/showhosts>/, "<showhosts>Temkin</showhosts>");
const showPage = fixture("show.html");
// The episode starts at 10:00 pm, so the newest logged track is moved after that.
const plays = fixture("dynamic.xml").replace("9:40p", "10:05p");

const soon = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

const predictions = {
  data: [
    {
      attributes: {
        arrival_time: soon(3),
        departure_time: soon(4),
        direction_id: 1,
      },
      relationships: {
        trip: { data: { id: "north" } },
        stop: { data: { id: "70072" } },
        vehicle: { data: null },
      },
    },
  ],
  included: [
    { id: "north", type: "trip", attributes: { headsign: "Alewife" } },
  ],
};

const alerts = {
  data: [
    {
      attributes: {
        effect: "DELAY",
        severity: 5,
        short_header: "Delays of about 10 minutes",
        informed_entity: [{ route: "Red", activities: ["BOARD"] }],
      },
    },
  ],
};

const spotify = {
  is_playing: true,
  currently_playing_type: "track",
  item: { name: "Song", artists: [{ name: "Artist" }] },
};

const env: Env = {
  MBTA_KEY: "mbta-secret",
  SPOTIFY_CLIENT_ID: "spotify-id",
  SPOTIFY_CLIENT_SECRET: "spotify-secret",
  SPOTIFY_REFRESH_TOKEN: "spotify-refresh",
};

let failing: string[] = [];
let calls: string[] = [];

const host = (url: string) => new URL(url).hostname;
const toSpotify = (url: string) => host(url).endsWith(".spotify.com");

beforeEach(() => {
  resetSpotifyToken();
  failing = [];
  calls = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const source = url.includes("/predictions")
      ? "predictions"
      : url.includes("/alerts")
        ? "alerts"
        : toSpotify(url)
          ? "spotify"
          : host(url) === "wmbr.org"
            ? "wmbr"
            : "other";
    if (failing.includes(source)) return new Response("down", { status: 503 });
    if (source === "wmbr") {
      if (url.includes("xmlinfo")) return new Response(info);
      if (url.includes("cgi-bin/show")) return new Response(showPage);
      return new Response(plays);
    }
    if (host(url) === "accounts.spotify.com") {
      return Response.json({
        access_token: "spotify-access",
        expires_in: 3600,
      });
    }
    const body = { predictions, alerts, spotify }[source as "alerts"];
    return Response.json(body ?? {});
  });
});

afterEach(() => vi.unstubAllGlobals());

const ask = (origin: string | null, path = "/live", withEnv = env) =>
  worker.fetch(
    new Request(`https://api.diegotemkin.com${path}`, {
      headers: origin ? { Origin: origin } : {},
    }),
    withEnv,
  );

test("answers the site with every feed", async () => {
  const response = await ask("https://www.diegotemkin.com");
  expect(response.status).toBe(200);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    "https://www.diegotemkin.com",
  );
  const body = (await response.json()) as LiveFeed;
  expect(body.trains).toHaveLength(1);
  expect(body.trains?.[0]).toMatchObject({
    headsign: "Alewife",
    tripId: "north",
  });
  expect(typeof body.trains?.[0].time).toBe("number");
  expect(body.alerts).toEqual([
    { text: "Delays of about 10 minutes", severe: false },
  ]);
  expect(body.song).toEqual({ song: "Song", artist: "Artist" });
  expect(body.radio).toEqual({
    show: "Evacuate the Station!",
    track: "The Cure: Disintegration",
  });
  expect(Math.abs(body.at - Date.now())).toBeLessThan(5_000);
});

test.each([
  "https://diegotemkin.com",
  "http://localhost:4321",
  "http://127.0.0.1:4410",
])("answers %s", async (origin) =>
  expect((await ask(origin)).status).toBe(200),
);

test.each([
  "https://example.com",
  "https://diegotemkin.com.evil.test",
  "http://localhost.evil.test",
])("refuses %s", async (origin) =>
  expect((await ask(origin)).status).toBe(403),
);

test("refuses requests with no origin", async () =>
  expect((await ask(null)).status).toBe(403));

test("other paths are not found", async () =>
  expect((await ask("https://www.diegotemkin.com", "/keys")).status).toBe(404));

test("keys never appear in the response", async () => {
  const text = await (await ask("https://www.diegotemkin.com")).text();
  expect(text).not.toContain("mbta-secret");
  expect(text).not.toContain("spotify-secret");
  expect(text).not.toContain("spotify-refresh");
  expect(text).not.toContain("spotify-access");
});

test("keys are sent upstream", async () => {
  await ask("https://www.diegotemkin.com");
  expect(calls.some((url) => url.includes("api_key=mbta-secret"))).toBe(true);
  expect(calls.some((url) => host(url) === "api.spotify.com")).toBe(true);
});

test("a failed source only empties its own part", async () => {
  failing = ["predictions", "wmbr"];
  resetSpotifyToken();
  const body = (await (
    await ask("https://www.diegotemkin.com")
  ).json()) as LiveFeed;
  expect(body.trains).toBeNull();
  expect(body.radio).toBeNull();
  expect(body.alerts).toHaveLength(1);
  expect(body.song).not.toBeNull();
});

test("failed alerts are null, not an empty list", async () => {
  failing = ["alerts"];
  const body = (await (
    await ask("https://www.diegotemkin.com")
  ).json()) as LiveFeed;
  expect(body.alerts).toBeNull();
});

test("music is skipped without Spotify settings", async () => {
  const body = (await (
    await ask("https://www.diegotemkin.com", "/live", { MBTA_KEY: "k" })
  ).json()) as LiveFeed;
  expect(body.song).toBeNull();
  expect(calls.some(toSpotify)).toBe(false);
});

test("turning music off stops the Spotify calls, not just the row", async () => {
  LIVE_CONFIG.music = false;
  try {
    const body = (await (
      await ask("https://www.diegotemkin.com")
    ).json()) as LiveFeed;
    expect(body.song).toBeNull();
    expect(calls.some(toSpotify)).toBe(false);
  } finally {
    LIVE_CONFIG.music = true;
  }
});

test("someone else on WMBR means no show page or plays are fetched", async () => {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("xmlinfo")) return new Response(fixture("xmlinfo.xml"));
    return Response.json({ data: [] });
  });
  const body = (await (
    await ask("https://www.diegotemkin.com")
  ).json()) as LiveFeed;
  expect(body.radio).toBeNull();
  expect(calls.some((url) => url.includes("cgi-bin/show"))).toBe(false);
  expect(calls.some((url) => url.includes("dynamic.xml"))).toBe(false);
});

test("after a Spotify failure, the Worker waits before asking again", async () => {
  failing = ["spotify"];
  await ask("https://www.diegotemkin.com");
  const before = calls.filter(toSpotify).length;
  failing = [];
  const body = (await (
    await ask("https://www.diegotemkin.com")
  ).json()) as LiveFeed;
  expect(calls.filter(toSpotify).length).toBe(before);
  expect(body.song).toBeNull();
  expect(MUSIC_COOLDOWN_SECONDS).toBeGreaterThan(0);
});

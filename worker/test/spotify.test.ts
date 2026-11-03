import { beforeEach, expect, test, vi } from "vitest";

import { currentSong, playingSong, resetSpotifyToken } from "../src/spotify";

const env = {
  SPOTIFY_CLIENT_ID: "client-id",
  SPOTIFY_CLIENT_SECRET: "client-secret",
  SPOTIFY_REFRESH_TOKEN: "refresh-token",
};

const track = (overrides = {}) => ({
  is_playing: true,
  currently_playing_type: "track",
  item: {
    name: "Humming",
    artists: [{ name: "Gracie Abrams" }, { name: "Aaron Dessner" }],
  },
  ...overrides,
});

test("reads the song and every artist", () =>
  expect(playingSong(track())).toEqual({
    song: "Humming",
    artist: "Gracie Abrams, Aaron Dessner",
  }));

test.each([
  ["paused", track({ is_playing: false })],
  ["a podcast", track({ currently_playing_type: "episode" })],
  ["an ad", track({ currently_playing_type: "ad", item: null })],
  ["nothing", null],
  ["something unexpected", { oops: true }],
])("shows nothing for %s", (_, body) => expect(playingSong(body)).toBeNull());

let requests: { url: string; init?: RequestInit }[] = [];
let tokenCalls = 0;
let nowPlaying: () => Response;

beforeEach(() => {
  resetSpotifyToken();
  requests = [];
  tokenCalls = 0;
  nowPlaying = () => Response.json(track());
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.startsWith("https://accounts.spotify.com/api/token")) {
      tokenCalls += 1;
      return Response.json({
        access_token: `access-${tokenCalls}`,
        expires_in: 3600,
      });
    }
    if (
      url.startsWith("https://api.spotify.com/v1/me/player/currently-playing")
    ) {
      return nowPlaying();
    }
    return new Response("not found", { status: 404 });
  });
});

test("trades the refresh token for an access token, then asks what's playing", async () => {
  expect(await currentSong(env, 0)).toEqual({
    song: "Humming",
    artist: "Gracie Abrams, Aaron Dessner",
  });
  const token = requests[0];
  expect(token.init?.method).toBe("POST");
  expect(String(token.init?.body)).toContain("grant_type=refresh_token");
  expect(String(token.init?.body)).toContain("refresh_token=refresh-token");
  expect(new Headers(token.init?.headers).get("Authorization")).toBe(
    `Basic ${btoa("client-id:client-secret")}`,
  );
  expect(new Headers(requests[1].init?.headers).get("Authorization")).toBe(
    "Bearer access-1",
  );
});

test("reuses the access token until it expires", async () => {
  await currentSong(env, 0);
  await currentSong(env, 60_000);
  expect(tokenCalls).toBe(1);
  await currentSong(env, 3_600_000);
  expect(tokenCalls).toBe(2);
});

test("nothing playing is not an error", async () => {
  nowPlaying = () => new Response(null, { status: 204 });
  expect(await currentSong(env, 0)).toBeNull();
});

test("a Spotify failure is an error, so the row hides", async () => {
  nowPlaying = () => new Response("down", { status: 503 });
  await expect(currentSong(env, 0)).rejects.toThrow();
});

test("a rejected token is retried once with a fresh one", async () => {
  let first = true;
  nowPlaying = () => {
    if (first) {
      first = false;
      return new Response("expired", { status: 401 });
    }
    return Response.json(track());
  };
  expect(await currentSong(env, 0)).not.toBeNull();
  expect(tokenCalls).toBe(2);
});

test("without Spotify settings, nothing is requested", async () => {
  expect(await currentSong({}, 0)).toBeNull();
  expect(requests).toHaveLength(0);
});

test("a failure starts a cooldown, honoring Retry-After", async () => {
  nowPlaying = () =>
    new Response("slow down", {
      status: 429,
      headers: { "Retry-After": "120" },
    });
  await expect(currentSong(env, 0)).rejects.toThrow();
  nowPlaying = () => Response.json(track());
  const asked = requests.length;
  await expect(currentSong(env, 60_000)).rejects.toThrow();
  expect(requests).toHaveLength(asked);
  expect(await currentSong(env, 121_000)).not.toBeNull();
});

test("a failed token refresh also starts a cooldown", async () => {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    requests.push({ url: String(input) });
    return new Response("revoked", { status: 400 });
  });
  await expect(currentSong(env, 0)).rejects.toThrow();
  const asked = requests.length;
  await expect(currentSong(env, 10_000)).rejects.toThrow();
  expect(requests).toHaveLength(asked);
});

test("the song is shared through the edge cache when there is one", async () => {
  const stored = new Map<string, Response>();
  vi.stubGlobal("caches", {
    default: {
      match: async (key: Request) => stored.get(key.url)?.clone(),
      put: async (key: Request, value: Response) => {
        stored.set(key.url, value);
      },
    },
  });
  try {
    await currentSong(env, 0);
    resetSpotifyToken();
    const asked = requests.length;
    expect(await currentSong(env, 1_000)).toEqual({
      song: "Humming",
      artist: "Gracie Abrams, Aaron Dessner",
    });
    expect(requests).toHaveLength(asked);
  } finally {
    vi.unstubAllGlobals();
  }
});

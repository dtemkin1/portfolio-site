import type { Song } from "../../src/lib/live";

export interface SpotifyEnv {
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REFRESH_TOKEN?: string;
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const SONG_SECONDS = 20;
export const MUSIC_COOLDOWN_SECONDS = 60;
const CACHE_KEY = "https://api.diegotemkin.com/__cache/spotify-now-playing";

// The token stays in one Worker's memory; the song is also shared through the edge cache below.
let token: { value: string; expires: number } | null = null;
let recent: { song: Song | null; at: number } | null = null;
let coolingUntil = 0;

export function resetSpotifyToken() {
  token = null;
  recent = null;
  coolingUntil = 0;
}

const edgeCache = () =>
  typeof caches === "undefined"
    ? null
    : (caches as unknown as { default: Cache }).default;

async function cachedSong(): Promise<{ song: Song | null } | null> {
  const hit = await edgeCache()?.match(new Request(CACHE_KEY));
  return hit ? hit.json() : null;
}

async function shareSong(song: Song | null) {
  await edgeCache()?.put(
    new Request(CACHE_KEY),
    Response.json(
      { song },
      { headers: { "Cache-Control": `max-age=${SONG_SECONDS}` } },
    ),
  );
}

// After a failure, wait before asking Spotify again, for as long as its Retry-After says.
function coolDown(response: Response | null, now: number) {
  const asked = Number(response?.headers.get("Retry-After"));
  const seconds = asked > 0 ? asked : MUSIC_COOLDOWN_SECONDS;
  coolingUntil = now + seconds * 1000;
}

export function playingSong(body: unknown): Song | null {
  const playing = body as {
    is_playing?: boolean;
    currently_playing_type?: string;
    item?: { name?: string; artists?: { name?: string }[] } | null;
  } | null;
  if (!playing?.is_playing || playing.currently_playing_type !== "track") {
    return null;
  }
  const name = playing.item?.name;
  if (!name) return null;
  const artist = (playing.item?.artists ?? [])
    .map((artist) => artist.name)
    .filter(Boolean)
    .join(", ");
  return { song: name, artist };
}

async function accessToken(env: Required<SpotifyEnv>, now: number) {
  if (token && token.expires > now) return token.value;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }).toString(),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Spotify token ${response.status}`);
  const { access_token, expires_in } = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  // Refresh a minute early, so a token never expires mid-request.
  token = { value: access_token, expires: now + (expires_in - 60) * 1000 };
  return access_token;
}

async function askSpotify(env: Required<SpotifyEnv>, now: number) {
  return fetch(NOW_PLAYING_URL, {
    headers: { Authorization: `Bearer ${await accessToken(env, now)}` },
    signal: AbortSignal.timeout(8_000),
  });
}

export async function currentSong(
  env: SpotifyEnv,
  now: number = Date.now(),
): Promise<Song | null> {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } =
    env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    return null;
  }
  if (recent && now - recent.at < SONG_SECONDS * 1000) return recent.song;
  if (now < coolingUntil) throw new Error("Spotify is cooling down");

  const shared = await cachedSong();
  if (shared) {
    recent = { song: shared.song, at: now };
    return shared.song;
  }

  const settings = {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
  };
  let response: Response | null = null;
  try {
    response = await askSpotify(settings, now);
    if (response.status === 401) {
      token = null;
      response = await askSpotify(settings, now);
    }
  } catch (error) {
    coolDown(response, now);
    throw error;
  }
  if (response.status !== 204 && !response.ok) {
    coolDown(response, now);
    throw new Error(`Spotify ${response.status}`);
  }

  const song =
    response.status === 204 ? null : playingSong(await response.json());
  recent = { song, at: now };
  await shareSong(song);
  return song;
}

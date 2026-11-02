export const LIVE_CONFIG = {
  title: "Live at Kendall/MIT",
  color: "#ff5a4d",
  stop: "place-knncl",
  route: "Red",
  routeName: "Red Line",
  music: false,
  // update later...
  lastfmUser: "",
};

export type Departure = { headsign: string; label: string };
export type Song = { song: string; artist: string };

type Prediction = {
  attributes?: { departure_time?: string | null; direction_id?: number };
  relationships?: { trip?: { data?: { id?: string } } };
};

type Trip = { id?: string; attributes?: { headsign?: string } };

export function predictionsUrl(): string {
  const url = new URL("https://api-v3.mbta.com/predictions");
  url.searchParams.set("filter[stop]", LIVE_CONFIG.stop);
  url.searchParams.set("filter[route]", LIVE_CONFIG.route);
  url.searchParams.set("include", "trip");
  url.searchParams.set("sort", "departure_time");
  return url.href;
}

export function recentTracksUrl(
  apiKey: string,
  user: string = LIVE_CONFIG.lastfmUser,
): string {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", user);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  return url.href;
}

export function departureLabel(departure: number, now: number): string {
  const minutes = Math.floor((departure - now) / 60_000);
  return minutes < 1 ? "Arriving" : `${minutes} min`;
}

// Throws on a malformed body, so a broken response can't pass for "no trains".
export function nextDepartures(body: unknown, now: number): Departure[] {
  const { data, included } = (body ?? {}) as {
    data?: Prediction[];
    included?: Trip[];
  };
  if (!Array.isArray(data)) throw new Error("Unexpected MBTA response");

  const headsigns = new Map(
    (included ?? []).map((trip) => [trip.id, trip.attributes?.headsign]),
  );
  const soonest = new Map<number, { time: number; headsign: string }>();

  for (const prediction of data) {
    const departure = prediction.attributes?.departure_time;
    const direction = prediction.attributes?.direction_id;
    const headsign = headsigns.get(prediction.relationships?.trip?.data?.id);
    if (!departure || direction === undefined || !headsign) continue;

    const time = new Date(departure).getTime();
    const current = soonest.get(direction);
    if (time >= now && (!current || time < current.time)) {
      soonest.set(direction, { time, headsign });
    }
  }

  // Direction 1 is toward Alewife, so the northbound train stays on top.
  return [...soonest.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, { time, headsign }]) => ({
      headsign,
      label: departureLabel(time, now),
    }));
}

export function arrivalLines(departures: Departure[]): string[] {
  if (departures.length === 0) return ["No trains predicted"];
  return departures.map(
    ({ headsign, label }) =>
      `${LIVE_CONFIG.routeName} to ${headsign}: ${label}`,
  );
}

export function nowPlaying(body: unknown): Song | null {
  const tracks = (body as { recenttracks?: { track?: unknown } } | null)
    ?.recenttracks?.track;
  const track = (Array.isArray(tracks) ? tracks[0] : tracks) as
    | {
        name?: string;
        artist?: { "#text"?: string };
        "@attr"?: { nowplaying?: string };
      }
    | undefined;
  if (track?.["@attr"]?.nowplaying !== "true" || !track.name) return null;
  return { song: track.name, artist: track.artist?.["#text"] ?? "" };
}

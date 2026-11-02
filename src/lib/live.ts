export const LIVE_CONFIG = {
  title: "Live at Kendall/MIT",
  color: "#ff5a4d",
  stop: "place-knncl",
  route: "Red",
  routeName: "Red Line",
  music: true,
  lastfmUser: "",
};

export type Departure = {
  tripId: string;
  headsign: string;
  label: string;
  minutes: number | null;
  held?: boolean;
};
export type Song = { song: string; artist: string };
export type Alert = { text: string; severe: boolean };

type RawAlert = {
  effect?: string;
  severity?: number;
  short_header?: string | null;
  header?: string | null;
  informed_entity?: { route?: string; stop?: string; activities?: string[] }[];
};

type Prediction = {
  attributes?: {
    arrival_time?: string | null;
    departure_time?: string | null;
    direction_id?: number;
    status?: string | null;
    schedule_relationship?: string | null;
  };
  relationships?: {
    trip?: { data?: { id?: string } };
    stop?: { data?: { id?: string } };
    vehicle?: { data?: { id?: string } | null };
  };
};

type Included = {
  id?: string;
  type?: string;
  attributes?: { headsign?: string; current_status?: string };
  relationships?: { stop?: { data?: { id?: string } } };
};

export function predictionsUrl(apiKey?: string): string {
  const url = new URL("https://api-v3.mbta.com/predictions");
  if (apiKey) url.searchParams.set("api_key", apiKey);
  url.searchParams.set("filter[stop]", LIVE_CONFIG.stop);
  url.searchParams.set("filter[route]", LIVE_CONFIG.route);
  url.searchParams.set("include", "trip,vehicle");
  url.searchParams.set("sort", "departure_time");
  url.searchParams.set(
    "fields[prediction]",
    "arrival_time,departure_time,direction_id,status,schedule_relationship",
  );
  url.searchParams.set("fields[trip]", "headsign");
  url.searchParams.set("fields[vehicle]", "current_status");
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

// Wording and thresholds follow the MBTA's Real-Time Display Guidelines.
export function countdownLabel(seconds: number): string {
  if (seconds <= 30) return "Arriving";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const remainder = minutes % 60;
  const hours = `${Math.floor(minutes / 60)} hr`;
  return remainder ? `${hours} ${remainder} min` : hours;
}

const timeOf = (value?: string | null) =>
  value ? new Date(value).getTime() : null;

function readPrediction(
  prediction: Prediction,
  included: Included[],
  now: number,
): (Departure & { direction: number; seconds: number }) | null {
  const {
    arrival_time,
    departure_time,
    direction_id: direction,
    status,
    schedule_relationship,
  } = prediction.attributes ?? {};
  const { trip, stop, vehicle } = prediction.relationships ?? {};
  const find = (type: string, id?: string) =>
    included.find((item) => item.type === type && item.id === id);

  const tripId = trip?.data?.id;
  const headsign = find("trip", tripId)?.attributes?.headsign;
  if (!tripId || !headsign || direction === undefined) return null;
  if (schedule_relationship === "CANCELED") return null;
  if (schedule_relationship === "SKIPPED") return null;

  const arrival = timeOf(arrival_time);
  const departure = timeOf(departure_time);
  const seconds = ((arrival ?? departure ?? Infinity) - now) / 1000;
  const shared = { tripId, headsign, direction, seconds };

  if (status) return { ...shared, label: status, minutes: null };
  if (departure === null) return null;

  const train = find("vehicle", vehicle?.data?.id);
  const stoppedHere =
    train?.attributes?.current_status === "STOPPED_AT" &&
    train.relationships?.stop?.data?.id === stop?.data?.id;
  const waitingToLeave = arrival !== null && arrival < now && departure > now;
  if (stoppedHere && (seconds <= 90 || waitingToLeave)) {
    return { ...shared, label: "Boarding", minutes: null };
  }

  if (departure < now) return null;
  return {
    ...shared,
    label: countdownLabel(seconds),
    minutes: seconds <= 30 ? null : Math.round(seconds / 60),
  };
}

// Throws on a malformed body, so a broken response can't pass for "no trains".
export function nextDepartures(body: unknown, now: number): Departure[] {
  const { data, included = [] } = (body ?? {}) as {
    data?: Prediction[];
    included?: Included[];
  };
  if (!Array.isArray(data)) throw new Error("Unexpected MBTA response");

  const soonest = new Map<number, ReturnType<typeof readPrediction>>();
  for (const prediction of data) {
    const read = readPrediction(prediction, included, now);
    if (!read) continue;
    const current = soonest.get(read.direction);
    if (!current || read.seconds < current.seconds) {
      soonest.set(read.direction, read);
    }
  }

  // Direction 1 is toward Alewife, so the northbound train stays on top.
  return [...soonest.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, read]) => {
      if (!read) return [];
      const { tripId, headsign, label, minutes } = read;
      return [{ tripId, headsign, label, minutes }];
    });
}

// Holds a one-minute jump upward for one refresh, so a time near a rounding
// boundary doesn't flip back and forth. A real delay still shows on the next one.
export function steadyDepartures(
  previous: Departure[] | null,
  next: Departure[],
): Departure[] {
  return next.map((departure) => {
    const before = previous?.find(({ tripId }) => tripId === departure.tripId);
    const jumped =
      before?.minutes != null &&
      departure.minutes != null &&
      departure.minutes === before.minutes + 1;
    if (!before || !jumped || before.held) return departure;
    return {
      ...departure,
      label: before.label,
      minutes: before.minutes,
      held: true,
    };
  });
}

export function alertsUrl(apiKey?: string): string {
  const url = new URL("https://api-v3.mbta.com/alerts");
  if (apiKey) url.searchParams.set("api_key", apiKey);
  url.searchParams.set("filter[route]", LIVE_CONFIG.route);
  url.searchParams.set("filter[datetime]", "NOW");
  url.searchParams.set(
    "fields[alert]",
    "effect,severity,short_header,header,informed_entity",
  );
  return url.href;
}

const LINE_WIDE = new Set(["SUSPENSION", "SHUTTLE"]);
const CLOSURES = new Set(["STATION_CLOSURE", "STOP_CLOSURE"]);
const RIDER_ACTIVITIES = new Set(["BOARD", "EXIT", "RIDE"]);
const MIN_DELAY_SEVERITY = 3;
const MAX_ALERTS = 2;

// Line-wide problems matter wherever they are, but a closed station only matters here.
export function relevantAlerts(body: unknown): Alert[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];

  const alerts: Alert[] = [];
  for (const { attributes } of data as { attributes?: RawAlert }[]) {
    const {
      effect = "",
      severity = 0,
      short_header,
      header,
    } = attributes ?? {};
    const text = short_header || header;
    const entities = (attributes?.informed_entity ?? []).filter(
      ({ route, activities }) =>
        route === LIVE_CONFIG.route &&
        activities?.some((activity) => RIDER_ACTIVITIES.has(activity)),
    );
    if (!text || entities.length === 0) continue;

    const atThisStop = entities.some(
      ({ stop }) => !stop || stop === LIVE_CONFIG.stop,
    );
    if (LINE_WIDE.has(effect) || (CLOSURES.has(effect) && atThisStop)) {
      alerts.push({ text, severe: true });
    } else if (effect === "DELAY" && severity >= MIN_DELAY_SEVERITY) {
      alerts.push({ text, severe: false });
    }
  }

  return alerts
    .sort((a, b) => Number(b.severe) - Number(a.severe))
    .slice(0, MAX_ALERTS);
}

export function arrivalLines(
  departures: Departure[],
  alerts: Alert[] = [],
): string[] {
  const trains = departures.map(
    ({ headsign, label }) =>
      `${LIVE_CONFIG.routeName} to ${headsign}: ${label}`,
  );
  return [
    ...alerts.filter(({ severe }) => severe).map(({ text }) => text),
    ...(trains.length > 0 ? trains : ["No trains predicted"]),
    ...alerts.filter(({ severe }) => !severe).map(({ text }) => text),
  ];
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

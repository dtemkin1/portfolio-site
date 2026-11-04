export const LIVE_CONFIG = {
  title: "Live at Kendall/MIT",
  color: "#ff5a4d",
  musicColor: "#1db954",
  stop: "place-knncl",
  route: "Red",
  routeName: "Red Line",
  music: true,
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
export type Radio = { show: string; track: string | null };
export type FirstTrain = { headsign: string; at: number };
export type Night = { firstTrains: FirstTrain[] };
export type Weather = {
  kind: "snow" | "rain" | "ice" | "storm" | "fog" | "heat" | "cold";
  text: string;
};
export type Building = { repo: string; at: number };

// null means source failed
export type LiveFeed = {
  at: number;
  trains: Train[] | null;
  alerts: Alert[] | null;
  song: Song | null;
  radio: Radio | null;
  night: Night | null;
  weather: Weather | null;
  building: Building[] | null;
};

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

// train data worker sends over
export type Train = {
  tripId: string;
  headsign: string;
  direction: number;
  time: number | null;
  leaves: number | null;
  fixed?: string;
};

function readPrediction(
  prediction: Prediction,
  included: Included[],
  now: number,
): Train | null {
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
  const time = arrival ?? departure;
  const shared = { tripId, headsign, direction, time, leaves: departure };

  if (status) return { ...shared, fixed: status };
  if (departure === null) return null;

  const train = find("vehicle", vehicle?.data?.id);
  const stoppedHere =
    train?.attributes?.current_status === "STOPPED_AT" &&
    train.relationships?.stop?.data?.id === stop?.data?.id;
  const seconds = ((time ?? departure) - now) / 1000;
  const waitingToLeave = arrival !== null && arrival < now && departure > now;
  if (stoppedHere && (seconds <= 90 || waitingToLeave)) {
    return { ...shared, fixed: "Boarding" };
  }

  if (departure < now) return null;
  return shared;
}

// throws when body is bad, but empty array if no trains
export function nextDepartures(body: unknown, now: number): Train[] {
  const { data, included = [] } = (body ?? {}) as {
    data?: Prediction[];
    included?: Included[];
  };
  if (!Array.isArray(data)) throw new Error("Unexpected MBTA response");

  const order = (train: Train) => train.time ?? Infinity;
  const trains = data
    .map((prediction) => readPrediction(prediction, included, now))
    .filter((train): train is Train => train !== null)
    .sort((a, b) => order(a) - order(b));

  // Two each way, so the board can fall back to the next train once the first leaves.
  // Direction 1 is toward Alewife, so the northbound trains stay on top.
  return [1, 0].flatMap((direction) =>
    trains.filter((train) => train.direction === direction).slice(0, 2),
  );
}

function departureAt(
  { tripId, headsign, time, leaves, fixed }: Train,
  now: number,
): Departure | null {
  if (fixed) return { tripId, headsign, label: fixed, minutes: null };
  if (time === null || (leaves !== null && leaves < now)) return null;
  const seconds = (time - now) / 1000;
  return {
    tripId,
    headsign,
    label: countdownLabel(seconds),
    minutes: seconds <= 30 ? null : Math.round(seconds / 60),
  };
}

// The first train each way that hasn't left yet.
export function departuresAt(trains: Train[], now: number): Departure[] {
  const shown: Departure[] = [];
  const done = new Set<number>();
  for (const train of trains) {
    if (done.has(train.direction)) continue;
    const departure = departureAt(train, now);
    if (!departure) continue;
    shown.push(departure);
    done.add(train.direction);
  }
  return shown;
}

const bostonClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

const clockTime = (at: number) =>
  bostonClock.format(at).replace(/\s/g, " ").toLowerCase();

export const SERVICE_ENDED = "Service has ended";

export const firstTrainRows = ({ firstTrains }: Night): [string, string][] =>
  firstTrains.map(({ headsign, at }) => [
    `First train to ${headsign}`,
    clockTime(at),
  ]);

export const nightLines = (night: Night): string[] => [
  "The T is asleep. Service has ended for the night.",
  ...firstTrainRows(night).map(([title, time]) => `${title}: ${time}`),
];

const MINUTE = 60_000;

// "14 min ago", "2 hr ago", "3 days ago": short enough for a board row.
export function agoLabel(at: number, now: number): string {
  const minutes = Math.floor((now - at) / MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function credits({
  mbta,
  song,
  radio,
  weather = false,
  building,
}: {
  mbta: boolean;
  song: boolean;
  radio: boolean;
  weather: boolean;
  building: boolean;
}): string {
  const names = [
    mbta && "the MBTA",
    song && "Spotify",
    radio && "WMBR",
    weather && "Open-Meteo",
    building && "GitHub",
  ].filter((name): name is string => Boolean(name));
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
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

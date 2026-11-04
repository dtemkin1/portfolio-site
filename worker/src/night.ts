import { type FirstTrain, LIVE_CONFIG, type Night } from "../../src/lib/live";

type Scheduled = { at: number; direction: number; headsign: string };

type Schedule = {
  attributes?: { departure_time?: string | null; direction_id?: number };
  relationships?: { trip?: { data?: { id?: string } } };
};

const bostonDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// The MBTA counts trips that start between midnight and 3 am as part of the day before.
export function serviceDate(now: number, days = 0): string {
  const { year, month, day } = Object.fromEntries(
    bostonDate
      .formatToParts(now - 3 * 60 * 60_000)
      .map(({ type, value }) => [type, Number(value)]),
  );
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function schedulesUrl(date: string, apiKey?: string): URL {
  const url = new URL("https://api-v3.mbta.com/schedules");
  if (apiKey) url.searchParams.set("api_key", apiKey);
  url.searchParams.set("filter[stop]", LIVE_CONFIG.stop);
  url.searchParams.set("filter[route]", LIVE_CONFIG.route);
  url.searchParams.set("filter[date]", date);
  url.searchParams.set("fields[schedule]", "departure_time,direction_id");
  url.searchParams.set("include", "trip");
  url.searchParams.set("fields[trip]", "headsign");
  return url;
}

export function lastTrainUrl(date: string, apiKey?: string): string {
  const url = schedulesUrl(date, apiKey);
  url.searchParams.set("sort", "-departure_time");
  url.searchParams.set("page[limit]", "1");
  return url.href;
}

// The morning is enough to find the first train each way, even on a Sunday.
export function firstTrainsUrl(date: string, apiKey?: string): string {
  const url = schedulesUrl(date, apiKey);
  url.searchParams.set("sort", "departure_time");
  url.searchParams.set("filter[max_time]", "08:00");
  return url.href;
}

export function readSchedules(body: unknown): Scheduled[] {
  const { data, included = [] } = (body ?? {}) as {
    data?: Schedule[];
    included?: { id?: string; attributes?: { headsign?: string } }[];
  };
  if (!Array.isArray(data)) throw new Error("Unexpected schedules response");
  return data.flatMap(({ attributes, relationships }) => {
    const time = attributes?.departure_time;
    const direction = attributes?.direction_id;
    const tripId = relationships?.trip?.data?.id;
    const headsign = included.find(({ id }) => id === tripId)?.attributes
      ?.headsign;
    if (!time || direction === undefined || !headsign) return [];
    return [{ at: new Date(time).getTime(), direction, headsign }];
  });
}

// Direction 1 is toward Alewife, so it goes first, as on the board.
export function firstTrains(scheduled: Scheduled[]): FirstTrain[] {
  return [1, 0].flatMap((direction) => {
    const first = scheduled
      .filter((train) => train.direction === direction)
      .sort((a, b) => a.at - b.at)[0];
    return first ? [{ headsign: first.headsign, at: first.at }] : [];
  });
}

const earliest = (scheduled: Scheduled[]) =>
  Math.min(...scheduled.map(({ at }) => at));

// Closed between the service day's last train and the next one's first.
export async function serviceEnded(
  now: number,
  read: (url: string) => Promise<unknown>,
  apiKey?: string,
): Promise<Night | null> {
  const date = serviceDate(now);
  const [first, last] = (
    await Promise.all([
      read(firstTrainsUrl(date, apiKey)),
      read(lastTrainUrl(date, apiKey)),
    ])
  ).map(readSchedules);
  if (first.length === 0 || last.length === 0) return null;
  if (now < earliest(first)) return { firstTrains: firstTrains(first) };
  if (now <= last[0].at) return null;

  const tomorrow = readSchedules(
    await read(firstTrainsUrl(serviceDate(now, 1), apiKey)),
  );
  return { firstTrains: firstTrains(tomorrow) };
}

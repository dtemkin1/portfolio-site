import { expect, test } from "vitest";

import {
  firstTrains,
  firstTrainsUrl,
  lastTrainUrl,
  readSchedules,
  serviceDate,
  serviceEnded,
} from "../src/night";

const at = (iso: string) => new Date(iso).getTime();

// The shape /schedules returns, trimmed to the fields the Worker asks for.
const schedules = (...rows: [string, number, string][]) => ({
  data: rows.map(([time, direction], i) => ({
    attributes: { departure_time: time, direction_id: direction },
    relationships: { trip: { data: { id: `t${i}` } } },
  })),
  included: rows.map(([, , headsign], i) => ({
    id: `t${i}`,
    type: "trip",
    attributes: { headsign },
  })),
});

test("the service day runs until 3 am Boston time", () => {
  expect(serviceDate(at("2026-11-04T02:59:00-05:00"))).toBe("2026-11-03");
  expect(serviceDate(at("2026-11-04T03:00:00-05:00"))).toBe("2026-11-04");
  expect(serviceDate(at("2026-11-04T02:00:00-05:00"), 1)).toBe("2026-11-04");
});

test("the service day follows daylight saving time", () =>
  expect(serviceDate(at("2026-07-01T02:30:00-04:00"))).toBe("2026-06-30"));

test("schedule URLs ask only for Kendall's Red Line trains on one service day", () => {
  const last = new URL(lastTrainUrl("2026-11-03", "key"));
  expect(last.pathname).toBe("/schedules");
  expect(last.searchParams.get("filter[stop]")).toBe("place-knncl");
  expect(last.searchParams.get("filter[route]")).toBe("Red");
  expect(last.searchParams.get("filter[date]")).toBe("2026-11-03");
  expect(last.searchParams.get("sort")).toBe("-departure_time");
  expect(last.searchParams.get("page[limit]")).toBe("1");
  expect(last.searchParams.get("api_key")).toBe("key");

  const first = new URL(firstTrainsUrl("2026-11-04"));
  expect(first.searchParams.get("sort")).toBe("departure_time");
  expect(first.searchParams.get("filter[max_time]")).toBe("08:00");
  expect(first.searchParams.has("api_key")).toBe(false);
});

test("reads departures with their destinations", () =>
  expect(
    readSchedules(schedules(["2026-11-04T05:27:00-05:00", 0, "Ashmont"])),
  ).toEqual([
    { at: at("2026-11-04T05:27:00-05:00"), direction: 0, headsign: "Ashmont" },
  ]));

test("a schedule with no departure or destination is skipped", () => {
  const body = schedules(["2026-11-04T05:27:00-05:00", 0, "Ashmont"]);
  body.data.push({
    attributes: { departure_time: null as unknown as string, direction_id: 1 },
    relationships: { trip: { data: { id: "t0" } } },
  });
  body.data.push({
    attributes: {
      departure_time: "2026-11-04T05:30:00-05:00",
      direction_id: 1,
    },
    relationships: { trip: { data: { id: "missing" } } },
  });
  expect(readSchedules(body)).toHaveLength(1);
});

test("an unexpected schedules response throws", () =>
  expect(() => readSchedules({ errors: [] })).toThrow());

test("the first train each way, Alewife side first", () =>
  expect(
    firstTrains(
      readSchedules(
        schedules(
          ["2026-11-04T05:27:00-05:00", 0, "Ashmont"],
          ["2026-11-04T05:34:00-05:00", 0, "Braintree"],
          ["2026-11-04T05:37:00-05:00", 1, "Alewife"],
        ),
      ),
    ).map(({ headsign }) => headsign),
  ).toEqual(["Alewife", "Ashmont"]));

// A pretend MBTA: the last train of Nov 3 leaves at 12:51 am, and service starts at 5:27 am.
const mbta = async (url: string) => {
  const { searchParams } = new URL(url);
  const date = searchParams.get("filter[date]");
  if (searchParams.get("sort") === "-departure_time") {
    return schedules([
      `${date === "2026-11-03" ? "2026-11-04" : "2026-11-05"}T00:51:00-05:00`,
      1,
      "Alewife",
    ]);
  }
  return schedules(
    [`${date}T05:27:00-05:00`, 0, "Ashmont"],
    [`${date}T05:37:00-05:00`, 1, "Alewife"],
  );
};

test("trains are running in the evening", async () =>
  expect(await serviceEnded(at("2026-11-03T22:00:00-05:00"), mbta)).toBeNull());

test("after the last train, service has ended until tomorrow's first", async () =>
  expect(await serviceEnded(at("2026-11-04T01:30:00-05:00"), mbta)).toEqual({
    firstTrains: [
      { headsign: "Alewife", at: at("2026-11-04T05:37:00-05:00") },
      { headsign: "Ashmont", at: at("2026-11-04T05:27:00-05:00") },
    ],
  }));

test("after 3 am, service is still closed until the day's first train", async () =>
  expect(
    (await serviceEnded(at("2026-11-04T04:30:00-05:00"), mbta))?.firstTrains,
  ).toHaveLength(2));

test("once the first train has run, service is back", async () =>
  expect(await serviceEnded(at("2026-11-04T05:30:00-05:00"), mbta)).toBeNull());

// A day with no Red Line schedules at Kendall is a shutdown, not a night: the alerts explain it.
test("a day without schedules doesn't close the station", async () =>
  expect(
    await serviceEnded(at("2026-11-03T14:00:00-05:00"), async () =>
      schedules(),
    ),
  ).toBeNull());

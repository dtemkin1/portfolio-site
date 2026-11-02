import { expect, test } from "vitest";

import {
  arrivalLines,
  departureLabel,
  nextDepartures,
  nowPlaying,
  predictionsUrl,
  recentTracksUrl,
} from "./live";

const now = new Date("2026-11-02T15:30:00-05:00").getTime();

const prediction = (
  id: string,
  direction: number,
  departure: string | null,
  trip: string,
) => ({
  attributes: { departure_time: departure, direction_id: direction },
  relationships: { trip: { data: { id: trip } } },
  id,
});

const trip = (id: string, headsign: string) => ({
  id,
  type: "trip",
  attributes: { headsign },
});

test("departure label counts whole minutes", () => {
  expect(departureLabel(now + 3.9 * 60_000, now)).toBe("3 min");
});

test.each([0, 30_000, 59_999])("under a minute is Arriving (%i ms)", (ms) =>
  expect(departureLabel(now + ms, now)).toBe("Arriving"),
);

test("keeps the soonest departure in each direction, Alewife side first", () => {
  const out = nextDepartures(
    {
      data: [
        prediction("a", 0, "2026-11-02T15:40:00-05:00", "t2"),
        prediction("b", 0, "2026-11-02T15:36:00-05:00", "t1"),
        prediction("c", 1, "2026-11-02T15:33:00-05:00", "t3"),
      ],
      included: [
        trip("t1", "Ashmont"),
        trip("t2", "Braintree"),
        trip("t3", "Alewife"),
      ],
    },
    now,
  );
  expect(out).toEqual([
    { headsign: "Alewife", label: "3 min" },
    { headsign: "Ashmont", label: "6 min" },
  ]);
});

test("skips past departures and predictions with no departure time", () => {
  const out = nextDepartures(
    {
      data: [
        prediction("a", 1, "2026-11-02T15:20:00-05:00", "t1"),
        prediction("b", 1, null, "t1"),
        prediction("c", 1, "2026-11-02T15:35:00-05:00", "t1"),
      ],
      included: [trip("t1", "Alewife")],
    },
    now,
  );
  expect(out).toEqual([{ headsign: "Alewife", label: "5 min" }]);
});

test("skips a prediction whose trip has no headsign", () => {
  const out = nextDepartures(
    {
      data: [prediction("a", 1, "2026-11-02T15:35:00-05:00", "missing")],
      included: [],
    },
    now,
  );
  expect(out).toEqual([]);
});

test.each([[{}], [null], ["oops"], [{ data: "oops" }], [{ errors: [{}] }]])(
  "a malformed MBTA response throws instead of looking like no trains (%j)",
  (body) => expect(() => nextDepartures(body, now)).toThrow(),
);

test("an empty MBTA response means no trains", () =>
  expect(nextDepartures({ data: [] }, now)).toEqual([]));

test("arrival lines print each direction", () =>
  expect(
    arrivalLines([
      { headsign: "Alewife", label: "3 min" },
      { headsign: "Ashmont", label: "Arriving" },
    ]),
  ).toEqual(["Red Line to Alewife: 3 min", "Red Line to Ashmont: Arriving"]));

test("arrival lines say when nothing is predicted", () =>
  expect(arrivalLines([])).toEqual(["No trains predicted"]));

test("reads the song only while it is playing", () =>
  expect(
    nowPlaying({
      recenttracks: {
        track: [
          {
            name: "Song",
            artist: { "#text": "Artist" },
            "@attr": { nowplaying: "true" },
          },
        ],
      },
    }),
  ).toEqual({ song: "Song", artist: "Artist" }));

test("a finished song is not shown", () =>
  expect(
    nowPlaying({
      recenttracks: {
        track: [{ name: "Old Song", artist: { "#text": "Artist" } }],
      },
    }),
  ).toBeNull());

test("a single track object is handled", () =>
  expect(
    nowPlaying({
      recenttracks: {
        track: {
          name: "Song",
          artist: { "#text": "Artist" },
          "@attr": { nowplaying: "true" },
        },
      },
    }),
  ).toEqual({ song: "Song", artist: "Artist" }));

test.each([[{}], [null], [{ error: 10, message: "Invalid API key" }]])(
  "a bad Last.fm response shows nothing (%j)",
  (body) => expect(nowPlaying(body)).toBeNull(),
);

test("predictions URL asks for the configured stop and route", () => {
  const url = new URL(predictionsUrl());
  expect(url.origin).toBe("https://api-v3.mbta.com");
  expect(url.searchParams.get("filter[stop]")).toBe("place-knncl");
  expect(url.searchParams.get("filter[route]")).toBe("Red");
  expect(url.searchParams.get("include")).toBe("trip");
});

test("recent tracks URL asks for one track for the given user", () => {
  const url = new URL(recentTracksUrl("KEY", "dtemkin1"));
  expect(url.origin).toBe("https://ws.audioscrobbler.com");
  expect(url.searchParams.get("user")).toBe("dtemkin1");
  expect(url.searchParams.get("api_key")).toBe("KEY");
  expect(url.searchParams.get("limit")).toBe("1");
});

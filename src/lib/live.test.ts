import { expect, test } from "vitest";

import {
  alertsUrl,
  arrivalLines,
  countdownLabel,
  credits,
  departuresAt,
  firstTrainRows,
  nextDepartures,
  nightLines,
  predictionsUrl,
  relevantAlerts,
  steadyDepartures,
} from "./live";

const now = new Date("2026-11-02T15:30:00-05:00").getTime();
const at = (seconds: number) => new Date(now + seconds * 1000).toISOString();

type Options = {
  arrival?: number | null;
  departure?: number | null;
  direction?: number;
  status?: string | null;
  relationship?: string | null;
  trip?: string;
  stop?: string;
  vehicle?: string | null;
};

const prediction = ({
  arrival = null,
  departure = null,
  direction = 1,
  status = null,
  relationship = null,
  trip = "north",
  stop = "70072",
  vehicle = null,
}: Options) => ({
  type: "prediction",
  attributes: {
    arrival_time: arrival === null ? null : at(arrival),
    departure_time: departure === null ? null : at(departure),
    direction_id: direction,
    status,
    schedule_relationship: relationship,
  },
  relationships: {
    trip: { data: { id: trip } },
    stop: { data: { id: stop } },
    vehicle: { data: vehicle ? { id: vehicle } : null },
  },
});

const included = [
  { id: "north", type: "trip", attributes: { headsign: "Alewife" } },
  { id: "south", type: "trip", attributes: { headsign: "Ashmont" } },
  { id: "south2", type: "trip", attributes: { headsign: "Braintree" } },
  {
    id: "train",
    type: "vehicle",
    attributes: { current_status: "STOPPED_AT" },
    relationships: { stop: { data: { id: "70072" } } },
  },
  {
    id: "elsewhere",
    type: "vehicle",
    attributes: { current_status: "STOPPED_AT" },
    relationships: { stop: { data: { id: "70070" } } },
  },
  {
    id: "moving",
    type: "vehicle",
    attributes: { current_status: "IN_TRANSIT_TO" },
    relationships: { stop: { data: { id: "70072" } } },
  },
];

const labels = (...data: ReturnType<typeof prediction>[]) =>
  departuresAt(nextDepartures({ data, included }, now), now).map(
    ({ headsign, label }) => [headsign, label],
  );
const label = (options: Options) => labels(prediction(options))[0]?.[1];

test.each([
  [30, "Arriving"],
  [31, "1 min"],
  [89, "1 min"],
  [90, "2 min"],
  [209, "3 min"],
  [210, "4 min"],
  [3540, "59 min"],
  [3599, "1 hr"],
  [3600, "1 hr"],
  [4320, "1 hr 12 min"],
])("%i seconds reads %s", (seconds, expected) =>
  expect(countdownLabel(seconds)).toBe(expected),
);

test("counts down to arrival when there is one", () =>
  expect(label({ arrival: 300, departure: 360 })).toBe("5 min"));

test("counts down to departure when there is no arrival", () =>
  expect(label({ departure: 360 })).toBe("6 min"));

test("a train stopped here within 90 seconds is boarding", () =>
  expect(label({ arrival: 60, departure: 120, vehicle: "train" })).toBe(
    "Boarding",
  ));

test("a train stopped here past its arrival is boarding", () =>
  expect(label({ arrival: -200, departure: 200, vehicle: "train" })).toBe(
    "Boarding",
  ));

test("a train stopped at another stop is not boarding", () =>
  expect(label({ arrival: 60, departure: 120, vehicle: "elsewhere" })).toBe(
    "1 min",
  ));

test("a moving train is not boarding", () =>
  expect(label({ arrival: 20, departure: 90, vehicle: "moving" })).toBe(
    "Arriving",
  ));

test("the prediction status replaces the countdown", () =>
  expect(
    label({ arrival: 300, departure: 360, status: "Stopped 2 stops away" }),
  ).toBe("Stopped 2 stops away"));

test.each(["CANCELED", "SKIPPED"])("a %s trip is hidden", (relationship) =>
  expect(label({ arrival: 300, departure: 360, relationship })).toBeUndefined(),
);

test("a train that can't be boarded is hidden", () =>
  expect(label({ arrival: 300 })).toBeUndefined());

test("a train that has left is hidden", () =>
  expect(label({ arrival: -120, departure: -60 })).toBeUndefined());

test("a prediction with no times or status is hidden", () =>
  expect(label({})).toBeUndefined());

test("keeps the soonest train each way, Alewife side first", () =>
  expect(
    labels(
      prediction({
        arrival: 600,
        departure: 660,
        direction: 0,
        trip: "south2",
      }),
      prediction({ arrival: 360, departure: 400, direction: 0, trip: "south" }),
      prediction({ arrival: 180, departure: 200 }),
    ),
  ).toEqual([
    ["Alewife", "3 min"],
    ["Ashmont", "6 min"],
  ]));

test("a train with no destination is hidden", () =>
  expect(label({ departure: 300, trip: "missing" })).toBeUndefined());

test.each([[{}], [null], ["oops"], [{ data: "oops" }], [{ errors: [{}] }]])(
  "a malformed MBTA response throws instead of looking like no trains (%j)",
  (body) => expect(() => nextDepartures(body, now)).toThrow(),
);

test("an empty MBTA response means no trains", () =>
  expect(nextDepartures({ data: [] }, now)).toEqual([]));

const train = (minutes: number, tripId = "north") => ({
  tripId,
  headsign: "Alewife",
  label: `${minutes} min`,
  minutes,
});

test("a one-minute jump upward waits a refresh before showing", () =>
  expect(steadyDepartures([train(4)], [train(5)])[0].label).toBe("4 min"));

test("the jump shows if the next refresh agrees", () => {
  const held = steadyDepartures([train(4)], [train(5)]);
  expect(steadyDepartures(held, [train(5)])[0].label).toBe("5 min");
});

test("counting down is never held", () =>
  expect(steadyDepartures([train(4)], [train(3)])[0].label).toBe("3 min"));

test("a bigger delay shows right away", () =>
  expect(steadyDepartures([train(4)], [train(7)])[0].label).toBe("7 min"));

test("a different train is never held", () =>
  expect(steadyDepartures([train(4)], [train(5, "other")])[0].label).toBe(
    "5 min",
  ));

test("the first reading is shown as is", () =>
  expect(steadyDepartures(null, [train(5)])[0].label).toBe("5 min"));

test("arrival lines print each direction", () =>
  expect(
    arrivalLines([
      { tripId: "a", headsign: "Alewife", label: "3 min", minutes: 3 },
      { tripId: "b", headsign: "Ashmont", label: "Boarding", minutes: null },
    ]),
  ).toEqual(["Red Line to Alewife: 3 min", "Red Line to Ashmont: Boarding"]));

test("arrival lines say when nothing is predicted", () =>
  expect(arrivalLines([])).toEqual(["No trains predicted"]));

test("predictions URL asks only for what the display needs", () => {
  const url = new URL(predictionsUrl());
  expect(url.origin).toBe("https://api-v3.mbta.com");
  expect(url.searchParams.get("filter[stop]")).toBe("place-knncl");
  expect(url.searchParams.get("filter[route]")).toBe("Red");
  expect(url.searchParams.get("include")).toBe("trip,vehicle");
  expect(url.searchParams.get("fields[prediction]")).toBe(
    "arrival_time,departure_time,direction_id,status,schedule_relationship",
  );
  expect(url.searchParams.get("fields[trip]")).toBe("headsign");
  expect(url.searchParams.get("fields[vehicle]")).toBe("current_status");
});

const alert = (
  effect: string,
  severity: number,
  text: string,
  entities: { route?: string; stop?: string; activities?: string[] }[] = [
    { route: "Red", activities: ["BOARD", "RIDE"] },
  ],
) => ({
  attributes: {
    effect,
    severity,
    short_header: text,
    informed_entity: entities,
  },
});

const at_kendall = [
  { route: "Red", stop: "place-knncl", activities: ["BOARD"] },
];
const elsewhere = [
  { route: "Red", stop: "place-davis", activities: ["BOARD"] },
];

test("alerts URL asks for current alerts on the whole route", () => {
  const url = new URL(alertsUrl());
  expect(url.origin).toBe("https://api-v3.mbta.com");
  expect(url.pathname).toBe("/alerts");
  expect(url.searchParams.get("filter[route]")).toBe("Red");
  expect(url.searchParams.get("filter[datetime]")).toBe("NOW");
  expect(url.searchParams.get("fields[alert]")).toBe(
    "effect,severity,short_header,header,informed_entity",
  );
});

test.each(["SUSPENSION", "SHUTTLE"])(
  "a %s anywhere on the line is severe",
  (e) =>
    expect(
      relevantAlerts({ data: [alert(e, 7, "No trains", elsewhere)] }),
    ).toEqual([{ text: "No trains", severe: true }]),
);

test.each(["STATION_CLOSURE", "STOP_CLOSURE"])(
  "a %s at Kendall/MIT is severe",
  (e) =>
    expect(
      relevantAlerts({ data: [alert(e, 7, "Closed", at_kendall)] }),
    ).toEqual([{ text: "Closed", severe: true }]),
);

test("a closure at another station is left out", () =>
  expect(
    relevantAlerts({ data: [alert("STATION_CLOSURE", 7, "Shut", elsewhere)] }),
  ).toEqual([]));

test("a meaningful delay is shown as informational", () =>
  expect(
    relevantAlerts({ data: [alert("DELAY", 3, "Delays of 10 minutes")] }),
  ).toEqual([{ text: "Delays of 10 minutes", severe: false }]));

test("a minor delay is left out", () =>
  expect(relevantAlerts({ data: [alert("DELAY", 2, "Minor")] })).toEqual([]));

test.each(["STATION_ISSUE", "NOTICE", "ELEVATOR_CLOSURE", "UNKNOWN"])(
  "a %s is left out",
  (e) => expect(relevantAlerts({ data: [alert(e, 9, "Other")] })).toEqual([]),
);

test("an alert about another route is left out", () =>
  expect(
    relevantAlerts({
      data: [
        alert("SUSPENSION", 7, "Orange", [
          { route: "Orange", activities: ["BOARD"] },
        ]),
      ],
    }),
  ).toEqual([]));

test("an alert that doesn't affect riders on board or boarding is left out", () =>
  expect(
    relevantAlerts({
      data: [
        alert("SUSPENSION", 7, "Access", [
          { route: "Red", activities: ["USING_WHEELCHAIR"] },
        ]),
      ],
    }),
  ).toEqual([]));

test("falls back to the full header", () =>
  expect(
    relevantAlerts({
      data: [
        {
          attributes: {
            effect: "SUSPENSION",
            severity: 7,
            short_header: null,
            header: "Full text",
            informed_entity: [{ route: "Red", activities: ["BOARD"] }],
          },
        },
      ],
    }),
  ).toEqual([{ text: "Full text", severe: true }]));

test("severe alerts come first, and only two show", () =>
  expect(
    relevantAlerts({
      data: [
        alert("DELAY", 5, "Delay"),
        alert("SUSPENSION", 7, "First"),
        alert("SHUTTLE", 7, "Second"),
      ],
    }).map(({ text }) => text),
  ).toEqual(["First", "Second"]));

test.each([[{}], [null], ["oops"], [{ data: "oops" }]])(
  "a malformed alerts response shows nothing (%j)",
  (body) => expect(relevantAlerts(body)).toEqual([]),
);

test("arrival lines put severe alerts first and delays last", () =>
  expect(
    arrivalLines(
      [{ tripId: "a", headsign: "Alewife", label: "3 min", minutes: 3 }],
      [
        { text: "Suspended", severe: true },
        { text: "Delayed", severe: false },
      ],
    ),
  ).toEqual(["Suspended", "Red Line to Alewife: 3 min", "Delayed"]));

test.each([
  ["predictions", predictionsUrl],
  ["alerts", alertsUrl],
])("%s URL sends the MBTA key when there is one", (_, url) => {
  expect(new URL(url("KEY")).searchParams.get("api_key")).toBe("KEY");
});

test.each([
  ["predictions", predictionsUrl],
  ["alerts", alertsUrl],
])("%s URL works without a key", (_, url) => {
  expect(new URL(url()).searchParams.has("api_key")).toBe(false);
  expect(new URL(url("")).searchParams.has("api_key")).toBe(false);
});

test("the countdown is worked out from the train's time, not when it was fetched", () => {
  const trains = nextDepartures(
    { data: [prediction({ arrival: 300, departure: 360 })], included },
    now,
  );
  expect(departuresAt(trains, now + 120_000)[0].label).toBe("3 min");
});

test("a train that left after it was fetched is dropped", () => {
  const trains = nextDepartures(
    { data: [prediction({ arrival: 60, departure: 90 })], included },
    now,
  );
  expect(departuresAt(trains, now + 100_000)).toEqual([]);
});

test("boarding and status labels stay as they were", () => {
  const trains = nextDepartures(
    {
      data: [
        prediction({ arrival: 60, departure: 120, vehicle: "train" }),
        prediction({
          arrival: 900,
          departure: 960,
          direction: 0,
          trip: "south",
          status: "Stopped 2 stops away",
        }),
      ],
      included,
    },
    now,
  );
  expect(departuresAt(trains, now + 20_000).map(({ label }) => label)).toEqual([
    "Boarding",
    "Stopped 2 stops away",
  ]);
});

test("trains survive a round trip through JSON", () => {
  const trains = nextDepartures(
    {
      data: [prediction({ status: "Delayed", direction: 0, trip: "south" })],
      included,
    },
    now,
  );
  const copy = JSON.parse(JSON.stringify(trains));
  expect(departuresAt(copy, now)[0].label).toBe("Delayed");
});

test("keeps the next two trains each way, so one leaving doesn't empty a direction", () => {
  const trains = nextDepartures(
    {
      data: [
        prediction({ arrival: 60, departure: 90 }),
        prediction({ arrival: 400, departure: 450, trip: "south2" }),
        prediction({ arrival: 900, departure: 950, trip: "south" }),
      ],
      included,
    },
    now,
  );
  expect(trains.filter(({ direction }) => direction === 1)).toHaveLength(2);
  expect(departuresAt(trains, now + 100_000)).toEqual([
    { tripId: "south2", headsign: "Braintree", label: "5 min", minutes: 5 },
  ]);
});

test("only the soonest train each way is shown", () => {
  const trains = nextDepartures(
    {
      data: [
        prediction({ arrival: 60, departure: 90 }),
        prediction({ arrival: 400, departure: 450, trip: "south2" }),
      ],
      included,
    },
    now,
  );
  expect(departuresAt(trains, now).map(({ tripId }) => tripId)).toEqual([
    "north",
  ]);
});

test("countdowns use the time the Worker sent, not the visitor's clock", () => {
  const trains = nextDepartures(
    { data: [prediction({ arrival: 300, departure: 360 })], included },
    now,
  );
  const workerAt = now + 60_000;
  expect(departuresAt(trains, workerAt)[0].label).toBe("4 min");
});

test("the credit names only the sources being shown", () => {
  expect(credits({ mbta: true, song: false, radio: false })).toBe("the MBTA");
  expect(credits({ mbta: true, song: true, radio: false })).toBe(
    "the MBTA and Spotify",
  );
  expect(credits({ mbta: true, song: true, radio: true })).toBe(
    "the MBTA, Spotify, and WMBR",
  );
  expect(credits({ mbta: false, song: true, radio: false })).toBe("Spotify");
  expect(credits({ mbta: false, song: true, radio: true })).toBe(
    "Spotify and WMBR",
  );
});

const night = {
  firstTrains: [
    {
      headsign: "Alewife",
      at: new Date("2026-11-04T05:37:00-05:00").getTime(),
    },
    {
      headsign: "Ashmont",
      at: new Date("2026-11-04T05:27:00-05:00").getTime(),
    },
  ],
};

test("first trains show in Boston time, whatever the visitor's clock", () =>
  expect(firstTrainRows(night)).toEqual([
    ["First train to Alewife", "5:37 am"],
    ["First train to Ashmont", "5:27 am"],
  ]));

test("the prompt says the T is asleep, then when it wakes up", () =>
  expect(nightLines(night)).toEqual([
    "The T is asleep. Service has ended for the night.",
    "First train to Alewife: 5:37 am",
    "First train to Ashmont: 5:27 am",
  ]));

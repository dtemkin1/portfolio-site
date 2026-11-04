import { expect, test } from "vitest";

import { readWeather, WEATHER_URL } from "../src/weather";

// The shape Open-Meteo returns for current conditions, trimmed to what the Worker asks for.
const current = (weather_code: number, temperature_2m = 40) => ({
  current: { time: "2026-11-04T01:00", temperature_2m, weather_code },
});

test("asks Open-Meteo for Kendall's current temperature and weather, in Fahrenheit", () => {
  const url = new URL(WEATHER_URL);
  expect(url.hostname).toBe("api.open-meteo.com");
  expect(Number(url.searchParams.get("latitude"))).toBeCloseTo(42.3625, 3);
  expect(Number(url.searchParams.get("longitude"))).toBeCloseTo(-71.0862, 3);
  expect(url.searchParams.get("current")).toBe("temperature_2m,weather_code");
  expect(url.searchParams.get("temperature_unit")).toBe("fahrenheit");
});

test("an ordinary day says nothing", () => {
  expect(readWeather(current(3, 61.6))).toBeNull();
  expect(readWeather(current(61))).toBeNull();
  expect(readWeather(current(51))).toBeNull();
});

test.each([
  [71, "light snow at Kendall/MIT. Platforms may be slippery."],
  [73, "snow at Kendall/MIT. Platforms may be slippery."],
  [75, "heavy snow at Kendall/MIT. Allow extra travel time."],
  [86, "heavy snow at Kendall/MIT. Allow extra travel time."],
])("snow code %i is announced as snow", (code, text) =>
  expect(readWeather(current(code, 28))).toEqual({
    kind: "snow",
    text: `Attention passengers: ${text}`,
  }),
);

test.each([
  [63, "rain", "rain at Kendall/MIT. Watch your step on the stairs."],
  [82, "rain", "heavy rain at Kendall/MIT. Watch your step on the stairs."],
  [67, "ice", "freezing rain at Kendall/MIT. Platforms may be icy."],
  [95, "storm", "thunderstorms at Kendall/MIT. Wait inside if you can."],
  [45, "fog", "fog at Kendall/MIT. Visibility is low."],
])("code %i is announced as %s", (code, kind, text) =>
  expect(readWeather(current(code))).toEqual({
    kind,
    text: `Attention passengers: ${text}`,
  }),
);

test("a heat wave is announced with the temperature", () =>
  expect(readWeather(current(0, 93.4))).toEqual({
    kind: "heat",
    text: "Attention passengers: it's 93°F at Kendall/MIT. Stay cool and drink water.",
  }));

test("deep cold is announced with the temperature", () =>
  expect(readWeather(current(1, -3.2))).toEqual({
    kind: "cold",
    text: "Attention passengers: it's -3°F at Kendall/MIT. Bundle up.",
  }));

test("snow wins over cold, since it's the one people can see", () =>
  expect(readWeather(current(73, 5))?.kind).toBe("snow"));

test("an unexpected response throws", () =>
  expect(() => readWeather({ error: true, reason: "bad" })).toThrow());

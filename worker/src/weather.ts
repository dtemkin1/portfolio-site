import type { Weather } from "../../src/lib/live";

const url = new URL("https://api.open-meteo.com/v1/forecast");
url.searchParams.set("latitude", "42.3625");
url.searchParams.set("longitude", "-71.0862");
url.searchParams.set("current", "temperature_2m,weather_code");
url.searchParams.set("temperature_unit", "fahrenheit");
export const WEATHER_URL = url.href;

const HEAT = 90;
const COLD = 10;

// WMO weather codes, as Open-Meteo reports them. Light rain and drizzle aren't worth a notice.
const NOTICES: Record<number, [Weather["kind"], string]> = {
  45: ["fog", "fog at Kendall/MIT. Visibility is low."],
  48: ["fog", "fog at Kendall/MIT. Visibility is low."],
  56: ["ice", "freezing drizzle at Kendall/MIT. Platforms may be icy."],
  57: ["ice", "freezing drizzle at Kendall/MIT. Platforms may be icy."],
  63: ["rain", "rain at Kendall/MIT. Watch your step on the stairs."],
  65: ["rain", "heavy rain at Kendall/MIT. Watch your step on the stairs."],
  66: ["ice", "freezing rain at Kendall/MIT. Platforms may be icy."],
  67: ["ice", "freezing rain at Kendall/MIT. Platforms may be icy."],
  71: ["snow", "light snow at Kendall/MIT. Platforms may be slippery."],
  73: ["snow", "snow at Kendall/MIT. Platforms may be slippery."],
  75: ["snow", "heavy snow at Kendall/MIT. Allow extra travel time."],
  77: ["snow", "light snow at Kendall/MIT. Platforms may be slippery."],
  81: ["rain", "rain at Kendall/MIT. Watch your step on the stairs."],
  82: ["rain", "heavy rain at Kendall/MIT. Watch your step on the stairs."],
  85: ["snow", "light snow at Kendall/MIT. Platforms may be slippery."],
  86: ["snow", "heavy snow at Kendall/MIT. Allow extra travel time."],
  95: ["storm", "thunderstorms at Kendall/MIT. Wait inside if you can."],
  96: ["storm", "thunderstorms at Kendall/MIT. Wait inside if you can."],
  99: ["storm", "thunderstorms at Kendall/MIT. Wait inside if you can."],
};

const announce = (kind: Weather["kind"], text: string): Weather => ({
  kind,
  text: `Attention passengers: ${text}`,
});

// Precipitation comes first, since it's what people see out the window.
export function readWeather(body: unknown): Weather | null {
  const current = (body as { current?: unknown } | null)?.current as
    { temperature_2m?: unknown; weather_code?: unknown } | undefined;
  const temperature = current?.temperature_2m;
  const code = current?.weather_code;
  if (typeof temperature !== "number" || typeof code !== "number") {
    throw new Error("Unexpected weather response");
  }

  const notice = NOTICES[code];
  if (notice) return announce(...notice);
  const degrees = `${Math.round(temperature)}°F`;
  if (temperature >= HEAT) {
    return announce(
      "heat",
      `it's ${degrees} at Kendall/MIT. Stay cool and drink water.`,
    );
  }
  if (temperature <= COLD) {
    return announce("cold", `it's ${degrees} at Kendall/MIT. Bundle up.`);
  }
  return null;
}

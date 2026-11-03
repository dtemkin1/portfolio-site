import {
  alertsUrl,
  LIVE_CONFIG,
  type LiveFeed,
  nextDepartures,
  predictionsUrl,
  relevantAlerts,
} from "../../src/lib/live";

import { currentSong, type SpotifyEnv } from "./spotify";
import { upstreamTimeout } from "./upstream";
import { liveRadio, WMBR_INFO } from "./wmbr";

export interface Env extends SpotifyEnv {
  MBTA_KEY?: string;
}

const DJ = "Temkin";

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?diegotemkin\.com$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

// Every visitor shares these cached upstream responses, so the APIs see one request per window.
const CACHE_SECONDS = { mbta: 30, wmbr: 30, wmbrShow: 300 };

async function upstream(url: string, seconds: number): Promise<Response> {
  const response = await fetch(url, {
    cf: { cacheTtl: seconds, cacheEverything: true },
    signal: upstreamTimeout(),
  } as RequestInit);
  if (!response.ok) throw new Error(`Upstream ${response.status}`);
  return response;
}

async function readFeed(env: Env): Promise<LiveFeed> {
  const [trains, alerts, song, radio] = await Promise.allSettled([
    upstream(predictionsUrl(env.MBTA_KEY), CACHE_SECONDS.mbta)
      .then((r) => r.json())
      .then((body) => nextDepartures(body, Date.now())),
    upstream(alertsUrl(env.MBTA_KEY), CACHE_SECONDS.mbta)
      .then((r) => r.json())
      .then((body) => {
        if (!Array.isArray((body as { data?: unknown })?.data)) {
          throw new Error("Unexpected alerts response");
        }
        return relevantAlerts(body);
      }),
    LIVE_CONFIG.music ? currentSong(env) : Promise.resolve(null),
    upstream(WMBR_INFO, CACHE_SECONDS.wmbr)
      .then((r) => r.text())
      .then((xml) =>
        liveRadio(xml, DJ, (url) =>
          upstream(
            url,
            url.includes("cgi-bin/show")
              ? CACHE_SECONDS.wmbrShow
              : CACHE_SECONDS.wmbr,
          ).then((r) => r.text()),
        ),
      ),
  ]);
  const value = <T>(result: PromiseSettledResult<T>) =>
    result.status === "fulfilled" ? result.value : null;
  return {
    at: Date.now(),
    trains: value(trains),
    alerts: value(alerts),
    song: value(song),
    radio: value(radio),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    if (!ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
      return new Response("Forbidden", { status: 403 });
    }
    if (new URL(request.url).pathname !== "/live") {
      return new Response("Not found", { status: 404 });
    }
    return Response.json(await readFeed(env), {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
    });
  },
};

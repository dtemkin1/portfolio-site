import { PUBLIC_LIVE_API } from "astro:env/client";

import {
  agoLabel,
  type Alert,
  arrivalLines,
  credits,
  type Departure,
  departuresAt,
  firstTrainRows,
  LIVE_CONFIG,
  type LiveFeed,
  NIGHT_KEY,
  nightUntil,
  SERVICE_ENDED,
  steadyDepartures,
} from "../lib/live";

const LIVE_API = PUBLIC_LIVE_API || "https://api.diegotemkin.com/live";
const REFRESH_EVERY = 30_000;

const live = document.querySelector<HTMLElement>("[data-live]");

// The Worker holds the API keys and caches each source, so the site never talks to them directly.
export async function fetchLive(): Promise<LiveFeed> {
  const response = await fetch(LIVE_API, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

if (live) {
  const rows = live.querySelector<HTMLElement>("[data-live-rows]")!;
  const sources = live.querySelector<HTMLElement>("[data-live-sources]")!;
  const credit = live.querySelector<HTMLElement>("[data-live-credit]")!;

  let feed: LiveFeed | null = null;
  let departures: Departure[] | null = null;
  let shown = false;
  let timer: number | undefined;

  const addAlert = ({ text, severe }: Alert) => {
    const row = document.createElement("li");
    row.className = severe ? "alert severe" : "alert";
    row.textContent = text;
    rows.append(row);
  };

  const addRow = (title: string, detail?: string) => {
    const row = document.createElement("li");
    const titleCell = document.createElement("span");
    titleCell.textContent = title;
    row.append(titleCell);
    if (detail) {
      const detailCell = document.createElement("span");
      detailCell.className = "detail";
      detailCell.textContent = detail;
      row.append(detailCell);
    }
    rows.append(row);
    return row;
  };

  const render = () => {
    rows.replaceChildren();
    // Once the panel has shown, a failed refresh says so instead of making it blink away.
    if (!feed) {
      if (shown) addRow("Live times unavailable");
      credit.hidden = true;
      live.hidden = !shown;
      return;
    }

    const alerts = feed.alerts ?? [];
    const song = LIVE_CONFIG.music ? feed.song : null;
    const radio = feed.radio;
    const night = feed.night;
    const weather = feed.weather;

    // dim background if no more trains running :3
    document.documentElement.toggleAttribute("data-night", Boolean(night));
    try {
      if (night) {
        sessionStorage.setItem(NIGHT_KEY, String(nightUntil(night, feed.at)));
      } else sessionStorage.removeItem(NIGHT_KEY);
    } catch {
      // can fail in private mode, just ignore ig
    }
    document.documentElement.toggleAttribute(
      "data-snow",
      weather?.kind === "snow",
    );

    alerts.filter(({ severe }) => severe).forEach(addAlert);
    if (weather) {
      const sign = document.createElement("li");
      sign.className = "notice announcement";
      sign.textContent = weather.text;
      rows.append(sign);
    }
    if (night) {
      addRow(SERVICE_ENDED);
      for (const [title, time] of firstTrainRows(night, feed.at)) {
        addRow(title, time);
      }
    } else if (departures === null) {
      addRow("Train times unavailable");
    } else if (departures.length === 0) {
      addRow(arrivalLines([])[0]);
    } else {
      for (const { headsign, label } of departures) {
        addRow(`${LIVE_CONFIG.routeName} to ${headsign}`, label);
      }
    }
    alerts.filter(({ severe }) => !severe).forEach(addAlert);
    if (radio) {
      addRow(`Live on WMBR 88.1: ${radio.show}`).classList.add("music");
      if (radio.track) addRow(radio.track).classList.add("music");
    }
    if (song) {
      addRow(
        `Now playing: ${song.song}${song.artist && `, ${song.artist}`}`,
      ).classList.add("music");
    }
    const building = feed.building ?? [];
    for (const { repo, at } of building) {
      addRow(`Last push: ${repo}`, agoLabel(at, feed.at)).classList.add(
        "building",
      );
    }

    sources.textContent = credits({
      mbta: departures !== null || alerts.length > 0 || Boolean(night),
      song: Boolean(song),
      radio: Boolean(radio),
      weather: Boolean(weather),
      building: building.length > 0,
    });
    credit.hidden = !sources.textContent;
    shown = true;
    live.hidden = false;
  };

  // Each refresh gets a number, so a slow older response can't overwrite a newer one.
  let latest = 0;
  const update = async () => {
    const request = ++latest;
    const next = await fetchLive().catch(() => null);
    if (request !== latest) return;
    feed = next;
    // Countdowns use the Worker's clock, so a visitor's wrong clock can't shift them.
    departures = feed?.trains
      ? steadyDepartures(departures, departuresAt(feed.trains, feed.at))
      : null;
    render();
  };

  // Polling only while the tab is visible keeps the Worker and its sources quiet.
  const stop = () => window.clearInterval(timer);
  const start = () => {
    stop();
    update();
    timer = window.setInterval(update, REFRESH_EVERY);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  if (!document.hidden) start();
}

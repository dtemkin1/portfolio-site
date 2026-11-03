import {
  type Alert,
  arrivalLines,
  type Departure,
  LIVE_CONFIG,
  type Song,
  steadyDepartures,
} from "../lib/live";

import { fetchAlerts, fetchDepartures, fetchSong } from "./live-feeds";

const ARRIVALS_EVERY = 30_000;
const ALERTS_EVERY = 60_000;
const MUSIC_EVERY = 60_000;

const live = document.querySelector<HTMLElement>("[data-live]");

if (live) {
  const rows = live.querySelector<HTMLElement>("[data-live-rows]")!;
  const credit = live.querySelector<HTMLElement>("[data-live-credit]");
  const { lastfmKey, lastfmUser } = live.dataset;

  // Null means a feed is down, so its row goes rather than showing stale data.
  let departures: Departure[] | null = null;
  let song: Song | null = null;
  let alerts: Alert[] = [];
  let timers: number[] = [];

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
    alerts.filter(({ severe }) => severe).forEach(addAlert);
    if (departures?.length === 0) addRow(arrivalLines([])[0]);
    for (const { headsign, label } of departures ?? []) {
      addRow(`${LIVE_CONFIG.routeName} to ${headsign}`, label);
    }
    alerts.filter(({ severe }) => !severe).forEach(addAlert);
    if (song) {
      addRow(
        `Now playing: ${song.song}${song.artist && `, ${song.artist}`}`,
      ).classList.add("music");
    }
    if (credit) credit.hidden = !song;
    live.hidden = departures === null && !song && alerts.length === 0;
  };

  const updateAlerts = async () => {
    alerts = await fetchAlerts().catch(() => []);
    render();
  };

  const updateDepartures = async () => {
    const next = await fetchDepartures().catch(() => null);
    departures = next && steadyDepartures(departures, next);
    render();
  };

  const updateSong = async () => {
    if (!lastfmKey || !lastfmUser) return;
    song = await fetchSong(lastfmKey, lastfmUser).catch(() => null);
    render();
  };

  // Polling only while the tab is visible keeps visitors well under the API limits.
  const stop = () => {
    timers.forEach(clearInterval);
    timers = [];
  };

  const start = () => {
    stop();
    updateDepartures();
    updateAlerts();
    updateSong();
    timers = [
      window.setInterval(updateDepartures, ARRIVALS_EVERY),
      window.setInterval(updateAlerts, ALERTS_EVERY),
      window.setInterval(updateSong, MUSIC_EVERY),
    ];
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  if (!document.hidden) start();
}

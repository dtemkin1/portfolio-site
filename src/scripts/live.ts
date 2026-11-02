import {
  arrivalLines,
  type Departure,
  LIVE_CONFIG,
  type Song,
} from "../lib/live";

import { fetchDepartures, fetchSong } from "./live-feeds";

const ARRIVALS_EVERY = 30_000;
const MUSIC_EVERY = 60_000;

const live = document.querySelector<HTMLElement>("[data-live]");

if (live) {
  const rows = live.querySelector<HTMLElement>("[data-live-rows]")!;
  const credit = live.querySelector<HTMLElement>("[data-live-credit]");
  const { lastfmKey, lastfmUser } = live.dataset;

  // Null means a feed is down, so its row goes rather than showing stale data.
  let departures: Departure[] | null = null;
  let song: Song | null = null;
  let timers: number[] = [];

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
  };

  const render = () => {
    rows.replaceChildren();
    if (departures?.length === 0) addRow(arrivalLines([])[0]);
    for (const { headsign, label } of departures ?? []) {
      addRow(`${LIVE_CONFIG.routeName} to ${headsign}`, label);
    }
    if (song) {
      addRow(`Now playing: ${song.song}${song.artist && `, ${song.artist}`}`);
    }
    if (credit) credit.hidden = !song;
    live.hidden = departures === null && !song;
  };

  const updateDepartures = async () => {
    departures = await fetchDepartures().catch(() => null);
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
    updateSong();
    timers = [
      window.setInterval(updateDepartures, ARRIVALS_EVERY),
      window.setInterval(updateSong, MUSIC_EVERY),
    ];
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  if (!document.hidden) start();
}

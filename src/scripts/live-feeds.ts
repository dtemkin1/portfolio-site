import {
  type Alert,
  alertsUrl,
  type Departure,
  nextDepartures,
  nowPlaying,
  predictionsUrl,
  recentTracksUrl,
  relevantAlerts,
  type Song,
} from "../lib/live";

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function fetchDepartures(): Promise<Departure[]> {
  return nextDepartures(await fetchJson(predictionsUrl()), Date.now());
}

export async function fetchAlerts(): Promise<Alert[]> {
  return relevantAlerts(await fetchJson(alertsUrl()));
}

export async function fetchSong(
  apiKey: string,
  user: string,
): Promise<Song | null> {
  return nowPlaying(await fetchJson(recentTracksUrl(apiKey, user)));
}

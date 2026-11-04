import type { Building } from "../../src/lib/live";

const USER = "dtemkin1";
const WEEK = 7 * 24 * 60 * 60_000;
const SHOWN = 2;

export interface GitHubEnv {
  GITHUB_TOKEN?: string;
}

// GitHub turns away requests with no user agent. A token only raises the rate limit.
export function githubRequest(token?: string): Request {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "diegotemkin.com live display",
  });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return new Request(
    `https://api.github.com/users/${USER}/events/public?per_page=50`,
    { headers },
  );
}

type GitHubEvent = {
  type?: string;
  public?: boolean;
  repo?: { name?: string };
  created_at?: string;
};

// my repos (and forks) go by their name alone
export function readBuilding(body: unknown, now: number): Building[] {
  if (!Array.isArray(body)) throw new Error("Unexpected GitHub response");

  const latest = new Map<string, Building>();
  for (const {
    type,
    public: isPublic,
    repo,
    created_at,
  } of body as GitHubEvent[]) {
    const full = repo?.name;
    const at = created_at ? new Date(created_at).getTime() : NaN;
    if (type !== "PushEvent" || !isPublic || !full || !(now - at < WEEK)) {
      continue;
    }
    const [owner, name] = full.split("/");
    // A repository named after the account holds its profile README.
    const shown =
      owner !== USER ? full : name === USER ? "GitHub profile" : name;
    const before = latest.get(name);
    if (!before || at > before.at) latest.set(name, { repo: shown, at });
  }

  return [...latest.values()].sort((a, b) => b.at - a.at).slice(0, SHOWN);
}

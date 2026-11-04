import { expect, test } from "vitest";

import { githubRequest, readBuilding } from "../src/github";

const now = new Date("2026-11-03T20:00:00Z").getTime();
const hoursAgo = (hours: number) =>
  new Date(now - hours * 60 * 60_000).toISOString();

// The shape GitHub's public events API returns, trimmed to what the Worker reads.
const event = (repo: string, hours: number, type = "PushEvent") => ({
  type,
  public: true,
  repo: { name: repo },
  created_at: hoursAgo(hours),
});

test("asks GitHub for public events, with a user agent and no token by default", () => {
  const request = githubRequest();
  expect(request.url).toBe(
    "https://api.github.com/users/dtemkin1/events/public?per_page=50",
  );
  expect(request.headers.get("user-agent")).toBeTruthy();
  expect(request.headers.has("authorization")).toBe(false);
});

test("a token, when set, goes in the authorization header", () =>
  expect(githubRequest("gh-secret").headers.get("authorization")).toBe(
    "Bearer gh-secret",
  ));

test("shows the repository with the latest push", () =>
  expect(
    readBuilding(
      [
        event("dtemkin1/portfolio-site", 5),
        event("mit-dormcon/website", 2),
        event("dtemkin1/portfolio-site", 1),
      ],
      now,
    ),
  ).toEqual([{ repo: "portfolio-site", at: new Date(hoursAgo(1)).getTime() }]));

test("a fork and its original count as one project", () =>
  expect(
    readBuilding(
      [event("sipb/hydrant", 3), event("dtemkin1/hydrant", 2)],
      now,
    ).map(({ repo }) => repo),
  ).toEqual(["hydrant"]));

test("only one repository shows", () =>
  expect(
    readBuilding(
      [event("dtemkin1/a", 1), event("dtemkin1/b", 2), event("dtemkin1/c", 3)],
      now,
    ),
  ).toHaveLength(1));

test("pushes older than a week are left out", () =>
  expect(readBuilding([event("dtemkin1/old", 24 * 8)], now)).toEqual([]));

test("other kinds of activity aren't building", () =>
  expect(
    readBuilding(
      [
        event("dtemkin1/starred", 1, "WatchEvent"),
        event("dtemkin1/x", 1, "IssuesEvent"),
      ],
      now,
    ),
  ).toEqual([]));

test("a private event never shows", () =>
  expect(
    readBuilding([{ ...event("dtemkin1/secret", 1), public: false }], now),
  ).toEqual([]));

test("an unexpected response throws", () =>
  expect(() =>
    readBuilding({ message: "API rate limit exceeded" }, now),
  ).toThrow());

test("the profile README repository shows as the GitHub profile", () =>
  expect(readBuilding([event("dtemkin1/dtemkin1", 1)], now)).toEqual([
    { repo: "GitHub profile", at: new Date(hoursAgo(1)).getTime() },
  ]));

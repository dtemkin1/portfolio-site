import { expect, test } from "vitest";

import { slugFromHash } from "./hash";

test("known slug", () =>
  expect(slugFromHash("#volpe", ["volpe"])).toBe("volpe"));

test("unknown slug", () => expect(slugFromHash("#nope", ["volpe"])).toBeNull());

test("empty hash", () => expect(slugFromHash("", ["volpe"])).toBeNull());

test("malformed encoding", () =>
  expect(slugFromHash("#%E0%A4%A", ["volpe"])).toBeNull());

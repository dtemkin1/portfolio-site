import { expect, test } from "vitest";

import { feedMarkdown } from "./feed";

const description = "Why did ridership fall?";

test("in-development entries lead with their status and description", () =>
  expect(
    feedMarkdown({ description, status: "in-development" }, "With the CTA."),
  ).toBe("In development.\n\nWhy did ridership fall?\n\nWith the CTA."));

test("in-development entries with no body still say so", () =>
  expect(feedMarkdown({ description, status: "in-development" }, "  ")).toBe(
    "In development.\n\nWhy did ridership fall?",
  ));

test("other entries use only their body", () =>
  expect(feedMarkdown({ description }, "The full text.\n")).toBe(
    "The full text.",
  ));

test.each([[undefined], [""], ["  \n"]])(
  "other entries with no body have no full text (%j)",
  (body) => expect(feedMarkdown({ description }, body)).toBeUndefined(),
);

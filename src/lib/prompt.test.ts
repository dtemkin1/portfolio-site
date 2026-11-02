import { expect, test } from "vitest";

import { complete, runCommand } from "./prompt";

const p = [
  { slug: "volpe", title: "Volpe" },
  { slug: "wmata", title: "WMATA" },
];

const printed = (input: string) => {
  const r = runCommand(input, p);
  return r.kind === "print" ? r.lines.join(" ") : "";
};

test("empty input does nothing", () =>
  expect(runCommand("   ", p)).toEqual({ kind: "none" }));

test("spaces and capitals", () =>
  expect(runCommand("  CAT  Volpe.md ", p)).toEqual({
    kind: "open",
    slug: "volpe",
  }));

test("cat without extension", () =>
  expect(runCommand("cat volpe", p)).toEqual({ kind: "open", slug: "volpe" }));

test("open goes to the page", () =>
  expect(runCommand("open wmata", p)).toEqual({
    kind: "navigate",
    href: "/work/wmata/",
  }));

test("cd about", () =>
  expect(runCommand("cd about", p)).toEqual({
    kind: "navigate",
    href: "/about/",
  }));

test("cd home", () =>
  expect(runCommand("cd ~", p)).toEqual({ kind: "navigate", href: "/" }));

test("cd to an unknown page says so", () =>
  expect(printed("cd nowhere")).toContain("nowhere"));

test("ls lists projects", () =>
  expect(runCommand("ls", p)).toEqual({
    kind: "print",
    lines: ["volpe.md", "wmata.md"],
  }));

test("clear", () => expect(runCommand("clear", p)).toEqual({ kind: "clear" }));

test("whoami names Diego", () =>
  expect(printed("whoami")).toContain("Diego Temkin"));

test("help lists commands without the treats", () => {
  expect(printed("help")).toContain("cat");
  expect(printed("help")).not.toContain("skateboard");
});

test("unknown command names help", () =>
  expect(printed("rm -rf /")).toContain("help"));

test("unknown project says so", () =>
  expect(printed("cat nope")).toContain("nope"));

test("cat with no project asks for one", () =>
  expect(printed("cat")).toContain("ls"));

test("skateboard", () =>
  expect(printed("cat skateboard.txt")).toContain("step on my keyboard"));

test("typewriters", () =>
  expect(printed("cat typewriters.txt")).toContain("typewriter"));

test("completes a unique project", () =>
  expect(complete("cat vol", p)).toBe("cat volpe.md"));

test("leaves ambiguous input alone", () =>
  expect(complete("cat ", p)).toBe("cat "));

test("leaves other commands alone", () =>
  expect(complete("ls vol", p)).toBe("ls vol"));

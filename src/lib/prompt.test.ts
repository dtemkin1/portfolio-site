import { expect, test } from "vitest";

import { complete, runCommand } from "./prompt";

const p = [{ slug: "volpe" }, { slug: "wmata" }];

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

test("cat with no project blames Skateboard", () =>
  expect(printed("cat")).toContain("Skateboard is stepping on the keyboard"));

test("open with no project stays plain", () =>
  expect(printed("open")).toBe("open: name a project. Try ls."));

test("exit announces the end of the line", () =>
  expect(printed("exit")).toBe(
    "End of the line. Please take all belongings with you.",
  ));

test.each(["sudo", "sudo rm -rf /", "SUDO ls"])("%s is refused", (input) =>
  expect(printed(input)).toBe("Only authorized personnel beyond this point."),
);

test("building 13", () =>
  expect(printed("cat building13.txt")).toContain("MBTA subway line"));

test("typewriters explain the 1 key", () =>
  expect(printed("cat typewriters.txt")).toContain("lowercase l"));

test("help keeps the jokes hidden", () => {
  for (const hidden of ["exit", "sudo", "building13"])
    expect(printed("help")).not.toContain(hidden);
});

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

test.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
  "built-in name %s is just an unknown project",
  (name) => expect(printed(`cat ${name}`)).toContain(name.toLowerCase()),
);

test.each(["constructor", "__proto__", "toString"])(
  "built-in name %s is just an unknown page",
  (name) =>
    expect(runCommand(`cd ${name}`, p)).toEqual({
      kind: "print",
      lines: [
        `cd: no page called ${name.toLowerCase()}. Try about, work, or ~.`,
      ],
    }),
);

test("arrivals asks for live departures", () =>
  expect(runCommand("  ARRIVALS ", p)).toEqual({ kind: "arrivals" }));

test("help lists arrivals", () =>
  expect(printed("help")).toContain("arrivals"));

test("open on a project with no page opens it on the board instead", () =>
  expect(
    runCommand("open mostec-2021", [{ slug: "mostec-2021", page: false }]),
  ).toEqual({ kind: "open", slug: "mostec-2021" }));

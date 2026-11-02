export type PromptProject = { slug: string };

export type PromptResult =
  | { kind: "print"; lines: string[] }
  | { kind: "navigate"; href: string }
  | { kind: "open"; slug: string }
  | { kind: "clear" }
  | { kind: "arrivals" }
  | { kind: "none" };

const PAGES = new Map([
  ["~", "/"],
  ["home", "/"],
  ["about", "/about/"],
  ["work", "/work/"],
]);

const TREATS = new Map([
  [
    "skateboard.txt",
    'Skateboard is an orange cat who "likes to step on my keyboard when I do my problem sets."',
  ],
  [
    "typewriters.txt",
    "A typewriter collection, started during Covid. My favorite key is the 1: early typewriters didn't have one, so people typed a lowercase l.",
  ],
  [
    "building13.txt",
    "Each floor of MIT's Building 13 is painted as a different MBTA subway line.",
  ],
  ["amtrak.txt", "Cross-country Amtrak: completed. Would ride again."],
]);

const HELP = [
  ["ls", "list projects"],
  ["cat <project>", "open a project on the board"],
  ["open <project>", "go to a project's page"],
  ["cd <page>", "go to about, work, or ~"],
  ["arrivals", "next Red Line trains at Kendall/MIT"],
  ["whoami", "who runs this station"],
  ["clear", "clear this output"],
];

const formatHelp = (helpText: typeof HELP) => {
  const spacing = helpText.reduce(
    (acc, [command]) => Math.max(acc, command.length),
    0,
  );
  return helpText.map(
    ([command, description]) => `${command.padEnd(spacing + 2)}${description}`,
  );
};

const print = (...lines: string[]): PromptResult => ({ kind: "print", lines });

function findProject(name: string, projects: PromptProject[]) {
  const slug = name.replace(/\.md$/, "");
  return projects.find((project) => project.slug === slug);
}

export function runCommand(
  input: string,
  projects: PromptProject[],
): PromptResult {
  const [command, argument] = input.trim().toLowerCase().split(/\s+/);

  switch (command) {
    case "":
      return { kind: "none" };
    case "help":
      return print(...formatHelp(HELP));
    case "ls":
      return print(...projects.map(({ slug }) => `${slug}.md`));
    case "whoami":
      return print(
        "Diego Temkin. MS in Transportation student at MIT, JTL-Transit Lab.",
      );
    case "clear":
      return { kind: "clear" };
    case "arrivals":
      return { kind: "arrivals" };
    case "exit":
      return print("End of the line. Please take all belongings with you.");
    case "sudo":
      return print("Only authorized personnel beyond this point.");
    case "cd": {
      const href = PAGES.get(argument ?? "~");
      return href
        ? { kind: "navigate", href }
        : print(`cd: no page called ${argument}. Try about, work, or ~.`);
    }
    case "cat":
    case "open": {
      if (!argument) {
        return print(
          command === "cat"
            ? "cat: Skateboard is stepping on the keyboard. Name a project, or try ls."
            : "open: name a project. Try ls.",
        );
      }
      const treat = command === "cat" && TREATS.get(argument);
      if (treat) return print(treat);
      const project = findProject(argument, projects);
      if (!project)
        return print(`${command}: no project called ${argument}. Try ls.`);
      return command === "cat"
        ? { kind: "open", slug: project.slug }
        : { kind: "navigate", href: `/work/${project.slug}/` };
    }
    default:
      return print(`${command}: command not found. Try help.`);
  }
}

export function complete(input: string, projects: PromptProject[]): string {
  const match = input.match(/^\s*(cat|open)\s+(\S*)$/i);
  if (!match || !match[2]) return input;
  const [, command, partial] = match;
  const hits = projects.filter(({ slug }) =>
    slug.startsWith(partial.toLowerCase()),
  );
  return hits.length === 1 ? `${command} ${hits[0].slug}.md` : input;
}

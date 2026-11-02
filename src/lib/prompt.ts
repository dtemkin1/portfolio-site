export type PromptProject = { slug: string; title: string };

export type PromptResult =
  | { kind: "print"; lines: string[] }
  | { kind: "navigate"; href: string }
  | { kind: "open"; slug: string }
  | { kind: "clear" }
  | { kind: "none" };

const PAGES: Record<string, string> = {
  "~": "/",
  home: "/",
  about: "/about/",
  work: "/work/",
};

const TREATS: Record<string, string[]> = {
  "skateboard.txt": [
    'Skateboard is an orange cat who "likes to step on my keyboard when I do my problem sets."',
  ],
  "typewriters.txt": ["A typewriter collection, started during Covid."],
};

const HELP = [
  "ls               list projects",
  "cat <project>    open a project on the board",
  "open <project>   go to a project's page",
  "cd <page>        go to about, work, or ~",
  "whoami           who runs this station",
  "clear            clear this output",
];

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
      return print(...HELP);
    case "ls":
      return print(...projects.map(({ slug }) => `${slug}.md`));
    case "whoami":
      return print(
        "Diego Temkin. MS Transportation student at MIT, JTL-Transit Lab.",
      );
    case "clear":
      return { kind: "clear" };
    case "cd": {
      const href = PAGES[argument ?? "~"];
      return href
        ? { kind: "navigate", href }
        : print(`cd: no page called ${argument}. Try about, work, or ~.`);
    }
    case "cat":
    case "open": {
      if (!argument) return print(`${command}: name a project. Try ls.`);
      if (command === "cat" && TREATS[argument]) {
        return print(...TREATS[argument]);
      }
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

import { arrivalLines, departuresAt, nightLines } from "../lib/live";
import { complete, type PromptProject, runCommand } from "../lib/prompt";

import { fetchLive } from "./live";

const form = document.querySelector<HTMLFormElement>("[data-prompt]");

if (form) {
  const input = form.querySelector("input")!;
  const output = form.querySelector<HTMLElement>("output")!;
  const block = form.querySelector<HTMLElement>(".block")!;
  const projects: PromptProject[] = JSON.parse(form.dataset.projects ?? "[]");

  // Hidden in the HTML, so it never appears without this script.
  form.hidden = false;

  // The input is monospace, so the cursor's offset is its column times 1ch.
  const placeBlock = () => {
    const column = input.selectionStart ?? input.value.length;
    const left = column * block.offsetWidth - input.scrollLeft;
    block.style.left = `${left}px`;
  };
  document.addEventListener("selectionchange", placeBlock);
  for (const type of ["input", "focus", "scroll"]) {
    input.addEventListener(type, placeBlock);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const typed = input.value;
    const result = runCommand(typed, projects);
    input.value = "";
    placeBlock();

    switch (result.kind) {
      case "print":
        output.textContent = [`$ ${typed.trim()}`, ...result.lines].join("\n");
        break;
      case "navigate":
        location.assign(result.href);
        break;
      case "open":
        output.textContent = `opened ${result.slug}.md`;
        window.dispatchEvent(
          new CustomEvent("board:open", { detail: { slug: result.slug } }),
        );
        break;
      case "clear":
        output.textContent = "";
        break;
      case "arrivals":
        output.textContent = "$ arrivals\nChecking the MBTA...";
        fetchLive()
          .then(({ at, trains, alerts, night }) => {
            if (night) return nightLines(night);
            if (!trains) throw new Error("No train data");
            return arrivalLines(departuresAt(trains, at), alerts ?? []);
          })
          .catch(() => ["arrivals: can't reach the MBTA. Try again soon."])
          .then((lines) => {
            output.textContent = ["$ arrivals", ...lines].join("\n");
          });
        break;
    }
  });

  input.addEventListener("keydown", (event) => {
    if (
      event.key !== "Tab" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }
    const completed = complete(input.value, projects);
    // With nothing to complete, Tab keeps moving focus as usual.
    if (completed !== input.value) {
      event.preventDefault();
      input.value = completed;
      placeBlock();
    }
  });
}

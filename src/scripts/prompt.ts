import { complete, type PromptProject, runCommand } from "../lib/prompt";

const form = document.querySelector<HTMLFormElement>("[data-prompt]");

if (form) {
  const input = form.querySelector("input")!;
  const output = form.querySelector<HTMLElement>("output")!;
  const projects: PromptProject[] = JSON.parse(form.dataset.projects ?? "[]");

  // Hidden in the HTML, so it never appears without this script.
  form.hidden = false;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const typed = input.value;
    const result = runCommand(typed, projects);
    input.value = "";

    switch (result.kind) {
      case "print":
        output.textContent = [`$ ${typed.trim()}`, ...result.lines].join("\n");
        break;
      case "navigate":
        location.assign(result.href);
        break;
      case "open":
        output.textContent = "";
        window.dispatchEvent(
          new CustomEvent("board:open", { detail: { slug: result.slug } }),
        );
        break;
      case "clear":
        output.textContent = "";
        break;
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const completed = complete(input.value, projects);
    // With nothing to complete, Tab keeps moving focus as usual.
    if (completed !== input.value) {
      event.preventDefault();
      input.value = completed;
    }
  });
}

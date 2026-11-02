import { slugFromHash } from "../lib/hash";

const SEEN_KEY = "board-lit";

function setUpBoard(board: HTMLElement) {
  const rows = new Map<string, { button: HTMLButtonElement; readout: HTMLElement }>();

  // Rows are links until now, so the board works without this script.
  for (const li of board.querySelectorAll<HTMLElement>("li[data-slug]")) {
    const slug = li.dataset.slug!;
    const link = li.querySelector<HTMLAnchorElement>("a.row")!;
    const readout = li.querySelector<HTMLElement>(".readout")!;

    const button = document.createElement("button");
    button.type = "button";
    button.className = link.className;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", readout.id);
    button.append(...link.childNodes);
    link.replaceWith(button);

    rows.set(slug, { button, readout });
    button.addEventListener("click", () => toggle(slug));
  }

  function setOpen(slug: string, open: boolean) {
    const row = rows.get(slug);
    if (!row) return;
    row.button.setAttribute("aria-expanded", String(open));
    row.readout.hidden = !open;
  }

  function open(slug: string) {
    for (const other of rows.keys()) setOpen(other, other === slug);
    history.replaceState(null, "", `#${slug}`);
  }

  function toggle(slug: string) {
    if (rows.get(slug)?.button.getAttribute("aria-expanded") === "true") {
      setOpen(slug, false);
      history.replaceState(null, "", location.pathname + location.search);
    } else {
      open(slug);
    }
  }

  const fromHash = slugFromHash(location.hash, [...rows.keys()]);
  if (fromHash) open(fromHash);

  window.addEventListener("board:open", (event) => {
    const { slug } = (event as CustomEvent<{ slug: string }>).detail;
    open(slug);
    rows.get(slug)?.button.scrollIntoView({ block: "nearest" });
  });
}

// The rows light up on the first visit of a session only.
function lightUpOnce(board: HTMLElement) {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return;
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    return;
  }
  board.classList.add("lighting");
}

const board = document.querySelector<HTMLElement>("[data-board]");
if (board) {
  setUpBoard(board);
  lightUpOnce(board);
}

// Copy buttons stay hidden without a clipboard, so the text is still there to select.
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "button[data-copy]",
)) {
  const source = document.getElementById(button.dataset.copy!);
  const status = button.nextElementSibling;
  if (!source || !status || !navigator.clipboard) continue;
  button.hidden = false;

  let timer: number | undefined;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(source.textContent!.trim());
      status.textContent = "Copied";
    } catch {
      status.textContent = "Couldn't copy. Select the text instead.";
    }
    clearTimeout(timer);
    timer = window.setTimeout(() => (status.textContent = ""), 3000);
  });
}

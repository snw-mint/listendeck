const ROUTE_SHORTCUTS = {
  1: "/charts/",
  2: "/match/",
  3: "/lyrics/",
  4: "/cards/",
};

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  ) {
    return;
  }

  const destination = ROUTE_SHORTCUTS[e.key];
  if (destination) {
    window.location.href = destination;
  }
});

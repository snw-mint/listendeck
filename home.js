import { EVENTS, trackEvent } from "./shared/analytics.js";

const ROUTE_SHORTCUTS = {
  1: "/wrapped/",
  2: "/charts/",
  3: "/match/",
  4: "/lyrics/",
  5: "/cards/",
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
    trackEvent(EVENTS.SHORTCUT_USED, { key: e.key });
    window.location.href = destination;
  }
});

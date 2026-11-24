const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";
const UMAMI_WEBSITE_ID = "2323e391-df0f-4375-9d6c-57f81b62b3b4";
const PRODUCTION_VERCEL_HOST = "listendeck.vercel.app";

export const EVENTS = Object.freeze({
  SEARCH_SUBMIT: "search_submit",
  PERIOD_CHANGE: "period_change",
  STYLE_CHANGE: "style_change",
  LYRICS_TRANSLATE: "lyrics_translate",
  EXPORT_CARD: "export_card",
  THEME_TOGGLE: "theme_toggle",
  SHORTCUT_USED: "shortcut_used",
  NAV_CLICK: "nav_click",
});

let analyticsInitialized = false;

function isProductionHost() {
  if (window.location.protocol !== "https:") return false;
  const host = window.location.hostname.toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") {
    return false;
  }
  if (host.endsWith(".vercel.app") && host !== PRODUCTION_VERCEL_HOST) {
    return false;
  }
  return true;
}

export function trackEvent(event, props) {
  if (!event || typeof window.umami?.track !== "function") return;
  if (props && typeof props === "object" && Object.keys(props).length > 0) {
    window.umami.track(event, props);
    return;
  }
  window.umami.track(event);
}

function handleDeclarativeClick(event) {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest("[data-track]");
  if (!target) return;
  const eventName = target.getAttribute("data-track");
  if (!eventName) return;

  const rawProps = target.getAttribute("data-track-props");
  let parsedProps;
  if (rawProps) {
    try {
      parsedProps = JSON.parse(rawProps);
    } catch {
      parsedProps = undefined;
    }
  }
  trackEvent(eventName, parsedProps);
}

export function initAnalytics() {
  if (analyticsInitialized) return;
  analyticsInitialized = true;

  document.addEventListener("click", handleDeclarativeClick);

  if (!isProductionHost()) return;
  if (document.querySelector(`script[data-website-id="${UMAMI_WEBSITE_ID}"]`)) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = UMAMI_SCRIPT_URL;
  script.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  document.head.appendChild(script);
}

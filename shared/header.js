import "./icons.js";
import { initCustomSelects } from "./select.js";

const SUN_ICON = `<animate-icons name="sun" size="20"></animate-icons>`;
const MOON_ICON = `<animate-icons name="moon" size="20"></animate-icons>`;
const MENU_ICON = `<animate-icons name="menu" size="22"></animate-icons>`;
const CLOSE_ICON = `<animate-icons name="x" size="22"></animate-icons>`;
const THEME_COLORS = {
  light: "#FAFAFA",
  dark: "#0B0B0E",
};
const DYNAMIC_QUERY_PARAMS = ["user", "u1", "u2", "id"];

function syncRobotsMeta() {
  const params = new URLSearchParams(window.location.search);
  const hasDynamicParam = DYNAMIC_QUERY_PARAMS.some((key) => params.has(key));
  const isResultRoute = /\/result(?:\.html)?$/i.test(window.location.pathname);
  if (!hasDynamicParam && !isResultRoute) return;

  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement("meta");
    robotsMeta.setAttribute("name", "robots");
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute("content", "noindex, follow");
}

function syncThemeColorMeta(theme) {
  const color = THEME_COLORS[theme] || THEME_COLORS.light;
  const existing = document.querySelectorAll('meta[name="theme-color"]');
  if (existing.length > 0) {
    existing.forEach((tag, index) => {
      if (index === 0) {
        tag.removeAttribute("media");
        tag.setAttribute("content", color);
      } else {
        tag.remove();
      }
    });
    return;
  }
  const meta = document.createElement("meta");
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", color);
  document.head.appendChild(meta);
}

syncRobotsMeta();

function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");

  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    syncThemeColorMeta(theme);
    if (toggle) {
      toggle.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  };

  applyTheme(initial);

  toggle?.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(isDark ? "light" : "dark");
  });
}

function initActiveNav() {
  const path = window.location.pathname;
  const links = document.querySelectorAll(".header-nav .nav-link");
  links.forEach((link) => {
    const route = link.getAttribute("data-route");
    const isHome = route === "/" && (path === "/" || path === "/index.html");
    const isTool = route && route !== "/" && path.startsWith(route);
    if (isHome || isTool) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
}

function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-btn");
  const nav = document.getElementById("header-nav");
  if (!btn || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.innerHTML = open ? CLOSE_ICON : MENU_ICON;
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!nav.classList.contains("open"));
  });

  document.addEventListener("click", (e) => {
    if (nav.classList.contains("open") && !nav.contains(e.target) && !btn.contains(e.target)) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
    }
  });
}

document.addEventListener("dragstart", (e) => {
  if (e.target instanceof HTMLImageElement) {
    e.preventDefault();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initActiveNav();
  initMobileMenu();
  initCustomSelects();
});

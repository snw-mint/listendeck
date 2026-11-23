import "./icons.js";

const SUN_ICON = `<animate-icons name="sun" size="20"></animate-icons>`;
const MOON_ICON = `<animate-icons name="moon" size="20"></animate-icons>`;
const MENU_ICON = `<animate-icons name="menu" size="22"></animate-icons>`;
const CLOSE_ICON = `<animate-icons name="x" size="22"></animate-icons>`;

function initTheme() {
  const toggle = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (prefersDark ? "dark" : "light");

  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
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

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initActiveNav();
  initMobileMenu();
});

import { defineIcons } from "@animateicons/vanilla";
import {
  Sun,
  Moon,
  Github,
  Menu,
  X,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Download,
} from "@animateicons/vanilla/lucide";

defineIcons({
  Sun,
  Moon,
  Github,
  Menu,
  X,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Download,
});

if (typeof document !== "undefined") {
  document.addEventListener("mouseover", (e) => {
    const trigger = e.target.closest("button, a");
    if (!trigger || trigger.contains(e.relatedTarget)) return;
    const icon = trigger.querySelector("animate-icons");
    if (icon) {
      icon.startAnimation?.();
      icon.dispatchEvent(new MouseEvent("mouseenter"));
    }
  });

  document.addEventListener("mouseout", (e) => {
    const trigger = e.target.closest("button, a");
    if (!trigger || trigger.contains(e.relatedTarget)) return;
    const icon = trigger.querySelector("animate-icons");
    if (icon) {
      icon.stopAnimation?.();
      icon.dispatchEvent(new MouseEvent("mouseleave"));
    }
  });
}

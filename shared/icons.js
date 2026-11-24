import { defineIcons } from "@animateicons/vanilla";
import {
  Sun,
  Moon,
  Github,
  Menu,
  X,
  ArrowLeft,
  ArrowRight,
  Download,
  Check,
  ChevronLeft,
  ChevronDown,
  CircleCheck,
  Calendar,
  ImagePlus,
  Music,
  Paintbrush,
  Search,
  Languages,
  Globe,
  Disc3,
  ChartColumnIncreasing,
  Heart,
  Quote,
  ArrowUpRight,
} from "@animateicons/vanilla/lucide";

defineIcons({
  Sun,
  Moon,
  Github,
  Menu,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  Check,
  ChevronLeft,
  ChevronDown,
  CircleCheck,
  Calendar,
  ImagePlus,
  Music,
  Paintbrush,
  Search,
  Languages,
  Globe,
  Disc3,
  ChartColumnIncreasing,
  Heart,
  Quote,
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

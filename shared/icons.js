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
  CircleDot,
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

const Circle = {
  name: "circle",
  library: "lucide",
  tag: "svg",
  attrs: {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  },
  children: [
    {
      tag: "circle",
      attrs: { cx: "12", cy: "12", r: "10" },
      normal: { scale: 1 },
      animate: {
        scale: [1, 0.92, 1.03, 1],
        transition: { duration: 0.5, ease: "easeInOut", times: [0, 0.35, 0.7, 1] },
      },
      style: { transformBox: "view-box", originX: "12px", originY: "12px" },
    },
  ],
};

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
  Circle,
  CircleCheck,
  CircleDot,
  CircleDot,
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

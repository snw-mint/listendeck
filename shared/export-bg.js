export const EXPORT_BG_PALETTES = [
  { id: "purple", label: "Purple", blob1: "#7c3aed", blob2: "#4f46e5" },
  { id: "nature", label: "Nature", blob1: "#65c914", blob2: "#a3e635" },
  { id: "crimson", label: "Crimson", blob1: "#ff2626", blob2: "#e11d74" },
  { id: "sea", label: "Sea", blob1: "#3b82f6", blob2: "#8b5cf6" },
  { id: "sunset", label: "Sunset", blob1: "#f97316", blob2: "#f43f5e" },
];

export const DEFAULT_EXPORT_BG = "purple";

const PALETTE_MAP = new Map(EXPORT_BG_PALETTES.map((palette) => [palette.id, palette]));
const DARK_INK_RGB = [20, 20, 22];
const LIGHT_INK_RGB = [255, 255, 255];
const NOISE_TILE_SIZE = 96;
const NOISE_INTENSITY = 0.15;
const EXPORT_CARD_WIDTH = 1080;
const EXPORT_CARD_HEIGHT = 1920;

let cachedNoiseTileCanvas = null;

function parseHexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return [124, 58, 237];
}

function resolveCssColorToRgb(cssColor, fallbackHex = "#4f46e5") {
  if (!cssColor) return parseHexToRgb(fallbackHex);
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext("2d");
  ctx.fillStyle = fallbackHex;
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function getNoiseTileCanvas() {
  if (cachedNoiseTileCanvas) return cachedNoiseTileCanvas;
  const tile = document.createElement("canvas");
  tile.width = NOISE_TILE_SIZE;
  tile.height = NOISE_TILE_SIZE;
  const ctx = tile.getContext("2d");
  const imageData = ctx.createImageData(NOISE_TILE_SIZE, NOISE_TILE_SIZE);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const shade = Math.floor(Math.random() * 256);
    pixels[i] = shade;
    pixels[i + 1] = shade;
    pixels[i + 2] = shade;
    pixels[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  cachedNoiseTileCanvas = tile;
  return cachedNoiseTileCanvas;
}

function drawEllipticalBlob(ctx, width, height, blob) {
  const [r, g, b] = Array.isArray(blob.color) ? blob.color : resolveCssColorToRgb(blob.color);
  const cx = width * blob.x;
  const cy = height * blob.y;
  const rx = width * blob.widthPct;
  const ry = height * blob.heightPct;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(-cx / rx, -cy / ry, width / rx, height / ry);
  ctx.restore();
}

export function renderBlurredNoiseLayer(width, height, config) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const blob1 = {
    x: 0.78,
    y: 1.05,
    widthPct: 1.25,
    heightPct: 0.75,
    ...config.blob1,
  };
  const blob2 = {
    x: 0.18,
    y: 1.05,
    widthPct: 1.05,
    heightPct: 0.68,
    ...config.blob2,
  };

  drawEllipticalBlob(ctx, width, height, blob2);
  drawEllipticalBlob(ctx, width, height, blob1);

  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = NOISE_INTENSITY;
  const noisePattern = ctx.createPattern(getNoiseTileCanvas(), "repeat");
  if (noisePattern) {
    ctx.fillStyle = noisePattern;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  return canvas;
}

function getRelativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(lumA, lumB) {
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastingInk(rgb) {
  const bgLum = getRelativeLuminance(rgb);
  const darkLum = getRelativeLuminance(DARK_INK_RGB);
  const lightLum = getRelativeLuminance(LIGHT_INK_RGB);
  const useDark = getContrastRatio(bgLum, darkLum) >= getContrastRatio(bgLum, lightLum);
  return {
    isDark: useDark,
    primary: useDark ? "#141416" : "#ffffff",
    muted: useDark ? "rgba(20, 20, 22, 0.72)" : "rgba(255, 255, 255, 0.78)",
  };
}

export function applyExportMeshPalette(container, paletteId = DEFAULT_EXPORT_BG) {
  if (!container) return;
  const palette = PALETTE_MAP.get(paletteId) || PALETTE_MAP.get(DEFAULT_EXPORT_BG);
  delete container.dataset.customColor;
  container.style.setProperty("--blob-1-color", palette.blob1);
  container.style.setProperty("--blob-2-color", palette.blob2);
}

export function applyExportMeshCustomColor(container, colorValue) {
  if (!container || !colorValue) return;
  container.style.setProperty("--blob-1-color", colorValue);
  container.style.removeProperty("--blob-2-color");
  container.dataset.customColor = "true";
}

function applyCompositeLayer(targetEl, blob1Rgb, blob2Rgb) {
  if (!targetEl) return;
  const layerCanvas = renderBlurredNoiseLayer(EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, {
    blob1: { color: blob1Rgb },
    blob2: { color: blob2Rgb },
  });
  targetEl.style.backgroundImage = `url("${layerCanvas.toDataURL("image/png")}")`;
}

export function initExportBgControls({ pickerEl, targetEl }) {
  let activeStyle = DEFAULT_EXPORT_BG;
  let customColor = PALETTE_MAP.get(DEFAULT_EXPORT_BG).blob1;

  if (!pickerEl || !targetEl) {
    return {
      getSelectedStyle: () => activeStyle,
      applyCurrentBg: () => {
        const palette = PALETTE_MAP.get(activeStyle) || PALETTE_MAP.get(DEFAULT_EXPORT_BG);
        const rgb1 = parseHexToRgb(palette.blob1);
        const rgb2 = parseHexToRgb(palette.blob2);
        applyExportMeshPalette(targetEl, activeStyle);
        applyCompositeLayer(targetEl, rgb1, rgb2);
      },
    };
  }

  const presetButtons = Array.from(pickerEl.querySelectorAll(".bg-option[data-bg]"));
  const customWrapper = pickerEl.querySelector(".bg-option-custom");
  const customInput = pickerEl.querySelector(".bg-custom-color-input");

  const clearSelection = () => {
    presetButtons.forEach((btn) => {
      btn.classList.remove("selected");
      btn.setAttribute("aria-pressed", "false");
    });
    if (customWrapper) {
      customWrapper.classList.remove("selected");
    }
  };

  const selectPreset = (paletteId) => {
    const validId = PALETTE_MAP.has(paletteId) ? paletteId : DEFAULT_EXPORT_BG;
    activeStyle = validId;
    clearSelection();
    const targetBtn = presetButtons.find((btn) => btn.dataset.bg === validId);
    if (targetBtn) {
      targetBtn.classList.add("selected");
      targetBtn.setAttribute("aria-pressed", "true");
    }
    applyExportMeshPalette(targetEl, validId);
  };

  const selectCustomColor = (hexColor) => {
    activeStyle = "custom";
    customColor = hexColor;
    clearSelection();
    if (customWrapper) {
      const iconInk = getContrastingInk(parseHexToRgb(hexColor));
      customWrapper.classList.add("selected", "has-custom-color");
      customWrapper.style.setProperty("--custom-swatch-color", hexColor);
      customWrapper.style.setProperty("--custom-swatch-fg", iconInk.primary);
    }
    applyExportMeshCustomColor(targetEl, hexColor);
  };

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectPreset(btn.dataset.bg);
    });
  });

  if (customInput) {
    const handleColorChange = (e) => {
      selectCustomColor(e.target.value);
    };
    customInput.addEventListener("input", handleColorChange);
    customInput.addEventListener("change", handleColorChange);
  }

  selectPreset(DEFAULT_EXPORT_BG);

  return {
    getSelectedStyle: () => activeStyle,
    applyCurrentBg: () => {
      if (activeStyle === "custom") {
        applyExportMeshCustomColor(targetEl, customColor);
        const computedBlob2 = getComputedStyle(targetEl).getPropertyValue("--blob-2-color").trim();
        const rgb1 = parseHexToRgb(customColor);
        const rgb2 = resolveCssColorToRgb(computedBlob2, customColor);
        applyCompositeLayer(targetEl, rgb1, rgb2);
      } else {
        const palette = PALETTE_MAP.get(activeStyle) || PALETTE_MAP.get(DEFAULT_EXPORT_BG);
        const rgb1 = parseHexToRgb(palette.blob1);
        const rgb2 = parseHexToRgb(palette.blob2);
        applyExportMeshPalette(targetEl, activeStyle);
        applyCompositeLayer(targetEl, rgb1, rgb2);
      }
    },
  };
}

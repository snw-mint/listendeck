import { deezer, lrclib } from "../shared/api.js";
import { exportNodeAsPng } from "../shared/export.js";
import { getCache, setCache, CACHE_TTL_CURRENT, CACHE_TTL_CLOSED } from "../shared/storage.js";

const SESSION_KEY = "ld_lyrics_session";
const MAX_LINES = 5;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeText(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTrackTitle(title) {
  return String(title || "")
    .replace(/\s*[\(\[](?:remaster(?:ed)?|deluxe|bonus track|radio edit|explicit|clean|album version|single version)[^\)\]]*[\)\]]/gi, "")
    .trim();
}

function parseLyricsLines(raw) {
  if (!raw) return [];
  return raw
    .replace(/\[\d{2}:\d{2}\.\d{2,3}\]\s*/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function getDefaultLang() {
  const lang = (navigator.language || "en").toLowerCase();
  const supported = ["pt", "en", "es", "fr", "de", "it", "ja", "ko"];
  return supported.find((code) => lang.startsWith(code)) || "pt";
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex) {
  const clean = hex.replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 43,
    g: parseInt(full.slice(2, 4), 16) || 47,
    b: parseInt(full.slice(4, 6), 16) || 58,
  };
}

function darkenHex(hex, factor = 0.4) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - factor))),
    Math.max(0, Math.round(g * (1 - factor))),
    Math.max(0, Math.round(b * (1 - factor)))
  );
}

function isLightHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.68;
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve("");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 500;
        canvas.height = img.naturalHeight || 500;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
}

function extractDominantColor(imgSrc) {
  return new Promise((resolve) => {
    const fallback = "#2b2f3a";
    if (!imgSrc) return resolve(fallback);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = 24;
        canvas.height = 24;
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (lum > 24 && lum < 235) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (!count) return resolve(fallback);
        resolve(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
      } catch {
        resolve(fallback);
      }
    };
    img.onerror = () => resolve(fallback);
    img.src = imgSrc;
  });
}

async function searchTracksCached(rawQuery) {
  const key = `lyrics_search_${normalizeText(rawQuery)}`;
  const cached = getCache(key);
  if (cached) return cached;

  const res = await deezer.search("track", rawQuery, 6);
  const items = (res?.data || []).map((t) => ({
    id: String(t.id),
    title: cleanTrackTitle(t.title || t.title_short || ""),
    artist: t.artist?.name || "",
    album: cleanTrackTitle(t.album?.title || ""),
    cover: t.album?.cover_medium || t.album?.cover_big || t.album?.cover || "",
    coverHq: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || "",
  }));

  if (items.length > 0) {
    setCache(key, items, CACHE_TTL_CURRENT);
  }
  return items;
}

async function fetchTrackByIdCached(trackId) {
  const key = `lyrics_track_meta_${trackId}`;
  const cached = getCache(key);
  if (cached) return cached;

  const t = await deezer.getTrack(trackId);
  if (!t || !t.id) return null;
  const track = {
    id: String(t.id),
    title: cleanTrackTitle(t.title || t.title_short || ""),
    artist: t.artist?.name || "",
    album: cleanTrackTitle(t.album?.title || ""),
    cover: t.album?.cover_medium || t.album?.cover_big || t.album?.cover || "",
    coverHq: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || "",
  };
  setCache(key, track, CACHE_TTL_CLOSED);
  return track;
}

async function fetchLyricsCached(track) {
  const key = `lyrics_lines_${normalizeText(track.artist)}__${normalizeText(track.title)}`;
  const cached = getCache(key);
  if (cached) return cached;

  let text = null;

  try {
    const exact = await lrclib.get(track.title, track.artist);
    text = exact?.plainLyrics || exact?.syncedLyrics || null;
  } catch {
  }

  if (!text) {
    try {
      const list = await lrclib.search(`${track.title} ${track.artist}`);
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((item) => item.plainLyrics || item.syncedLyrics) || list[0];
        text = best?.plainLyrics || best?.syncedLyrics || null;
      }
    } catch {
    }
  }

  if (!text) {
    try {
      const res = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(track.artist)}/${encodeURIComponent(track.title)}`
      );
      if (res.ok) {
        const json = await res.json();
        text = json?.lyrics || null;
      }
    } catch {
    }
  }

  const lines = parseLyricsLines(text);
  if (lines.length > 0) {
    setCache(key, lines, CACHE_TTL_CLOSED);
  }
  return lines;
}

async function translateText(text, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.[0])) {
        const joined = json[0].map((part) => part?.[0] || "").join("").trim();
        if (joined) return joined;
      }
    }
  } catch {
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${encodeURIComponent(targetLang)}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json?.responseData?.translatedText) return json.responseData.translatedText;
    }
  } catch {
  }

  return null;
}

async function translateLinesCached(track, lines, targetLang) {
  const key = `lyrics_tr_${track.id || normalizeText(track.title)}_${targetLang}`;
  const cached = getCache(key);
  if (cached && cached.length === lines.length) return cached;

  const chunkSize = 8;
  const output = new Array(lines.length).fill("");

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    const payload = chunk.map((line, idx) => `${idx + 1}. ${line}`).join("\n");
    const translated = await translateText(payload, targetLang);
    const mapped = new Array(chunk.length).fill("");

    if (translated) {
      const rows = translated.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
      rows.forEach((row) => {
        const m = row.match(/^\s*(\d+)[\.\)\:\-]\s*(.*)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= chunk.length && m[2].trim()) {
            mapped[n - 1] = m[2].trim();
          }
        }
      });
      if (mapped.some((v) => !v) && rows.length === chunk.length) {
        rows.forEach((row, idx) => {
          if (!mapped[idx]) mapped[idx] = row.replace(/^\s*\d+[\.\)\:\-]\s*/, "").trim();
        });
      }
    }

    for (let j = 0; j < chunk.length; j++) {
      output[i + j] = mapped[j] || chunk[j];
    }
  }

  setCache(key, output, CACHE_TTL_CLOSED);
  return output;
}

function saveSession(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initLandingPage() {
  const form = document.getElementById("lyrics-form");
  const input = document.getElementById("lyrics-query");
  const dropdown = document.getElementById("lyrics-dropdown");
  const wrap = document.getElementById("lyrics-search-wrap");
  const errorEl = document.getElementById("lyrics-error");
  if (!form || !input || !dropdown) return;

  let results = [];
  let activeIndex = -1;
  let debounceTimer = null;
  let requestSeq = 0;

  const setOpen = (open) => {
    dropdown.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  };

  const selectTrack = (track) => {
    setCache(`lyrics_track_meta_${track.id}`, track, CACHE_TTL_CLOSED);
    saveSession({
      track,
      selectedIndices: [],
      isTranslated: false,
      targetLang: getDefaultLang(),
      format: "card",
      layout: "solid",
      textTheme: "light",
      customColor: null,
      bilingual: true,
      step: "select",
    });
    const params = new URLSearchParams({
      id: track.id,
      track: track.title,
      artist: track.artist,
    });
    window.location.href = `/lyrics/result.html?${params.toString()}#select`;
  };

  const renderDropdown = () => {
    if (results.length === 0) {
      dropdown.innerHTML = `<div class="dropdown-status">No tracks found</div>`;
      setOpen(true);
      return;
    }

    dropdown.innerHTML = results
      .map((item, idx) => {
        const label = item.artist ? `${item.title} - ${item.artist}` : item.title;
        const activeClass = idx === activeIndex ? " is-active" : "";
        return `
          <button type="button" class="dropdown-item${activeClass}" role="option" data-index="${idx}">
            <span class="dropdown-item-icon" aria-hidden="true">
              <animate-icons name="music" size="16"></animate-icons>
            </span>
            <span class="dropdown-item-label">${escapeHtml(label)}</span>
          </button>
        `;
      })
      .join("");
    setOpen(true);
  };

  const runSearch = async (query) => {
    const clean = query.trim();
    if (clean.length < 2) {
      results = [];
      activeIndex = -1;
      setOpen(false);
      return;
    }

    const seq = ++requestSeq;
    dropdown.innerHTML = `<div class="dropdown-status">Searching...</div>`;
    setOpen(true);

    try {
      const items = await searchTracksCached(clean);
      if (seq !== requestSeq) return;
      results = items;
      activeIndex = items.length > 0 ? 0 : -1;
      renderDropdown();
    } catch {
      if (seq !== requestSeq) return;
      dropdown.innerHTML = `<div class="dropdown-status">Search failed. Try again.</div>`;
      setOpen(true);
    }
  };

  input.addEventListener("input", () => {
    errorEl.textContent = "";
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    if (val.length < 2) {
      results = [];
      setOpen(false);
      return;
    }
    debounceTimer = setTimeout(() => runSearch(val), 280);
  });

  input.addEventListener("focus", () => {
    if (results.length > 0) setOpen(true);
  });

  input.addEventListener("keydown", (e) => {
    if (dropdown.hidden || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % results.length;
      renderDropdown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + results.length) % results.length;
      renderDropdown();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  });

  dropdown.addEventListener("click", (e) => {
    const btn = e.target.closest(".dropdown-item");
    if (!btn) return;
    const item = results[Number(btn.dataset.index)];
    if (item) selectTrack(item);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    if (results.length > 0) {
      selectTrack(results[activeIndex >= 0 ? activeIndex : 0]);
      return;
    }

    await runSearch(query);
    if (results.length === 1) {
      selectTrack(results[0]);
    }
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  });
}

function initResultPage() {
  const stepSelectEl = document.getElementById("step-select");
  const stepStyleEl = document.getElementById("step-style");
  if (!stepSelectEl || !stepStyleEl) return;

  const backBtn = document.getElementById("lyrics-back-btn");
  const backLabel = document.getElementById("lyrics-back-label");
  const pillSelect = document.getElementById("step-pill-select");
  const pillStyle = document.getElementById("step-pill-style");

  const sheetCover = document.getElementById("sheet-cover");
  const sheetCoverFallback = document.getElementById("sheet-cover-fallback");
  const sheetTitle = document.getElementById("sheet-title");
  const sheetArtist = document.getElementById("sheet-artist");
  const linesContainer = document.getElementById("lyrics-lines-container");
  const countBadge = document.getElementById("selection-count-badge");
  const clearBtn = document.getElementById("btn-clear-selection");
  const toStyleBtn = document.getElementById("btn-to-style");

  const langSelect = document.getElementById("lyrics-lang-select");
  const translateBtn = document.getElementById("btn-translate-toggle");
  const translateLabel = document.getElementById("translate-btn-label");

  const exportNode = document.getElementById("lyrics-export-node");
  const exportStageBg = document.getElementById("export-stage-bg");
  const exportCardBg = document.getElementById("export-card-bg");
  const exportCover = document.getElementById("export-cover");
  const exportTitle = document.getElementById("export-title");
  const exportArtist = document.getElementById("export-artist");
  const exportVerses = document.getElementById("export-verses");

  const ctrlFormat = document.getElementById("ctrl-format");
  const ctrlLayout = document.getElementById("ctrl-layout");
  const ctrlText = document.getElementById("ctrl-text");
  const ctrlColors = document.getElementById("ctrl-colors");
  const swatchAuto = document.getElementById("swatch-auto");
  const customColorInput = document.getElementById("ctrl-custom-color");
  const resetColorBtn = document.getElementById("btn-reset-color");
  const bilingualRow = document.getElementById("ctrl-bilingual-row");
  const bilingualToggle = document.getElementById("ctrl-bilingual");
  const downloadBtn = document.getElementById("btn-download-lyrics");
  const downloadLabel = document.getElementById("download-btn-label");

  const state = {
    track: null,
    lines: [],
    translatedLines: null,
    isTranslated: false,
    targetLang: getDefaultLang(),
    selectedIndices: [],
    step: "select",
    format: "card",
    layout: "solid",
    textTheme: "light",
    dominantColor: "#2b2f3a",
    customColor: null,
    bilingual: true,
    coverDataUrl: "",
  };

  const persist = () => {
    if (!state.track) return;
    saveSession({
      track: state.track,
      selectedIndices: state.selectedIndices,
      isTranslated: state.isTranslated,
      targetLang: state.targetLang,
      format: state.format,
      layout: state.layout,
      textTheme: state.textTheme,
      customColor: state.customColor,
      bilingual: state.bilingual,
      step: state.step,
    });
  };

  const updateSelectionUi = () => {
    const count = state.selectedIndices.length;
    countBadge.textContent = `${count} / ${MAX_LINES}`;
    clearBtn.hidden = count === 0;
    toStyleBtn.disabled = count === 0;
    pillStyle.disabled = count === 0;
  };

  const renderLines = () => {
    if (state.lines.length === 0) {
      linesContainer.innerHTML = `
        <div class="lyric-empty-state">
          <strong>Lyrics not found</strong>
          <p>We couldn't find lyrics for this track on LRCLIB.</p>
          <a href="/lyrics/" class="primary-action-btn">Search another track</a>
        </div>
      `;
      updateSelectionUi();
      return;
    }

    const selectedSet = new Set(state.selectedIndices);
    linesContainer.innerHTML = state.lines
      .map((line, idx) => {
        const isSel = selectedSet.has(idx);
        const mainText = state.isTranslated && state.translatedLines?.[idx] ? state.translatedLines[idx] : line;
        const origHtml =
          state.isTranslated && state.translatedLines?.[idx] && state.translatedLines[idx] !== line
            ? `<span class="lyric-line-orig">${escapeHtml(line)}</span>`
            : "";
        return `
          <button type="button" class="lyric-line${isSel ? " selected" : ""}" data-idx="${idx}">
            ${origHtml}
            <span class="lyric-line-main">${escapeHtml(mainText)}</span>
          </button>
        `;
      })
      .join("");

    updateSelectionUi();
  };

  const renderPreview = () => {
    const activeColor = state.customColor || state.dominantColor;
    const darker = darkenHex(activeColor, 0.42);

    exportNode.className = `export-stage format-${state.format} layout-${state.layout} text-${state.textTheme}`;
    exportNode.style.setProperty("--card-color", activeColor);
    exportNode.style.setProperty("--card-color-dark", darker);

    swatchAuto.style.setProperty("--sw", state.dominantColor);
    resetColorBtn.hidden = !state.customColor;

    const bgSrc = state.coverDataUrl || state.track?.coverHq || state.track?.cover || "";
    exportStageBg.style.backgroundImage = bgSrc ? `url("${bgSrc}")` : "none";
    exportCardBg.style.backgroundImage = bgSrc ? `url("${bgSrc}")` : "none";
    if (bgSrc) {
      exportCover.src = bgSrc;
      exportCover.hidden = false;
    } else {
      exportCover.hidden = true;
    }

    exportTitle.textContent = state.track?.title || "";
    exportArtist.textContent = state.track?.artist || "";

    const ordered = [...state.selectedIndices].sort((a, b) => a - b);
    exportVerses.innerHTML = ordered
      .map((idx) => {
        const orig = state.lines[idx] || "";
        const main = state.isTranslated && state.translatedLines?.[idx] ? state.translatedLines[idx] : orig;
        const showOrig = state.isTranslated && state.bilingual && main !== orig;
        return `
          <div class="export-verse-block">
            ${showOrig ? `<span class="export-verse-orig">${escapeHtml(orig)}</span>` : ""}
            <p class="export-verse-main">${escapeHtml(main)}</p>
          </div>
        `;
      })
      .join("");

    bilingualRow.hidden = !state.isTranslated;
    bilingualToggle.checked = state.bilingual;

    ctrlFormat.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.format === state.format));
    ctrlLayout.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.layout === state.layout));
    ctrlText.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.text === state.textTheme));
    ctrlColors.querySelectorAll(".swatch-btn").forEach((b) => {
      const val = b.dataset.color;
      b.classList.toggle("active", val === "auto" ? !state.customColor : state.customColor === val);
    });
  };

  const setStep = (step, { pushHistory = true } = {}) => {
    if (step === "style" && state.selectedIndices.length === 0) return;
    state.step = step;

    const isStyle = step === "style";
    stepSelectEl.hidden = isStyle;
    stepStyleEl.hidden = !isStyle;
    pillSelect.classList.toggle("active", !isStyle);
    pillStyle.classList.toggle("active", isStyle);
    backLabel.textContent = isStyle ? "Lyrics" : "Search";

    if (isStyle) renderPreview();
    persist();

    const targetHash = `#${step}`;
    if (pushHistory && window.location.hash !== targetHash) {
      history.pushState({ step }, "", targetHash);
    }
  };

  backBtn.addEventListener("click", () => {
    if (state.step === "style") {
      setStep("select");
    } else {
      window.location.href = "/lyrics/";
    }
  });

  pillSelect.addEventListener("click", () => setStep("select"));
  pillStyle.addEventListener("click", () => setStep("style"));

  window.addEventListener("popstate", () => {
    const hashStep = window.location.hash === "#style" ? "style" : "select";
    setStep(hashStep, { pushHistory: false });
  });

  linesContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".lyric-line");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const pos = state.selectedIndices.indexOf(idx);
    if (pos >= 0) {
      state.selectedIndices.splice(pos, 1);
      btn.classList.remove("selected");
    } else if (state.selectedIndices.length < MAX_LINES) {
      state.selectedIndices.push(idx);
      btn.classList.add("selected");
    }
    updateSelectionUi();
    persist();
  });

  clearBtn.addEventListener("click", () => {
    state.selectedIndices = [];
    renderLines();
    persist();
  });

  toStyleBtn.addEventListener("click", () => setStep("style"));

  langSelect.addEventListener("change", async () => {
    state.targetLang = langSelect.value;
    state.translatedLines = null;
    if (state.isTranslated && state.lines.length > 0) {
      translateBtn.disabled = true;
      translateLabel.textContent = "Translating...";
      state.translatedLines = await translateLinesCached(state.track, state.lines, state.targetLang);
      translateBtn.disabled = false;
      translateLabel.textContent = "Translated";
      renderLines();
    }
    persist();
  });

  translateBtn.addEventListener("click", async () => {
    if (state.lines.length === 0) return;
    if (!state.isTranslated) {
      if (!state.translatedLines) {
        translateBtn.disabled = true;
        translateLabel.textContent = "Translating...";
        state.translatedLines = await translateLinesCached(state.track, state.lines, state.targetLang);
        translateBtn.disabled = false;
      }
      state.isTranslated = true;
      translateBtn.classList.add("active");
      translateLabel.textContent = "Translated";
    } else {
      state.isTranslated = false;
      translateBtn.classList.remove("active");
      translateLabel.textContent = "Translate";
    }
    renderLines();
    persist();
  });

  ctrlFormat.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.format = btn.dataset.format;
    renderPreview();
    persist();
  });

  ctrlLayout.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.layout = btn.dataset.layout;
    renderPreview();
    persist();
  });

  ctrlText.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    state.textTheme = btn.dataset.text;
    renderPreview();
    persist();
  });

  ctrlColors.addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch-btn");
    if (!btn) return;
    const val = btn.dataset.color;
    state.customColor = val === "auto" ? null : val;
    if (val !== "auto") {
      state.textTheme = isLightHex(val) ? "dark" : "light";
    }
    renderPreview();
    persist();
  });

  customColorInput.addEventListener("input", () => {
    state.customColor = customColorInput.value;
    state.textTheme = isLightHex(state.customColor) ? "dark" : "light";
    renderPreview();
    persist();
  });

  resetColorBtn.addEventListener("click", () => {
    state.customColor = null;
    state.textTheme = isLightHex(state.dominantColor) ? "dark" : "light";
    renderPreview();
    persist();
  });

  bilingualToggle.addEventListener("change", () => {
    state.bilingual = bilingualToggle.checked;
    renderPreview();
    persist();
  });

  downloadBtn.addEventListener("click", async () => {
    downloadBtn.disabled = true;
    downloadLabel.textContent = "Exporting...";
    try {
      const slug = `${state.track?.artist || "track"}-${state.track?.title || "lyrics"}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await exportNodeAsPng(exportNode, `listendeck-${slug}-${state.format}.png`, { pixelRatio: 3 });
    } finally {
      downloadBtn.disabled = false;
      downloadLabel.textContent = "Download PNG";
    }
  });

  async function bootstrap() {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get("id");
    const paramTrack = params.get("track");
    const paramArtist = params.get("artist");
    const saved = loadSession();

    let track = null;
    if (paramId) {
      track =
        (saved?.track?.id === paramId ? saved.track : null) ||
        getCache(`lyrics_track_meta_${paramId}`) ||
        (await fetchTrackByIdCached(paramId));
    }

    if (!track && paramTrack && paramArtist) {
      track = { id: paramId || "", title: paramTrack, artist: paramArtist, cover: "", coverHq: "" };
    } else if (!track && saved?.track) {
      track = saved.track;
    }

    if (!track) {
      window.location.href = "/lyrics/";
      return;
    }

    state.track = track;
    document.title = `${track.title} · Lyrics · listendeck.`;
    sheetTitle.textContent = track.title;
    sheetArtist.textContent = track.artist;

    const isSameSaved = saved?.track && saved.track.id === track.id;
    if (isSameSaved) {
      state.selectedIndices = Array.isArray(saved.selectedIndices) ? saved.selectedIndices : [];
      state.isTranslated = Boolean(saved.isTranslated);
      state.targetLang = saved.targetLang || getDefaultLang();
      state.format = saved.format || "card";
      state.layout = saved.layout || "solid";
      state.textTheme = saved.textTheme || "light";
      state.customColor = saved.customColor || null;
      state.bilingual = saved.bilingual !== false;
    }

    langSelect.value = state.targetLang;

    const coverUrl = track.coverHq || track.cover;
    if (coverUrl) {
      sheetCover.onload = () => {
        sheetCover.classList.add("is-loaded");
        if (sheetCoverFallback) sheetCoverFallback.hidden = true;
      };
      sheetCover.src = track.cover || coverUrl;
      loadImageAsDataUrl(coverUrl).then((dataUrl) => {
        state.coverDataUrl = dataUrl;
        if (state.step === "style") renderPreview();
      });
      extractDominantColor(coverUrl).then((hex) => {
        state.dominantColor = hex;
        if (!state.customColor && !isSameSaved) {
          state.textTheme = isLightHex(hex) ? "dark" : "light";
        }
        if (state.step === "style") renderPreview();
      });
    }

    state.lines = await fetchLyricsCached(track);
    state.selectedIndices = state.selectedIndices.filter((i) => i >= 0 && i < state.lines.length);

    if (state.isTranslated && state.lines.length > 0) {
      translateBtn.classList.add("active");
      translateLabel.textContent = "Translated";
      state.translatedLines = await translateLinesCached(track, state.lines, state.targetLang);
    }

    renderLines();

    const initialStep =
      (window.location.hash === "#style" || (isSameSaved && saved.step === "style")) &&
      state.selectedIndices.length > 0
        ? "style"
        : "select";
    setStep(initialStep, { pushHistory: false });
  }

  bootstrap();
}

document.addEventListener("DOMContentLoaded", () => {
  initLandingPage();
  initResultPage();
});

import { EVENTS, trackEvent } from "../shared/analytics.js";
import { deezer, listenbrainz } from "../shared/api.js";
import { exportNodeAsPng } from "../shared/export.js";
import { initExportBgControls } from "../shared/export-bg.js";
import {
  addRecentUser,
  CACHE_TTL_CURRENT,
  getCache,
  setCache,
} from "../shared/storage.js";

const WINDOW_DAYS = 30;
const WINDOW_BUCKET_SEC = 600;
const MAX_LISTEN_PAGES = 15;
const LISTENS_PAGE_SIZE = 1000;
const TASTOMETER_CIRCUMFERENCE = 282.74;

const lastValidResults = new Map();
let currentMatchData = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function truncateWithEllipsis(str, maxLength = 30) {
  if (!str) return "";
  const s = String(str).trim();
  if (s.length <= maxLength) return s;
  return `${s.slice(0, maxLength).trimEnd()}...`;
}

function cleanReportTitle(str) {
  if (!str) return "";
  const cleaned = String(str).replace(/\s*\([^)]*\)/g, "").trim();
  return cleaned || String(str).trim();
}

function getAffinityTier(percentage) {
  if (percentage >= 100) return "SUPER FRIENDS";
  if (percentage >= 90) return "SOUL SYNCHRONIZED";
  if (percentage >= 80) return "MUSIC TWINS";
  if (percentage >= 70) return "VIBE PARTNERS";
  if (percentage >= 60) return "SOUND NEIGHBORS";
  if (percentage >= 50) return "COMMON GROUND";
  if (percentage >= 40) return "OCCASIONAL OVERLAP";
  if (percentage >= 30) return "CASUAL ACQUAINTANCES";
  if (percentage >= 20) return "DISTANT WAVES";
  if (percentage >= 10) return "PARALLEL LINES";
  return "TOTAL STRANGERS";
}

function getRolling30DayWindow() {
  const nowSec = Math.floor(Date.now() / 1000);
  const endTs = Math.ceil(nowSec / WINDOW_BUCKET_SEC) * WINDOW_BUCKET_SEC;
  const startTs = endTs - WINDOW_DAYS * 86400;
  const dayKey = new Date().toISOString().slice(0, 10);
  return { startTs, endTs, dayKey };
}

async function fetchWindowListens(username, startTs, endTs) {
  const collected = [];
  const seen = new Set();
  let cursorMaxTs = endTs;

  for (let page = 0; page < MAX_LISTEN_PAGES; page++) {
    const response = await listenbrainz.getUserListens(username, {
      maxTs: cursorMaxTs,
      count: LISTENS_PAGE_SIZE,
    });
    const batch = response?.payload?.listens || [];
    if (!batch.length) break;

    for (const listen of batch) {
      const ts = Number(listen?.listened_at);
      if (!Number.isFinite(ts) || ts >= endTs || ts < startTs) continue;
      const trackName = listen?.track_metadata?.track_name || "";
      const artistName = listen?.track_metadata?.artist_name || "";
      const dedupeKey = `${ts}:${trackName}:${artistName}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      collected.push(listen);
    }

    const oldestTs = Number(batch[batch.length - 1]?.listened_at);
    if (!Number.isFinite(oldestTs) || oldestTs <= startTs || batch.length < LISTENS_PAGE_SIZE || oldestTs >= cursorMaxTs) {
      break;
    }
    cursorMaxTs = oldestTs;
  }

  return collected;
}

function sortMapEntries(map, limit) {
  return Array.from(map.values())
    .sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function aggregateUser30d(listens) {
  const artistMap = new Map();
  const trackMap = new Map();
  const albumMap = new Map();

  for (const listen of listens) {
    const meta = listen?.track_metadata || {};
    const artistName = (meta.artist_name || "").trim();
    const trackName = (meta.track_name || "").trim();
    const releaseName = (meta.release_name || "").trim();

    if (artistName) {
      const key = artistName.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.plays += 1;
      } else {
        artistMap.set(key, { title: artistName, subtitle: "", plays: 1, cover: "" });
      }
    }

    if (trackName) {
      const key = `${trackName.toLowerCase()}::${artistName.toLowerCase()}`;
      const existing = trackMap.get(key);
      if (existing) {
        existing.plays += 1;
      } else {
        trackMap.set(key, { title: trackName, subtitle: artistName, plays: 1 });
      }
    }

    if (releaseName) {
      const key = `${releaseName.toLowerCase()}::${artistName.toLowerCase()}`;
      const existing = albumMap.get(key);
      if (existing) {
        existing.plays += 1;
      } else {
        albumMap.set(key, { title: releaseName, subtitle: artistName, plays: 1 });
      }
    }
  }

  return {
    totalListens: listens.length,
    uniqueArtists: artistMap.size,
    top100Artists: sortMapEntries(artistMap, 100),
    top3Tracks: sortMapEntries(trackMap, 3),
    top3Albums: sortMapEntries(albumMap, 3),
  };
}

async function fetchUserSummary(username, windowInfo) {
  const cacheKey = `match_user:${username.toLowerCase()}:${windowInfo.dayKey}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const listens = await fetchWindowListens(username, windowInfo.startTs, windowInfo.endTs);
    const summary = aggregateUser30d(listens);
    setCache(cacheKey, summary, CACHE_TTL_CURRENT);
    return summary;
  } catch (err) {
    if (err?.status === 404) {
      err.notFoundUser = username;
    }
    throw err;
  }
}

async function resolveArtistCover(name) {
  if (!name) return "";
  const cleanName = name.includes(",") ? name.split(",")[0].trim() : name.trim();
  try {
    const res = await deezer.search("artist", cleanName, 5);
    const items = res?.data || [];
    if (!items.length) return "";
    const targetLower = cleanName.toLowerCase();
    const exact = items.find((item) => item.name?.toLowerCase().trim() === targetLower);
    const chosen = exact || items[0];
    return chosen?.picture_xl || chosen?.picture_big || chosen?.picture_medium || "";
  } catch {
    return "";
  }
}

async function fetchMatchData(user1, user2) {
  const windowInfo = getRolling30DayWindow();
  const pairKey = `match_pair:${user1.toLowerCase()}:${user2.toLowerCase()}:${windowInfo.dayKey}`;
  const cached = getCache(pairKey);
  if (cached) return cached;

  const summary1 = await fetchUserSummary(user1, windowInfo);
  const summary2 = await fetchUserSummary(user2, windowInfo);

  const list1 = summary1.top100Artists;
  const list2 = summary2.top100Artists;

  const map1 = new Map(list1.map((a, idx) => [a.title.toLowerCase(), { ...a, rank: idx + 1 }]));
  const map2 = new Map(list2.map((a, idx) => [a.title.toLowerCase(), { ...a, rank: idx + 1 }]));

  const common = [];
  for (const a1 of list1) {
    const key = a1.title.toLowerCase();
    const a2 = map2.get(key);
    if (a2) {
      common.push({
        title: a1.title,
        subtitle: "",
        rankScore: map1.get(key).rank + a2.rank,
        plays: a1.plays + a2.plays,
        cover: "",
      });
    }
  }
  common.sort((a, b) => a.rankScore - b.rankScore || b.plays - a.plays);

  const maxPossibleCommon = Math.min(list1.length, list2.length);
  const matchPercentage = maxPossibleCommon > 0 ? Math.round((common.length / maxPossibleCommon) * 100) : 0;

  const artists1 = list1.slice(0, 10).map((a) => ({ ...a }));
  const artists2 = list2.slice(0, 10).map((a) => ({ ...a }));
  const commonTop10 = common.slice(0, 10);

  const [commonCover, cover1, cover2] = await Promise.all([
    commonTop10[0] ? resolveArtistCover(commonTop10[0].title) : Promise.resolve(""),
    artists1[0] ? resolveArtistCover(artists1[0].title) : Promise.resolve(""),
    artists2[0] ? resolveArtistCover(artists2[0].title) : Promise.resolve(""),
  ]);

  if (commonTop10[0]) commonTop10[0].cover = commonCover;
  if (artists1[0]) artists1[0].cover = cover1;
  if (artists2[0]) artists2[0].cover = cover2;

  const data = {
    user1,
    user2,
    matchPercentage,
    tier: getAffinityTier(matchPercentage),
    heroCover: commonCover || cover1 || cover2 || "",
    stats1: {
      listens: formatNumber(summary1.totalListens),
      artists: formatNumber(summary1.uniqueArtists),
    },
    stats2: {
      listens: formatNumber(summary2.totalListens),
      artists: formatNumber(summary2.uniqueArtists),
    },
    commonArtists: commonTop10,
    user1Artists: artists1,
    user2Artists: artists2,
    story1: {
      artists: artists1.slice(0, 3),
      tracks: summary1.top3Tracks,
      albums: summary1.top3Albums,
    },
    story2: {
      artists: artists2.slice(0, 3),
      tracks: summary2.top3Tracks,
      albums: summary2.top3Albums,
    },
  };

  setCache(pairKey, data, CACHE_TTL_CURRENT);
  return data;
}

function attachImageFadeIn(imgEl, onReveal) {
  if (!imgEl) return;
  imgEl.classList.remove("is-loaded");
  const reveal = () => {
    imgEl.classList.add("is-loaded");
    onReveal?.();
  };
  imgEl.addEventListener("load", reveal, { once: true });
  imgEl.addEventListener("error", () => {
    imgEl.style.display = "none";
    onReveal?.();
  }, { once: true });
  if (imgEl.complete && imgEl.naturalWidth > 0) {
    requestAnimationFrame(reveal);
  }
}

function renderEmpty(container, message) {
  container.innerHTML = `<div class="chart-item"><span class="chart-row-sub">${escapeHtml(message)}</span></div>`;
}

function renderArtistList(container, items, emptyMessage) {
  if (!items.length) {
    renderEmpty(container, emptyMessage);
    return;
  }

  const [first, ...rest] = items;
  const top1Html = `
    <div class="chart-item top-1">
      ${first.cover ? `<div class="top1-skeleton-bg skeleton"></div><img class="top1-image" src="${escapeHtml(first.cover)}" alt="" crossorigin="anonymous" />` : ""}
      <div class="text-content">
        <span>${escapeHtml(first.title)}</span>
        <span>${formatNumber(first.plays)}</span>
      </div>
    </div>
  `;

  const restHtml = rest
    .map((item, idx) => `
      <div class="chart-item">
        <span class="chart-rank">#${idx + 2}</span>
        <div class="chart-row-text">
          <span class="chart-row-title">${escapeHtml(item.title)}</span>
        </div>
        <span class="chart-row-plays">${formatNumber(item.plays)}</span>
      </div>
    `)
    .join("");

  container.innerHTML = top1Html + restHtml;
  const top1Img = container.querySelector(".top1-image");
  const top1Bg = container.querySelector(".top1-skeleton-bg");
  if (top1Img) {
    attachImageFadeIn(top1Img, () => {
      top1Bg?.remove();
    });
  }
}

function animateTastometer(percentage) {
  const textEl = document.getElementById("tastometerText");
  const progressEl = document.getElementById("tastometerProgress");
  if (!textEl || !progressEl) return;

  const targetOffset = TASTOMETER_CIRCUMFERENCE - (TASTOMETER_CIRCUMFERENCE * percentage) / 100;
  requestAnimationFrame(() => {
    progressEl.style.strokeDashoffset = String(targetOffset);
  });

  if (percentage <= 0) {
    textEl.textContent = "0%";
    return;
  }

  let current = 0;
  const steps = 40;
  const increment = percentage / steps;
  const timer = setInterval(() => {
    current += increment;
    if (current >= percentage) {
      current = percentage;
      clearInterval(timer);
    }
    textEl.textContent = `${Math.round(current)}%`;
  }, 25);
}

function setHeaderSkeleton(active) {
  const ids = ["userScrobbles1", "userArtists1", "userScrobbles2", "userArtists2", "tastometerTier"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("skeleton", active);
    el.classList.toggle("skeleton-text", active);
    if (active) el.textContent = "";
  });
}

function applyMatchToDom(data) {
  currentMatchData = data;
  setHeaderSkeleton(false);

  document.getElementById("userScrobbles1").textContent = data.stats1.listens;
  document.getElementById("userArtists1").textContent = data.stats1.artists;
  document.getElementById("userScrobbles2").textContent = data.stats2.listens;
  document.getElementById("userArtists2").textContent = data.stats2.artists;
  document.getElementById("tastometerTier").textContent = data.tier;

  animateTastometer(data.matchPercentage);

  const coverEl = document.getElementById("artistCover");
  if (coverEl) {
    if (data.heroCover) {
      coverEl.style.display = "block";
      coverEl.src = data.heroCover;
      attachImageFadeIn(coverEl);
    } else {
      coverEl.removeAttribute("src");
      coverEl.style.display = "none";
    }
  }

  renderArtistList(
    document.getElementById("listUser1Vibe"),
    data.user1Artists,
    "No top artists recorded in the last 30 days."
  );
  renderArtistList(
    document.getElementById("listCommonArtists"),
    data.commonArtists,
    "No artists in common yet. Opposites attract!"
  );
  renderArtistList(
    document.getElementById("listUser2Vibe"),
    data.user2Artists,
    "No top artists recorded in the last 30 days."
  );
}

async function verifyUser(username) {
  const cacheKey = `user_ok:${username.toLowerCase()}`;
  if (getCache(cacheKey)) return;
  await listenbrainz.getUserCount(username);
  setCache(cacheKey, true, CACHE_TTL_CURRENT);
}

function initLandingForm() {
  const form = document.getElementById("match-form");
  const input1 = document.getElementById("match-user-1");
  const input2 = document.getElementById("match-user-2");
  const pill = document.getElementById("match-input-pill");
  const errorEl = document.getElementById("match-error");
  const submitBtn = document.getElementById("match-submit-btn");
  if (!form || !input1 || !input2) return;

  const setError = (msg) => {
    if (errorEl) errorEl.textContent = msg || "";
    pill?.classList.toggle("has-error", Boolean(msg));
  };

  const params = new URLSearchParams(window.location.search);
  const notFound = (params.get("not_found") || "").trim();
  const u1Param = (params.get("user1") || "").trim();
  const u2Param = (params.get("user2") || "").trim();
  if (u1Param) input1.value = u1Param;
  if (u2Param) input2.value = u2Param;
  if (notFound) {
    setError(`User "${notFound}" not found on ListenBrainz.`);
  }

  input1.addEventListener("input", () => setError(""));
  input2.addEventListener("input", () => setError(""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user1 = input1.value.trim();
    const user2 = input2.value.trim();
    if (!user1 || !user2) return;

    if (user1.toLowerCase() === user2.toLowerCase()) {
      setError("Please enter two different ListenBrainz usernames.");
      return;
    }

    setError("");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking...";
    }

    try {
      try {
        await verifyUser(user1);
      } catch (err) {
        if (err?.status === 404) {
          setError(`User "${user1}" not found on ListenBrainz.`);
          return;
        }
        throw err;
      }

      try {
        await verifyUser(user2);
      } catch (err) {
        if (err?.status === 404) {
          setError(`User "${user2}" not found on ListenBrainz.`);
          return;
        }
        throw err;
      }

      addRecentUser("match", user1);
      addRecentUser("match", user2);
      trackEvent(EVENTS.SEARCH_SUBMIT, { tool: "match" });
      window.location.href = `/match/result.html?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`;
    } catch {
      setError("Unable to reach ListenBrainz. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Compare";
      }
    }
  });
}

function populateStoryList(containerId, items, isTrackOrAlbum) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const top3 = (items || []).slice(0, 3);
  container.innerHTML = top3
    .map((item, index) => {
      const rank = index + 1;
      const rawSub = item.subtitle ? item.subtitle : `${formatNumber(item.plays)} streams`;
      const rawName = isTrackOrAlbum ? cleanReportTitle(item.title) : item.title;
      const displayName = truncateWithEllipsis(rawName, 24);
      const displaySub = truncateWithEllipsis(rawSub, 28);
      return `
        <div class="story-item-row">
          <span class="story-item-rank">${rank}</span>
          <div class="story-item-details">
            <span class="story-item-name">${escapeHtml(displayName)}</span>
            <span class="story-item-sub">${escapeHtml(displaySub)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function initExportModal() {
  const openBtn = document.getElementById("export-match-btn");
  const settingsModal = document.getElementById("generationSettingsModal");
  const generationModal = document.getElementById("generationModal");
  const closeBtn = document.getElementById("closeSettingsModal");
  const confirmBtn = document.getElementById("confirmSettingsBtn");
  const themeCheckbox = document.getElementById("themeToggleCheckbox");
  const bgPicker = document.getElementById("bgStylePicker");
  const meshBgEl = document.getElementById("storyReportBackground");

  if (!openBtn || !settingsModal) return;

  const bgControls = initExportBgControls({ pickerEl: bgPicker, targetEl: meshBgEl });

  const openModal = () => {
    if (!currentMatchData) return;
    settingsModal.classList.add("show");
  };

  const closeModal = () => {
    settingsModal.classList.remove("show");
  };

  openBtn.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeModal();
  });

  confirmBtn?.addEventListener("click", async () => {
    if (!currentMatchData) return;
    closeModal();

    const selectedBg = bgControls.getSelectedStyle();
    const isLight = Boolean(themeCheckbox?.checked);

    const reportEl = document.getElementById("storyReport");
    reportEl.className = isLight ? "theme-light" : "theme-dark";
    bgControls.applyCurrentBg();

    document.getElementById("storyReportTitle").textContent = "Match";
    document.getElementById("storyMatchScore").textContent = `${currentMatchData.matchPercentage}%`;
    document.getElementById("storyMonthYear").textContent = currentMatchData.tier;
    document.getElementById("storyTotalMinutes").textContent = `${currentMatchData.user1} & ${currentMatchData.user2}`;

    populateStoryList("storyListArtists1", currentMatchData.story1.artists, false);
    populateStoryList("storyListSongs1", currentMatchData.story1.tracks, true);
    populateStoryList("storyListAlbums1", currentMatchData.story1.albums, true);

    populateStoryList("storyListArtists2", currentMatchData.story2.artists, false);
    populateStoryList("storyListSongs2", currentMatchData.story2.tracks, true);
    populateStoryList("storyListAlbums2", currentMatchData.story2.albums, true);

    const stateLoading = document.getElementById("generationStateLoading");
    const stateComplete = document.getElementById("generationStateComplete");
    if (generationModal) {
      stateLoading.style.display = "flex";
      stateComplete.style.display = "none";
      generationModal.classList.add("show");
    }

    setTimeout(async () => {
      try {
        await exportNodeAsPng(
          reportEl,
          `listendeck_match_${currentMatchData.user1}_${currentMatchData.user2}.png`
        );
        trackEvent(EVENTS.EXPORT_CARD, {
          tool: "match",
          action: "download",
          format: "story",
          style: selectedBg,
        });
        if (generationModal) {
          stateLoading.style.display = "none";
          stateComplete.style.display = "flex";
          setTimeout(() => generationModal.classList.remove("show"), 900);
        }
      } catch {
        generationModal?.classList.remove("show");
      }
    }, 350);
  });
}

async function initResultPage() {
  const report = document.getElementById("match-report");
  if (!report) return;

  const params = new URLSearchParams(window.location.search);
  const user1 = (params.get("user1") || "").trim();
  const user2 = (params.get("user2") || "").trim();

  if (!user1 || !user2 || user1.toLowerCase() === user2.toLowerCase()) {
    window.location.replace("/match/");
    return;
  }

  document.getElementById("userDisplayName1").textContent = user1;
  document.getElementById("userDisplayName2").textContent = user2;
  document.getElementById("titleUser1Vibe").innerHTML = `${escapeHtml(user1)}'s Vibe<span class="logo-dot">.</span>`;
  document.getElementById("titleUser2Vibe").innerHTML = `${escapeHtml(user2)}'s Vibe<span class="logo-dot">.</span>`;

  addRecentUser("match", user1);
  addRecentUser("match", user2);
  initExportModal();

  const memoryKey = `${user1.toLowerCase()}:${user2.toLowerCase()}`;

  try {
    const data = await fetchMatchData(user1, user2);
    lastValidResults.set(memoryKey, data);
    applyMatchToDom(data);
  } catch (err) {
    if (err?.status === 404) {
      const missing = err.notFoundUser || user1;
      window.location.replace(
        `/match/?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}&not_found=${encodeURIComponent(missing)}`
      );
      return;
    }
    const fallback = lastValidResults.get(memoryKey);
    if (fallback) {
      applyMatchToDom(fallback);
      return;
    }
    setHeaderSkeleton(false);
    const msg = "Unable to load ListenBrainz data.";
    renderEmpty(document.getElementById("listUser1Vibe"), msg);
    renderEmpty(document.getElementById("listCommonArtists"), msg);
    renderEmpty(document.getElementById("listUser2Vibe"), msg);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initLandingForm();
  initResultPage();
});

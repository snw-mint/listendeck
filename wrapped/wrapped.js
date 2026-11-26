import { EVENTS, trackEvent } from "../shared/analytics.js";
import { deezer, listenbrainz } from "../shared/api.js";
import { exportNodeAsPng } from "../shared/export.js";
import { initExportBgControls } from "../shared/export-bg.js";
import {
  addRecentUser,
  CACHE_TTL_WRAPPED,
  getCache,
  setCache,
} from "../shared/storage.js";

const WRAPPED_RANGE = "this_year";
const FALLBACK_DURATION_MS = 3.5 * 60 * 1000;
const LISTENS_PAGE_SIZE = 1000;
const MAX_WRAPPED_PAGES = 50;

const SERVICE_LOGOS = {
  listendeck: `<span class="story-service-wordmark">listendeck<span class="logo-dot">.</span></span>`,
  applemusic: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" width="200" height="50"><path d="M83.57 48.49V15.95h-.24L70.31 48.49h-5.06L52.23 15.95h-.24v32.54h-6.03V4.37h7.72l13.98 35.2h.24l13.98-35.2h7.96v44.12zm40.25 0h-6.27v-5.55h-.24c-1.68 3.86-5.06 6.03-9.88 6.03-6.99 0-11.09-4.58-11.09-12.05V16.19h6.51v19.52c0 4.82 2.41 7.48 6.75 7.48 4.82 0 7.47-3.38 7.47-8.44V16.19h6.51zm17.84-32.79c7.47 0 12.05 4.1 12.29 10.13h-6.02c-.48-3.14-2.65-5.07-6.27-5.07s-6.03 1.69-6.03 4.34c0 1.93 1.45 3.38 4.82 4.1l5.07 1.21c6.51 1.44 8.92 4.1 8.92 8.68 0 5.78-5.31 9.88-12.78 9.88-7.96 0-12.78-3.86-13.26-10.13h6.51c.48 3.38 2.89 5.07 6.75 5.07s6.27-1.69 6.27-4.34c0-2.17-1.21-3.38-4.58-4.1l-5.07-1.21c-6.02-1.44-8.91-4.33-8.91-9.16 0-5.54 4.82-9.4 12.29-9.4m17.6-7.95c0-2.17 1.68-3.86 3.85-3.86s3.86 1.69 3.86 3.86-1.69 3.85-3.86 3.85-3.85-1.68-3.85-3.85m.48 8.43h6.51v32.31h-6.51zm33.99 11.09c-.72-3.38-3.13-6.27-7.47-6.27-5.07 0-8.44 4.34-8.44 11.09 0 6.99 3.37 11.09 8.44 11.09 4.09 0 6.5-2.17 7.47-6.03H200c-.73 6.75-6.03 11.57-13.74 11.57-9.16 0-14.95-6.27-14.95-16.63 0-10.13 5.79-16.64 14.95-16.64 8.19 0 13.01 5.31 13.74 11.57zM25.95 8.71c-1.69 1.93-4.34 3.62-6.99 3.38-.48-2.89.96-5.79 2.41-7.48C23.06 2.45 25.95 1 28.36 1c.24 2.65-.72 5.54-2.41 7.71m2.41 3.86c1.45 0 5.78.48 8.68 4.82-.24.24-5.07 3.13-5.07 9.16 0 7.23 6.27 9.64 6.27 9.64 0 .24-.96 3.38-3.13 6.75-1.93 2.9-4.1 5.79-7.23 5.79-3.14 0-4.1-1.93-7.72-1.93-3.61 0-4.82 1.93-7.71 1.93-3.13 0-5.55-3.13-7.47-6.03-4.1-6.02-7.24-16.87-2.9-24.1 1.93-3.62 5.79-6.03 9.65-6.03 3.13 0 6.02 2.17 7.71 2.17s5.06-2.41 8.92-2.17" style="fill:currentColor"/></svg>`,
  spotify: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 162 50" width="162" height="50"><path d="M25.54 0c-13.81 0-25 11.19-25 25s11.19 25 25 25 25-11.19 25-25-11.19-25-25-25M37 36.06q-.16.26-.41.44-.25.19-.55.26t-.61.02q-.31-.04-.57-.21c-5.87-3.58-13.26-4.39-21.96-2.41q-.3.07-.61.02-.3-.05-.57-.22-.26-.16-.44-.41-.18-.26-.25-.56t-.02-.61q.06-.3.22-.56.17-.27.42-.45.25-.17.55-.24c9.53-2.18 17.7-1.24 24.29 2.78q.26.17.44.42.19.25.26.55t.02.61q-.05.3-.21.57m3.06-6.81c-.56.92-1.76 1.21-2.68.64-6.72-4.13-16.96-5.32-24.91-2.91q-.37.11-.76.07-.38-.04-.73-.22-.34-.18-.58-.48-.25-.3-.36-.67t-.08-.76q.04-.38.22-.72.19-.34.49-.59t.67-.36c9.08-2.76 20.36-1.42 28.08 3.32.92.57 1.21 1.77.64 2.68m.27-7.09c-8.06-4.78-21.36-5.22-29.05-2.89-1.23.38-2.54-.32-2.91-1.56q-.14-.44-.09-.91.04-.46.26-.87t.58-.7q.36-.3.8-.43c8.84-2.69 23.52-2.17 32.79 3.34q.4.24.68.61t.4.82q.11.45.04.91-.06.46-.3.86a2.33 2.33 0 0 1-3.2.82m28.23.92c-4.32-1.03-5.09-1.75-5.09-3.27 0-1.43 1.35-2.4 3.36-2.4 1.95 0 3.87.73 5.9 2.24q.09.07.21.05.03 0 .06-.01.02-.01.05-.02l.04-.04.04-.04 2.11-2.97q.03-.05.04-.1t.01-.11q-.01-.05-.04-.1-.03-.04-.07-.08c-2.41-1.93-5.12-2.87-8.29-2.87-4.66 0-7.91 2.8-7.91 6.8 0 4.29 2.8 5.81 7.66 6.98 4.13.96 4.83 1.75 4.83 3.18 0 1.58-1.41 2.56-3.68 2.56-2.52 0-4.58-.85-6.88-2.84q-.02-.02-.04-.03-.03-.02-.05-.02l-.06-.02h-.05q-.03 0-.06.01t-.05.02q-.03.01-.05.03l-.04.04-2.36 2.81q-.04.04-.05.1-.02.05-.02.1.01.06.03.11t.07.09c2.67 2.38 5.96 3.64 9.51 3.64 5.02 0 8.27-2.74 8.27-6.99.01-3.58-2.14-5.57-7.4-6.85m18.77-4.25c-2.18 0-3.96.85-5.44 2.61v-1.98a.28.28 0 0 0-.28-.28h-3.86q-.06 0-.11.02t-.09.06-.06.1q-.02.05-.02.1v21.98c0 .15.12.28.28.28h3.86q.06 0 .11-.02t.09-.06.06-.1q.02-.05.02-.1V34.5c1.48 1.65 3.26 2.46 5.44 2.46 4.05 0 8.14-3.11 8.14-9.07.01-5.95-4.09-9.06-8.14-9.06m3.65 9.06c0 3.03-1.87 5.15-4.55 5.15-2.64 0-4.63-2.21-4.63-5.15 0-2.93 1.99-5.14 4.63-5.14 2.63 0 4.55 2.16 4.55 5.14m14.99-9.06c-5.21 0-9.3 4.01-9.3 9.13 0 5.07 4.06 9.03 9.23 9.03 5.23 0 9.32-3.99 9.32-9.1 0-5.08-4.06-9.06-9.25-9.06m0 14.24c-2.78 0-4.86-2.23-4.86-5.18 0-2.96 2.01-5.11 4.79-5.11 2.79 0 4.89 2.22 4.89 5.18s-2.03 5.11-4.82 5.11m20.38-13.89h-4.26v-4.35c0-.16-.12-.28-.28-.28h-3.86q-.06 0-.11.02t-.09.06-.07.09q-.02.05-.02.11v4.35h-1.85q-.06 0-.11.02t-.09.06-.06.09q-.03.06-.03.11v3.32q0 .06.03.11.02.05.06.09t.09.07q.05.02.11.02h1.85v8.59c0 3.48 1.73 5.24 5.14 5.24 1.39 0 2.54-.29 3.62-.9q.03-.02.06-.05.03-.02.05-.06.02-.03.03-.07.01-.03 0-.07v-3.23q-.01-.04-.03-.07l-.04-.06-.06-.04q-.03-.02-.06-.03l-.08-.02q-.03 0-.07.01-.03.01-.06.03c-.75.37-1.47.54-2.27.54-1.24 0-1.8-.56-1.8-1.82v-7.99h4.26q.05 0 .1-.02.06-.02.1-.06.03-.04.06-.1.02-.05.02-.1v-3.33q0-.05-.02-.1-.02-.06-.06-.1t-.09-.06-.11-.02m14.82.02v-.54c0-1.57.6-2.27 1.95-2.27.81 0 1.46.16 2.18.4q.07.03.13.02.07-.02.13-.06.05-.04.08-.1t.03-.13v-3.25q0-.05-.01-.09-.02-.05-.04-.08-.03-.04-.07-.06-.03-.03-.08-.04c-.76-.23-1.74-.47-3.21-.47-3.57 0-5.46 2.01-5.46 5.82v.81h-1.86q-.05 0-.1.03-.06.02-.1.06t-.06.09-.02.11v3.34c0 .15.13.28.28.28h1.86v13.26c0 .15.13.28.29.28h3.86c.16 0 .28-.13.28-.28V23.07h3.61l5.53 13.26c-.63 1.39-1.24 1.66-2.09 1.66q-1.02 0-2.13-.6-.02-.01-.05-.02t-.06-.01q-.03-.01-.06 0-.02 0-.05.01t-.05.02q-.03.02-.05.04l-.04.04q-.02.02-.03.05l-1.31 2.87q-.02.05-.03.11 0 .05.02.1t.05.09q.04.05.08.07c1.37.74 2.6 1.06 4.13 1.06 2.85 0 4.43-1.33 5.82-4.91l6.71-17.33q.01-.03.01-.06.01-.04 0-.07 0-.04-.01-.07t-.03-.06-.05-.05q-.02-.02-.05-.04-.03-.01-.07-.02-.03-.01-.06-.01h-4.03q-.04 0-.09.01-.04.01-.07.04-.04.03-.07.06l-.04.08-4.12 11.77-4.51-11.78q-.02-.04-.05-.07-.02-.04-.06-.06-.03-.03-.07-.04t-.09-.01zm-8.59-.02h-3.87q-.05 0-.11.02-.05.02-.09.06t-.06.1q-.02.05-.02.1v16.87c0 .15.13.28.28.28h3.87c.15 0 .28-.13.28-.28V19.47q0-.06-.02-.11-.02-.06-.06-.1t-.09-.06q-.06-.02-.11-.02m-1.91-7.68c-1.53 0-2.78 1.24-2.78 2.77q0 .55.21 1.06.22.51.61.9t.9.61q.51.21 1.06.21c1.53 0 2.77-1.24 2.77-2.78q0-.55-.21-1.06-.22-.51-.6-.9-.39-.38-.9-.6-.51-.21-1.06-.21" style="fill:currentColor"/></svg>`,
  youtubemusic: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 165 50" width="165" height="50" style="fill:currentColor"><path d="M25.41 0C11.38 0 0 11.19 0 25s11.38 25 25.41 25c14.04 0 25.42-11.19 25.42-25 0-13.8-11.38-25-25.42-25m0 41.35a16.35 16.35 0 0 1-15.09-10.1 16.33 16.33 0 0 1 3.55-17.81c4.67-4.67 11.7-6.07 17.81-3.54a16.34 16.34 0 0 1 10.08 15.11c0 2.14-.42 4.27-1.24 6.25s-2.03 3.79-3.54 5.3a16.3 16.3 0 0 1-5.31 3.54c-1.98.83-4.1 1.25-6.25 1.25z"/><path d="M25.52 11.22c-5.58 0-10.61 3.36-12.75 8.51a13.81 13.81 0 0 0 2.99 15.03c3.95 3.94 9.88 5.12 15.03 2.99 5.16-2.14 8.52-7.17 8.52-12.74 0-1.81-.36-3.61-1.05-5.28-.7-1.67-1.71-3.19-2.99-4.48-1.28-1.28-2.8-2.29-4.48-2.98-1.67-.7-3.46-1.05-5.27-1.05M20.21 32.3V17.71L33.54 25zm57.71-12.29c-1.25 6.04-2.09 13.12-2.5 16.24h-.41c-.42-3.12-1.26-10.2-2.51-16.04L69.38 5.63H60V45h5.84V12.5l.62 3.13L72.5 45h5.84l5.83-29.37.42-3.13v32.3h5.83V5.63h-9.58c.21 0-2.92 14.38-2.92 14.38m28.33 18.95q-.21.4-.52.74t-.69.58q-.38.25-.82.39-.43.14-.88.17c-1.25 0-1.88-1.04-1.88-3.55V16.25H94.8V37.5c0 5.21 1.87 7.71 5.83 7.71 2.71 0 4.79-1.25 6.46-3.96h.21l.62 3.55h5.21V16.25h-6.88zm19.59-11.46c-2.09-1.45-3.54-2.5-3.54-4.79q0-2.5 2.49-2.5c1.88 0 2.51 1.25 2.51 5.62l5.62-.2c.42-6.88-1.87-9.79-8.13-9.79-5.62 0-8.53 2.5-8.53 7.5 0 4.58 2.29 6.66 6.04 9.58 3.33 2.5 5.2 3.75 5.2 5.84 0 1.45-1.04 2.49-2.71 2.49-2.08 0-3.12-1.87-2.91-5h-5.62c-.84 6.04 1.66 9.38 8.12 9.38 5.83 0 8.75-2.5 8.75-7.71.41-4.79-2.08-6.67-7.29-10.42m11.25-11.25h6.46V44.8h-6.46zm3.33-11.46c-2.5 0-3.54.83-3.54 3.96 0 3.12 1.25 3.96 3.54 3.96 2.5 0 3.54-.84 3.54-3.96 0-2.92-1.04-3.96-3.54-3.96M165 34.58l-5.83-.21c0 5-.62 6.67-2.5 6.67-1.87 0-2.29-1.88-2.29-7.71V27.7c0-5.83.42-7.49 2.29-7.49 1.88 0 2.29 1.66 2.29 7.08l5.84-.42c.41-4.37-.21-7.5-1.88-9.16-1.25-1.25-3.33-1.88-6.04-1.88-6.46 0-9.17 3.34-9.17 12.92v3.95c0 9.8 2.29 12.93 8.96 12.93 2.71 0 4.79-.63 6.04-1.88 1.67-1.88 2.29-4.79 2.29-9.17"/></svg>`,
  deezer: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 50" width="180" height="50"><path fill-rule="evenodd" d="M101.96 31.92H85.68V12.18h16.28v5.33h-8.6v2.28h8.08v4.36h-8.08v2.43h8.6zm18.12 0H103.8V12.19h16.28v5.33h-8.6v2.28h8.08v4.36h-8.08v2.43h8.6zm50.38 0q-1.24-3.85-3.8-8.17v8.17h-7.7V12.18h10.78c5.23 0 8.55 1.69 8.55 5.28 0 2.36-1.46 3.9-3.9 4.61 2.09 3.61 3.63 6.83 4.75 9.85zM169.32 21c1.14 0 1.78-.62 1.78-1.74 0-1.14-.64-1.74-1.78-1.74h-2.66V21zM157.1 31.92h-16.28V12.18h16.28v5.34h-8.61v2.28h8.09v4.36h-8.09v2.43h8.61zm-35.19-19.74h17.33v5.33c-3.94 3.27-6.74 6.16-8.74 9.07h8.74v5.34h-17.49v-5.34c2.1-3.32 4.81-6.37 8.11-9.07h-7.95zm-57.8 0h9.91c6.14 0 10.47 4.07 10.47 9.87s-4.33 9.87-10.47 9.87h-9.91zm7.7 14.42h1.8c1.93 0 2.95-1.29 2.95-4.55 0-3.25-1.02-4.54-2.95-4.54h-1.8zM42.45 7.63c.47-2.68 1.15-4.36 1.89-4.36h.01c1.4 0 2.54 5.84 2.54 13.07 0 7.21-1.14 13.07-2.55 13.07-.57 0-1.1-1-1.53-2.66-.68 6.09-2.08 10.29-3.71 10.29-1.25 0-2.38-2.52-3.14-6.49-.52 7.54-1.81 12.9-3.34 12.9-.95 0-1.82-2.12-2.46-5.57-.78 7.13-2.57 12.13-4.66 12.13s-3.87-5-4.65-12.13c-.63 3.45-1.51 5.57-2.47 5.57-1.53 0-2.82-5.36-3.34-12.9-.75 3.97-1.88 6.49-3.14 6.49-1.63 0-3.03-4.19-3.7-10.29-.43 1.66-.97 2.66-1.54 2.66-1.41 0-2.55-5.86-2.55-13.07 0-7.23 1.14-13.07 2.55-13.07.76 0 1.42 1.69 1.89 4.36C9.3 3.01 10.52.01 11.9.01c1.63 0 3.05 4.25 3.72 10.42.65-4.49 1.65-7.36 2.76-7.36 1.56 0 2.89 5.63 3.38 13.49.92-4.03 2.26-6.55 3.74-6.55 1.49 0 2.82 2.52 3.75 6.55.49-7.86 1.81-13.49 3.37-13.49 1.12 0 2.11 2.87 2.77 7.36C36.06 4.26 37.47.01 39.11.01c1.37 0 2.6 3 3.34 7.62M1.92 20.89c-.8 0-1.44-2.61-1.44-5.84s.64-5.84 1.44-5.84 1.45 2.61 1.45 5.84-.65 5.84-1.45 5.84m47.16 0c-.8 0-1.45-2.61-1.45-5.84s.65-5.84 1.45-5.84 1.44 2.61 1.44 5.84-.64 5.84-1.44 5.84" style="fill:currentColor"/></svg>`,
  none: "",
};

const lastValidResults = new Map();
let currentWrappedData = null;
let customArtistImage = null;

function updateLoadingProgress({ visible, current = 1, total = MAX_WRAPPED_PAGES, label = "Fetching listens" }) {
  const statusEl = document.getElementById("wrappedFetchStatus");
  const progressEl = document.getElementById("wrappedBannerProgress");
  const barEl = document.getElementById("wrappedBannerBar");

  if (statusEl) {
    statusEl.classList.toggle("is-visible", Boolean(visible));
    statusEl.setAttribute("aria-hidden", String(!visible));
    statusEl.textContent = visible ? `${label} ${current}/${total}` : "";
  }
  if (progressEl) {
    progressEl.classList.toggle("is-visible", Boolean(visible));
  }
  if (barEl) {
    const pct = visible ? Math.max(0, Math.min(100, (current / Math.max(1, total)) * 100)) : 0;
    barEl.style.width = `${pct}%`;
  }
}

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

function truncateWithEllipsis(str, maxLength = 22) {
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

function getYearWindow() {
  const now = new Date();
  const year = now.getFullYear();
  const startDate = new Date(year, 0, 1);
  const startTs = Math.floor(startDate.getTime() / 1000);
  const endTs = Math.floor(now.getTime() / 1000);
  const elapsedDays = Math.max(1, Math.ceil((endTs - startTs) / 86400));
  return {
    year,
    startTs,
    endTs,
    elapsedDays,
    storyHeading: `${year} WRAPPED`,
  };
}

async function estimateYearPages(username) {
  try {
    const activityRes = await listenbrainz.getUserListeningActivity(username, { range: WRAPPED_RANGE });
    const buckets = activityRes?.payload?.listening_activity || [];
    const total = buckets.reduce((sum, bucket) => sum + Number(bucket?.listen_count || 0), 0);
    if (total > 0) {
      return Math.max(1, Math.min(MAX_WRAPPED_PAGES, Math.ceil(total / LISTENS_PAGE_SIZE)));
    }
  } catch {
  }
  return MAX_WRAPPED_PAGES;
}

async function fetchYearListens(username, startTs, endTs, onProgress) {
  const collected = [];
  const seen = new Set();
  let cursorMaxTs = endTs;
  let totalPages = await estimateYearPages(username);

  for (let page = 1; page <= MAX_WRAPPED_PAGES; page++) {
    if (page > totalPages) totalPages = page;
    onProgress?.(page, totalPages);

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
      onProgress?.(page, page);
      break;
    }
    cursorMaxTs = oldestTs;
  }

  return collected;
}

function getListenDurationMs(listen) {
  const info = listen?.track_metadata?.additional_info;
  const durationMs = Number(info?.duration_ms);
  if (Number.isFinite(durationMs) && durationMs > 0) {
    return durationMs;
  }
  const durationSec = Number(info?.duration);
  if (Number.isFinite(durationSec) && durationSec > 0) {
    return durationSec * 1000;
  }
  return FALLBACK_DURATION_MS;
}

function sortAndSliceTop(map, limit = 10) {
  return Array.from(map.values())
    .sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function getLocalDayIndex(timestampSec) {
  const d = new Date(timestampSec * 1000);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function getLongestConsecutiveDays(daySet) {
  if (!daySet || !daySet.size) return 0;
  const sorted = Array.from(daySet).sort((a, b) => a - b);
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

function aggregateListens(listens, elapsedDays) {
  const artistMap = new Map();
  const trackMap = new Map();
  const albumMap = new Map();
  let totalDurationMs = 0;

  for (const listen of listens) {
    totalDurationMs += getListenDurationMs(listen);

    const ts = Number(listen?.listened_at);
    const dayIndex = Number.isFinite(ts) ? getLocalDayIndex(ts) : null;
    const meta = listen?.track_metadata || {};
    const artistName = (meta.artist_name || "Unknown Artist").trim();
    const trackName = (meta.track_name || "").trim();
    const releaseName = (meta.release_name || "").trim();
    const mapping = meta.mbid_mapping || {};

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
        if (dayIndex !== null) existing.days.add(dayIndex);
        if (releaseName) {
          existing.releases.set(releaseName, (existing.releases.get(releaseName) || 0) + 1);
        }
      } else {
        const releases = new Map();
        const days = new Set();
        if (dayIndex !== null) days.add(dayIndex);
        if (releaseName) releases.set(releaseName, 1);
        trackMap.set(key, {
          title: trackName,
          subtitle: artistName,
          plays: 1,
          days,
          releases,
          caaReleaseMbid: mapping.caa_release_mbid || "",
          caaId: mapping.caa_id || "",
          cover: "",
        });
      }
    }

    if (releaseName) {
      const key = `${releaseName.toLowerCase()}::${artistName.toLowerCase()}`;
      const existing = albumMap.get(key);
      if (existing) {
        existing.plays += 1;
      } else {
        albumMap.set(key, {
          title: releaseName,
          subtitle: artistName,
          plays: 1,
          caaReleaseMbid: mapping.caa_release_mbid || "",
          caaId: mapping.caa_id || "",
          cover: "",
        });
      }
    }
  }

  let obsession = null;
  for (const track of trackMap.values()) {
    const streak = getLongestConsecutiveDays(track.days);
    if (
      streak > 0 &&
      (!obsession ||
        streak > obsession.days ||
        (streak === obsession.days && track.plays > obsession.plays))
    ) {
      obsession = {
        days: streak,
        plays: track.plays,
        title: track.title,
        artist: track.subtitle,
      };
    }
  }

  const totalListens = listens.length;
  const totalMinutes = Math.round(totalDurationMs / 60000);
  const dailyAvg = Math.round(totalListens / Math.max(1, elapsedDays));

  const topTracks = sortAndSliceTop(trackMap, 10).map((item) => {
    let preferredRelease = "";
    let bestCount = 0;
    for (const [rel, count] of item.releases.entries()) {
      if (count > bestCount) {
        bestCount = count;
        preferredRelease = rel;
      }
    }
    return {
      title: item.title,
      subtitle: item.subtitle,
      plays: item.plays,
      releaseName: preferredRelease,
      caaReleaseMbid: item.caaReleaseMbid,
      caaId: item.caaId,
      cover: item.cover,
    };
  });

  return {
    totalListens,
    totalMinutes,
    dailyAvg,
    obsession,
    artists: sortAndSliceTop(artistMap, 10),
    tracks: topTracks,
    albums: sortAndSliceTop(albumMap, 10),
  };
}

function renderSkeleton(container, withSub = true) {
  const widths = [145, 165, 130, 155, 140, 170, 125, 150, 135];
  const topHtml = `
    <div class="chart-item top-1 is-skeleton">
      <div class="top1-skeleton-bg skeleton"></div>
      <div class="text-content">
        <span class="skeleton skeleton-text" style="width: 150px; height: 20px;"></span>
        <span class="skeleton skeleton-text" style="width: 100px; height: 14px; margin-top: 8px;"></span>
      </div>
    </div>
  `;
  const rows = widths
    .map((w, idx) => {
      const rank = idx + 2;
      const subHtml = withSub
        ? `<span class="skeleton skeleton-text" style="width: ${Math.round(w * 0.65)}px; height: 11px; margin-top: 4px;"></span>`
        : "";
      return `
        <div class="chart-item">
          <span class="chart-rank">#${rank}</span>
          <div class="chart-row-text">
            <span class="skeleton skeleton-text" style="width: ${w}px; height: 14px;"></span>
            ${subHtml}
          </div>
          <span class="skeleton skeleton-text" style="width: 30px; height: 12px;"></span>
        </div>
      `;
    })
    .join("");
  container.innerHTML = topHtml + rows;
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

function renderWrappedList(container, items, { allowImageUpload = false } = {}) {
  if (!items.length) {
    renderEmpty(container, "No listens recorded for this year.");
    return;
  }

  const [first, ...rest] = items;
  const effectiveCover = allowImageUpload ? (customArtistImage || first.cover) : first.cover;
  const top1Sub = first.subtitle ? `${first.subtitle} · ${formatNumber(first.plays)}` : formatNumber(first.plays);
  const uploadActionsHtml = allowImageUpload
    ? `
      <div class="top1-upload-actions">
        ${customArtistImage ? `<button type="button" class="top1-action-btn" id="artistResetBtn" aria-label="Reset custom image" title="Reset image"><animate-icons name="x" size="16"></animate-icons></button>` : ""}
        <button type="button" class="top1-action-btn" id="artistUploadBtn" aria-label="Upload custom artist image" title="Upload custom image">
          <animate-icons name="image-plus" size="17"></animate-icons>
        </button>
      </div>
    `
    : "";

  const top1Html = `
    <div class="chart-item top-1">
      ${effectiveCover ? `<div class="top1-skeleton-bg skeleton"></div><img class="top1-image" src="${escapeHtml(effectiveCover)}" alt="" crossorigin="anonymous" />` : ""}
      ${uploadActionsHtml}
      <div class="text-content">
        <span>${escapeHtml(first.title)}</span>
        <span>${escapeHtml(top1Sub)}</span>
      </div>
    </div>
  `;

  const restHtml = rest
    .map((item, idx) => {
      const rank = idx + 2;
      const subHtml = item.subtitle ? `<span class="chart-row-sub">${escapeHtml(item.subtitle)}</span>` : "";
      return `
        <div class="chart-item">
          <span class="chart-rank">#${rank}</span>
          <div class="chart-row-text">
            <span class="chart-row-title">${escapeHtml(item.title)}</span>
            ${subHtml}
          </div>
          <span class="chart-row-plays">${formatNumber(item.plays)}</span>
        </div>
      `;
    })
    .join("");

  container.innerHTML = top1Html + restHtml;
  const top1Img = container.querySelector(".top1-image");
  const top1Bg = container.querySelector(".top1-skeleton-bg");
  if (top1Img) {
    attachImageFadeIn(top1Img, () => {
      top1Bg?.remove();
    });
  }

  if (allowImageUpload) {
    const uploadInput = document.getElementById("artistImageUploadInput");
    document.getElementById("artistUploadBtn")?.addEventListener("click", () => {
      if (uploadInput) {
        uploadInput.value = "";
        uploadInput.click();
      }
    });
    document.getElementById("artistResetBtn")?.addEventListener("click", () => {
      customArtistImage = null;
      if (currentWrappedData) applyWrappedToDom(currentWrappedData);
    });
  }
}

function normalizeMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestAlbumMatch(items, targetTitle) {
  if (!items.length) return null;
  const target = normalizeMatch(targetTitle);
  return (
    items.find((al) => normalizeMatch(al.title) === target) ||
    items.find((al) => normalizeMatch(al.title).includes(target) || target.includes(normalizeMatch(al.title))) ||
    items[0]
  );
}

async function resolveAlbumCover(albumTitle, artistName, caaReleaseMbid, caaId) {
  try {
    const query = `${albumTitle} ${artistName}`.trim();
    const res = await deezer.search("album", query, 8);
    const chosen = pickBestAlbumMatch(res?.data || [], albumTitle);
    const cover = chosen?.cover_xl || chosen?.cover_big || chosen?.cover_medium || "";
    if (cover) return cover;
  } catch {
  }

  if (caaReleaseMbid && caaId) {
    return `https://coverartarchive.org/release/${caaReleaseMbid}/${caaId}-500.jpg`;
  }
  return "";
}

async function resolveTrackCover(topTrack) {
  const { title, subtitle, releaseName, caaReleaseMbid, caaId } = topTrack;

  if (releaseName) {
    try {
      const trackRes = await deezer.search("track", `${title} ${subtitle}`, 10);
      const trackItems = trackRes?.data || [];
      const targetAlbum = normalizeMatch(releaseName);
      const albumMatchedTrack = trackItems.find((t) => {
        const alb = normalizeMatch(t.album?.title);
        return alb && (alb === targetAlbum || alb.includes(targetAlbum) || targetAlbum.includes(alb));
      });
      if (albumMatchedTrack) {
        const cover = albumMatchedTrack.album?.cover_xl || albumMatchedTrack.album?.cover_big || albumMatchedTrack.album?.cover_medium || "";
        if (cover) return cover;
      }

      const albumCover = await resolveAlbumCover(releaseName, subtitle, "", "");
      if (albumCover) return albumCover;
    } catch {
    }
  }

  if (caaReleaseMbid && caaId) {
    return `https://coverartarchive.org/release/${caaReleaseMbid}/${caaId}-500.jpg`;
  }

  try {
    const res = await deezer.search("track", `${title} ${subtitle}`, 5);
    const first = res?.data?.[0];
    return first?.album?.cover_xl || first?.album?.cover_big || first?.album?.cover_medium || "";
  } catch {
    return "";
  }
}

async function resolveArtistCover(artistName) {
  try {
    const res = await deezer.search("artist", artistName, 5);
    const items = res?.data || [];
    const target = artistName.toLowerCase().trim();
    const chosen = items.find((a) => a.name?.toLowerCase().trim() === target) || items[0];
    return chosen?.picture_xl || chosen?.picture_big || chosen?.picture_medium || "";
  } catch {
    return "";
  }
}

async function resolveVibe(topTrack, topAlbum) {
  try {
    const query = topAlbum
      ? `${topAlbum.title} ${topAlbum.subtitle}`.trim()
      : topTrack
        ? `${topTrack.title} ${topTrack.subtitle}`.trim()
        : "";
    if (!query) return "Eclectic";
    const res = await deezer.search("album", query, 1);
    const albumId = res?.data?.[0]?.id;
    if (!albumId) return "Eclectic";
    const detail = await deezer.getAlbum(albumId);
    return detail?.genres?.data?.[0]?.name || "Eclectic";
  } catch {
    return "Eclectic";
  }
}

async function fetchWrappedData(username) {
  const windowInfo = getYearWindow();
  const cacheKey = `wrapped:v2:${username.toLowerCase()}:${WRAPPED_RANGE}:${windowInfo.year}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  updateLoadingProgress({ visible: true, current: 1, total: MAX_WRAPPED_PAGES });
  const listens = await fetchYearListens(
    username,
    windowInfo.startTs,
    windowInfo.endTs,
    (current, total) => {
      updateLoadingProgress({ visible: true, current, total });
    }
  );

  const aggregated = aggregateListens(listens, windowInfo.elapsedDays);
  const { artists, tracks, albums } = aggregated;

  const [artistCover, trackCover, albumCover, vibe] = await Promise.all([
    artists[0] ? resolveArtistCover(artists[0].title) : Promise.resolve(""),
    tracks[0] ? resolveTrackCover(tracks[0]) : Promise.resolve(""),
    albums[0]
      ? resolveAlbumCover(albums[0].title, albums[0].subtitle, albums[0].caaReleaseMbid, albums[0].caaId)
      : Promise.resolve(""),
    resolveVibe(tracks[0], albums[0]),
  ]);

  if (artists[0]) artists[0].cover = artistCover;
  if (tracks[0]) tracks[0].cover = trackCover;
  if (albums[0]) albums[0].cover = albumCover;

  const obsession = aggregated.obsession;

  const data = {
    storyHeading: windowInfo.storyHeading,
    stats: {
      totalListens: aggregated.totalListens,
      totalMinutes: aggregated.totalMinutes,
      listens: formatNumber(aggregated.totalListens),
      minutes: formatNumber(aggregated.totalMinutes),
      obsession: obsession ? obsession.title : "—",
      obsessionTrack: obsession ? obsession.title : "",
      obsessionArtist: obsession ? obsession.artist : "",
      obsessionDays: obsession ? obsession.days : 0,
      dailyAvg: formatNumber(aggregated.dailyAvg),
      vibe,
    },
    heroCover: artistCover || albumCover || trackCover || "",
    artists,
    tracks,
    albums,
  };

  setCache(cacheKey, data, CACHE_TTL_WRAPPED);
  return data;
}

function setStatsSkeleton(active) {
  const ids = ["userScrobbles", "userMinutes", "userObsession", "userDailyAvg", "userVibe"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("skeleton", active);
    el.classList.toggle("skeleton-text", active);
    if (active) {
      el.textContent = "";
      el.removeAttribute("title");
    }
  });
}

function applyWrappedToDom(data) {
  currentWrappedData = data;
  setStatsSkeleton(false);

  document.getElementById("userScrobbles").textContent = data.stats.listens;
  document.getElementById("userMinutes").textContent = data.stats.minutes;
  const obsessionEl = document.getElementById("userObsession");
  const obsessionName = data.stats.obsessionTrack || data.stats.obsession || "—";
  obsessionEl.textContent = obsessionName;
  if (data.stats.obsessionTrack) {
    const fullTitle = data.stats.obsessionArtist
      ? `${data.stats.obsessionTrack} · ${data.stats.obsessionArtist}`
      : data.stats.obsessionTrack;
    obsessionEl.setAttribute("title", fullTitle);
  }
  document.getElementById("userDailyAvg").textContent = data.stats.dailyAvg;
  document.getElementById("userVibe").textContent = data.stats.vibe;

  const effectiveHero = customArtistImage || data.heroCover;
  const artistCoverEl = document.getElementById("artistCover");
  if (artistCoverEl) {
    if (effectiveHero) {
      artistCoverEl.style.display = "block";
      artistCoverEl.src = effectiveHero;
      attachImageFadeIn(artistCoverEl);
    } else {
      artistCoverEl.removeAttribute("src");
      artistCoverEl.style.display = "none";
    }
  }

  renderWrappedList(document.getElementById("listTopArtists"), data.artists, { allowImageUpload: true });
  renderWrappedList(document.getElementById("listTopTracks"), data.tracks);
  renderWrappedList(document.getElementById("listTopAlbums"), data.albums);
}

function initArtistImageUpload() {
  const input = document.getElementById("artistImageUploadInput");
  if (!input) return;

  input.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      customArtistImage = reader.result;
      if (currentWrappedData) {
        applyWrappedToDom(currentWrappedData);
      }
    };
    reader.readAsDataURL(file);
  });
}

function initLandingForm() {
  const form = document.getElementById("wrapped-form");
  const input = document.getElementById("wrapped-user");
  const pill = document.getElementById("wrapped-input-pill");
  const errorEl = document.getElementById("wrapped-error");
  const submitBtn = document.getElementById("wrapped-submit-btn");
  if (!form || !input) return;

  const setError = (msg) => {
    if (errorEl) errorEl.textContent = msg || "";
    pill?.classList.toggle("has-error", Boolean(msg));
  };

  const params = new URLSearchParams(window.location.search);
  const notFoundUser = (params.get("not_found") || "").trim();
  if (notFoundUser) {
    input.value = notFoundUser;
    setError(`User "${notFoundUser}" not found on ListenBrainz.`);
  }

  input.addEventListener("input", () => setError(""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = input.value.trim();
    if (!user) return;

    setError("");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking...";
    }

    try {
      const userCacheKey = `user_ok:${user.toLowerCase()}`;
      if (!getCache(userCacheKey)) {
        await listenbrainz.getUserCount(user);
        setCache(userCacheKey, true, CACHE_TTL_WRAPPED);
      }
      addRecentUser("wrapped", user);
      trackEvent(EVENTS.SEARCH_SUBMIT, { tool: "wrapped" });
      window.location.href = `/wrapped/result.html?user=${encodeURIComponent(user)}`;
    } catch (err) {
      if (err?.status === 404) {
        setError(`User "${user}" not found on ListenBrainz.`);
      } else {
        setError("Unable to reach ListenBrainz. Please try again.");
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Generate";
      }
    }
  });
}

async function loadWrapped(username) {
  const listArtists = document.getElementById("listTopArtists");
  const listTracks = document.getElementById("listTopTracks");
  const listAlbums = document.getElementById("listTopAlbums");
  const memoryKey = `${username.toLowerCase()}:${WRAPPED_RANGE}`;

  currentWrappedData = null;
  setStatsSkeleton(true);

  renderSkeleton(listArtists, false);
  renderSkeleton(listTracks, true);
  renderSkeleton(listAlbums, true);

  try {
    const data = await fetchWrappedData(username);
    lastValidResults.set(memoryKey, data);
    applyWrappedToDom(data);
  } catch (err) {
    if (err?.status === 404) {
      window.location.replace(`/wrapped/?not_found=${encodeURIComponent(username)}`);
      return;
    }
    const fallback = lastValidResults.get(memoryKey);
    if (fallback) {
      applyWrappedToDom(fallback);
      return;
    }
    setStatsSkeleton(false);
    document.getElementById("userScrobbles").textContent = "—";
    document.getElementById("userMinutes").textContent = "—";
    document.getElementById("userObsession").textContent = "—";
    document.getElementById("userDailyAvg").textContent = "—";
    document.getElementById("userVibe").textContent = "—";
    const msg = "Unable to load ListenBrainz data.";
    renderEmpty(listArtists, msg);
    renderEmpty(listTracks, msg);
    renderEmpty(listAlbums, msg);
  } finally {
    updateLoadingProgress({ visible: false });
  }
}

function populateStoryList(containerId, items, isTrackOrAlbum) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const top3 = items.slice(0, 3);
  container.innerHTML = top3
    .map((item, index) => {
      const rank = index + 1;
      const rawSub = item.subtitle ? item.subtitle : `${formatNumber(item.plays)} streams`;
      const rawName = isTrackOrAlbum ? cleanReportTitle(item.title) : item.title;
      const displayName = truncateWithEllipsis(rawName, 36);
      const displaySub = truncateWithEllipsis(rawSub, 42);
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

function initExportModal(username) {
  const openBtn = document.getElementById("export-wrapped-btn");
  const settingsModal = document.getElementById("generationSettingsModal");
  const generationModal = document.getElementById("generationModal");
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");
  const closeBtn = document.getElementById("closeSettingsModal");
  const nextToStep2Btn = document.getElementById("nextToStep2Btn");
  const backToStep1Btn = document.getElementById("backToStep1Btn");
  const nextToStep3Btn = document.getElementById("nextToStep3Btn");
  const backToStep2Btn = document.getElementById("backToStep2Btn");
  const confirmBtn = document.getElementById("confirmSettingsBtn");
  const bgPicker = document.getElementById("bgStylePicker");
  const meshBgEl = document.getElementById("storyReportBackground");
  const exportTypePicker = document.getElementById("exportTypePicker");

  if (!openBtn || !settingsModal) return;

  const bgControls = initExportBgControls({ pickerEl: bgPicker, targetEl: meshBgEl });
  const radioRows = Array.from(exportTypePicker?.querySelectorAll(".ld-radio-row") || []);

  const syncRadioIcons = (animateSelected = false) => {
    radioRows.forEach((row) => {
      const input = row.querySelector('input[type="radio"]');
      const icon = row.querySelector("animate-icons");
      const isSelected = Boolean(input?.checked);
      row.classList.toggle("is-selected", isSelected);
      if (!icon) return;
      const nextName = isSelected ? "circle-dot" : "circle";
      if (icon.getAttribute("name") !== nextName) {
        icon.setAttribute("name", nextName);
      }
      if (isSelected && animateSelected) {
        icon.startAnimation?.();
      }
    });
  };

  radioRows.forEach((row) => {
    const input = row.querySelector('input[type="radio"]');
    input?.addEventListener("change", () => syncRadioIcons(true));
    row.addEventListener("mouseenter", () => {
      row.querySelector("animate-icons")?.startAnimation?.();
    });
    row.addEventListener("mouseleave", () => {
      row.querySelector("animate-icons")?.stopAnimation?.();
    });
  });

  const getSelectedExportType = () => {
    const checked = exportTypePicker?.querySelector('input[name="wrappedExportType"]:checked');
    return checked?.value || "full_recap";
  };

  const showStep = (stepNumber) => {
    if (step1) step1.style.display = stepNumber === 1 ? "block" : "none";
    if (step2) step2.style.display = stepNumber === 2 ? "block" : "none";
    if (step3) step3.style.display = stepNumber === 3 ? "block" : "none";
  };

  const openModal = () => {
    if (!currentWrappedData) return;
    syncRadioIcons(false);
    showStep(1);
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

  nextToStep2Btn?.addEventListener("click", () => showStep(2));
  backToStep1Btn?.addEventListener("click", () => showStep(1));
  nextToStep3Btn?.addEventListener("click", () => showStep(3));
  backToStep2Btn?.addEventListener("click", () => showStep(2));

  confirmBtn?.addEventListener("click", async () => {
    if (!currentWrappedData) return;
    closeModal();

    const exportType = getSelectedExportType();
    const selectedBg = bgControls.getSelectedStyle();
    const service = document.getElementById("serviceSelect")?.value || "listendeck";
    const isLight = Boolean(document.getElementById("themeToggleCheckbox")?.checked);
    const useScrobbles = Boolean(document.getElementById("useScrobblesCheckbox")?.checked);

    const reportEl = document.getElementById("storyReport");
    reportEl.className = isLight ? "theme-light" : "theme-dark";
    bgControls.applyCurrentBg();

    document.getElementById("storyReportTitle").textContent = "Wrapped";
    document.getElementById("storyServiceLogo").innerHTML = SERVICE_LOGOS[service] || "";
    document.getElementById("storyMonthYear").textContent = currentWrappedData.storyHeading || `${new Date().getFullYear()} WRAPPED`;
    document.getElementById("storyTotalMinutes").textContent = useScrobbles
      ? `${currentWrappedData.stats.listens} listens`
      : `${currentWrappedData.stats.minutes} minutes`;

    populateStoryList("storyListArtists", currentWrappedData.artists, false);
    populateStoryList("storyListSongs", currentWrappedData.tracks, true);
    populateStoryList("storyListAlbums", currentWrappedData.albums, true);

    const imgArtist = document.getElementById("storyImageArtist");
    const imgSong = document.getElementById("storyImageSong");
    const imgAlbum = document.getElementById("storyImageAlbum");

    if (imgArtist) imgArtist.src = customArtistImage || currentWrappedData.artists[0]?.cover || "";
    if (imgSong) imgSong.src = currentWrappedData.tracks[0]?.cover || "";
    if (imgAlbum) imgAlbum.src = currentWrappedData.albums[0]?.cover || "";

    const stateLoading = document.getElementById("generationStateLoading");
    const stateComplete = document.getElementById("generationStateComplete");
    if (generationModal) {
      stateLoading.style.display = "flex";
      stateComplete.style.display = "none";
      generationModal.classList.add("show");
    }

    const fileName = exportType === "full_recap"
      ? `listendeck_wrapped_${username}_${WRAPPED_RANGE}.png`
      : `listendeck_wrapped_${username}_${exportType}.png`;

    setTimeout(async () => {
      try {
        await exportNodeAsPng(reportEl, fileName);
        trackEvent(EVENTS.EXPORT_CARD, {
          tool: "wrapped",
          action: "download",
          format: "story",
          type: exportType,
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

function initResultPage() {
  const report = document.getElementById("wrapped-report");
  if (!report) return;

  const params = new URLSearchParams(window.location.search);
  const username = (params.get("user") || "").trim();
  if (!username) {
    window.location.replace("/wrapped/");
    return;
  }

  addRecentUser("wrapped", username);
  document.getElementById("userDisplayName").textContent = username;

  initArtistImageUpload();
  loadWrapped(username);
  initExportModal(username);
}

document.addEventListener("DOMContentLoaded", () => {
  initLandingForm();
  initResultPage();
});

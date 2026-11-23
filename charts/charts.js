import { deezer, listenbrainz } from "../shared/api.js";
import { exportNodeAsPng } from "../shared/export.js";
import {
  addRecentUser,
  CACHE_TTL_CLOSED,
  CACHE_TTL_CURRENT,
  getCache,
  setCache,
} from "../shared/storage.js";

const VALID_PERIODS = new Set(["this_week", "week", "this_month", "month"]);

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

function renderSkeleton(container) {
  const rows = Array.from({ length: 9 }, () => `<div class="chart-skeleton-row"></div>`).join("");
  container.innerHTML = `<div class="chart-skeleton-top"></div>${rows}`;
}

function renderEmpty(container, message) {
  container.innerHTML = `<div class="chart-item"><span class="chart-row-sub">${escapeHtml(message)}</span></div>`;
}

function renderChartList(container, items) {
  if (!items.length) {
    renderEmpty(container, "No listens recorded for this period.");
    return;
  }

  const [first, ...rest] = items;
  const top1Sub = first.subtitle ? `${first.subtitle} · ${formatNumber(first.plays)}` : formatNumber(first.plays);

  const top1Html = `
    <div class="chart-item top-1">
      ${first.cover ? `<img class="top1-image" src="${escapeHtml(first.cover)}" alt="" crossorigin="anonymous" />` : ""}
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
}

async function resolveTopCover(type, query, caaReleaseMbid, caaId) {
  try {
    const res = await deezer.search(type, query, 1);
    const first = res?.data?.[0];
    if (type === "artist") {
      return first?.picture_xl || first?.picture_big || first?.picture_medium || "";
    }
    if (type === "track") {
      return first?.album?.cover_xl || first?.album?.cover_big || first?.album?.cover_medium || "";
    }
    if (type === "album") {
      return first?.cover_xl || first?.cover_big || first?.cover_medium || "";
    }
  } catch {
  }

  if (caaReleaseMbid && caaId) {
    return `https://coverartarchive.org/release/${caaReleaseMbid}/${caaId}-500.jpg`;
  }
  return "";
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

async function fetchChartsData(username, period) {
  const cacheKey = `charts:${username.toLowerCase()}:${period}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  await listenbrainz.getUserCount(username);

  const [artistsRes, tracksRes, albumsRes, activityRes] = await Promise.all([
    listenbrainz.getStats(username, "artists", period, 10),
    listenbrainz.getStats(username, "recordings", period, 10),
    listenbrainz.getStats(username, "release-groups", period, 10),
    listenbrainz.getListeningActivity(username, period).catch(() => null),
  ]);

  const rawArtists = artistsRes?.payload?.artists || [];
  const rawTracks = tracksRes?.payload?.recordings || [];
  const rawAlbums = albumsRes?.payload?.release_groups || [];
  const activityBins = activityRes?.payload?.listening_activity || [];

  const artists = rawArtists.slice(0, 10).map((a) => ({
    title: a.artist_name,
    subtitle: "",
    plays: a.listen_count,
    cover: "",
  }));

  const tracks = rawTracks.slice(0, 10).map((t) => ({
    title: t.track_name,
    subtitle: t.artist_name || "",
    plays: t.listen_count,
    caaReleaseMbid: t.caa_release_mbid,
    caaId: t.caa_id,
    cover: "",
  }));

  const albums = rawAlbums.slice(0, 10).map((al) => ({
    title: al.release_group_name,
    subtitle: al.artist_name || "",
    plays: al.listen_count,
    caaReleaseMbid: al.caa_release_mbid,
    caaId: al.caa_id,
    cover: "",
  }));

  const [artistCover, trackCover, albumCover, vibe] = await Promise.all([
    artists[0] ? resolveTopCover("artist", artists[0].title) : Promise.resolve(""),
    tracks[0]
      ? resolveTopCover("track", `${tracks[0].title} ${tracks[0].subtitle}`, tracks[0].caaReleaseMbid, tracks[0].caaId)
      : Promise.resolve(""),
    albums[0]
      ? resolveTopCover("album", `${albums[0].title} ${albums[0].subtitle}`, albums[0].caaReleaseMbid, albums[0].caaId)
      : Promise.resolve(""),
    resolveVibe(tracks[0], albums[0]),
  ]);

  if (artists[0]) artists[0].cover = artistCover;
  if (tracks[0]) tracks[0].cover = trackCover;
  if (albums[0]) albums[0].cover = albumCover;

  const activityTotal = activityBins.reduce((sum, bin) => sum + (bin.listen_count || 0), 0);
  const fallbackTotal = artists.reduce((sum, item) => sum + (item.plays || 0), 0);
  const totalListens = activityTotal || fallbackTotal;
  const daysCount = Math.max(1, activityBins.filter((b) => (b.listen_count || 0) > 0).length || (period.includes("month") ? 30 : 7));
  const dailyAvg = Math.round(totalListens / daysCount);
  const minutes = Math.round(totalListens * 3.5);

  const data = {
    stats: {
      listens: formatNumber(totalListens),
      minutes: formatNumber(minutes),
      dailyAvg: formatNumber(dailyAvg),
      vibe,
    },
    heroCover: artistCover || albumCover || trackCover || "",
    artists,
    tracks,
    albums,
  };

  const isClosedPeriod = period === "week" || period === "month";
  setCache(cacheKey, data, isClosedPeriod ? CACHE_TTL_CLOSED : CACHE_TTL_CURRENT);
  return data;
}

function initLandingForm() {
  const form = document.getElementById("charts-form");
  const input = document.getElementById("charts-user");
  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = input.value.trim();
    if (!user) return;
    addRecentUser("charts", user);
    window.location.href = `/charts/result.html?user=${encodeURIComponent(user)}&period=this_week`;
  });
}

async function loadCharts(username, periodKey) {
  const listArtists = document.getElementById("listTopArtists");
  const listTracks = document.getElementById("listTopTracks");
  const listAlbums = document.getElementById("listTopAlbums");

  document.getElementById("userScrobbles").textContent = "—";
  document.getElementById("userMinutes").textContent = "—";
  document.getElementById("userDailyAvg").textContent = "—";
  document.getElementById("userVibe").textContent = "—";

  renderSkeleton(listArtists);
  renderSkeleton(listTracks);
  renderSkeleton(listAlbums);

  try {
    const data = await fetchChartsData(username, periodKey);

    document.getElementById("userScrobbles").textContent = data.stats.listens;
    document.getElementById("userMinutes").textContent = data.stats.minutes;
    document.getElementById("userDailyAvg").textContent = data.stats.dailyAvg;
    document.getElementById("userVibe").textContent = data.stats.vibe;

    const artistCoverEl = document.getElementById("artistCover");
    if (artistCoverEl) {
      if (data.heroCover) {
        artistCoverEl.src = data.heroCover;
        artistCoverEl.style.display = "block";
      } else {
        artistCoverEl.removeAttribute("src");
        artistCoverEl.style.display = "none";
      }
    }

    renderChartList(listArtists, data.artists);
    renderChartList(listTracks, data.tracks);
    renderChartList(listAlbums, data.albums);
  } catch (err) {
    const msg = err?.status === 404 ? `User "${username}" not found on ListenBrainz.` : "Unable to load ListenBrainz data.";
    renderEmpty(listArtists, msg);
    renderEmpty(listTracks, msg);
    renderEmpty(listAlbums, msg);
  }
}

function initResultPage() {
  const report = document.getElementById("charts-report");
  if (!report) return;

  const params = new URLSearchParams(window.location.search);
  const username = (params.get("user") || "").trim();
  if (!username) {
    window.location.replace("/charts/");
    return;
  }

  addRecentUser("charts", username);
  let currentPeriod = VALID_PERIODS.has(params.get("period")) ? params.get("period") : "this_week";

  document.getElementById("userDisplayName").textContent = username;

  const tabs = document.querySelectorAll(".period-tab");
  const setActiveTab = (period) => {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.period === period);
    });
  };

  setActiveTab(currentPeriod);
  loadCharts(username, currentPeriod);

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const nextPeriod = tab.dataset.period;
      if (!nextPeriod || nextPeriod === currentPeriod) return;
      currentPeriod = nextPeriod;
      setActiveTab(currentPeriod);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("user", username);
      nextUrl.searchParams.set("period", currentPeriod);
      window.history.replaceState({}, "", nextUrl.toString());
      loadCharts(username, currentPeriod);
    });
  });

  const exportBtn = document.getElementById("export-charts-btn");
  exportBtn?.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      await exportNodeAsPng(report, `listendeck-charts-${username}-${currentPeriod}.png`);
    } finally {
      exportBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initLandingForm();
  initResultPage();
});

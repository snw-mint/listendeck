const LB_BASE = "https://api.listenbrainz.org/1";
const LRCLIB_BASE = "https://lrclib.net/api";
const DEEZER_PROXY_BASE = "/api/deezer";
const DEEZER_DIRECT_BASE = "https://api.deezer.com";
const DEFAULT_TIMEOUT = 8000;

async function requestJson(url, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 204) {
      return null;
    }
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function requestDeezerJsonp(path, params = {}, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const callbackName = `ld_dz_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({
      ...params,
      output: "jsonp",
      callback: callbackName,
    });

    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Deezer JSONP timeout"));
    }, timeout);

    window[callbackName] = (data) => {
      cleanup();
      if (data?.error) {
        reject(new Error(data.error.message || "Deezer error"));
        return;
      }
      resolve(data);
    };

    script.src = `${DEEZER_DIRECT_BASE}${path}?${query.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Deezer JSONP failed"));
    };

    document.body.appendChild(script);
  });
}

async function requestDeezer(path, params = {}) {
  const query = new URLSearchParams(params);
  const qs = query.toString();
  const proxyUrl = `${DEEZER_PROXY_BASE}${path}${qs ? `?${qs}` : ""}`;
  try {
    const data = await requestJson(proxyUrl, 5000);
    if (data?.error) throw new Error(data.error.message || "Deezer error");
    return data;
  } catch {
    return requestDeezerJsonp(path, params);
  }
}

export const listenbrainz = {
  getUserCount(username) {
    const user = encodeURIComponent(username.trim());
    return requestJson(`${LB_BASE}/user/${user}/listen-count`);
  },
  getStats(username, entity, range = "this_week", count = 10) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ range, count: String(count) });
    return requestJson(`${LB_BASE}/stats/user/${user}/${entity}?${query.toString()}`);
  },
  getListeningActivity(username, range = "this_week") {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ range });
    return requestJson(`${LB_BASE}/stats/user/${user}/listening-activity?${query.toString()}`);
  },
};

export const lrclib = {
  get(trackName, artistName) {
    const query = new URLSearchParams({
      track_name: trackName.trim(),
      artist_name: artistName.trim(),
    });
    return requestJson(`${LRCLIB_BASE}/get?${query.toString()}`);
  },
  search(queryText) {
    const query = new URLSearchParams({ q: queryText.trim() });
    return requestJson(`${LRCLIB_BASE}/search?${query.toString()}`);
  },
};

export const deezer = {
  search(type, queryText, limit = 10) {
    const clean = queryText.replace(/["']/g, "").trim();
    return requestDeezer(`/search/${type}`, { q: clean, limit: String(limit) });
  },
  getTrack(id) {
    return requestDeezer(`/track/${encodeURIComponent(id)}`);
  },
  getAlbum(id) {
    return requestDeezer(`/album/${encodeURIComponent(id)}`);
  },
  getArtist(id) {
    return requestDeezer(`/artist/${encodeURIComponent(id)}`);
  },
};

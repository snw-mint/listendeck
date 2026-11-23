const LB_BASE = "https://api.listenbrainz.org/1";
const LRCLIB_BASE = "https://lrclib.net/api";
const DEEZER_PROXY_BASE = "/api/deezer";
const DEEZER_DIRECT_BASE = "https://api.deezer.com";
const DEFAULT_TIMEOUT = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headerValue, attempt) {
  if (headerValue) {
    const seconds = Number(headerValue);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(Math.max(seconds * 1000, 500), 10000);
    }
    const targetMs = Date.parse(headerValue);
    if (Number.isFinite(targetMs)) {
      const diff = targetMs - Date.now();
      if (diff > 0) return Math.min(diff, 10000);
    }
  }
  return 1500 * (attempt + 1);
}

async function requestJson(url, { timeout = DEFAULT_TIMEOUT, retries = 0 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 204) {
        return null;
      }
      if (res.status === 429 && attempt < retries) {
        const waitMs = parseRetryAfter(res.headers.get("Retry-After"), attempt);
        clearTimeout(timer);
        await sleep(waitMs);
        continue;
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
    const data = await requestJson(proxyUrl, { timeout: 5000 });
    if (data?.error) throw new Error(data.error.message || "Deezer error");
    return data;
  } catch {
    return requestDeezerJsonp(path, params);
  }
}

export const listenbrainz = {
  getUserCount(username) {
    const user = encodeURIComponent(username.trim());
    return requestJson(`${LB_BASE}/user/${user}/listen-count`, { retries: 2 });
  },
  getUserListens(username, { maxTs, count = 1000 } = {}) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ count: String(count) });
    if (Number.isFinite(maxTs)) {
      query.set("max_ts", String(Math.floor(maxTs)));
    }
    return requestJson(`${LB_BASE}/user/${user}/listens?${query.toString()}`, {
      timeout: 12000,
      retries: 2,
    });
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

const LB_BASE = "https://api.listenbrainz.org/1";
const LRCLIB_BASE = "https://lrclib.net/api";
const DEEZER_PROXY_BASE = "/api/deezer";
const DEEZER_DIRECT_BASE = "https://api.deezer.com";
const DEFAULT_TIMEOUT = 10000;
const LB_MIN_INTERVAL_MS = 1100;

let lbNextAllowedAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRateLimitResetMs(headers) {
  const resetIn = Number(headers.get("X-RateLimit-Reset-In"));
  if (Number.isFinite(resetIn) && resetIn > 0) {
    return Math.min(Math.max((resetIn + 0.5) * 1000, 1000), 15000);
  }
  return null;
}

function parseRetryAfter(headerValue, attempt, headers) {
  if (headerValue) {
    const seconds = Number(headerValue);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(Math.max(seconds * 1000, 1000), 15000);
    }
    const targetMs = Date.parse(headerValue);
    if (Number.isFinite(targetMs)) {
      const diff = targetMs - Date.now();
      if (diff > 0) return Math.min(diff, 15000);
    }
  }
  if (headers) {
    const resetMs = parseRateLimitResetMs(headers);
    if (resetMs) return resetMs;
  }
  return Math.min(2000 * (attempt + 1), 12000);
}

async function requestJson(url, { timeout = DEFAULT_TIMEOUT, retries = 0, paceListenBrainz = false } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (paceListenBrainz) {
      const wait = lbNextAllowedAt - Date.now();
      if (wait > 0) {
        await sleep(wait);
      }
      lbNextAllowedAt = Date.now() + LB_MIN_INTERVAL_MS;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (paceListenBrainz) {
        const remaining = Number(res.headers.get("X-RateLimit-Remaining"));
        const resetMs = parseRateLimitResetMs(res.headers);
        if (Number.isFinite(remaining) && remaining <= 2 && resetMs) {
          lbNextAllowedAt = Math.max(lbNextAllowedAt, Date.now() + resetMs);
        }
      }
      if (res.status === 204) {
        return null;
      }
      if (res.status === 429 && attempt < retries) {
        const waitMs = parseRetryAfter(res.headers.get("Retry-After"), attempt, res.headers);
        if (paceListenBrainz) {
          lbNextAllowedAt = Math.max(lbNextAllowedAt, Date.now() + waitMs);
        }
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
    return requestJson(`${LB_BASE}/user/${user}/listen-count`, { retries: 3, paceListenBrainz: true });
  },
  getUserListens(username, { maxTs, count = 1000, retries = 4 } = {}) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ count: String(count) });
    if (Number.isFinite(maxTs)) {
      query.set("max_ts", String(Math.floor(maxTs)));
    }
    return requestJson(`${LB_BASE}/user/${user}/listens?${query.toString()}`, {
      timeout: 15000,
      retries,
      paceListenBrainz: true,
    });
  },
  getUserStatsArtists(username, { range = "this_year", count = 10, offset = 0 } = {}) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ range, count: String(count), offset: String(offset) });
    return requestJson(`${LB_BASE}/stats/user/${user}/artists?${query.toString()}`, {
      timeout: 12000,
      retries: 3,
      paceListenBrainz: true,
    });
  },
  getUserStatsRecordings(username, { range = "this_year", count = 10, offset = 0 } = {}) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ range, count: String(count), offset: String(offset) });
    return requestJson(`${LB_BASE}/stats/user/${user}/recordings?${query.toString()}`, {
      timeout: 12000,
      retries: 3,
      paceListenBrainz: true,
    });
  },
  getUserStatsReleases(username, { range = "this_year", count = 10, offset = 0 } = {}) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ range, count: String(count), offset: String(offset) });
    return requestJson(`${LB_BASE}/stats/user/${user}/releases?${query.toString()}`, {
      timeout: 12000,
      retries: 3,
      paceListenBrainz: true,
    });
  },
  getUserListeningActivity(username, { range = "this_year" } = {}) {
    const user = encodeURIComponent(username.trim());
    const query = new URLSearchParams({ range });
    return requestJson(`${LB_BASE}/stats/user/${user}/listening-activity?${query.toString()}`, {
      timeout: 12000,
      retries: 3,
      paceListenBrainz: true,
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

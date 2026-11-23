const CACHE_PREFIX = "ld_cache_";
const RECENT_PREFIX = "ld_recent_";
const MAX_RECENT = 6;

export const CACHE_TTL_CURRENT = 2 * 60 * 60 * 1000;
export const CACHE_TTL_CLOSED = 24 * 60 * 60 * 1000;

export function getCache(key) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || Date.now() > entry.expiresAt) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache(key, data, ttlMs = CACHE_TTL_CURRENT) {
  try {
    const payload = JSON.stringify({
      data,
      expiresAt: Date.now() + ttlMs,
    });
    localStorage.setItem(`${CACHE_PREFIX}${key}`, payload);
  } catch {
  }
}

export function getRecentUsers(scope) {
  try {
    const raw = localStorage.getItem(`${RECENT_PREFIX}${scope}`);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecentUser(scope, username) {
  const clean = (username || "").trim();
  if (!clean) return;
  try {
    const current = getRecentUsers(scope).filter(
      (item) => item.toLowerCase() !== clean.toLowerCase()
    );
    const next = [clean, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(`${RECENT_PREFIX}${scope}`, JSON.stringify(next));
  } catch {
  }
}

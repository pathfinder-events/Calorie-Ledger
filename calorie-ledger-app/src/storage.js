// Local-storage backed shim so the app code can keep using the same
// get/set calls it used inside the Claude artifact sandbox.
//
// Browsers allow only ~5 MB per site. If a write fails (quota), we free
// space by dropping photo thumbnails from saved food logs -- meals, names
// and calories are kept -- and retry. If it still fails, the error is
// thrown so the app can warn instead of losing data silently.
const PREFIX = "calorie-ledger:";

function stripThumbs(json) {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return json;
    return JSON.stringify(arr.map((e) => { if (e && typeof e === "object") { const { thumb, ...rest } = e; return rest; } return e; }));
  } catch { return json; }
}

function freeSpace() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX + "food-log:")) keys.push(k);
  }
  keys.sort(); // oldest day first
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    const slim = stripThumbs(raw);
    if (slim !== raw) {
      try { localStorage.setItem(k, slim); } catch {}
    }
  }
}

export const storage = {
  async get(key) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    return { key, value: raw, shared: false };
  },
  async set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch (e1) {
      freeSpace();
      try {
        localStorage.setItem(PREFIX + key, value);
      } catch (e2) {
        // Last resort: save this value without thumbnails.
        localStorage.setItem(PREFIX + key, key.startsWith("food-log:") ? stripThumbs(value) : value);
      }
    }
    return { key, value, shared: false };
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(PREFIX + prefix)) keys.push(k.slice(PREFIX.length));
    }
    return { keys, prefix, shared: false };
  },
};

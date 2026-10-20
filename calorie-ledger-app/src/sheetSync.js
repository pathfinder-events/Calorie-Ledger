// Fire-and-forget logging to a Google Sheet backup, if configured.
// Local storage stays the source of truth for what the app displays;
// this is a one-way durable record you can open in Sheets anytime.
//
// Supports per-person configuration: each person using this app can
// point it at their OWN Google Sheet by entering their own webhook URL
// and secret in Settings (stored only on their own device). If they
// haven't set anything, it falls back to the build-time default
// (VITE_SHEET_WEBHOOK_URL / VITE_APP_SHARED_SECRET) -- so the person
// who originally built/deployed the app doesn't need to configure
// anything themselves, but anyone else sharing the same installed app
// can redirect their own data to their own sheet without touching
// anyone else's.

const WEBHOOK_KEY = "calorie-ledger:sheet-webhook-url";
const SECRET_KEY = "calorie-ledger:sheet-secret";

const DEFAULT_WEBHOOK_URL = import.meta.env.VITE_SHEET_WEBHOOK_URL || "";
const DEFAULT_SECRET = import.meta.env.VITE_APP_SHARED_SECRET || "";

export function getSheetConfig() {
  return {
    webhookUrl: localStorage.getItem(WEBHOOK_KEY) || DEFAULT_WEBHOOK_URL,
    secret: localStorage.getItem(SECRET_KEY) || DEFAULT_SECRET,
    isCustom: !!localStorage.getItem(WEBHOOK_KEY),
  };
}

export function setSheetConfig(webhookUrl, secret) {
  if (webhookUrl) {
    localStorage.setItem(WEBHOOK_KEY, webhookUrl.trim());
  } else {
    localStorage.removeItem(WEBHOOK_KEY);
  }
  if (secret) {
    localStorage.setItem(SECRET_KEY, secret.trim());
  } else {
    localStorage.removeItem(SECRET_KEY);
  }
}

function post(type, data) {
  const { webhookUrl, secret } = getSheetConfig();
  if (!webhookUrl) return;
  try {
    // mode: "no-cors" because Apps Script Web Apps don't return proper
    // CORS headers -- we can't read the response, but the request still
    // executes server-side and appends the row. That's all we need here.
    fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ secret, type, data }),
    }).catch(() => {});
  } catch (e) {}
}

export function logFoodToSheet(entry, dateStr) {
  post("food", {
    date: dateStr,
    time: new Date(entry.time).toLocaleTimeString(),
    name: entry.name,
    calories: entry.calories,
    confidence: entry.confidence,
    note: entry.note || "",
  });
}

export function logWeightToSheet(dateStr, weight) {
  post("weight", { date: dateStr, weight });
}

export function logSleepToSheet(dateStr, hours) {
  post("sleep", { date: dateStr, hours });
}

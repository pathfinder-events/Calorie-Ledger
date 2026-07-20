// Fire-and-forget logging to the Google Sheet backup, if configured.
// Local storage stays the source of truth for what the app displays;
// this is a one-way durable record you can open in Sheets anytime.
// If VITE_SHEET_WEBHOOK_URL isn't set, this quietly does nothing.

const WEBHOOK_URL = import.meta.env.VITE_SHEET_WEBHOOK_URL || "";
const SECRET = import.meta.env.VITE_APP_SHARED_SECRET || "";

function post(type, data) {
  if (!WEBHOOK_URL) return;
  try {
    // mode: "no-cors" because Apps Script Web Apps don't return proper
    // CORS headers -- we can't read the response, but the request still
    // executes server-side and appends the row. That's all we need here.
    fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ secret: SECRET, type, data }),
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

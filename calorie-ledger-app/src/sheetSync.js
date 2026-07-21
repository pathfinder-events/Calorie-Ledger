const WEBHOOK_URL = "https://script.google.com/macros/s/1vX8Y26nXSX9f-4IhEDU_gvEtPcUj6AV1DJ7m5EaKuzPddWZez1Y7zF4I/exec";
const SECRET = import.meta.env.VITE_APP_SHARED_SECRET || import.meta.env.APP_SHARED_SECRET || "";

function post(type, data) {
  if (!WEBHOOK_URL) {
    console.error("Sheet Sync Error: WEBHOOK_URL is missing!");
    return;
  }
  try {
    fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ secret: SECRET, type, data }),
    }).catch((err) => console.error("Sheet Sync Fetch Error:", err));
  } catch (e) {
    console.error("Sheet Sync Exception:", e);
  }
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

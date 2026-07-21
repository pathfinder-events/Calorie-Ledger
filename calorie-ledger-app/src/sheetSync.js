const WEBHOOK_URL = import.meta.env.VITE_SHEET_WEBHOOK_URL || import.meta.env.VITE_SHEET_WEB_APP_URL || "";
const SECRET = import.meta.env.VITE_APP_SHARED_SECRET || import.meta.env.APP_SHARED_SECRET || "";

function post(type, data) {
  console.log("--> post() called with:", { type, data });
  console.log("--> Current WEBHOOK_URL:", WEBHOOK_URL);

  if (!WEBHOOK_URL) {
    console.error("❌ Sheet Sync Error: WEBHOOK_URL is completely empty!");
    return;
  }

  try {
    fetch(WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ secret: SECRET, type, data }),
    })
      .then(() => console.log("✅ fetch request sent successfully!"))
      .catch((err) => console.error("❌ fetch network error:", err));
  } catch (e) {
    console.error("❌ Exception inside post():", e);
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
  console.log("--> logSleepToSheet called:", { dateStr, hours });
  post("sleep", { date: dateStr, hours });
}
// Google Fit integration. Reads today's calories-burned and step count
// from Google Fit -- data your phone already tracks passively in the
// background all day, regardless of whether this app is open.
//
// Uses Google Identity Services' token client (implicit OAuth flow) --
// no backend involved, the browser talks to Google directly. Access
// tokens are short-lived (~1hr); we silently re-request one on each app
// load if the person previously connected, so it mostly stays invisible
// after the first approval.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const SCOPE = "https://www.googleapis.com/auth/fitness.activity.read";
const CONNECTED_KEY = "calorie-ledger:google-fit-connected";

let tokenClient = null;
let currentToken = null;

function waitForGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      } else if (tries > 50) {
        clearInterval(interval);
        reject(new Error("Google sign-in script failed to load"));
      }
    }, 100);
  });
}

async function getTokenClient() {
  await waitForGis();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: () => {}, // overridden per-call below
    });
  }
  return tokenClient;
}

// Requests an access token. prompt: "" attempts a silent/invisible
// re-auth (works if the person already granted access before and is
// still signed into their Google account in this browser). Falls back
// to showing Google's consent popup if silent auth isn't possible.
export async function requestFitAccess(silent = false) {
  const client = await getTokenClient();
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error));
        return;
      }
      currentToken = resp.access_token;
      localStorage.setItem(CONNECTED_KEY, "true");
      resolve(currentToken);
    };
    client.requestAccessToken({ prompt: silent ? "" : "consent" });
  });
}

export function wasFitPreviouslyConnected() {
  return localStorage.getItem(CONNECTED_KEY) === "true";
}

export function disconnectFit() {
  if (currentToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(currentToken, () => {});
  }
  currentToken = null;
  localStorage.removeItem(CONNECTED_KEY);
}

// Fetches today's total calories burned and step count from Google Fit.
export async function fetchTodayFitData(accessToken) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const res = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aggregateBy: [
        { dataTypeName: "com.google.calories.expended" },
        { dataTypeName: "com.google.step_count.delta" },
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: startOfDay.getTime(),
      endTimeMillis: now.getTime(),
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Fit API error: ${res.status}`);
  }

  const data = await res.json();
  let calories = 0;
  let steps = 0;

  for (const bucket of data.bucket || []) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const value of point.value || []) {
          if (dataset.dataSourceId?.includes("calories")) {
            calories += value.fpVal || 0;
          } else if (dataset.dataSourceId?.includes("step_count")) {
            steps += value.intVal || 0;
          }
        }
      }
    }
  }

  return { calories: Math.round(calories), steps };
}

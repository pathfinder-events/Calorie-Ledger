const SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL"; // Replace with your Web App URL

export async function logFoodToSheet(foodData) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "food",
        data: foodData,
      }),
    });
  } catch (err) {
    console.error("Error logging food:", err);
  }
}

export async function logWeightToSheet(date, weight) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "weight",
        data: { date, weight },
      }),
    });
  } catch (err) {
    console.error("Error logging weight:", err);
  }
}

export async function logSleepToSheet(date, hours) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sleep",
        data: { date, hours },
      }),
    });
  } catch (err) {
    console.error("Error logging sleep:", err);
  }
}

export async function logExerciseToSheet(date, activity, duration, calories) {
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "exercise",
        data: {
          date: date,
          activity: activity,
          duration: duration,
          calories: calories,
        },
      }),
    });
  } catch (err) {
    console.error("Error logging exercise:", err);
  }
}

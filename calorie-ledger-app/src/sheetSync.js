const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwybOGvYH-hEoCNWuflEigS7tEGo3XbZqOE9riSyKKQVw7N4MHAOWE70YO2Juzj3iNR/exec"; // Replace with your Web App URL if it ever changes

export async function logFoodToSheet(foodData, currentDate) {
  try {
    // 1. Ensure we have a valid YYYY-MM-DD date for Column A
    const date = foodData.date || currentDate || new Date().toISOString().split("T")[0];

    // 2. Ensure time is formatted cleanly (e.g., "7:57:50 AM") for Column B
    let time = foodData.time || new Date().toLocaleTimeString();
    if (time.includes("T")) {
      const d = new Date(time);
      time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    }

    // 3. Construct clean object explicitly matching Columns A through F
    const formattedFoodData = {
      date: date,                                  // Column A: Date
      time: time,                                  // Column B: Time
      name: foodData.name || "",                   // Column C: Food Name
      calories: foodData.calories || 0,            // Column D: Calories
      confidence: foodData.confidence || "medium", // Column E: Confidence
      note: foodData.note || ""                    // Column F: Note
    };

    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "food",
        data: formattedFoodData,
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

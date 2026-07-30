import React, { useState, useEffect } from 'react';
import { logFoodToSheet, logWeightToSheet } from './sheetSync';

// Helper to format today's date cleanly as YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function App() {
  // -------------------------------------------------------------
  // APP CONFIGURATION & TARGETS (Customized for 58yo, 5'5", 189lbs)
  // -------------------------------------------------------------
  const TARGET_CALORIES = 2000;
  const START_WEIGHT = 189;
  const GOAL_WEIGHT = 172;

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const [currentDate, setCurrentDate] = useState(getTodayString());
  const [currentWeight, setCurrentWeight] = useState(189);
  const [entries, setEntries] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form Inputs
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [note, setNote] = useState('');
  const [weightInput, setWeightInput] = useState('');

  // -------------------------------------------------------------
  // AUTO-REFRESH DATE ON TAB/APP FOCUS
  // -------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const freshDate = getTodayString();
        setCurrentDate(freshDate);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // -------------------------------------------------------------
  // FOOD LOGGING HANDLERS
  // -------------------------------------------------------------
  const handleAddFood = async (entryOverride = null) => {
    const entryDate = currentDate || getTodayString();
    const entryTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

    const newEntry = entryOverride || {
      id: Date.now(),
      date: entryDate,
      time: entryTime,
      name: foodName.trim(),
      calories: parseInt(calories, 10) || 0,
      confidence: 'medium',
      note: note.trim()
    };

    if (!newEntry.name || !newEntry.calories) return;

    // Local state update
    setEntries(prev => [newEntry, ...prev]);

    // Clear form
    if (!entryOverride) {
      setFoodName('');
      setCalories('');
      setNote('');
    }

    // Google Sheets sync
    setIsSyncing(true);
    await logFoodToSheet(newEntry, entryDate);
    setIsSyncing(false);
  };

  const handleQuickWine = () => {
    const wineEntry = {
      id: Date.now(),
      date: currentDate,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
      name: "Red Wine (2 glasses, 10 oz)",
      calories: 245,
      confidence: "high",
      note: "Twice-weekly allowance"
    };
    handleAddFood(wineEntry);
  };

  // -------------------------------------------------------------
  // WEIGHT LOGGING HANDLER
  // -------------------------------------------------------------
  const handleLogWeight = async (e) => {
    e.preventDefault();
    const w = parseFloat(weightInput);
    if (!w) return;

    setCurrentWeight(w);
    setWeightInput('');

    setIsSyncing(true);
    await logWeightToSheet(currentDate, w);
    setIsSyncing(false);
  };

  // -------------------------------------------------------------
  // CALCULATIONS FOR TODAY'S SUMMARY
  // -------------------------------------------------------------
  const todayEntries = entries.filter(item => item.date === currentDate);
  const totalCaloriesToday = todayEntries.reduce((sum, item) => sum + item.calories, 0);
  const remainingCalories = TARGET_CALORIES - totalCaloriesToday;

  // 6-Month Progress Calculations
  const totalToLose = START_WEIGHT - GOAL_WEIGHT; // 17 lbs
  const lostSoFar = Math.max(0, START_WEIGHT - currentWeight);
  const progressPercent = Math.min(100, Math.max(0, Math.round((lostSoFar / totalToLose) * 100)));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans max-w-2xl mx-auto">
      
      {/* APP HEADER */}
      <header className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400">Calorie Ledger</h1>
          <p className="text-xs text-slate-400">Date: <span className="font-medium text-slate-200">{currentDate}</span></p>
        </div>
        {isSyncing && (
          <span className="text-xs text-amber-400 bg-amber-950/60 border border-amber-800 px-2.5 py-1 rounded-full animate-pulse">
            Syncing to Sheet...
          </span>
        )}
      </header>

      {/* 6-MONTH GOAL BANNER */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6 shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-sm text-slate-300">6-Month Weight Target</h2>
          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
            {progressPercent}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-700/80 rounded-full h-3 mb-3 overflow-hidden">
          <div 
            className="bg-emerald-500 h-3 rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-xs text-slate-400">
          <span>Start: <strong className="text-slate-200">{START_WEIGHT} lbs</strong></span>
          <span>Current: <strong className="text-emerald-300">{currentWeight} lbs</strong></span>
          <span>Target: <strong className="text-slate-200">{GOAL_WEIGHT} lbs</strong></span>
        </div>
      </div>

      {/* DAILY CALORIE SUMMARY CARD */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 mb-6">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm font-medium text-slate-300">Today's Calories</span>
          <span className="text-2xl font-bold text-white">{totalCaloriesToday} <span className="text-xs font-normal text-slate-400">/ {TARGET_CALORIES} kcal</span></span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-700/80 rounded-full h-2.5 mb-2 overflow-hidden">
          <div 
            className={`h-2.5 rounded-full transition-all duration-300 ${remainingCalories < 0 ? 'bg-red-500' : 'bg-emerald-400'}`}
            style={{ width: `${Math.min(100, (totalCaloriesToday / TARGET_CALORIES) * 100)}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-xs">
          <span className={remainingCalories < 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
            {remainingCalories >= 0 ? `${remainingCalories} kcal remaining` : `${Math.abs(remainingCalories)} kcal over target`}
          </span>
          <span className="text-slate-400">9,000 Step Routine Active</span>
        </div>
      </div>

      {/* LOG FOOD FORM */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-sm text-slate-200">Log Food Entry</h3>
          <button
            onClick={handleQuickWine}
            type="button"
            className="text-xs bg-purple-950/80 hover:bg-purple-900/90 text-purple-200 border border-purple-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            🍷 Quick Log: 2 Glasses Red Wine (245 kcal)
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleAddFood(); }} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Food name (e.g., Banana)"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
            <input
              type="number"
              placeholder="Calories"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="col-span-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <input
            type="text"
            placeholder="Note (optional, e.g., Medium portion)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors shadow-sm"
          >
            Add Entry & Sync to Sheet
          </button>
        </form>
      </div>

      {/* QUICK LOG WEIGHT */}
      <div className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-4 mb-6">
        <form onSubmit={handleLogWeight} className="flex gap-3 items-center">
          <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Log Today's Weight:</span>
          <input
            type="number"
            step="0.1"
            placeholder="lbs (e.g. 188.5)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            Save Weight
          </button>
        </form>
      </div>

      {/* TODAY'S LOG LIST */}
      <div>
        <h3 className="font-semibold text-sm text-slate-300 mb-3">Today's Entries ({todayEntries.length})</h3>
        {todayEntries.length === 0 ? (
          <p className="text-xs text-slate-500 italic bg-slate-950/30 border border-slate-800/50 rounded-lg p-4 text-center">
            No entries logged for today yet.
          </p>
        ) : (
          <div className="space-y-2">
            {todayEntries.map((item) => (
              <div key={item.id} className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-3 flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium text-slate-100">{item.name}</div>
                  <div className="text-xs text-slate-400">
                    {item.time} {item.note ? `• ${item.note}` : ''}
                  </div>
                </div>
                <div className="font-semibold text-emerald-400">
                  +{item.calories} kcal
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
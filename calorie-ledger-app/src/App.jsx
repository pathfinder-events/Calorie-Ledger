import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Camera, Loader2, Trash2, Settings2, TrendingDown, Flame, Plus, Type, Edit3, X, History, ArrowLeft, Image as ImageIcon, Footprints, RefreshCw, Link2, Unlink } from "lucide-react";
import { storage } from "./storage.js";
import { logFoodToSheet, logWeightToSheet } from "./sheetSync.js";
import { requestFitAccess, wasFitPreviouslyConnected, disconnectFit, fetchTodayFitData } from "./googleFit.js";

// Uses local date components
const todayKey = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const fmt = (n) => Math.round(n).toLocaleString();
const SHARED_SECRET = import.meta.env.VITE_APP_SHARED_SECRET || "";

async function fetchWithTimeout(url, options, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const DEFAULT_STATS = {
  sex: "male",
  age: 57,
  heightIn: 65,
  weightLb: 190,
  goalLowLb: 170,
  goalHighLb: 175,
  activity: 1.45,
  deficit: 500,
};

const ACTIVITY_OPTIONS = [
  { value: 1.2, label: "Sedentary", hint: "desk-bound, little walking" },
  { value: 1.375, label: "Lightly active", hint: "some walking, light chores" },
  { value: 1.45, label: "On your feet + light exercise", hint: "8hr on feet, 1-2 workouts/wk" },
  { value: 1.55, label: "Moderately active", hint: "on feet often, 3-4 workouts/wk" },
  { value: 1.725, label: "Very active", hint: "physical job or daily hard training" },
];

function resizeImage(file, maxDim = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = (err) => reject(new Error("Image decode failed"));
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [statsOpen, setStatsOpen] = useState(false);
  const [view, setView] = useState("today"); // "today" | "history"
  const [fitConnected, setFitConnected] = useState(false);
  const [fitData, setFitData] = useState(null); // { calories, steps }
  const [fitLoading, setFitLoading] = useState(false);
  const [fitError, setFitError] = useState("");
  const [entries, setEntries] = useState([]);
  const [weightLog, setWeightLog] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [entryMode, setEntryMode] = useState(null); // null | "describe" | "manual"
  const [descText, setDescText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCals, setManualCals] = useState("");
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const today = todayKey();

  useEffect(() => {
    (async () => {
      try {
        const s = await storage.get("user-stats");
        if (s?.value) setStats(JSON.parse(s.value));
      } catch (e) {}
      try {
        const l = await storage.get(`food-log:${today}`);
        if (l?.value) setEntries(JSON.parse(l.value));
      } catch (e) {}
      try {
        const w = await storage.get("weight-log");
        if (w?.value) setWeightLog(JSON.parse(w.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set("user-stats", JSON.stringify(stats)).catch(() => {});
  }, [stats, loaded]);

  useEffect(() => {
    if (!wasFitPreviouslyConnected()) return;
    (async () => {
      try {
        setFitLoading(true);
        const token = await requestFitAccess(true);
        const data = await fetchTodayFitData(token);
        setFitData(data);
        setFitConnected(true);
      } catch (e) {
      } finally {
        setFitLoading(false);
      }
    })();
  }, []);

  const connectFit = async () => {
    setFitError("");
    setFitLoading(true);
    try {
      const token = await requestFitAccess(false);
      const data = await fetchTodayFitData(token);
      setFitData(data);
      setFitConnected(true);
    } catch (e) {
      setFitError("Couldn't connect to Google Fit. Try again.");
    } finally {
      setFitLoading(false);
    }
  };

  const refreshFitData = async () => {
    if (!fitConnected) return;
    setFitLoading(true);
    try {
      const token = await requestFitAccess(true);
      const data = await fetchTodayFitData(token);
      setFitData(data);
    } catch (e) {
    } finally {
      setFitLoading(false);
    }
  };

  const handleDisconnectFit = () => {
    disconnectFit();
    setFitConnected(false);
    setFitData(null);
  };

  useEffect(() => {
    if (!loaded) return;
    storage.set(`food-log:${today}`, JSON.stringify(entries)).catch(() => {});
  }, [entries, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.set("weight-log", JSON.stringify(weightLog)).catch(() => {});
  }, [weightLog, loaded]);

  const weightKg = stats.weightLb * 0.453592;
  const heightCm = stats.heightIn * 2.54;
  const bmr =
    stats.sex === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * stats.age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * stats.age - 161;
  const tdee = bmr * stats.activity;
  const target = tdee - stats.deficit;
  const weeklyLoss = (stats.deficit * 7) / 3500;

  const consumed = entries.reduce((sum, e) => sum + (e.calories || 0), 0);
  const remaining = target - consumed;

  const handlePhoto = async (file) => {
    if (!file) return;
    setError("");
    setAnalyzing(true);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), 45000)
    );

    const work = async () => {
      const dataUrl = await resizeImage(file);
      const base64 = dataUrl.split(",")[1];

      const response = await fetchWithTimeout("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-secret": SHARED_SECRET },
        body: JSON.stringify({ image: base64 }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const parsed = await response.json();

      const newEntry = {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        thumb: dataUrl,
        name: parsed.food_name,
        items: parsed.items || [],
        note: parsed.portion_note || "",
        calories: Number(parsed.estimated_calories) || 0,
        confidence: parsed.confidence || "medium",
      };
      setEntries((prev) => [...prev, newEntry]);
      logFoodToSheet(newEntry, today);
    };

    try {
      await Promise.race([work(), timeoutPromise]);
    } catch (e) {
      setError(
        e.name === "AbortError" || e.message === "TIMEOUT"
          ? "That took too long and timed out. Try again, or use a smaller/clearer photo."
          : "Couldn't read that plate. Try a clearer, well-lit shot."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDescribe = async () => {
    if (!descText.trim()) return;
    setError("");
    setAnalyzing(true);
    try {
      const response = await fetchWithTimeout("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-secret": SHARED_SECRET },
        body: JSON.stringify({ description: descText.trim() }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const parsed = await response.json();

      const newEntry = {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        thumb: null,
        name: parsed.food_name,
        items: parsed.items || [],
        note: parsed.portion_note || "",
        calories: Number(parsed.estimated_calories) || 0,
        confidence: parsed.confidence || "medium",
      };
      setEntries((prev) => [...prev, newEntry]);
      logFoodToSheet(newEntry, today);
      setDescText("");
      setEntryMode(null);
    } catch (e) {
      setError(
        e.name === "AbortError"
          ? "That took too long and timed out. Try again."
          : "Couldn't estimate that one. Try rephrasing, or enter calories manually."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const addManualEntry = () => {
    const cals = parseFloat(manualCals);
    if (!manualName.trim() || !cals || cals <= 0) return;
    const newEntry = {
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      thumb: null,
      name: manualName.trim(),
      items: [],
      note: "Entered manually",
      calories: cals,
      confidence: "manual",
    };
    setEntries((prev) => [...prev, newEntry]);
    logFoodToSheet(newEntry, today);
    setManualName("");
    setManualCals("");
    setEntryMode(null);
  };

  const logWeight = () => {
    const val = parseFloat(newWeight);
    if (!val || val <= 0) return;
    setWeightLog((prev) => {
      const filtered = prev.filter((w) => w.date !== today);
      return [...filtered, { date: today, weight: val }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setStats((prev) => ({ ...prev, weightLb: val }));
    logWeightToSheet(today, val);
    setNewWeight("");
  };

  const chartData = weightLog.map((w) => ({ date: w.date.slice(5), weight: w.weight }));

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>DAILY LEDGER</div>
            <h1 style={styles.h1}>Calorie Ledger</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.iconBtn} onClick={() => setView((v) => (v === "history" ? "today" : "history"))}>
              <History size={18} />
            </button>
            <button style={styles.iconBtn} onClick={() => setStatsOpen((o) => !o)}>
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        {view === "history" ? (
          <HistoryView target={target} onBack={() => setView("today")} />
        ) : (
        <>
        {statsOpen && <StatsPanel stats={stats} setStats={setStats} />}

        <section style={styles.summaryCard}>
          <div style={styles.summaryRow}>
            <SummaryStat label="TARGET" value={fmt(target)} accent={colors.gold} />
            <SummaryStat label="EATEN" value={fmt(consumed)} accent={colors.text} />
            <SummaryStat
              label={remaining >= 0 ? "REMAINING" : "OVER"}
              value={fmt(Math.abs(remaining))}
              accent={remaining >= 0 ? colors.teal : colors.rust}
            />
          </div>
          <ProgressBar consumed={consumed} target={target} />
          <div style={styles.metaRow}>
            <span style={styles.metaText}>
              <Flame size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Burns ~{fmt(tdee)} cal/day &middot; BMR {fmt(bmr)}
            </span>
            <span style={styles.metaText}>
              <TrendingDown size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              ~{weeklyLoss.toFixed(1)} lb/wk pace
            </span>
          </div>

          <div style={styles.fitRow}>
            {fitConnected ? (
              <>
                <span style={styles.metaText}>
                  <Footprints size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                  {fitData ? (
                    <>
                      {fmt(fitData.calories)} cal &middot; {fmt(fitData.steps)} steps today (Google Fit)
                    </>
                  ) : (
                    "Loading Google Fit data..."
                  )}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={styles.fitIconBtn} onClick={refreshFitData} disabled={fitLoading}>
                    <RefreshCw size={12} style={fitLoading ? { animation: "spin 1s linear infinite" } : {}} />
                  </button>
                  <button style={styles.fitIconBtn} onClick={handleDisconnectFit}>
                    <Unlink size={12} />
                  </button>
                </div>
              </>
            ) : (
              <button style={styles.fitConnectBtn} onClick={connectFit} disabled={fitLoading}>
                {fitLoading ? (
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Link2 size={13} />
                )}
                Connect Google Fit for real burn data
              </button>
            )}
          </div>
          {fitError && <div style={styles.errorText}>{fitError}</div>}
        </section>

        <section style={styles.scanSection}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handlePhoto(e.target.files[0])}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handlePhoto(e.target.files[0])}
          />
          <button style={styles.scanBtn} onClick={() => fileInputRef.current?.click()} disabled={analyzing}>
            {analyzing ? (
              <>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Reading your plate...
              </>
            ) : (
              <>
                <Camera size={18} />
                Scan a meal
              </>
            )}
          </button>

          <div style={styles.altRow}>
            <button style={styles.altLink} onClick={() => galleryInputRef.current?.click()}>
              <ImageIcon size={13} /> Choose photo
            </button>
            <span style={styles.altDivider}>&middot;</span>
            <button
              style={styles.altLink}
              onClick={() => setEntryMode((m) => (m === "describe" ? null : "describe"))}
            >
              <Type size={13} /> Type it in
            </button>
            <span style={styles.altDivider}>&middot;</span>
            <button
              style={styles.altLink}
              onClick={() => setEntryMode((m) => (m === "manual" ? null : "manual"))}
            >
              <Edit3 size={13} /> Enter manually
            </button>
          </div>

          {entryMode === "describe" && (
            <div style={styles.inlineForm}>
              <div style={styles.inlineFormHeader}>
                <span>Describe what you ate — AI estimates the calories</span>
                <button style={styles.closeBtn} onClick={() => setEntryMode(null)}>
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={descText}
                onChange={(e) => setDescText(e.target.value)}
                placeholder="e.g. Two scrambled eggs, a slice of sourdough toast with butter, black coffee"
                style={styles.textarea}
                rows={3}
              />
              <button style={styles.inlineSubmitBtn} onClick={handleDescribe} disabled={analyzing || !descText.trim()}>
                {analyzing ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Type size={15} />}
                Estimate calories
              </button>
            </div>
          )}

          {entryMode === "manual" && (
            <div style={styles.inlineForm}>
              <div style={styles.inlineFormHeader}>
                <span>Enter exact calories — no AI estimate</span>
                <button style={styles.closeBtn} onClick={() => setEntryMode(null)}>
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="What was it? e.g. Protein shake"
                style={styles.numInput}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  type="number"
                  value={manualCals}
                  onChange={(e) => setManualCals(e.target.value)}
                  placeholder="Calories"
                  style={styles.numInput}
                />
                <button
                  style={styles.inlineSubmitBtnCompact}
                  onClick={addManualEntry}
                  disabled={!manualName.trim() || !manualCals}
                >
                  <Plus size={15} /> Add
                </button>
              </div>
            </div>
          )}

          {error && <div style={styles.errorText}>{error}</div>}
        </section>

        <section>
          <div style={styles.sectionLabel}>Today's entries</div>
          {entries.length === 0 && !analyzing && (
            <div style={styles.emptyState}>No meals logged yet. Snap a photo to start today's ledger.</div>
          )}
          <div style={styles.receipt}>
            {entries.map((e, i) => (
              <div key={e.id}>
                <EntryRow entry={e} onRemove={() => removeEntry(e.id)} />
                {i < entries.length - 1 && <div style={styles.dashedDivider} />}
              </div>
            ))}
          </div>
        </section>

        <section style={styles.weightSection}>
          <div style={styles.sectionLabel}>Weight trend</div>
          <div style={styles.weightInputRow}>
            <input
              type="number"
              placeholder={`${stats.weightLb} lb`}
              value={newWeight}
              onChange={(ev) => setNewWeight(ev.target.value)}
              style={styles.weightInput}
            />
            <button style={styles.logWeightBtn} onClick={logWeight} disabled={!newWeight}>
              <Plus size={15} /> Log today
            </button>
          </div>
          <div style={styles.goalNote}>
            Goal: {stats.goalLowLb}&ndash;{stats.goalHighLb} lb &middot; currently {stats.weightLb} lb
          </div>
          {chartData.length > 1 && (
            <div style={{ width: "100%", maxWidth: "100%", height: 160, marginTop: 14, overflow: "hidden" }}>
              <ResponsiveContainer width="99%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={colors.gridLine} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={{ stroke: colors.gridLine }} tickLine={false} />
                  <YAxis domain={["dataMin - 3", "dataMax + 3"]} tick={{ fill: colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
                  <Tooltip contentStyle={{ background: colors.card, border: `1px solid ${colors.gridLine}`, borderRadius: 8, fontSize: 12, color: colors.text }} />
                  <Line type="monotone" dataKey="weight" stroke={colors.gold} strokeWidth={2} dot={{ fill: colors.gold, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
        </>
        )}

        <footer style={styles.footer}>
          Estimates from photo scans are approximate, not medical or clinical guidance. Check with your doctor before changing your diet.
        </footer>
      </div>
    </div>
  );
}

function HistoryView({ target, onBack }) {
  const [days, setDays] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const listResult = await storage.list("food-log:");
        const keys = (listResult?.keys || []).sort().reverse();
        const rows = [];
        for (const key of keys) {
          try {
            const result = await storage.get(key);
            if (!result?.value) continue;
            const entries = JSON.parse(result.value);
            if (!entries.length) continue;
            const date = key.replace("food-log:", "");
            const eaten = entries.reduce((sum, e) => sum + (e.calories || 0), 0);
            rows.push({
              date,
              items: entries.map((e) => e.name).join(", "),
              eaten,
              target,
              overBy: Math.max(0, eaten - target),
            });
          } catch (e) {}
        }
        setDays(rows);
      } catch (e) {
        setDays([]);
      }
    })();
  }, []);

  const formatDate = (isoDate) => {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={styles.historyHeaderRow}>
        <button style={styles.iconBtn} onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div style={styles.sectionLabel}>History</div>
      </div>

      {days === null && <div style={styles.emptyState}>Loading past days...</div>}
      {days !== null && days.length === 0 && (
        <div style={styles.emptyState}>No past days logged yet.</div>
      )}

      {days !== null &&
        days.map((d) => (
          <div key={d.date} style={styles.historyCard}>
            <div style={styles.historyDateRow}>
              <span style={styles.historyDate}>{formatDate(d.date)}</span>
              {d.overBy > 0 ? (
                <span style={{ ...styles.historyBadge, color: colors.rust }}>+{fmt(d.overBy)} over</span>
              ) : (
                <span style={{ ...styles.historyBadge, color: colors.teal }}>within target</span>
              )}
            </div>
            <div style={styles.historyItems}>{d.items}</div>
            <div style={styles.historyStatsRow}>
              <span>
                Target <strong>{fmt(d.target)}</strong>
              </span>
              <span>
                Eaten <strong>{fmt(d.eaten)}</strong>
              </span>
            </div>
          </div>
        ))}
    </section>
  );
}

function SummaryStat({ label, value, accent }) {
  return (
    <div style={styles.summaryStat}>
      <div style={{ ...styles.summaryValue, color: accent }}>{value}</div>
      <div style={styles.summaryLabel}>{label}</div>
    </div>
  );
}

function ProgressBar({ consumed, target }) {
  const pct = Math.min(100, Math.max(0, (consumed / target) * 100));
  const over = consumed > target;
  return (
    <div style={styles.progressTrack}>
      <div style={{ ...styles.progressFill, width: `${pct}%`, background: over ? colors.rust : colors.teal }} />
    </div>
  );
}

function EntryRow({ entry, onRemove }) {
  const time = new Date(entry.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div style={styles.entryRow}>
      {entry.thumb ? (
        <img src={entry.thumb} alt="" style={styles.entryThumb} />
      ) : (
        <img src="/icon-192.png" alt="" style={styles.entryThumb} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.entryName}>{entry.name}</div>
        <div style={styles.entryNote}>{entry.note || entry.items.join(", ")}</div>
        <div style={styles.entryTime}>{time}</div>
      </div>
      <div style={styles.entryCals}>{fmt(entry.calories)}</div>
      <button style={styles.trashBtn} onClick={onRemove}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function StatsPanel({ stats, setStats }) {
  const set = (k) => (v) => setStats((prev) => ({ ...prev, [k]: v }));
  return (
    <section style={styles.statsPanel}>
      <Field label="Weight (lb)">
        <input type="number" value={stats.weightLb} onChange={(e) => set("weightLb")(Number(e.target.value))} style={styles.numInput} />
      </Field>
      <Field label="Height (in)">
        <input type="number" value={stats.heightIn} onChange={(e) => set("heightIn")(Number(e.target.value))} style={styles.numInput} />
      </Field>
      <Field label="Age">
        <input type="number" value={stats.age} onChange={(e) => set("age")(Number(e.target.value))} style={styles.numInput} />
      </Field>
      <Field label="Sex">
        <select value={stats.sex} onChange={(e) => set("sex")(e.target.value)} style={styles.numInput}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </Field>
      <Field label="Goal range (lb)">
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={stats.goalLowLb} onChange={(e) => set("goalLowLb")(Number(e.target.value))} style={styles.numInput} />
          <input type="number" value={stats.goalHighLb} onChange={(e) => set("goalHighLb")(Number(e.target.value))} style={styles.numInput} />
        </div>
      </Field>
      <Field label="Activity level">
        <select value={stats.activity} onChange={(e) => set("activity")(Number(e.target.value))} style={styles.numInput}>
          {ACTIVITY_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label} — {a.hint}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Daily deficit: ${stats.deficit} cal (~${((stats.deficit * 7) / 3500).toFixed(1)} lb/wk)`}>
        <input
          type="range"
          min={250}
          max={750}
          step={50}
          value={stats.deficit}
          onChange={(e) => set("deficit")(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Field>
      {stats.deficit > 750 && (
        <div style={styles.errorText}>That pace is aggressive — most guidance caps sustainable loss near 1–1.5 lb/week.</div>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

const colors = {
  bg: "#e9dec2",
  card: "#f6eeda",
  cardAlt: "#ecdfbe",
  text: "#3b2a1a",
  textMuted: "#8a7355",
  gold: "#8b6a3d",
  teal: "#5c6b3f",
  rust: "#a1432c",
  gridLine: "#d6c49a",
  border: "#c9b384",
  onGold: "#f8f1e2",
  onTeal: "#f4f2e4",
};

const styles = {
  page: { minHeight: "100vh", background: colors.bg, fontFamily: "'Inter', system-ui, sans-serif", color: colors.text, padding: "24px 16px 60px" },
  wrap: { maxWidth: 480, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  eyebrow: { fontSize: 11, letterSpacing: "0.14em", color: colors.gold, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 4 },
  h1: { fontFamily: "'Bitter', serif", fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" },
  iconBtn: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 9, color: colors.textMuted, cursor: "pointer" },
  statsPanel: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16, marginBottom: 16 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6, fontFamily: "'IBM Plex Mono', monospace" },
  numInput: { width: "100%", background: colors.cardAlt, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 10px", color: colors.text, fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: "border-box" },
  summaryCard: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: "20px 18px", marginBottom: 18 },
  summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: 14 },
  summaryStat: { textAlign: "center", flex: 1 },
  summaryValue: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 600, lineHeight: 1.1 },
  summaryLabel: { fontSize: 10, letterSpacing: "0.1em", color: colors.textMuted, marginTop: 4 },
  progressTrack: { height: 8, background: colors.cardAlt, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, transition: "width 0.4s ease" },
  metaRow: { display: "flex", justifyContent: "space-between", marginTop: 12 },
  fitRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${colors.border}` },
  fitConnectBtn: { background: "none", border: `1px dashed ${colors.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: colors.textMuted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", width: "100%", justifyContent: "center" },
  fitIconBtn: { background: colors.cardAlt, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 5, color: colors.textMuted, cursor: "pointer", display: "flex" },
  metaText: { fontSize: 11.5, color: colors.textMuted },
  scanSection: { marginBottom: 24 },
  scanBtn: { width: "100%", background: colors.gold, color: colors.onGold, border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  errorText: { color: colors.rust, fontSize: 12.5, marginTop: 8 },
  altRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, flexWrap: "wrap", rowGap: 6 },
  altLink: { background: "none", border: "none", color: colors.textMuted, fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", padding: 4 },
  altDivider: { color: colors.border },
  inlineForm: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, marginTop: 10 },
  inlineFormHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  closeBtn: { background: "none", border: "none", color: colors.textMuted, cursor: "pointer", padding: 2 },
  textarea: { width: "100%", background: colors.cardAlt, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "8px 10px", color: colors.text, fontSize: 14, fontFamily: "'Inter', sans-serif", boxSizing: "border-box", resize: "vertical" },
  inlineSubmitBtn: { background: colors.teal, color: colors.onTeal, border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", marginTop: 10, width: "100%" },
  inlineSubmitBtnCompact: { background: colors.teal, color: colors.onTeal, border: "none", borderRadius: 10, padding: "0 16px", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", whiteSpace: "nowrap" },
  entryThumbPlaceholder: { width: 44, height: 44, borderRadius: 8, flexShrink: 0, border: `1px solid ${colors.border}`, background: colors.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", color: colors.textMuted },
  sectionLabel: { fontSize: 11, letterSpacing: "0.12em", color: colors.textMuted, fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10, textTransform: "uppercase" },
  emptyState: { color: colors.textMuted, fontSize: 13.5, padding: "20px 0", textAlign: "center" },
  receipt: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "4px 14px", overflow: "hidden" },
  dashedDivider: { borderTop: `1px dashed ${colors.border}` },
  entryRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0" },
  entryThumb: { width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: `1px solid ${colors.border}` },
  entryName: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  entryNote: { fontSize: 11.5, color: colors.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  entryTime: { fontSize: 10.5, color: colors.textMuted, marginTop: 2 },
  entryCals: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600, color: colors.gold, whiteSpace: "nowrap" },
  trashBtn: { background: "none", border: "none", color: colors.textMuted, cursor: "pointer", padding: 4 },
  weightSection: { marginTop: 26 },
  weightInputRow: { display: "flex", gap: 8 },
  weightInput: { flex: 1, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 12px", color: colors.text, fontSize: 14, boxSizing: "border-box" },
  logWeightBtn: { background: colors.teal, color: colors.onTeal, border: "none", borderRadius: 10, padding: "0 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" },
  goalNote: { fontSize: 11.5, color: colors.textMuted, marginTop: 8 },
  footer: { marginTop: 32, fontSize: 11, color: colors.textMuted, textAlign: "center", lineHeight: 1.5 },
  historyHeaderRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  historyCard: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 },
  historyDateRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  historyDate: { fontFamily: "'Bitter', serif", fontSize: 15, fontWeight: 700 },
  historyBadge: { fontSize: 11.5, fontWeight: 600 },
  historyItems: { fontSize: 12.5, color: colors.textMuted, marginBottom: 10, lineHeight: 1.4 },
  historyStatsRow: { display: "flex", gap: 18, fontSize: 12.5, color: colors.textMuted },
};

import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Camera, Loader2, Trash2, Settings2, TrendingDown, Flame, Plus } from "lucide-react";
import { storage } from "./storage.js";

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const fmt = (n) => Math.round(n).toLocaleString();

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
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [statsOpen, setStatsOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [weightLog, setWeightLog] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const fileInputRef = useRef(null);
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
    try {
      const dataUrl = await resizeImage(file);
      const base64 = dataUrl.split(",")[1];

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const parsed = await response.json();

      setEntries((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          time: new Date().toISOString(),
          thumb: dataUrl,
          name: parsed.food_name,
          items: parsed.items || [],
          note: parsed.portion_note || "",
          calories: Number(parsed.estimated_calories) || 0,
          confidence: parsed.confidence || "medium",
        },
      ]);
    } catch (e) {
      setError("Couldn't read that plate. Try a clearer, well-lit shot.");
    } finally {
      setAnalyzing(false);
    }
  };

  const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const logWeight = () => {
    const val = parseFloat(newWeight);
    if (!val || val <= 0) return;
    setWeightLog((prev) => {
      const filtered = prev.filter((w) => w.date !== today);
      return [...filtered, { date: today, weight: val }].sort((a, b) => a.date.localeCompare(b.date));
    });
    setStats((prev) => ({ ...prev, weightLb: val }));
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
          <button style={styles.iconBtn} onClick={() => setStatsOpen((o) => !o)}>
            <Settings2 size={18} />
          </button>
        </header>

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
            <button style={styles.logWeightBtn} onClick={logWeight}>
              <Plus size={15} /> Log today
            </button>
          </div>
          <div style={styles.goalNote}>
            Goal: {stats.goalLowLb}&ndash;{stats.goalHighLb} lb &middot; currently {stats.weightLb} lb
          </div>
          {chartData.length > 1 && (
            <div style={{ width: "100%", height: 160, marginTop: 14 }}>
              <ResponsiveContainer>
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

        <footer style={styles.footer}>
          Estimates from photo scans are approximate, not medical or clinical guidance. Check with your doctor before changing your diet.
        </footer>
      </div>
    </div>
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
      <img src={entry.thumb} alt="" style={styles.entryThumb} />
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
  metaText: { fontSize: 11.5, color: colors.textMuted },
  scanSection: { marginBottom: 24 },
  scanBtn: { width: "100%", background: colors.gold, color: colors.onGold, border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  errorText: { color: colors.rust, fontSize: 12.5, marginTop: 8 },
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
};

import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Camera, Loader2, Trash2, Settings2, TrendingDown, Flame, Plus, Type, Edit3, X } from "lucide-react";
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
  const [entryMode, setEntryMode] = useState(null); // null | "describe" | "manual"
  const [descText, setDescText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCals, setManualCals] = useState("");
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
  const heightCm =

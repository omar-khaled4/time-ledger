"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  LogIn, LogOut, RotateCcw, Settings2, Download, Upload,
  Trash2, Plus, LogOut as SignOutIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const pad2 = (n) => String(n).padStart(2, "0");

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseDateStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dayOfWeekForDateStr(s) {
  return parseDateStr(s).getDay();
}
function formatHM(dateObj) {
  if (!dateObj) return "\u2014";
  return `${pad2(dateObj.getHours())}:${pad2(dateObj.getMinutes())}`;
}
function hoursBetween(isoStart, endDate) {
  if (!isoStart) return 0;
  const start = new Date(isoStart);
  const diff = (endDate.getTime() - start.getTime()) / 3600000;
  return diff > 0 ? diff : 0;
}
function fmtHours(h) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 60) return `${hrs + 1}h 0m`;
  return `${hrs}h ${mins}m`;
}
function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

const defaultSettings = {
  monthlySalary: 15000,
  hoursPerDay: 9,
  standardMonthlyHours: 198,
  overtimeMultiplier: 1.5,
  currency: "EGP",
  holidayDays: [5, 6], // Friday, Saturday
};

function computeEntryStats(entry, settings, nowForOngoing) {
  const empty = { hours: 0, regularHours: 0, overtimeHours: 0, pay: 0, isHoliday: false, ongoing: false };
  if (!entry || !entry.clockIn) return empty;
  const end = entry.clockOut ? new Date(entry.clockOut) : nowForOngoing;
  const hours = hoursBetween(entry.clockIn, end);
  const isHoliday = settings.holidayDays.includes(dayOfWeekForDateStr(entry.date));
  const hourlyRate = settings.standardMonthlyHours > 0 ? settings.monthlySalary / settings.standardMonthlyHours : 0;
  let regularHours, overtimeHours;
  if (isHoliday) {
    regularHours = 0;
    overtimeHours = hours;
  } else {
    regularHours = Math.min(hours, settings.hoursPerDay);
    overtimeHours = Math.max(0, hours - settings.hoursPerDay);
  }
  const pay = regularHours * hourlyRate + overtimeHours * hourlyRate * settings.overtimeMultiplier;
  return { hours, regularHours, overtimeHours, pay, isHoliday, ongoing: !entry.clockOut };
}

async function persistSettings(userId, s) {
  await supabase.from("settings").upsert({
    user_id: userId,
    monthly_salary: s.monthlySalary,
    hours_per_day: s.hoursPerDay,
    standard_monthly_hours: s.standardMonthlyHours,
    overtime_multiplier: s.overtimeMultiplier,
    currency: s.currency,
    holiday_days: s.holidayDays,
    updated_at: new Date().toISOString(),
  });
}
async function persistEntry(userId, entry) {
  await supabase.from("entries").upsert(
    {
      user_id: userId,
      date: entry.date,
      clock_in: entry.clockIn,
      clock_out: entry.clockOut,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );
}
async function deleteEntryRemote(userId, date) {
  await supabase.from("entries").delete().eq("user_id", userId).eq("date", date);
}

export default function Dashboard({ session }) {
  const userId = session.user.id;
  const [settings, setSettings] = useState(defaultSettings);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState({ date: todayDateStr(), clockIn: "09:00", clockOut: "18:00" });
  const fileInputRef = useRef(null);
  const settingsSaveTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Initial load from Supabase
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: settingsRow } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (settingsRow) {
        setSettings({
          monthlySalary: Number(settingsRow.monthly_salary),
          hoursPerDay: Number(settingsRow.hours_per_day),
          standardMonthlyHours: Number(settingsRow.standard_monthly_hours),
          overtimeMultiplier: Number(settingsRow.overtime_multiplier),
          currency: settingsRow.currency,
          holidayDays: settingsRow.holiday_days,
        });
      } else {
        await persistSettings(userId, defaultSettings);
      }

      const { data: entryRows } = await supabase.from("entries").select("*").eq("user_id", userId);
      if (cancelled) return;
      if (entryRows) {
        setEntries(entryRows.map((r) => ({ date: r.date, clockIn: r.clock_in, clockOut: r.clock_out })));
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced settings sync to Supabase, skipped on initial load
  useEffect(() => {
    if (!loaded) return;
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      persistSettings(userId, settings).catch(console.error);
    }, 500);
    return () => clearTimeout(settingsSaveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const minuteKey = Math.floor(now.getTime() / 60000);
  const todayStr = todayDateStr();
  const todayEntry = entries.find((e) => e.date === todayStr);
  const heroState = !todayEntry || !todayEntry.clockIn ? "in" : !todayEntry.clockOut ? "out" : "done";

  function upsertLocalEntry(date, clockIn, clockOut) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.date === date);
      const next = { date, clockIn, clockOut };
      if (idx === -1) return [...prev, next];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
    return { date, clockIn, clockOut };
  }

  function handleClockIn() {
    const entry = upsertLocalEntry(todayStr, new Date().toISOString(), null);
    persistEntry(userId, entry).catch(console.error);
  }
  function handleClockOut() {
    const clockOutIso = new Date().toISOString();
    setEntries((prev) => prev.map((e) => (e.date === todayStr ? { ...e, clockOut: clockOutIso } : e)));
    const entry = entries.find((e) => e.date === todayStr);
    if (entry) persistEntry(userId, { ...entry, clockOut: clockOutIso }).catch(console.error);
  }
  function handleResume() {
    setEntries((prev) => prev.map((e) => (e.date === todayStr ? { ...e, clockOut: null } : e)));
    const entry = entries.find((e) => e.date === todayStr);
    if (entry) persistEntry(userId, { ...entry, clockOut: null }).catch(console.error);
  }
  function handleDelete(date) {
    setEntries((prev) => prev.filter((e) => e.date !== date));
    deleteEntryRemote(userId, date).catch(console.error);
  }
  function handleSaveDraft() {
    if (!draft.date || !draft.clockIn) return;
    const clockInIso = new Date(`${draft.date}T${draft.clockIn}:00`).toISOString();
    const clockOutIso = draft.clockOut ? new Date(`${draft.date}T${draft.clockOut}:00`).toISOString() : null;
    const entry = upsertLocalEntry(draft.date, clockInIso, clockOutIso);
    persistEntry(userId, entry).catch(console.error);
  }

  const monthPrefix = todayStr.slice(0, 7);
  const [curYear, curMonthIdx] = [Number(todayStr.slice(0, 4)), Number(todayStr.slice(5, 7)) - 1];
  const totalDaysThisMonth = daysInMonth(curYear, curMonthIdx);
  const todayDayNum = Number(todayStr.slice(8, 10));

  const monthStats = useMemo(() => {
    const chartData = [];
    let totalRegularHours = 0, totalOvertimeHours = 0, totalPay = 0;
    let standardWorkdaysInMonth = 0, elapsedStandardWorkdays = 0;

    for (let d = 1; d <= totalDaysThisMonth; d++) {
      const dateStr = `${curYear}-${pad2(curMonthIdx + 1)}-${pad2(d)}`;
      const isHoliday = settings.holidayDays.includes(dayOfWeekForDateStr(dateStr));
      if (!isHoliday) {
        standardWorkdaysInMonth++;
        if (d <= todayDayNum) elapsedStandardWorkdays++;
      }
      const entry = entries.find((e) => e.date === dateStr);
      const stats = computeEntryStats(entry, settings, now);
      totalRegularHours += stats.regularHours;
      totalOvertimeHours += stats.overtimeHours;
      totalPay += stats.pay;
      chartData.push({
        day: d,
        label: `${d}`,
        regularHours: Number(stats.regularHours.toFixed(2)),
        overtimeHours: Number(stats.overtimeHours.toFixed(2)),
        pay: Number(stats.pay.toFixed(2)),
        isHoliday,
        isFuture: d > todayDayNum,
      });
    }

    let running = 0;
    chartData.forEach((row) => {
      if (!row.isFuture) running += row.pay;
      row.cumulativePay = Number(running.toFixed(2));
    });

    const hourlyRate = settings.standardMonthlyHours > 0 ? settings.monthlySalary / settings.standardMonthlyHours : 0;
    const overtimePayLogged = chartData.reduce((sum, r) => sum + r.overtimeHours * hourlyRate * settings.overtimeMultiplier, 0);
    const regularHoursRatio = elapsedStandardWorkdays > 0
      ? Math.min(1, totalRegularHours / (elapsedStandardWorkdays * settings.hoursPerDay))
      : 0;
    const projectedRegularPay = settings.monthlySalary * regularHoursRatio;
    const avgOvertimePayPerElapsedDay = todayDayNum > 0 ? overtimePayLogged / todayDayNum : 0;
    const projectedOvertimePay = avgOvertimePayPerElapsedDay * totalDaysThisMonth;
    const projectedTotal = projectedRegularPay + projectedOvertimePay;

    return { chartData, totalRegularHours, totalOvertimeHours, totalPay, projectedTotal, hourlyRate };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, settings, minuteKey, curYear, curMonthIdx, totalDaysThisMonth, todayDayNum]);

  const monthEntries = useMemo(
    () => entries.filter((e) => e.date.startsWith(monthPrefix)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries, monthPrefix]
  );

  const heroElapsed = heroState === "out" && todayEntry ? hoursBetween(todayEntry.clockIn, now) : 0;

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const logRows = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => {
      const s = computeEntryStats(e, settings, now);
      return {
        Date: e.date,
        Day: DAY_NAMES[dayOfWeekForDateStr(e.date)],
        "Clock In": e.clockIn ? formatHM(new Date(e.clockIn)) : "",
        "Clock Out": e.clockOut ? formatHM(new Date(e.clockOut)) : "",
        "Hours Worked": Number(s.hours.toFixed(2)),
        "Regular Hours": Number(s.regularHours.toFixed(2)),
        "Overtime Hours": Number(s.overtimeHours.toFixed(2)),
        Holiday: s.isHoliday ? "Yes" : "No",
        Pay: Number(s.pay.toFixed(2)),
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logRows), "Attendance Log");

    const settingsRows = [
      { Setting: "Monthly Salary", Value: settings.monthlySalary },
      { Setting: "Hours Per Workday", Value: settings.hoursPerDay },
      { Setting: "Standard Monthly Hours", Value: settings.standardMonthlyHours },
      { Setting: "Overtime Multiplier", Value: settings.overtimeMultiplier },
      { Setting: "Currency", Value: settings.currency },
      { Setting: "Holiday Days (0=Sun..6=Sat)", Value: settings.holidayDays.join(",") },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingsRows), "Settings");

    const byMonth = {};
    entries.forEach((e) => {
      const key = e.date.slice(0, 7);
      if (!byMonth[key]) byMonth[key] = { days: 0, regular: 0, overtime: 0, pay: 0 };
      const s = computeEntryStats(e, settings, now);
      byMonth[key].days += 1;
      byMonth[key].regular += s.regularHours;
      byMonth[key].overtime += s.overtimeHours;
      byMonth[key].pay += s.pay;
    });
    const summaryRows = Object.keys(byMonth).sort().map((key) => ({
      Month: key,
      "Days Logged": byMonth[key].days,
      "Regular Hours": Number(byMonth[key].regular.toFixed(2)),
      "Overtime Hours": Number(byMonth[key].overtime.toFixed(2)),
      "Total Pay": Number(byMonth[key].pay.toFixed(2)),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Monthly Summary");

    XLSX.writeFile(wb, "time-ledger.xlsx");
  }

  function importExcel(file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });

        if (wb.SheetNames.includes("Settings")) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets["Settings"]);
          const map = {};
          rows.forEach((r) => { map[r.Setting] = r.Value; });
          setSettings((prev) => ({
            monthlySalary: Number(map["Monthly Salary"] ?? prev.monthlySalary),
            hoursPerDay: Number(map["Hours Per Workday"] ?? prev.hoursPerDay),
            standardMonthlyHours: Number(map["Standard Monthly Hours"] ?? prev.standardMonthlyHours),
            overtimeMultiplier: Number(map["Overtime Multiplier"] ?? prev.overtimeMultiplier),
            currency: String(map["Currency"] ?? prev.currency),
            holidayDays: String(map["Holiday Days (0=Sun..6=Sat)"] ?? prev.holidayDays.join(","))
              .split(",").filter((x) => x !== "").map(Number),
          }));
        }

        if (wb.SheetNames.includes("Attendance Log")) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets["Attendance Log"]);
          const importedEntries = rows.filter((r) => r["Date"]).map((r) => {
            const date = String(r["Date"]);
            const clockIn = r["Clock In"] ? new Date(`${date}T${r["Clock In"]}:00`).toISOString() : null;
            const clockOut = r["Clock Out"] ? new Date(`${date}T${r["Clock Out"]}:00`).toISOString() : null;
            return { date, clockIn, clockOut };
          });
          setEntries(importedEntries);
          importedEntries.forEach((entry) => persistEntry(userId, entry).catch(console.error));
        }
      } catch (e) {
        console.error("Import failed", e);
        alert("That file could not be read. Make sure it's a Time Ledger export.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const currency = settings.currency;

  return (
    <div className="tl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        .tl-root {
          --ink: #1B1D22; --ink-soft: #24272E; --ink-line: #34383F;
          --brass: #C98A3B; --brass-soft: #E3B57C; --green: #6E9E76; --rust: #B5563E;
          --text: #ECE7DA; --text-dim: #9C9C90;
          --sans: 'IBM Plex Sans', system-ui, sans-serif; --mono: 'IBM Plex Mono', 'Courier New', monospace;
          background: var(--ink); color: var(--text); font-family: var(--sans);
          min-height: 100vh; padding: 28px 20px 60px; box-sizing: border-box;
        }
        .tl-root * { box-sizing: border-box; }
        .tl-wrap { max-width: 980px; margin: 0 auto; }
        .tl-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; flex-wrap: wrap; gap: 10px; }
        .tl-title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
        .tl-title span { color: var(--brass); }
        .tl-date { font-family: var(--mono); color: var(--text-dim); font-size: 13px; }
        .tl-top-actions { display: flex; gap: 8px; }
        .tl-gear { background: none; border: 1px solid var(--ink-line); color: var(--text-dim); border-radius: 8px; padding: 8px 10px; cursor: pointer; display:flex; align-items:center; gap:6px; font-family: var(--sans); font-size: 13px; }
        .tl-gear:hover { color: var(--text); border-color: var(--brass); }
        .tl-hero { background: var(--ink-soft); border: 1px solid var(--ink-line); border-radius: 14px; padding: 28px; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 18px; }
        .tl-clock { font-family: var(--mono); font-size: 44px; font-weight: 600; letter-spacing: 0.02em; line-height: 1; }
        .tl-clock-sub { color: var(--text-dim); font-size: 13px; margin-top: 8px; font-family: var(--mono); }
        .tl-punch-btn { border: none; border-radius: 10px; padding: 16px 30px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: var(--sans); display: flex; align-items: center; gap: 10px; }
        .tl-punch-in { background: var(--brass); color: #1B1D22; }
        .tl-punch-out { background: var(--green); color: #10140F; }
        .tl-punch-done { background: transparent; border: 1px solid var(--ink-line); color: var(--text-dim); }
        .tl-hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .tl-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .tl-stat { background: var(--ink-soft); border: 1px solid var(--ink-line); border-radius: 12px; padding: 16px; }
        .tl-stat-label { font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
        .tl-stat-value { font-family: var(--mono); font-size: 20px; font-weight: 600; }
        .tl-stat-value.brass { color: var(--brass-soft); }
        .tl-stat-value.green { color: var(--green); }
        .tl-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
        .tl-panel { background: var(--ink-soft); border: 1px solid var(--ink-line); border-radius: 12px; padding: 18px; }
        .tl-panel h3 { margin: 0 0 14px; font-size: 14px; font-weight: 600; color: var(--text); }
        .tl-settings { background: var(--ink-soft); border: 1px solid var(--ink-line); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .tl-settings h3 { margin: 0 0 16px; font-size: 15px; }
        .tl-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .tl-field label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 6px; }
        .tl-field input, .tl-field select { width: 100%; background: var(--ink); border: 1px solid var(--ink-line); color: var(--text); border-radius: 8px; padding: 9px 10px; font-family: var(--sans); font-size: 13px; }
        .tl-field input:focus { outline: none; border-color: var(--brass); }
        .tl-holidays { display: flex; gap: 6px; flex-wrap: wrap; }
        .tl-day-chip { border: 1px solid var(--ink-line); background: var(--ink); color: var(--text-dim); border-radius: 20px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
        .tl-day-chip.active { background: var(--rust); border-color: var(--rust); color: #fff; }
        .tl-log { background: var(--ink-soft); border: 1px solid var(--ink-line); border-radius: 12px; padding: 20px; }
        .tl-log-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
        .tl-log-top h3 { margin: 0; font-size: 15px; }
        .tl-actions { display: flex; gap: 8px; }
        .tl-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: 1px solid var(--ink-line); color: var(--text); border-radius: 8px; padding: 8px 12px; font-size: 13px; cursor: pointer; font-family: var(--sans); }
        .tl-btn:hover { border-color: var(--brass); }
        .tl-btn.primary { background: var(--brass); color: #1B1D22; border-color: var(--brass); font-weight: 600; }
        .tl-add-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr auto; gap: 10px; margin-bottom: 16px; align-items: end; }
        table.tl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.tl-table th { text-align: left; color: var(--text-dim); font-weight: 500; padding: 8px 10px; border-bottom: 1px solid var(--ink-line); font-size: 12px; }
        table.tl-table td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: var(--mono); }
        table.tl-table tr.holiday td { color: var(--rust); }
        .tl-del { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; }
        .tl-del:hover { color: var(--rust); }
        .tl-empty { color: var(--text-dim); font-size: 13px; padding: 20px 0; text-align: center; }
        .tl-note { color: var(--text-dim); font-size: 12px; margin-top: 10px; }
        @media (max-width: 720px) {
          .tl-stats { grid-template-columns: repeat(2, 1fr); }
          .tl-charts { grid-template-columns: 1fr; }
          .tl-add-row { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="tl-wrap">
        <div className="tl-top">
          <div>
            <p className="tl-title">Time <span>Ledger</span></p>
            <p className="tl-date">{DAY_NAMES[now.getDay()]}, {MONTH_NAMES[now.getMonth()]} {now.getDate()} {now.getFullYear()} · {session.user.email}</p>
          </div>
          <div className="tl-top-actions">
            <button className="tl-gear" onClick={() => setShowSettings((s) => !s)}>
              <Settings2 size={15} /> Salary &amp; hours
            </button>
            <button className="tl-gear" onClick={() => supabase.auth.signOut()}>
              <SignOutIcon size={15} /> Sign out
            </button>
          </div>
        </div>

        <div className="tl-hero">
          <div>
            <div className="tl-clock">{pad2(now.getHours())}:{pad2(now.getMinutes())}:{pad2(now.getSeconds())}</div>
            <div className="tl-clock-sub">
              {heroState === "in" && "Not clocked in yet today"}
              {heroState === "out" && `Clocked in at ${formatHM(new Date(todayEntry.clockIn))} \u00b7 ${fmtHours(heroElapsed)} elapsed`}
              {heroState === "done" && todayEntry && `Worked ${formatHM(new Date(todayEntry.clockIn))} \u2013 ${formatHM(new Date(todayEntry.clockOut))} today`}
            </div>
          </div>
          <div className="tl-hero-right">
            {heroState === "in" && (
              <button className="tl-punch-btn tl-punch-in" onClick={handleClockIn}><LogIn size={18} /> Clock in</button>
            )}
            {heroState === "out" && (
              <button className="tl-punch-btn tl-punch-out" onClick={handleClockOut}><LogOut size={18} /> Clock out</button>
            )}
            {heroState === "done" && (
              <button className="tl-punch-btn tl-punch-done" onClick={handleResume}><RotateCcw size={16} /> Resume today</button>
            )}
          </div>
        </div>

        <div className="tl-stats">
          <div className="tl-stat">
            <div className="tl-stat-label">Hours this month</div>
            <div className="tl-stat-value">{fmtHours(monthStats.totalRegularHours + monthStats.totalOvertimeHours)}</div>
          </div>
          <div className="tl-stat">
            <div className="tl-stat-label">Overtime logged</div>
            <div className="tl-stat-value" style={{ color: "var(--rust)" }}>{fmtHours(monthStats.totalOvertimeHours)}</div>
          </div>
          <div className="tl-stat">
            <div className="tl-stat-label">Earned so far</div>
            <div className="tl-stat-value green">{currency} {monthStats.totalPay.toFixed(0)}</div>
          </div>
          <div className="tl-stat">
            <div className="tl-stat-label">Projected month total</div>
            <div className="tl-stat-value brass">{currency} {monthStats.projectedTotal.toFixed(0)}</div>
          </div>
        </div>

        <div className="tl-charts">
          <div className="tl-panel">
            <h3>Daily hours — {MONTH_NAMES[curMonthIdx]}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthStats.chartData} barGap={0} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#34383F" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#9C9C90", fontSize: 11 }} axisLine={{ stroke: "#34383F" }} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "#9C9C90", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1B1D22", border: "1px solid #34383F", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#ECE7DA" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="regularHours" stackId="h" fill="#C98A3B" name="Regular" />
                <Bar dataKey="overtimeHours" stackId="h" fill="#B5563E" name="Overtime" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="tl-panel">
            <h3>Cumulative pay — {MONTH_NAMES[curMonthIdx]}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#34383F" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#9C9C90", fontSize: 11 }} axisLine={{ stroke: "#34383F" }} tickLine={false} interval={2} />
                <YAxis tick={{ fill: "#9C9C90", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1B1D22", border: "1px solid #34383F", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#ECE7DA" }} formatter={(v) => [`${currency} ${v}`, "Pay"]} />
                <Line type="monotone" dataKey="cumulativePay" stroke="#6E9E76" strokeWidth={2} dot={false} name="Pay" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {showSettings && (
          <div className="tl-settings">
            <h3>Salary &amp; work hours</h3>
            <div className="tl-grid2">
              <div className="tl-field">
                <label>Monthly salary</label>
                <input type="number" value={settings.monthlySalary} onChange={(e) => setSettings((s) => ({ ...s, monthlySalary: Number(e.target.value) }))} />
              </div>
              <div className="tl-field">
                <label>Currency</label>
                <input type="text" value={settings.currency} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))} />
              </div>
              <div className="tl-field">
                <label>Hours per workday</label>
                <input type="number" value={settings.hoursPerDay} onChange={(e) => setSettings((s) => ({ ...s, hoursPerDay: Number(e.target.value) }))} />
              </div>
              <div className="tl-field">
                <label>Standard hours per month</label>
                <input type="number" value={settings.standardMonthlyHours} onChange={(e) => setSettings((s) => ({ ...s, standardMonthlyHours: Number(e.target.value) }))} />
              </div>
              <div className="tl-field">
                <label>Overtime multiplier</label>
                <input type="number" step="0.1" value={settings.overtimeMultiplier} onChange={(e) => setSettings((s) => ({ ...s, overtimeMultiplier: Number(e.target.value) }))} />
              </div>
              <div className="tl-field">
                <label>Holiday days (count as overtime)</label>
                <div className="tl-holidays">
                  {DAY_NAMES.map((name, idx) => (
                    <div key={name} className={`tl-day-chip ${settings.holidayDays.includes(idx) ? "active" : ""}`}
                      onClick={() => setSettings((s) => ({
                        ...s,
                        holidayDays: s.holidayDays.includes(idx) ? s.holidayDays.filter((d) => d !== idx) : [...s.holidayDays, idx],
                      }))}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="tl-note">Hourly rate is derived as monthly salary ÷ standard hours per month, currently {currency} {monthStats.hourlyRate.toFixed(2)}/hr. Changes save automatically to your account.</p>
          </div>
        )}

        <div className="tl-log">
          <div className="tl-log-top">
            <h3>Attendance log — {MONTH_NAMES[curMonthIdx]} {curYear}</h3>
            <div className="tl-actions">
              <button className="tl-btn" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Import Excel</button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) importExcel(e.target.files[0]); e.target.value = ""; }} />
              <button className="tl-btn primary" onClick={exportExcel}><Download size={14} /> Export Excel</button>
            </div>
          </div>

          <div className="tl-add-row">
            <div className="tl-field">
              <label>Date</label>
              <input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            </div>
            <div className="tl-field">
              <label>Clock in</label>
              <input type="time" value={draft.clockIn} onChange={(e) => setDraft((d) => ({ ...d, clockIn: e.target.value }))} />
            </div>
            <div className="tl-field">
              <label>Clock out</label>
              <input type="time" value={draft.clockOut} onChange={(e) => setDraft((d) => ({ ...d, clockOut: e.target.value }))} />
            </div>
            <button className="tl-btn" onClick={handleSaveDraft}><Plus size={14} /> Add entry</button>
          </div>

          {monthEntries.length === 0 ? (
            <div className="tl-empty">No entries yet this month. Clock in above, or add one manually.</div>
          ) : (
            <table className="tl-table">
              <thead>
                <tr><th>Date</th><th>Day</th><th>In</th><th>Out</th><th>Hours</th><th>Regular</th><th>Overtime</th><th>Pay</th><th></th></tr>
              </thead>
              <tbody>
                {monthEntries.map((e) => {
                  const s = computeEntryStats(e, settings, now);
                  return (
                    <tr key={e.date} className={s.isHoliday ? "holiday" : ""}>
                      <td>{e.date}</td>
                      <td>{DAY_NAMES[dayOfWeekForDateStr(e.date)]}</td>
                      <td>{e.clockIn ? formatHM(new Date(e.clockIn)) : "\u2014"}</td>
                      <td>{e.clockOut ? formatHM(new Date(e.clockOut)) : (s.ongoing ? "running" : "\u2014")}</td>
                      <td>{fmtHours(s.hours)}</td>
                      <td>{fmtHours(s.regularHours)}</td>
                      <td>{fmtHours(s.overtimeHours)}</td>
                      <td>{currency} {s.pay.toFixed(0)}</td>
                      <td><button className="tl-del" onClick={() => handleDelete(e.date)}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="tl-note">Rows tinted red are holidays (Friday &amp; Saturday by default) — any hours logged there count fully as overtime. On workdays, hours beyond your set hours-per-day also count as overtime.</p>
        </div>
      </div>
    </div>
  );
}

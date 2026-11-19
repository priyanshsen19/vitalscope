#!/usr/bin/env node
/**
 * Converts the public LifeSnaps daily CSV into Vitalscope's daily format.
 *
 *   node scripts/import-lifesnaps.mjs <path/to/daily_fitbit_sema_df_unprocessed.csv>
 *
 * Source: LifeSnaps (Yfantidou et al.), Zenodo, DOI 10.5281/zenodo.7229547, licence CC BY 4.0.
 * The CSV is inside rais_anonymized.zip → rais_anonymized/csv_rais_anonymized/.
 *
 * Selection rule (fixed, not chosen by looking at results): the participant and the
 * 90-day window with the most days that have resting HR, HRV, sleep and steps all present.
 * Values are copied as recorded — no smoothing, no filling of gaps. Only unit conversions.
 * Demographic columns (age, gender, BMI) are deliberately not copied.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WINDOW = 90;
const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-lifesnaps.mjs <daily_fitbit_sema_df_unprocessed.csv>");
  process.exit(1);
}
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/real/lifesnaps.json");

/** Minimal RFC-4180 CSV parser (handles quoted fields with commas/quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = (v) => {
  if (v === undefined || v === "" || v.toLowerCase() === "nan") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const round = (v, d) => (v === undefined ? undefined : Math.round(v * 10 ** d) / 10 ** d);

/** LifeSnaps column → Vitalscope metric. Each entry documents its conversion. */
const MAP = {
  restingHr: { col: "resting_hr", conv: (v) => round(v, 1), note: "Fitbit resting heart rate (bpm)" },
  hrv: { col: "rmssd", conv: (v) => round(v, 1), note: "Fitbit nightly HRV, RMSSD (ms)" },
  avgHr: { col: "bpm", conv: (v) => round(v, 1), note: "Mean of the day's heart-rate samples (bpm)" },
  vo2Max: { col: "filteredDemographicVO2Max", conv: (v) => round(v, 1), note: "Fitbit cardio fitness estimate (ml/kg/min)" },
  respRate: { col: "full_sleep_breathing_rate", conv: (v) => round(v, 1), note: "Fitbit breathing rate, measured during sleep (breaths/min)" },
  sleepDuration: { col: "minutesAsleep", conv: (v) => round(v / 60, 2), note: "Minutes asleep ÷ 60 (hours)" },
  sleepEfficiency: { col: "sleep_efficiency", conv: (v) => round(v, 1), note: "Fitbit sleep efficiency (%)" },
  steps: { col: "steps", conv: (v) => Math.round(v), note: "Daily steps" },
  walkingDistance: { col: "distance", conv: (v) => round(v / 1000, 2), note: "Fitbit distance in metres ÷ 1000 (km)" },
  exerciseMinutes: { col: null, note: "Fitbit moderately + very active minutes" },
};

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const byId = new Map();
for (const r of rows) {
  if (!r.id || !r.date) continue;
  if (!byId.has(r.id)) byId.set(r.id, new Map());
  byId.get(r.id).set(r.date.slice(0, 10), r);
}

const CORE = ["resting_hr", "rmssd", "minutesAsleep", "steps"];
const complete = (r) => !!r && CORE.every((c) => num(r[c]) !== undefined);
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

let best = null;
for (const [id, days] of byId) {
  const dates = [...days.keys()].sort();
  for (let s = dates[0]; s <= addDays(dates[dates.length - 1], -(WINDOW - 1)); s = addDays(s, 1)) {
    let n = 0;
    for (let i = 0; i < WINDOW; i++) if (complete(days.get(addDays(s, i)))) n++;
    if (!best || n > best.n || (n === best.n && id < best.id)) best = { id, start: s, n };
  }
}
if (!best) throw new Error("No participant has a full window.");

const days = byId.get(best.id);
const records = [];
for (let i = 0; i < WINDOW; i++) {
  const date = addDays(best.start, i);
  const r = days.get(date);
  const v = {};
  if (r) {
    for (const [key, m] of Object.entries(MAP)) {
      if (!m.col) continue;
      const x = num(r[m.col]);
      if (x !== undefined) v[key] = m.conv(x);
    }
    const mod = num(r.moderately_active_minutes), very = num(r.very_active_minutes);
    if (mod !== undefined || very !== undefined) v.exerciseMinutes = (mod ?? 0) + (very ?? 0);
    // A Fitbit day with no sleep record reports sleep efficiency only when minutesAsleep exists.
    if (v.sleepDuration === 0) { delete v.sleepDuration; delete v.sleepEfficiency; }
  }
  records.push({ date, v });
}

const available = Object.keys(MAP).filter((k) => records.some((d) => d.v[k] !== undefined));
const coverage = Object.fromEntries(available.map((k) => [k, records.filter((d) => d.v[k] !== undefined).length]));

const out = {
  provenance: {
    dataset: "LifeSnaps",
    title: "LifeSnaps: a 4-month multi-modal dataset capturing unobtrusive snapshots of our lives in the wild",
    authors: "Yfantidou, S., Karagianni, C., Efstathiou, S., Vakali, A., Palotti, J., Giakatos, D. P., et al.",
    year: 2022,
    doi: "10.5281/zenodo.7229547",
    url: "https://zenodo.org/records/7229547",
    licence: "CC BY 4.0",
    device: "Fitbit Sense",
    file: "rais_anonymized/csv_rais_anonymized/daily_fitbit_sema_df_unprocessed.csv",
    participant: best.id.slice(0, 8),
    selection: `Participant and ${WINDOW}-day window with the most days having resting HR, HRV, sleep and steps all recorded (${best.n} of ${WINDOW}).`,
    completeDays: best.n,
    mapping: Object.fromEntries(Object.entries(MAP).filter(([k]) => available.includes(k)).map(([k, m]) => [k, { column: m.col ?? "moderately_active_minutes + very_active_minutes", note: m.note }])),
    coverage,
  },
  startDate: records[0].date,
  endDate: records[records.length - 1].date,
  available,
  days: records,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out) + "\n");
console.log(`Participant ${best.id.slice(0, 8)} · ${out.startDate} → ${out.endDate} · ${best.n}/${WINDOW} complete days`);
console.log("Coverage:", coverage);
console.log("Wrote", outPath);

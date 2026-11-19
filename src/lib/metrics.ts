import type { MetricKey, MetricMeta, UnitPref } from "@/types/health";

type Def = Omit<MetricMeta, "key">;
const D = (d: Def): Def => d;

const defs: Record<MetricKey, Def> = {
  restingHr: D({ label: "Resting heart rate", short: "Resting HR", unit: "bpm", decimals: 1, category: "cardio", sources: ["apple"], better: "lower", description: "Lowest sustained heart rate while at rest." }),
  avgHr: D({ label: "Average heart rate", short: "Avg HR", unit: "bpm", decimals: 1, category: "cardio", sources: ["apple", "temple"], better: "neutral", description: "Mean daily heart rate." }),
  hrv: D({ label: "Heart rate variability", short: "HRV", unit: "ms", decimals: 1, category: "cardio", sources: ["apple", "temple"], better: "higher", description: "Beat-to-beat variability (SDNN-style, simulated)." }),
  workoutHr: D({ label: "Workout heart rate", short: "Workout HR", unit: "bpm", decimals: 0, category: "cardio", sources: ["apple"], better: "neutral", description: "Mean heart rate during workouts." }),
  hrRecovery: D({ label: "Heart rate recovery", short: "HR recovery", unit: "bpm", decimals: 1, category: "cardio", sources: ["apple"], better: "higher", description: "Heart rate drop one minute after a workout." }),
  vo2Max: D({ label: "VO2 Max (estimate)", short: "VO2 Max", unit: "ml/kg/min", decimals: 1, category: "cardio", sources: ["apple"], better: "higher", description: "Estimated maximal oxygen uptake." }),
  respRate: D({ label: "Respiratory rate", short: "Resp. rate", unit: "br/min", decimals: 1, category: "respiratory", sources: ["apple", "temple"], better: "lower", description: "Breaths per minute, daily average." }),
  sleepRespRate: D({ label: "Sleep respiratory rate", short: "Sleep resp.", unit: "br/min", decimals: 1, category: "respiratory", sources: ["apple"], better: "neutral", description: "Breaths per minute during sleep." }),
  sleepDuration: D({ label: "Sleep duration", short: "Sleep", unit: "h", decimals: 2, category: "sleep", sources: ["apple"], better: "higher", description: "Total time asleep." }),
  remDuration: D({ label: "REM sleep", short: "REM", unit: "h", decimals: 2, category: "sleep", sources: ["apple"], better: "neutral", description: "Time in REM sleep." }),
  deepDuration: D({ label: "Deep sleep", short: "Deep", unit: "h", decimals: 2, category: "sleep", sources: ["apple"], better: "higher", description: "Time in deep sleep." }),
  coreDuration: D({ label: "Core sleep", short: "Core", unit: "h", decimals: 2, category: "sleep", sources: ["apple"], better: "neutral", description: "Time in core (light) sleep." }),
  sleepEfficiency: D({ label: "Sleep efficiency", short: "Sleep eff.", unit: "%", decimals: 1, category: "sleep", sources: ["apple"], better: "higher", description: "Share of time in bed spent asleep." }),
  sleepConsistency: D({ label: "Sleep consistency", short: "Consistency", unit: "score", decimals: 0, category: "sleep", sources: ["apple"], better: "higher", description: "Regularity of sleep and wake times (0–100)." }),
  steps: D({ label: "Steps", short: "Steps", unit: "steps", decimals: 0, category: "activity", sources: ["apple"], better: "higher", description: "Daily step count." }),
  activeEnergy: D({ label: "Active energy", short: "Active energy", unit: "kcal", decimals: 0, category: "activity", sources: ["apple"], better: "higher", description: "Energy expended through activity." }),
  exerciseMinutes: D({ label: "Exercise minutes", short: "Exercise", unit: "min", decimals: 0, category: "activity", sources: ["apple"], better: "higher", description: "Minutes of brisk activity." }),
  walkingDistance: D({ label: "Walking distance", short: "Distance", unit: "km", decimals: 2, category: "activity", sources: ["apple"], better: "higher", description: "Walking and running distance." }),
  workoutDuration: D({ label: "Workout duration", short: "Workout", unit: "min", decimals: 0, category: "activity", sources: ["apple"], better: "neutral", description: "Duration of logged workouts (workout days only)." }),
  workoutIntensity: D({ label: "Workout intensity", short: "Intensity", unit: "RPE", decimals: 1, category: "activity", sources: ["apple"], better: "neutral", description: "Perceived exertion 1–10 (workout days only)." }),
  walkingSpeed: D({ label: "Walking speed", short: "Walking speed", unit: "m/s", decimals: 2, category: "mobility", sources: ["apple"], better: "higher", description: "Average speed on flat ground." }),
  stepLength: D({ label: "Step length", short: "Step length", unit: "cm", decimals: 1, category: "mobility", sources: ["apple"], better: "higher", description: "Average distance between consecutive steps." }),
  walkingAsymmetry: D({ label: "Walking asymmetry", short: "Asymmetry", unit: "%", decimals: 1, category: "mobility", sources: ["apple"], better: "lower", description: "Share of steps where left and right timing differ." }),
  doubleSupport: D({ label: "Double support time", short: "Double support", unit: "%", decimals: 1, category: "mobility", sources: ["apple"], better: "lower", description: "Share of the gait cycle with both feet on the ground." }),
  stairAscent: D({ label: "Stair ascent speed", short: "Stair ascent", unit: "m/s", decimals: 2, category: "mobility", sources: ["apple"], better: "higher", description: "Vertical speed climbing stairs." }),
  stairDescent: D({ label: "Stair descent speed", short: "Stair descent", unit: "m/s", decimals: 2, category: "mobility", sources: ["apple"], better: "higher", description: "Vertical speed descending stairs." }),
  daylight: D({ label: "Daylight exposure", short: "Daylight", unit: "min", decimals: 0, category: "environment", sources: ["apple"], better: "higher", description: "Time spent in daylight." }),
  noise: D({ label: "Environmental noise", short: "Noise", unit: "dB", decimals: 0, category: "environment", sources: ["apple"], better: "lower", description: "Average environmental sound level." }),
  brainFlow: D({ label: "BrainFlow Index", short: "BrainFlow", unit: "index", decimals: 1, category: "temple", sources: ["temple"], better: "neutral", templeSimulated: true, description: "Simulated Temple-compatible exploratory index. Not a clinical or cognitive measurement." }),
  entropy: D({ label: "Entropy", short: "Entropy", unit: "a.u.", decimals: 3, category: "temple", sources: ["temple"], better: "neutral", templeSimulated: true, description: "Simulated Temple-compatible signal-complexity measure (arbitrary units). Not a clinical measurement." }),
  reactionTime: D({ label: "Reaction time", short: "Reaction", unit: "ms", decimals: 0, category: "cognitive", sources: ["manual"], better: "lower", description: "Median result of a short self-administered reaction test." }),
  energy: D({ label: "Self-reported energy", short: "Energy", unit: "/10", decimals: 1, category: "cognitive", sources: ["manual"], better: "higher", description: "Daily self-report (1–10)." }),
  mentalFatigue: D({ label: "Mental fatigue", short: "Mental fatigue", unit: "/10", decimals: 1, category: "cognitive", sources: ["manual"], better: "lower", description: "Daily self-report (1–10)." }),
};

export const METRICS: Record<MetricKey, MetricMeta> = Object.fromEntries(
  (Object.keys(defs) as MetricKey[]).map((k) => [k, { key: k, ...defs[k] }]),
) as Record<MetricKey, MetricMeta>;

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export function metricsByCategory(cat: MetricMeta["category"]): MetricMeta[] {
  return METRIC_KEYS.filter((k) => METRICS[k].category === cat).map((k) => METRICS[k]);
}

/* ---------- Unit conversion (display only; analytics stay in metric units) ---------- */

export function displayUnit(key: MetricKey, units: UnitPref): string {
  const base = METRICS[key].unit;
  if (units === "metric") return base;
  if (key === "walkingDistance") return "mi";
  if (key === "stepLength") return "in";
  if (key === "walkingSpeed") return "mph";
  if (key === "stairAscent" || key === "stairDescent") return "ft/s";
  return base;
}

export function toDisplay(key: MetricKey, v: number, units: UnitPref): number {
  if (units === "metric") return v;
  if (key === "walkingDistance") return v * 0.621371;
  if (key === "stepLength") return v / 2.54;
  if (key === "walkingSpeed") return v * 2.23694;
  if (key === "stairAscent" || key === "stairDescent") return v * 3.28084;
  return v;
}

export function displayDecimals(key: MetricKey, units: UnitPref): number {
  const d = METRICS[key].decimals;
  if (units === "imperial" && (key === "stepLength" || key === "walkingSpeed")) return key === "stepLength" ? 1 : 2;
  return d;
}

export function formatMetric(key: MetricKey, v: number | null | undefined, units: UnitPref = "metric", withUnit = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (key === "sleepDuration" || key === "remDuration" || key === "deepDuration" || key === "coreDuration") {
    return formatHours(v);
  }
  const dv = toDisplay(key, v, units);
  const s = dv.toLocaleString("en-US", { minimumFractionDigits: displayDecimals(key, units), maximumFractionDigits: displayDecimals(key, units) });
  return withUnit ? `${s} ${displayUnit(key, units)}` : s;
}

export function formatHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export function formatPct(p: number | null | undefined, digits = 1, signed = true): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  const s = Math.abs(p).toFixed(digits);
  if (!signed) return `${s}%`;
  return `${p > 0 ? "+" : p < 0 ? "−" : ""}${s}%`;
}

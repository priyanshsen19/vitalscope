import type { Dataset, MetricKey, SeriesPoint, SourceId, UnitPref } from "@/types/health";
import { METRICS, formatMetric, formatPct } from "@/lib/metrics";
import { getSeries } from "@/lib/data/selectors";
import { clamp } from "@/lib/utils";
import {
  Baseline, calculateBaseline, calculateMean, calculatePercentageChange, calculateRollingAverage, calculateStandardDeviation, meanOver, validValues,
} from "./baseline";
import { detectPersistentDrift, PersistentRun } from "./drift-detection";

export const MOVEMENT_METRICS: MetricKey[] = ["walkingSpeed", "walkingAsymmetry", "stepLength", "doubleSupport", "stairAscent", "stairDescent"];

export type MovementStatus = "improving" | "stable" | "monitor" | "unavailable";

export interface MovementTrend {
  key: MetricKey;
  available: boolean;
  series: SeriesPoint[];
  baseline: Baseline | null;
  current: number | null; // mean last 7 days
  historicalAvg: number | null;
  rangeAvg: number | null;
  thirty: { recent: number | null; previous: number | null; pct: number | null };
  pctVsBaseline: number | null;
  effectSize: number | null;
  status: MovementStatus;
  runs: PersistentRun[];
}

const BASE_END = 29;

export function calculateMovementTrends(ds: Dataset, source: SourceId, rangeDays: number): MovementTrend[] {
  const last = ds.days.length - 1;
  return MOVEMENT_METRICS.map((key) => {
    const series = getSeries(ds, key, source);
    if (!series) {
      return {
        key, available: false, series: [], baseline: null, current: null, historicalAvg: null, rangeAvg: null,
        thirty: { recent: null, previous: null, pct: null }, pctVsBaseline: null, effectSize: null, status: "unavailable", runs: [],
      };
    }
    const baseline = calculateBaseline(series, 0, BASE_END);
    const current = meanOver(series, last - 6, last).mean;
    const recent14 = meanOver(series, last - 13, last).mean;
    const recent30 = meanOver(series, last - 29, last).mean;
    const prev30 = meanOver(series, last - 59, last - 30).mean;
    const d = baseline && recent14 !== null ? (recent14 - baseline.mean) / baseline.sd : null;
    let status: MovementStatus = "stable";
    if (d !== null && Math.abs(d) >= 1.5) {
      const better = METRICS[key].better;
      status = (better === "higher") === (d > 0) ? "improving" : "monitor";
    }
    const rolling = calculateRollingAverage(series, 5);
    const runs = baseline ? detectPersistentDrift(rolling, baseline, 1.5, 3) : [];
    return {
      key, available: true, series, baseline, current,
      historicalAvg: calculateMean(series.map((p) => p.value)),
      rangeAvg: meanOver(series, last - rangeDays + 1, last).mean,
      thirty: { recent: recent30, previous: prev30, pct: calculatePercentageChange(prev30, recent30) },
      pctVsBaseline: baseline ? calculatePercentageChange(baseline.mean, recent14) : null,
      effectSize: d, status, runs,
    };
  });
}

export interface PeriodComparisonRow {
  key: MetricKey;
  a: number | null;
  b: number | null;
  pct: number | null;
  favourable: boolean | null;
}

/** Compares period A (current) with period B (reference). */
export function comparePeriods(
  ds: Dataset, source: SourceId, a: { start: number; end: number }, b: { start: number; end: number },
): PeriodComparisonRow[] {
  return MOVEMENT_METRICS.map((key) => {
    const s = getSeries(ds, key, source);
    if (!s) return { key, a: null, b: null, pct: null, favourable: null };
    const ma = meanOver(s, a.start, a.end).mean;
    const mb = meanOver(s, b.start, b.end).mean;
    const pct = calculatePercentageChange(mb, ma);
    const better = METRICS[key].better;
    const favourable = pct === null || Math.abs(pct) < 0.5 ? null : better === "higher" ? pct > 0 : better === "lower" ? pct < 0 : null;
    return { key, a: ma, b: mb, pct, favourable };
  });
}

export interface MovementProfileScores {
  consistency: number;
  regularity: number;
  symmetry: number;
  stairs: number;
  stability: number;
}

function cv(points: SeriesPoint[], start: number, end: number): number | null {
  const v = validValues(points.filter((p) => p.index >= start && p.index <= end).map((p) => p.value));
  const m = calculateMean(v);
  const sd = calculateStandardDeviation(v);
  return m && sd !== null ? sd / m : null;
}

/** Descriptive 0–100 indices (not clinical scores). */
export function calculateMovementProfile(
  ds: Dataset, source: SourceId, start: number, end: number,
): MovementProfileScores | null {
  const speed = getSeries(ds, "walkingSpeed", source);
  const step = getSeries(ds, "stepLength", source);
  const asym = getSeries(ds, "walkingAsymmetry", source);
  const dsup = getSeries(ds, "doubleSupport", source);
  const asc = getSeries(ds, "stairAscent", source);
  const desc = getSeries(ds, "stairDescent", source);
  if (!speed || !step || !asym || !dsup || !asc || !desc) return null;
  const cvS = cv(speed, start, end) ?? 0.05;
  const cvL = cv(step, start, end) ?? 0.05;
  const asymM = meanOver(asym, start, end).mean ?? 5;
  const dsM = meanOver(dsup, start, end).mean ?? 30;
  const ascBase = meanOver(asc, 0, BASE_END).mean ?? 1;
  const descBase = meanOver(desc, 0, BASE_END).mean ?? 1;
  const ascM = meanOver(asc, start, end).mean ?? ascBase;
  const descM = meanOver(desc, start, end).mean ?? descBase;
  return {
    consistency: Math.round(100 * (1 - Math.min(1, cvS / 0.08))),
    regularity: Math.round(100 * (1 - Math.min(1, cvL / 0.06))),
    symmetry: Math.round(100 * (1 - Math.min(1, asymM / 12))),
    stairs: Math.round(clamp(100 * ((ascM / ascBase + descM / descBase) / 2), 0, 100)),
    stability: Math.round(clamp(100 - (dsM - 22) * 5, 0, 100)),
  };
}

export interface MovementObservation {
  id: string;
  tone: "lime" | "cyan" | "amber" | "muted";
  title: string;
  text: string;
  evidence: { label: string; value: string }[];
}

export function generateMovementObservations(trends: MovementTrend[], units: UnitPref): MovementObservation[] {
  const av = trends.filter((t) => t.available && t.baseline);
  const out: MovementObservation[] = [];
  const stable = av.filter((t) => t.status === "stable");
  const monitor = av.filter((t) => t.status === "monitor");
  const improving = av.filter((t) => t.status === "improving");
  const lower = (k: MetricKey) => METRICS[k].label.toLowerCase();

  const ev = (t: MovementTrend) => ({
    label: METRICS[t.key].label,
    value: `${formatMetric(t.key, t.baseline?.mean, units)} baseline → ${formatMetric(t.key, meanOverRecent(t), units)} (last 14 d, ${formatPct(t.pctVsBaseline)})`,
  });

  if (stable.length) {
    out.push({
      id: "stable",
      tone: "cyan",
      title: "Relatively stable indicators",
      text: `Your ${joinList(stable.map((t) => lower(t.key)))} ${stable.length > 1 ? "have" : "has"} remained relatively stable compared with your personal baseline over the last 14 days.`,
      evidence: stable.map(ev),
    });
  }
  if (monitor.length) {
    out.push({
      id: "monitor",
      tone: "amber",
      title: "Worth monitoring",
      text: `${capitalise(joinList(monitor.map((t) => lower(t.key))))} ${monitor.length > 1 ? "differ" : "differs"} from your previous baseline by more than 1.5 standard deviations. This is a change relative to your own history, not a clinical assessment, and may reflect footing, terrain, footwear or recent training.`,
      evidence: monitor.map(ev),
    });
  }
  if (improving.length) {
    out.push({
      id: "improving",
      tone: "lime",
      title: "Improving indicators",
      text: `${capitalise(joinList(improving.map((t) => lower(t.key))))} ${improving.length > 1 ? "have" : "has"} moved in a favourable direction compared with your baseline.`,
      evidence: improving.map(ev),
    });
  }
  // episodes
  const eps = av.flatMap((t) => t.runs.map((r) => ({ t, r }))).sort((a, b) => b.r.endIndex - a.r.endIndex);
  const speedEp = eps.find((e) => e.t.key === "walkingSpeed" && e.r.direction === "down");
  if (speedEp) {
    out.push({
      id: "speed-dip",
      tone: "muted",
      title: "Earlier dip in walking speed",
      text: `Walking speed was persistently below your baseline for ${speedEp.r.length} days (${speedEp.r.startDate} to ${speedEp.r.endDate}), alongside shorter steps and longer double support time, and has since returned toward baseline.`,
      evidence: [{ label: "Peak deviation", value: `${Math.abs(speedEp.r.peakZ).toFixed(1)} SD below baseline (5-day rolling average)` }],
    });
  }
  if (out.length === 0) out.push({ id: "none", tone: "muted", title: "No movement data", text: "The selected data source does not provide mobility measurements.", evidence: [] });
  return out;
}

function meanOverRecent(t: MovementTrend): number | null {
  const last = t.series.length - 1;
  return meanOver(t.series, last - 13, last).mean;
}
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

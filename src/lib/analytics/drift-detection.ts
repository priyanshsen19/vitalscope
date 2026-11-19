import type { Dataset, MetricKey, SeriesPoint, SourceId } from "@/types/health";
import { getSeries } from "@/lib/data/selectors";
import {
  Baseline, calculateBaseline, calculateMean, calculatePercentageChange, calculateRollingAverage, calculateZScore, meanOver,
} from "./baseline";

export interface DriftConfig {
  /** Deviation threshold in baseline standard deviations. */
  sdThreshold: number;
  /** Consecutive daily observations required. */
  persistence: number;
  /** Rolling average window in days. */
  rollingWindow: number;
  baselineStart: number;
  baselineEnd: number;
  /** Number of metrics that must deviate together for a multi-signal pattern. */
  minSignals: number;
}

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  sdThreshold: 1.5,
  persistence: 3,
  rollingWindow: 5,
  baselineStart: 0,
  baselineEnd: 29,
  minSignals: 2,
};

export const DRIFT_METRICS: { key: MetricKey; adverse: "up" | "down" }[] = [
  { key: "restingHr", adverse: "up" },
  { key: "hrv", adverse: "down" },
  { key: "respRate", adverse: "up" },
  { key: "sleepEfficiency", adverse: "down" },
];

export interface PersistentRun {
  direction: "up" | "down";
  startIndex: number;
  endIndex: number;
  length: number;
  peakZ: number;
  startDate: string;
  endDate: string;
}

/**
 * Finds runs where the rolling average stays beyond `threshold` SDs of the baseline for
 * at least `persistence` consecutive daily observations. Works in both directions.
 */
export function detectPersistentDrift(
  rolling: SeriesPoint[],
  baseline: Baseline,
  threshold: number,
  persistence: number,
): PersistentRun[] {
  const runs: PersistentRun[] = [];
  let cur: { dir: "up" | "down"; start: number; peak: number } | null = null;

  const close = (endIdx: number) => {
    if (!cur) return;
    const length = endIdx - cur.start + 1;
    if (length >= persistence) {
      runs.push({
        direction: cur.dir,
        startIndex: cur.start,
        endIndex: endIdx,
        length,
        peakZ: cur.peak,
        startDate: rolling[cur.start].date,
        endDate: rolling[endIdx].date,
      });
    }
    cur = null;
  };

  for (let i = 0; i < rolling.length; i++) {
    const z = calculateZScore(rolling[i].value, baseline.mean, baseline.sd);
    const dir: "up" | "down" | null = z === null ? null : z >= threshold ? "up" : z <= -threshold ? "down" : null;
    if (dir && cur && cur.dir === dir) {
      cur.peak = Math.abs(z as number) > Math.abs(cur.peak) ? (z as number) : cur.peak;
    } else {
      close(i - 1);
      if (dir) cur = { dir, start: i, peak: z as number };
    }
  }
  close(rolling.length - 1);
  return runs;
}

export type DriftStatus = "drifting" | "building" | "favourable" | "stable" | "unavailable";

export interface MetricDrift {
  key: MetricKey;
  adverse: "up" | "down";
  available: boolean;
  series: SeriesPoint[];
  rolling: SeriesPoint[];
  baseline: Baseline | null;
  currentRolling: number | null;
  zScore: number | null;
  pctDeviation: number | null;
  rangeAvg: number | null;
  rangePctDeviation: number | null;
  trend: "up" | "down" | "flat";
  status: DriftStatus;
  runs: PersistentRun[];
  adverseRuns: PersistentRun[];
  /** Days where the raw value was ≥ 2 SD adverse but not part of a persistent run. */
  isolatedOutliers: string[];
}

export function analyseMetricDrift(
  ds: Dataset,
  key: MetricKey,
  adverse: "up" | "down",
  source: SourceId,
  cfg: DriftConfig,
  rangeDays: number,
): MetricDrift {
  const series = getSeries(ds, key, source);
  const empty: MetricDrift = {
    key, adverse, available: false, series: [], rolling: [], baseline: null, currentRolling: null, zScore: null, pctDeviation: null,
    rangeAvg: null, rangePctDeviation: null, trend: "flat", status: "unavailable", runs: [], adverseRuns: [], isolatedOutliers: [],
  };
  if (!series) return empty;
  const baseline = calculateBaseline(series, cfg.baselineStart, cfg.baselineEnd);
  const rolling = calculateRollingAverage(series, cfg.rollingWindow);
  if (!baseline) return { ...empty, available: true, series, rolling, status: "stable" };

  const runs = detectPersistentDrift(rolling, baseline, cfg.sdThreshold, cfg.persistence);
  const adverseDir = adverse;
  const adverseRuns = runs.filter((r) => r.direction === adverseDir);
  const last = ds.days.length - 1;
  const currentRolling = rolling[last].value;
  const zScore = calculateZScore(currentRolling, baseline.mean, baseline.sd);
  const pctDeviation = calculatePercentageChange(baseline.mean, currentRolling);
  const rangeAvg = meanOver(series, last - rangeDays + 1, last).mean;
  const rangePctDeviation = calculatePercentageChange(baseline.mean, rangeAvg);

  // trend: rolling now vs 7 days ago, relative to baseline SD
  const prev = rolling[Math.max(0, last - 7)].value;
  let trend: MetricDrift["trend"] = "flat";
  if (currentRolling !== null && prev !== null) {
    const delta = (currentRolling - prev) / baseline.sd;
    trend = delta > 0.35 ? "up" : delta < -0.35 ? "down" : "flat";
  }

  // status at the latest observation
  let status: DriftStatus = "stable";
  const tail = runs.find((r) => r.endIndex === last);
  if (tail) status = tail.direction === adverseDir ? "drifting" : "favourable";
  else if (zScore !== null && Math.abs(zScore) >= cfg.sdThreshold) status = (zScore > 0) === (adverseDir === "up") ? "building" : "stable";

  // single-day outliers
  const inRun = new Set<number>();
  runs.forEach((r) => { for (let i = r.startIndex; i <= r.endIndex; i++) inRun.add(i); });
  const isolated: string[] = [];
  series.forEach((p) => {
    const z = calculateZScore(p.value, baseline.mean, baseline.sd);
    if (z !== null && !inRun.has(p.index) && (adverseDir === "up" ? z >= 2 : z <= -2) && p.index > cfg.baselineEnd) isolated.push(p.date);
  });

  return {
    key, adverse, available: true, series, rolling, baseline, currentRolling, zScore, pctDeviation, rangeAvg, rangePctDeviation,
    trend, status, runs, adverseRuns, isolatedOutliers: isolated,
  };
}

export interface DriftEpisodeMetric {
  key: MetricKey;
  baselineMean: number;
  episodeMean: number;
  pctChange: number;
  zScore: number;
  flaggedDays: number;
}

export interface DriftEpisode {
  id: string;
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  ongoing: boolean;
  metrics: DriftEpisodeMetric[];
  severity: "moderate" | "strong";
  peakSignals: number;
}

export interface DriftAnalysis {
  config: DriftConfig;
  metrics: MetricDrift[];
  episodes: DriftEpisode[];
  /** Per-day count of metrics flagged in the adverse direction. */
  signalCounts: { date: string; index: number; count: number; keys: MetricKey[] }[];
}

/** Multi-signal detection: ≥ minSignals metrics adverse together for ≥ persistence days. */
export function detectMultiSignalPatterns(ds: Dataset, metrics: MetricDrift[], cfg: DriftConfig): DriftEpisode[] {
  const n = ds.days.length;
  const flagged: Record<number, MetricKey[]> = {};
  for (let i = 0; i < n; i++) flagged[i] = [];
  const avail = metrics.filter((m) => m.available && m.baseline);
  avail.forEach((m) => {
    m.adverseRuns.forEach((r) => {
      for (let i = r.startIndex; i <= r.endIndex; i++) flagged[i].push(m.key);
    });
  });

  const episodes: DriftEpisode[] = [];
  let start = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    const len = end - start + 1;
    if (len >= cfg.persistence) {
      const contributing: DriftEpisodeMetric[] = [];
      let peak = 0;
      for (let i = start; i <= end; i++) peak = Math.max(peak, flagged[i].length);
      avail.forEach((m) => {
        const flaggedDays = Array.from({ length: len }, (_, k) => flagged[start + k].includes(m.key)).filter(Boolean).length;
        if (flaggedDays >= cfg.persistence && m.baseline) {
          const vals = meanOver(m.series, start, end).mean;
          if (vals !== null) {
            const z = calculateZScore(vals, m.baseline.mean, m.baseline.sd) ?? 0;
            contributing.push({
              key: m.key,
              baselineMean: m.baseline.mean,
              episodeMean: vals,
              pctChange: calculatePercentageChange(m.baseline.mean, vals) ?? 0,
              zScore: z,
              flaggedDays,
            });
          }
        }
      });
      if (contributing.length >= cfg.minSignals) {
        const maxZ = Math.max(...contributing.map((c) => Math.abs(c.zScore)));
        episodes.push({
          id: `drift-${ds.days[start].date}`,
          startIndex: start,
          endIndex: end,
          startDate: ds.days[start].date,
          endDate: ds.days[end].date,
          durationDays: len,
          ongoing: end === n - 1,
          metrics: contributing.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)),
          severity: contributing.length >= 3 || maxZ >= 3 ? "strong" : "moderate",
          peakSignals: peak,
        });
      }
    }
    start = -1;
  };
  for (let i = 0; i < n; i++) {
    if (flagged[i].length >= cfg.minSignals) {
      if (start < 0) start = i;
    } else flush(i - 1);
  }
  flush(n - 1);
  return episodes;
}

export function analyseDrift(ds: Dataset, source: SourceId, cfg: DriftConfig, rangeDays: number): DriftAnalysis {
  const metrics = DRIFT_METRICS.map((m) => analyseMetricDrift(ds, m.key, m.adverse, source, cfg, rangeDays));
  const episodes = detectMultiSignalPatterns(ds, metrics, cfg);
  const signalCounts = ds.days.map((d) => {
    const keys = metrics.filter((m) => m.adverseRuns.some((r) => d.index >= r.startIndex && d.index <= r.endIndex)).map((m) => m.key);
    return { date: d.date, index: d.index, count: keys.length, keys };
  });
  return { config: cfg, metrics, episodes, signalCounts };
}

export function latestEpisode(a: DriftAnalysis): DriftEpisode | null {
  return a.episodes.length ? a.episodes[a.episodes.length - 1] : null;
}

export { calculateMean };

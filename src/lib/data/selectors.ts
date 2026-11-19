import type { DailyRecord, Dataset, MetricKey, RawSource, SeriesPoint, SourceId } from "@/types/health";
import { METRICS } from "@/lib/metrics";

export function sourcesFor(source: SourceId): RawSource[] {
  if (source === "apple") return ["apple", "manual"];
  if (source === "temple") return ["temple", "manual"];
  return ["apple", "temple", "manual"];
}

/**
 * Whether a metric can be supplied by the selected data source. For the real dataset,
 * only metrics actually present in the imported file count as available.
 */
export function isMetricAvailable(key: MetricKey, source: SourceId, ds?: Dataset): boolean {
  if (ds?.kind === "real" && !ds.available?.includes(key)) return false;
  const allowed = sourcesFor(source);
  return METRICS[key].sources.some((s) => allowed.includes(s));
}

export function valueFor(rec: DailyRecord, key: MetricKey, source: SourceId): number | null {
  const allowed = sourcesFor(source).filter((s) => METRICS[key].sources.includes(s));
  const vals: number[] = [];
  for (const s of allowed) {
    const v = rec[s][key];
    if (v !== undefined && !Number.isNaN(v)) vals.push(v);
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Full-history series for a metric, or null if the source cannot supply it at all. */
export function getSeries(ds: Dataset, key: MetricKey, source: SourceId): SeriesPoint[] | null {
  if (!isMetricAvailable(key, source, ds)) return null;
  return ds.days.map((d) => ({ date: d.date, index: d.index, value: valueFor(d, key, source) }));
}

export function sliceLast<T extends { index: number }>(points: T[], days: number): T[] {
  return points.slice(Math.max(0, points.length - days));
}

export function sourceLabel(source: SourceId, ds?: Dataset): string {
  if (ds?.kind === "real") return `${ds.provenance?.device ?? "Wearable"} · Real (${ds.provenance?.dataset ?? "public dataset"})`;
  return source === "apple" ? "Apple Watch · Simulated" : source === "temple" ? "Temple · Simulated" : "Combined · Simulated";
}

export function metricSourceLabels(key: MetricKey, ds?: Dataset): string[] {
  if (ds?.kind === "real") return ds.available?.includes(key) ? [ds.provenance?.device ?? "Wearable"] : [];
  const m = METRICS[key];
  return m.sources.map((s) => (s === "apple" ? "Apple Watch" : s === "temple" ? "Temple" : "Self-report"));
}

import type { SeriesPoint } from "@/types/health";

export type Num = number | null | undefined;

export function validValues(values: Num[]): number[] {
  return values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
}

export function calculateMean(values: Num[]): number | null {
  const v = validValues(values);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Sample standard deviation (n − 1). */
export function calculateStandardDeviation(values: Num[]): number | null {
  const v = validValues(values);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const ss = v.reduce((a, b) => a + (b - m) ** 2, 0);
  return Math.sqrt(ss / (v.length - 1));
}

export function calculatePercentageChange(from: Num, to: Num): number | null {
  if (from === null || from === undefined || to === null || to === undefined || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

export function calculateZScore(value: Num, mean: Num, sd: Num): number | null {
  if (value === null || value === undefined || mean === null || mean === undefined || !sd) return null;
  return (value - mean) / sd;
}

/** Trailing rolling mean; a window needs at least `minPoints` observations. */
export function calculateRollingAverage(points: SeriesPoint[], window: number, minPoints = 2): SeriesPoint[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1).map((x) => x.value);
    const vals = validValues(slice);
    return { date: p.date, index: p.index, value: vals.length >= Math.min(minPoints, window) ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
  });
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
  startIndex: number;
  endIndex: number;
  startDate: string;
  endDate: string;
}

export function calculateBaseline(points: SeriesPoint[], startIndex: number, endIndex: number): Baseline | null {
  const slice = points.filter((p) => p.index >= startIndex && p.index <= endIndex);
  const vals = validValues(slice.map((p) => p.value));
  const mean = calculateMean(vals);
  const sd = calculateStandardDeviation(vals);
  if (mean === null || sd === null || vals.length < 5) return null;
  return {
    mean,
    sd,
    n: vals.length,
    startIndex,
    endIndex,
    startDate: slice[0]?.date ?? "",
    endDate: slice[slice.length - 1]?.date ?? "",
  };
}

export function pearson(xs: Num[], ys: Num[]): { r: number; n: number } | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const x = xs[i];
    const y = ys[i];
    if (typeof x === "number" && typeof y === "number") pairs.push([x, y]);
  }
  const n = pairs.length;
  if (n < 5) return null;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / n;
  const my = pairs.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

export function meanOver(points: SeriesPoint[], startIndex: number, endIndex: number): { mean: number | null; n: number } {
  const vals = validValues(points.filter((p) => p.index >= startIndex && p.index <= endIndex).map((p) => p.value));
  return { mean: calculateMean(vals), n: vals.length };
}

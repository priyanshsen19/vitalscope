import type { MetricKey } from "./health";

export type ExperimentCategory = "Sleep" | "Exercise" | "Nutrition" | "Recovery" | "Lifestyle" | "Environment";
export type ExperimentStatus = "draft" | "active" | "paused" | "completed";
export type ExperimentDuration = 7 | 14 | 21 | 30;

export interface Experiment {
  id: string;
  name: string;
  category: ExperimentCategory;
  hypothesis: string;
  behaviour: string;
  durationDays: ExperimentDuration;
  primaryMetric: MetricKey;
  secondaryMetrics: MetricKey[];
  status: ExperimentStatus;
  createdAt: string; // yyyy-MM-dd
  startDate: string | null;
  pausedOn: string | null;
  completedOn: string | null;
  /** date -> adherent? Only logged days are present. */
  adherence: Record<string, boolean>;
  isSample?: boolean;
  /** Which dataset the experiment belongs to (missing = demo). */
  dataMode?: "demo" | "real";
}

export type Verdict = "improved" | "worsened" | "changed" | "unchanged" | "unavailable";

export interface ExperimentMetricResult {
  key: MetricKey;
  isPrimary: boolean;
  verdict: Verdict;
  baselineMean: number | null;
  experimentMean: number | null;
  absChange: number | null;
  pctChange: number | null;
  effectSize: number | null;
  baselineN: number;
  experimentN: number;
  /** Daily values aligned by day offset in each period. */
  baselineSeries: { offset: number; date: string; value: number | null }[];
  experimentSeries: { offset: number; date: string; value: number | null }[];
}

export interface ConfidenceFactor {
  label: string;
  score: number; // 0..1
  detail: string;
}

export interface Confidence {
  score: number; // 0..100
  level: "Low" | "Moderate" | "High";
  factors: ConfidenceFactor[];
}

export interface ExperimentResults {
  ready: boolean;
  reason?: string;
  baseline: { start: string; end: string; days: number };
  period: { start: string; end: string; elapsed: number; planned: number; daysWithData: number };
  metrics: ExperimentMetricResult[];
  adherence: { logged: number; adherent: number; rate: number | null; elapsed: number };
  confidence: Confidence;
  confounders: string[];
  summary: string;
  observations: string[];
  daily: { date: string; offset: number; adherent: boolean | null; inPeriod: boolean; future: boolean }[];
}

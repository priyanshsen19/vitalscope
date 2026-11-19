import type { Dataset, MetricKey, SeriesPoint, SourceId, UnitPref } from "@/types/health";
import type { Experiment } from "@/types/experiment";
import type { Insight, TimelineEvent } from "@/types/insights";
import { METRICS, formatMetric, formatPct } from "@/lib/metrics";
import { getSeries, isMetricAvailable } from "@/lib/data/selectors";
import { calculateMean, pearson } from "./baseline";
import { analyseDrift, DEFAULT_DRIFT_CONFIG, DriftAnalysis, DriftConfig, latestEpisode } from "./drift-detection";
import { calculateExperimentResults } from "./experiments";
import { calculateMovementTrends, MovementTrend } from "./movement";
import { compareWorkoutResponses } from "./brain-body";

export interface InsightContext {
  ds: Dataset;
  source: SourceId;
  experiments: Experiment[];
  units: UnitPref;
  driftConfig?: DriftConfig;
}

type CorrPair = { a: MetricKey | "trainingLoad"; b: MetricKey | "trainingLoad"; lag?: number };

const CORR_PAIRS: CorrPair[] = [
  { a: "sleepDuration", b: "hrv" },
  { a: "daylight", b: "sleepConsistency" },
  { a: "trainingLoad", b: "restingHr", lag: 1 },
  { a: "brainFlow", b: "hrv" },
  { a: "brainFlow", b: "sleepEfficiency" },
  { a: "entropy", b: "hrv" },
  { a: "mentalFatigue", b: "hrv" },
  { a: "reactionTime", b: "sleepEfficiency" },
  { a: "steps", b: "sleepDuration" },
  { a: "restingHr", b: "hrv" },
];

function seriesFor(ds: Dataset, k: MetricKey | "trainingLoad", source: SourceId): (number | null)[] | null {
  if (k === "trainingLoad") {
    const d = getSeries(ds, "workoutDuration", source);
    const r = getSeries(ds, "workoutIntensity", source);
    if (!d || !r) return null;
    return d.map((p, i) => (p.value ?? 0) * ((r[i].value ?? 0) / 10));
  }
  const s = getSeries(ds, k, source);
  return s ? s.map((p) => p.value) : null;
}

const labelOf = (k: MetricKey | "trainingLoad") => (k === "trainingLoad" ? "training load" : METRICS[k].templeSimulated ? METRICS[k].label : METRICS[k].label.toLowerCase());

export interface Correlation {
  a: MetricKey | "trainingLoad";
  b: MetricKey | "trainingLoad";
  lag: number;
  r: number;
  n: number;
}

export function calculateCorrelations(ds: Dataset, source: SourceId, pairs: CorrPair[] = CORR_PAIRS): Correlation[] {
  const out: Correlation[] = [];
  pairs.forEach((p) => {
    const sa = seriesFor(ds, p.a, source);
    const sb = seriesFor(ds, p.b, source);
    if (!sa || !sb) return;
    const lag = p.lag ?? 0;
    const xs = lag ? sa.slice(0, sa.length - lag) : sa;
    const ys = lag ? sb.slice(lag) : sb;
    const res = pearson(xs, ys);
    if (res) out.push({ a: p.a, b: p.b, lag, r: res.r, n: res.n });
  });
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

function strength(r: number): string {
  const a = Math.abs(r);
  return a >= 0.6 ? "strong" : a >= 0.4 ? "moderate" : "weak-to-moderate";
}

function confidenceFromN(n: number, r: number): Insight["confidence"] {
  const score = Math.round(Math.min(1, n / 60) * 50 + Math.min(1, Math.abs(r) / 0.7) * 50);
  return { score, level: score >= 75 ? "High" : score >= 50 ? "Moderate" : "Low" };
}

export function generateCrossSignalInsights(ctx: InsightContext): Insight[] {
  const { ds, source } = ctx;
  const corrs = calculateCorrelations(ds, source).filter((c) => Math.abs(c.r) >= 0.3 && c.n >= 30);
  return corrs.slice(0, 5).map((c): Insight => {
    const positive = c.r > 0;
    const templeSim = [c.a, c.b].some((k) => k !== "trainingLoad" && METRICS[k].templeSimulated);
    const lag = c.lag ? ` the following day` : "";
    return {
      id: `corr-${c.a}-${c.b}`,
      category: "pattern",
      title: `${cap(labelOf(c.a))} and ${labelOf(c.b)} tend to move ${positive ? "together" : "in opposite directions"}`,
      description: `Across ${c.n} days, higher ${labelOf(c.a)} was associated with ${positive ? "higher" : "lower"} ${labelOf(c.b)}${lag} (${strength(c.r)} association, r = ${c.r.toFixed(2)}). This is an association in your own data, not evidence that one causes the other.`,
      severity: "info",
      relevance: Math.abs(c.r) * 0.8,
      confidence: confidenceFromN(c.n, c.r),
      dateRange: { start: ds.startDate, end: ds.endDate },
      evidence: [
        { label: "Pearson correlation", value: `r = ${c.r.toFixed(2)}`, detail: `${c.n} paired daily observations${c.lag ? `, ${labelOf(c.b)} lagged by ${c.lag} day` : ""}` },
        { label: "Variance shared", value: `${(c.r * c.r * 100).toFixed(0)}%`, detail: "r² — the share of day-to-day variation the two measures have in common" },
      ],
      explanation: "Calculated as the Pearson correlation of the daily values for the whole 90-day history. Shared trends (for example both measures changing during the same event) can create correlation without a direct relationship.",
      href: templeSim ? "/brain-body" : "/health-drift",
      simulatedTemple: templeSim,
    };
  });
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateDriftInsights(ctx: InsightContext, analysis: DriftAnalysis): Insight[] {
  const out: Insight[] = [];
  analysis.episodes.forEach((ep) => {
    out.push({
      id: ep.id,
      category: "drift",
      title: ep.ongoing ? "Your physiological pattern has shifted" : "A past physiological shift was detected",
      description: `${ep.ongoing ? `Over the last ${ep.durationDays} days` : `Over a ${ep.durationDays}-day period`}, ${ep.metrics.map((m) => `${METRICS[m.key].label.toLowerCase()} ${m.pctChange >= 0 ? "increased" : "decreased"} ${Math.abs(m.pctChange).toFixed(0)}%`).join(", ")}. These changes occurred together and differ from your personal baseline. Consider reviewing recent training load, sleep consistency and recovery time.`,
      severity: ep.severity === "strong" ? "notable" : "attention",
      relevance: ep.ongoing ? 0.98 : 0.6,
      confidence: {
        score: Math.min(95, 45 + ep.metrics.length * 12 + Math.min(20, ep.durationDays * 1.5)),
        level: ep.metrics.length >= 3 ? "High" : "Moderate",
      },
      dateRange: { start: ep.startDate, end: ep.endDate },
      evidence: ep.metrics.map((m) => ({
        label: METRICS[m.key].label,
        value: `${formatMetric(m.key, m.baselineMean, ctx.units)} → ${formatMetric(m.key, m.episodeMean, ctx.units)} (${formatPct(m.pctChange)})`,
        detail: `${m.zScore.toFixed(1)} SD from baseline · beyond threshold on ${m.flaggedDays} consecutive days`,
      })),
      explanation: `A 5-day rolling average beyond ${analysis.config.sdThreshold} standard deviations of the personal baseline for at least ${analysis.config.persistence} consecutive days, in at least ${analysis.config.minSignals} metrics at once. This does not diagnose illness or predict disease.`,
      href: "/health-drift",
    });
  });
  return out;
}

export function generateExperimentInsights(ctx: InsightContext): Insight[] {
  const out: Insight[] = [];
  ctx.experiments.forEach((exp) => {
    if (exp.status === "draft") return;
    const res = calculateExperimentResults(ctx.ds, exp, ctx.source, ctx.units);
    if (!res.ready) return;
    const sig = res.metrics.filter((m) => m.verdict === "improved" || m.verdict === "worsened" || m.verdict === "changed");
    out.push({
      id: `exp-${exp.id}`,
      category: "experiment",
      title: exp.status === "completed" ? `${exp.name}: results` : `${exp.name}: early read`,
      description: `${res.summary} Adherence ${res.adherence.rate === null ? "—" : Math.round(res.adherence.rate * 100) + "%"}. This is an observational personal experiment and does not establish causation.`,
      severity: sig.some((m) => m.verdict === "improved") && res.confidence.level !== "Low" ? "positive" : "info",
      relevance: exp.status === "active" ? 0.85 : 0.75,
      confidence: { score: res.confidence.score, level: res.confidence.level },
      dateRange: { start: res.period.start, end: res.period.end },
      evidence: res.metrics.filter((m) => m.verdict !== "unavailable").map((m) => ({
        label: METRICS[m.key].label,
        value: `${formatMetric(m.key, m.baselineMean, ctx.units)} → ${formatMetric(m.key, m.experimentMean, ctx.units)} (${formatPct(m.pctChange)})`,
        detail: `${m.verdict}${m.effectSize !== null ? ` · effect size ${m.effectSize.toFixed(2)} SD` : ""}`,
      })),
      explanation: `Compared the ${res.period.elapsed}-day experiment period against the ${res.baseline.days} days before it. ${res.confounders.length ? "Concurrent changes: " + res.confounders.join(" ") : "No concurrent training-load or drift changes were found."}`,
      href: "/experiments",
    });
  });
  return out;
}

export function generateMovementInsights(ctx: InsightContext, trends: MovementTrend[]): Insight[] {
  const out: Insight[] = [];
  const av = trends.filter((t) => t.available && t.baseline);
  if (av.length === 0) return out;
  const monitor = av.filter((t) => t.status === "monitor");
  const stable = av.filter((t) => t.status === "stable");
  const last = ctx.ds.days.length - 1;
  monitor.forEach((t) => {
    out.push({
      id: `move-${t.key}`,
      category: "movement",
      title: `${METRICS[t.key].label} is ${t.pctVsBaseline !== null && t.pctVsBaseline < 0 ? "below" : "above"} your baseline`,
      description: `Over the last 14 days, ${METRICS[t.key].label.toLowerCase()} averaged ${formatMetric(t.key, (t.baseline?.mean ?? 0) * (1 + (t.pctVsBaseline ?? 0) / 100), ctx.units)} compared with a personal baseline of ${formatMetric(t.key, t.baseline?.mean, ctx.units)} (${formatPct(t.pctVsBaseline)}). Worth monitoring; many everyday factors can influence it.`,
      severity: "attention",
      relevance: 0.8,
      confidence: { score: 72, level: "Moderate" },
      dateRange: { start: ctx.ds.days[last - 13].date, end: ctx.ds.days[last].date },
      evidence: [
        { label: "Personal baseline (first 30 days)", value: formatMetric(t.key, t.baseline?.mean, ctx.units), detail: `SD ${formatMetric(t.key, t.baseline?.sd, ctx.units)}` },
        { label: "Effect vs baseline", value: `${(t.effectSize ?? 0).toFixed(1)} SD` },
        { label: "30-day change vs previous 30 days", value: formatPct(t.thirty.pct) },
      ],
      explanation: "Last-14-day mean compared with the mean of the first 30 days, expressed in baseline standard deviations. A change beyond 1.5 SD is flagged. Not a medical threshold.",
      href: "/movement",
    });
  });
  if (stable.length >= 2) {
    out.push({
      id: "move-stable",
      category: "movement",
      title: "Most mobility indicators are stable",
      description: `${stable.map((t) => METRICS[t.key].short.toLowerCase()).join(", ")} stayed within 1.5 SD of your baseline over the last 14 days.`,
      severity: "positive",
      relevance: 0.4,
      confidence: { score: 80, level: "High" },
      dateRange: { start: ctx.ds.days[last - 13].date, end: ctx.ds.days[last].date },
      evidence: stable.map((t) => ({ label: METRICS[t.key].label, value: `${formatMetric(t.key, t.baseline?.mean, ctx.units)} baseline`, detail: formatPct(t.pctVsBaseline) + " vs baseline" })),
      explanation: "Compared with each metric's own first-30-day baseline.",
      href: "/movement",
    });
  }
  return out;
}

export function generateBrainBodyInsights(ctx: InsightContext): Insight[] {
  if (!isMetricAvailable("brainFlow", ctx.source, ctx.ds)) return [];
  const { summaries, observations } = compareWorkoutResponses(ctx.ds.workouts, ctx.ds.workouts[0]?.id);
  const run = summaries.find((s) => s.intensityLabel === "High");
  const cyc = summaries.find((s) => s.intensityLabel === "Moderate");
  if (!run || !cyc) return [];
  const last = ctx.ds.workouts.map((w) => w.date).sort();
  const obs = observations.find((o) => o.id === "moderate-vs-high");
  return [{
    id: "bb-intensity",
    category: "brain-body",
    title: "BrainFlow and Entropy responded differently across exercise intensities",
    description: `In the high-intensity run BrainFlow ended ${run.bfEndDelta.toFixed(1)} points from its starting level and Entropy fell ${Math.abs(run.entropyMinDelta).toFixed(2)} a.u.; in the moderate cycling session BrainFlow ended ${cyc.bfEndDelta >= 0 ? "+" : ""}${cyc.bfEndDelta.toFixed(1)} and Entropy fell only ${Math.abs(cyc.entropyMinDelta).toFixed(2)} a.u. Exploratory analysis of simulated Temple-compatible measurements.`,
    severity: "info",
    relevance: 0.7,
    confidence: { score: 52, level: "Moderate" },
    dateRange: { start: last[0], end: last[last.length - 1] },
    evidence: obs?.evidence.map((e) => ({ label: e.label, value: e.value })) ?? [],
    explanation: "Compared pre-exercise, during-exercise and recovery means for three sample workouts. BrainFlow and Entropy are simulated Temple-compatible measurements; they are not clinical, cognitive or cerebral-blood-flow measurements.",
    href: "/brain-body",
    simulatedTemple: true,
  }];
}

export function generateInsights(ctx: InsightContext): { insights: Insight[]; drift: DriftAnalysis; trends: MovementTrend[] } {
  const cfg = ctx.driftConfig ?? DEFAULT_DRIFT_CONFIG;
  const drift = analyseDrift(ctx.ds, ctx.source, cfg, 30);
  const trends = calculateMovementTrends(ctx.ds, ctx.source, 30);
  const insights = [
    ...generateDriftInsights(ctx, drift),
    ...generateExperimentInsights(ctx),
    ...generateMovementInsights(ctx, trends),
    ...generateBrainBodyInsights(ctx),
    ...generateCrossSignalInsights(ctx),
  ].sort((a, b) => b.relevance - a.relevance);
  return { insights, drift, trends };
}

export function buildTimeline(ctx: InsightContext, drift: DriftAnalysis, trends: MovementTrend[], lastDays = 30): TimelineEvent[] {
  const { ds } = ctx;
  const minIdx = ds.days.length - lastDays;
  const ev: TimelineEvent[] = [];
  drift.episodes.forEach((ep) => {
    if (ep.endIndex >= minIdx) ev.push({ id: ep.id, date: ep.startDate, type: "drift", title: "Multi-signal drift detected", detail: `${ep.metrics.length} signals shifted together${ep.ongoing ? " · ongoing" : ""}`, tone: "amber", href: "/health-drift" });
  });
  ctx.experiments.forEach((e) => {
    if (e.startDate && ds.days.findIndex((d) => d.date === e.startDate) >= minIdx) ev.push({ id: `${e.id}-start`, date: e.startDate, type: "experiment", title: `Started “${e.name}”`, detail: `${e.durationDays}-day experiment · ${METRICS[e.primaryMetric].label}`, tone: "lime", href: "/experiments" });
    if (e.completedOn && ds.days.findIndex((d) => d.date === e.completedOn) >= minIdx) ev.push({ id: `${e.id}-done`, date: e.completedOn, type: "experiment", title: `Completed “${e.name}”`, detail: "Results available", tone: "lime", href: "/experiments" });
  });
  ds.workouts.forEach((w) => {
    if (w.dayIndex >= minIdx) ev.push({ id: w.id, date: w.date, type: "workout", title: w.name, detail: `${w.durationMin} min · RPE ${w.rpe}`, tone: "violet", href: "/brain-body" });
  });
  trends.forEach((t) => {
    t.runs.forEach((r) => {
      if (r.endIndex >= minIdx && r.startIndex >= minIdx) ev.push({ id: `${t.key}-${r.startIndex}`, date: r.startDate, type: "movement", title: `${METRICS[t.key].label} ${r.direction === "down" ? "below" : "above"} baseline`, detail: `${r.length} days beyond 1.5 SD${r.endIndex === ds.days.length - 1 ? " · ongoing" : ""}`, tone: "cyan", href: "/movement" });
    });
  });
  return ev.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "amber" | "cyan" | "lime";
}

export function buildNotifications(ctx: InsightContext, drift: DriftAnalysis, trends: MovementTrend[]): AppNotification[] {
  const out: AppNotification[] = [];
  const ep = latestEpisode(drift);
  if (ep && ep.ongoing) out.push({ id: `n-${ep.id}`, title: "Ongoing physiological drift", detail: `${ep.metrics.length} signals have differed from baseline for ${ep.durationDays} days.`, href: "/health-drift", tone: "amber" });
  trends.filter((t) => t.status === "monitor").forEach((t) => out.push({ id: `n-move-${t.key}`, title: `${METRICS[t.key].label} worth monitoring`, detail: `${formatPct(t.pctVsBaseline)} vs your baseline.`, href: "/movement", tone: "cyan" }));
  const lastDate = ctx.ds.endDate;
  ctx.experiments.filter((e) => e.status === "active").forEach((e) => {
    if (e.adherence[lastDate] === undefined) out.push({ id: `n-log-${e.id}-${lastDate}`, title: `Log adherence: ${e.name}`, detail: "Yesterday's check-in is still empty.", href: "/experiments", tone: "lime" });
  });
  return out;
}

export { calculateMean };
export type { SeriesPoint };

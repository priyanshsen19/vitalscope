import { addDays, format, parseISO } from "date-fns";
import type { Dataset, MetricKey, SeriesPoint, SourceId, UnitPref } from "@/types/health";
import type {
  Confidence, Experiment, ExperimentMetricResult, ExperimentResults, Verdict,
} from "@/types/experiment";
import { METRICS, formatMetric, formatPct } from "@/lib/metrics";
import { getSeries, isMetricAvailable } from "@/lib/data/selectors";
import { clamp } from "@/lib/utils";
import {
  calculateMean, calculatePercentageChange, calculateStandardDeviation, meanOver, validValues,
} from "./baseline";
import { analyseDrift, DEFAULT_DRIFT_CONFIG } from "./drift-detection";

function indexOfDate(ds: Dataset, date: string): number {
  return ds.days.findIndex((d) => d.date === date);
}

function dateIndexClamped(ds: Dataset, date: string): number {
  if (date < ds.startDate) return -1;
  if (date > ds.endDate) return ds.days.length;
  return indexOfDate(ds, date);
}

function listify(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function trainingLoadSeries(ds: Dataset, source: SourceId): SeriesPoint[] | null {
  const dur = getSeries(ds, "workoutDuration", source);
  const rpe = getSeries(ds, "workoutIntensity", source);
  if (!dur || !rpe) return null;
  return dur.map((p, i) => ({ date: p.date, index: p.index, value: (p.value ?? 0) * ((rpe[i].value ?? 0) / 10) }));
}

export function experimentPeriod(ds: Dataset, exp: Experiment) {
  if (!exp.startDate) return null;
  const startIdx = dateIndexClamped(ds, exp.startDate);
  const last = ds.days.length - 1;
  if (startIdx > last) return { startIdx, endIdx: startIdx, plannedEndIdx: startIdx + exp.durationDays - 1, elapsed: 0 };
  const s = Math.max(0, startIdx);
  const plannedEnd = s + exp.durationDays - 1;
  let end = Math.min(plannedEnd, last);
  if (exp.status === "completed" && exp.completedOn) end = Math.min(end, dateIndexClamped(ds, exp.completedOn));
  if (exp.status === "paused" && exp.pausedOn) end = Math.min(end, dateIndexClamped(ds, exp.pausedOn));
  return { startIdx: s, endIdx: end, plannedEndIdx: plannedEnd, elapsed: Math.max(0, end - s + 1) };
}

export function calculateExperimentResults(
  ds: Dataset,
  exp: Experiment,
  source: SourceId,
  units: UnitPref = "metric",
): ExperimentResults {
  const per = experimentPeriod(ds, exp);
  const empty: ExperimentResults = {
    ready: false,
    baseline: { start: "", end: "", days: 0 },
    period: { start: exp.startDate ?? "", end: "", elapsed: 0, planned: exp.durationDays, daysWithData: 0 },
    metrics: [],
    adherence: { logged: 0, adherent: 0, rate: null, elapsed: 0 },
    confidence: { score: 0, level: "Low", factors: [] },
    confounders: [],
    summary: "",
    observations: [],
    daily: [],
  };
  if (exp.status === "draft" || !per || !exp.startDate) return { ...empty, reason: exp.startDate && exp.status === "draft"
      ? `This experiment is a draft planned for ${exp.startDate}. Start it to begin tracking adherence and comparing measurements to your baseline.`
      : "This experiment has not started yet. Start it to begin tracking adherence and comparing measurements to your baseline." };

  const { startIdx, endIdx, plannedEndIdx, elapsed } = per;
  const baseStart = Math.max(0, startIdx - exp.durationDays);
  const baseEnd = startIdx - 1;
  const baseDays = Math.max(0, baseEnd - baseStart + 1);

  const daily = Array.from({ length: exp.durationDays }, (_, off) => {
    const date = format(addDays(parseISO(exp.startDate as string), off), "yyyy-MM-dd");
    const idx = startIdx + off;
    const future = idx > ds.days.length - 1;
    const inPeriod = idx <= endIdx && !future;
    const adh = exp.adherence[date];
    return { date, offset: off, adherent: adh === undefined ? null : adh, inPeriod, future };
  });
  const inPeriodDates = daily.filter((d) => d.inPeriod).map((d) => d.date);
  const adherentCount = inPeriodDates.filter((d) => exp.adherence[d] === true).length;
  const loggedCount = inPeriodDates.filter((d) => exp.adherence[d] !== undefined).length;
  const adherence = { logged: loggedCount, adherent: adherentCount, rate: elapsed > 0 ? adherentCount / elapsed : null, elapsed };

  if (elapsed < 3 || baseDays < 5) {
    return {
      ...empty,
      reason: elapsed < 3
        ? `Only ${elapsed} day${elapsed === 1 ? "" : "s"} of measurements fall inside this experiment so far. Results appear after at least 3 days.`
        : "There are fewer than 5 days of history before the start date, so there is no baseline to compare with.",
      baseline: { start: ds.days[baseStart]?.date ?? "", end: ds.days[Math.max(0, baseEnd)]?.date ?? "", days: baseDays },
      period: { start: exp.startDate, end: ds.days[endIdx]?.date ?? "", elapsed, planned: exp.durationDays, daysWithData: 0 },
      adherence,
      daily,
    };
  }

  const keys: MetricKey[] = [exp.primaryMetric, ...exp.secondaryMetrics.filter((k) => k !== exp.primaryMetric)];
  const metrics: ExperimentMetricResult[] = keys.map((key) => {
    const isPrimary = key === exp.primaryMetric;
    const series = getSeries(ds, key, source);
    if (!series) {
      return {
        key, isPrimary, verdict: "unavailable", baselineMean: null, experimentMean: null, absChange: null, pctChange: null,
        effectSize: null, baselineN: 0, experimentN: 0, baselineSeries: [], experimentSeries: [],
      };
    }
    const bs = series.filter((p) => p.index >= baseStart && p.index <= baseEnd);
    const es = series.filter((p) => p.index >= startIdx && p.index <= endIdx);
    const bMean = calculateMean(bs.map((p) => p.value));
    const eMean = calculateMean(es.map((p) => p.value));
    const bSd = calculateStandardDeviation(bs.map((p) => p.value));
    const abs = bMean !== null && eMean !== null ? eMean - bMean : null;
    const pct = calculatePercentageChange(bMean, eMean);
    const d = abs !== null && bSd ? abs / bSd : null;
    let verdict: Verdict = "unchanged";
    if (d === null) verdict = "unavailable";
    else if (Math.abs(d) >= 0.5) {
      const better = METRICS[key].better;
      if (better === "neutral") verdict = "changed";
      else verdict = (better === "higher") === (abs as number) > 0 ? "improved" : "worsened";
    }
    return {
      key, isPrimary, verdict, baselineMean: bMean, experimentMean: eMean, absChange: abs, pctChange: pct, effectSize: d,
      baselineN: validValues(bs.map((p) => p.value)).length, experimentN: validValues(es.map((p) => p.value)).length,
      baselineSeries: bs.map((p) => ({ offset: p.index - baseStart, date: p.date, value: p.value })),
      experimentSeries: es.map((p) => ({ offset: p.index - startIdx, date: p.date, value: p.value })),
    };
  });

  // ---- confounders ----
  const confounders: string[] = [];
  const load = trainingLoadSeries(ds, source);
  if (load) {
    const b = meanOver(load, baseStart, baseEnd).mean;
    const e = meanOver(load, startIdx, endIdx).mean;
    const pct = calculatePercentageChange(b, e);
    if (pct !== null && Math.abs(pct) >= 25 && !keys.includes("workoutDuration")) {
      confounders.push(`Training load ${pct > 0 ? "rose" : "fell"} by ${Math.abs(pct).toFixed(0)}% compared with the baseline period.`);
    }
  }
  const drift = analyseDrift(ds, source, DEFAULT_DRIFT_CONFIG, 30);
  drift.episodes.forEach((ep) => {
    const overlap = Math.min(ep.endIndex, endIdx) - Math.max(ep.startIndex, startIdx) + 1;
    if (overlap >= 3) confounders.push(`A multi-signal physiological drift overlapped ${overlap} days of this experiment.`);
  });

  // ---- confidence ----
  const primary = metrics.find((m) => m.isPrimary);
  const nExp = Math.max(...metrics.map((m) => m.experimentN), 0);
  const nBase = Math.max(...metrics.map((m) => m.baselineN), 0);
  const sampleScore = clamp((Math.min(nExp, 14) / 14) * 0.6 + (Math.min(nBase, 14) / 14) * 0.4, 0, 1);
  const avail = metrics.filter((m) => m.verdict !== "unavailable");
  const expectedPts = avail.length * (elapsed + baseDays);
  const havePts = avail.reduce((a, m) => a + m.experimentN + m.baselineN, 0);
  const completeness = expectedPts > 0 ? havePts / expectedPts : 0;
  let consistency = 0.5;
  if (primary && primary.baselineMean !== null && primary.absChange !== null) {
    const vals = validValues(primary.experimentSeries.map((p) => p.value));
    const same = vals.filter((v) => (v - (primary.baselineMean as number)) * (primary.absChange as number) > 0).length;
    consistency = vals.length ? same / vals.length : 0.5;
  }
  const confScore = clamp(1 - 0.4 * confounders.length, 0, 1);
  const fullDuration = clamp(elapsed / exp.durationDays, 0, 1);
  const total = sampleScore * 0.22 + completeness * 0.2 + consistency * 0.28 + confScore * 0.2 + fullDuration * 0.1;
  const score = Math.round(total * 100);
  const confidence: Confidence = {
    score,
    // Concurrent changes cap the level: the result cannot be called High confidence.
    level: score >= 75 && confounders.length === 0 ? "High" : score >= 55 ? "Moderate" : "Low",
    factors: [
      { label: "Sample size", score: sampleScore, detail: `${nExp} experiment days and ${nBase} baseline days with data (14 + 14 ideal).` },
      { label: "Data completeness", score: completeness, detail: `${havePts} of ${expectedPts} expected daily values were recorded.` },
      { label: "Consistency", score: consistency, detail: primary ? `${Math.round(consistency * 100)}% of experiment days moved the primary metric in the same direction as the average change.` : "No primary metric." },
      { label: "Confounders", score: confScore, detail: confounders.length ? `${confounders.length} concurrent change${confounders.length > 1 ? "s" : ""} could also explain the result.` : "No concurrent training-load or drift changes detected." },
      { label: "Duration covered", score: fullDuration, detail: `${elapsed} of ${exp.durationDays} planned days elapsed.` },
    ],
  };

  // ---- findings ----
  const label = (k: MetricKey) => METRICS[k].label.toLowerCase();
  const improved = metrics.filter((m) => m.verdict === "improved").map((m) => label(m.key));
  const worsened = metrics.filter((m) => m.verdict === "worsened").map((m) => label(m.key));
  const changed = metrics.filter((m) => m.verdict === "changed").map((m) => label(m.key));
  const flat = metrics.filter((m) => m.verdict === "unchanged").map((m) => label(m.key));
  const parts: string[] = [];
  if (improved.length) parts.push(`improvements in ${listify(improved)}`);
  if (worsened.length) parts.push(`less favourable ${listify(worsened)}`);
  if (changed.length) parts.push(`a shift in ${listify(changed)}`);
  if (flat.length) parts.push(`no clear change in ${listify(flat)}`);
  const summary = parts.length ? `Your ${exp.name} was associated with ${listify(parts)}.` : `Not enough measurements are available to summarise ${exp.name}.`;

  const observations: string[] = [];
  metrics.forEach((m) => {
    if (m.verdict === "unavailable") {
      observations.push(`${METRICS[m.key].label} is not provided by the selected data source, so it was excluded.`);
      return;
    }
    if (m.pctChange !== null && Math.abs(m.pctChange) >= 20 && m.key !== exp.primaryMetric) {
      observations.push(`${METRICS[m.key].label} ${m.pctChange > 0 ? "increased" : "decreased"} by ${Math.abs(m.pctChange).toFixed(0)}% during the intervention period (${formatMetric(m.key, m.baselineMean, units)} → ${formatMetric(m.key, m.experimentMean, units)}).`);
    }
  });
  if (adherence.rate !== null) observations.push(`Adherence was ${Math.round(adherence.rate * 100)}% (${adherence.adherent} of ${elapsed} days).`);
  confounders.forEach((c) => observations.push(c));

  return {
    ready: true,
    baseline: { start: ds.days[baseStart].date, end: ds.days[baseEnd].date, days: baseDays },
    period: { start: ds.days[startIdx].date, end: ds.days[endIdx].date, elapsed, planned: exp.durationDays, daysWithData: nExp },
    metrics, adherence, confidence, confounders, summary, observations, daily,
  };
}

export interface ExperimentStats {
  total: number;
  active: number;
  completed: number;
  draft: number;
  paused: number;
  avgAdherence: number | null;
  withPositiveFinding: number;
  analysed: number;
}

export function calculateExperimentStats(ds: Dataset, experiments: Experiment[], source: SourceId): ExperimentStats {
  let adhSum = 0, adhN = 0, positive = 0, analysed = 0;
  experiments.forEach((e) => {
    if (e.status === "draft") return;
    const r = calculateExperimentResults(ds, e, source);
    if (r.adherence.rate !== null) { adhSum += r.adherence.rate; adhN++; }
    if (r.ready) {
      analysed++;
      if (r.metrics.some((m) => m.isPrimary && m.verdict === "improved")) positive++;
    }
  });
  return {
    total: experiments.length,
    active: experiments.filter((e) => e.status === "active").length,
    completed: experiments.filter((e) => e.status === "completed").length,
    draft: experiments.filter((e) => e.status === "draft").length,
    paused: experiments.filter((e) => e.status === "paused").length,
    avgAdherence: adhN ? adhSum / adhN : null,
    withPositiveFinding: positive,
    analysed,
  };
}

export function buildExperimentReport(exp: Experiment, res: ExperimentResults, ds: Dataset, units: UnitPref = "metric"): string {
  const L: string[] = [];
  L.push(`# Experiment report — ${exp.name}`);
  L.push("");
  L.push("> DEMO DATA · SIMULATED WEARABLE MEASUREMENTS. Generated by Vitalscope. This is an observational personal experiment and does not establish causation.");
  L.push("");
  L.push(`- **Category:** ${exp.category}`);
  L.push(`- **Status:** ${exp.status}`);
  L.push(`- **Hypothesis:** ${exp.hypothesis}`);
  L.push(`- **Behaviour tested:** ${exp.behaviour}`);
  L.push(`- **Duration:** ${exp.durationDays} days${exp.startDate ? ` (started ${exp.startDate})` : ""}`);
  L.push(`- **Primary metric:** ${METRICS[exp.primaryMetric].label}`);
  L.push(`- **Secondary metrics:** ${exp.secondaryMetrics.map((k) => METRICS[k].label).join(", ") || "none"}`);
  L.push(`- **Dataset window:** ${ds.startDate} to ${ds.endDate} (seed ${ds.seed})`);
  L.push("");
  if (!res.ready) {
    L.push(`## Results\n\n${res.reason ?? "No results yet."}`);
    return L.join("\n");
  }
  L.push("## Summary");
  L.push("");
  L.push(res.summary);
  L.push("");
  L.push(`Baseline period: ${res.baseline.start} → ${res.baseline.end} (${res.baseline.days} days). Experiment period: ${res.period.start} → ${res.period.end} (${res.period.elapsed} of ${res.period.planned} days).`);
  L.push("");
  L.push("## Before / after");
  L.push("");
  L.push("| Metric | Baseline | Experiment | Change | Effect size | Verdict |");
  L.push("|---|---|---|---|---|---|");
  res.metrics.forEach((m) => {
    L.push(`| ${METRICS[m.key].label}${m.isPrimary ? " (primary)" : ""} | ${formatMetric(m.key, m.baselineMean, units)} | ${formatMetric(m.key, m.experimentMean, units)} | ${formatPct(m.pctChange)} | ${m.effectSize === null ? "—" : m.effectSize.toFixed(2)} | ${m.verdict} |`);
  });
  L.push("");
  L.push(`## Adherence\n\n${res.adherence.adherent} of ${res.adherence.elapsed} days (${res.adherence.rate === null ? "—" : Math.round(res.adherence.rate * 100) + "%"}).`);
  L.push("");
  L.push(`## Confidence: ${res.confidence.level} (${res.confidence.score}/100)`);
  L.push("");
  res.confidence.factors.forEach((f) => L.push(`- **${f.label}** (${Math.round(f.score * 100)}%): ${f.detail}`));
  L.push("");
  L.push("## Observations");
  L.push("");
  res.observations.forEach((o) => L.push(`- ${o}`));
  L.push("");
  L.push("## Method");
  L.push("");
  L.push("Verdicts compare the experiment-period mean with the mean of the equally long period before the start date. A metric is called changed when the difference is at least 0.5 baseline standard deviations. Confidence combines sample size, completeness, direction consistency, concurrent changes and duration covered.");
  return L.join("\n");
}

export { isMetricAvailable };

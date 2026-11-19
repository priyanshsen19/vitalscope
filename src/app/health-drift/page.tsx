"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, Segmented } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/form";
import { EmptyState } from "@/components/shared/states";
import { DriftMetricCard } from "@/components/drift/drift-metric-card";
import { DeviationBars } from "@/components/drift/deviation-bars";
import { DriftExplainer } from "@/components/drift/drift-explainer";
import { TimeSeriesChart, type ChartBand, type ChartRow } from "@/components/charts/time-series-chart";
import { useApp } from "@/lib/store/app-context";
import { analyseDrift, DEFAULT_DRIFT_CONFIG, DRIFT_METRICS, latestEpisode, type DriftConfig } from "@/lib/analytics/drift-detection";
import { calculateZScore } from "@/lib/analytics/baseline";
import { METRICS, formatPct } from "@/lib/metrics";
import type { MetricKey } from "@/types/health";

const BASELINES: { id: string; label: string; start: number; end: number }[] = [
  { id: "first30", label: "First 30 days (default)", start: 0, end: 29 },
  { id: "first14", label: "First 14 days", start: 0, end: 13 },
  { id: "first60", label: "First 60 days", start: 0, end: 59 },
  { id: "d31-60", label: "Days 31–60", start: 30, end: 59 },
];

type View = "all" | MetricKey;

export default function HealthDriftPage() {
  const { dataset, settings, fmt, fmtDate } = useApp();
  const range = settings.dateRange;
  const [baselineId, setBaselineId] = useState("first30");
  const [view, setView] = useState<View>("all");
  const [showCfg, setShowCfg] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_DRIFT_CONFIG.sdThreshold);
  const [persistence, setPersistence] = useState(DEFAULT_DRIFT_CONFIG.persistence);
  const [rolling, setRolling] = useState(DEFAULT_DRIFT_CONFIG.rollingWindow);

  const bl = BASELINES.find((b) => b.id === baselineId) ?? BASELINES[0];
  const cfg: DriftConfig = useMemo(() => ({ ...DEFAULT_DRIFT_CONFIG, sdThreshold: threshold, persistence, rollingWindow: rolling, baselineStart: bl.start, baselineEnd: bl.end }), [threshold, persistence, rolling, bl]);
  const analysis = useMemo(() => analyseDrift(dataset, settings.source, cfg, range), [dataset, settings.source, cfg, range]);
  const episode = latestEpisode(analysis);
  const n = dataset.days.length;
  const from = n - range;

  const availableMetrics = analysis.metrics.filter((m) => m.available);
  const effectiveView: View = view !== "all" && !availableMetrics.some((m) => m.key === view) ? "all" : view;

  // ----- main chart data -----
  const { rows, series, bands, refs, axes, title } = useMemo(() => {
    const idxs = dataset.days.slice(from).map((d) => d.index);
    const bandsFor = (runs: { startIndex: number; endIndex: number }[]): ChartBand[] =>
      runs.filter((r) => r.endIndex >= from).map((r) => ({ x1: dataset.days[Math.max(r.startIndex, from)].date, x2: dataset.days[r.endIndex].date, color: "amber", opacity: 0.14 }));
    if (effectiveView === "all") {
      const rowsAll: ChartRow[] = idxs.map((i) => {
        const row: ChartRow = { date: dataset.days[i].date };
        availableMetrics.forEach((m) => {
          if (!m.baseline) return;
          const z = calculateZScore(m.rolling[i].value, m.baseline.mean, m.baseline.sd);
          // orient so that positive always = adverse direction
          row[m.key] = z === null ? null : Math.round((m.adverse === "up" ? z : -z) * 100) / 100;
        });
        return row;
      });
      const colors: Record<string, string> = { restingHr: "danger", hrv: "cyan", respRate: "violet", sleepEfficiency: "lime" };
      return {
        rows: rowsAll,
        series: availableMetrics.map((m) => ({ key: m.key, label: `${METRICS[m.key].short}`, color: colors[m.key], format: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} SD` })),
        bands: episode ? [{ x1: dataset.days[Math.max(episode.startIndex, from)].date, x2: dataset.days[episode.endIndex].date, color: "amber", opacity: 0.12 }] : [],
        refs: [{ y: cfg.sdThreshold, label: `+${cfg.sdThreshold} SD (unfavourable)`, color: "amber" }, { y: 0, label: "baseline", color: "lime" }],
        axes: { left: { format: (v: number) => `${v.toFixed(0)}` } },
        title: "All signals · unfavourable deviation from baseline (SD)",
      };
    }
    const m = analysis.metrics.find((x) => x.key === effectiveView)!;
    const rowsOne: ChartRow[] = idxs.map((i) => ({
      date: dataset.days[i].date, raw: m.series[i].value, rolling: m.rolling[i].value,
      upper: m.baseline ? m.baseline.mean + cfg.sdThreshold * m.baseline.sd : null, lower: m.baseline ? m.baseline.mean - cfg.sdThreshold * m.baseline.sd : null,
    }));
    const meta = METRICS[m.key];
    const f = (v: number) => v.toFixed(meta.decimals);
    return {
      rows: rowsOne,
      series: [
        { key: "raw", label: "Daily value", color: "muted", opacity: 0.55, width: 1.25, dots: true, format: f },
        { key: "rolling", label: `${cfg.rollingWindow}-day rolling avg`, color: "cyan", width: 2.25, format: f },
      ],
      bands: bandsFor(m.adverseRuns),
      refs: m.baseline ? [
        { y: m.baseline.mean, label: `baseline ${f(m.baseline.mean)}`, color: "lime" },
        { y: m.adverse === "up" ? m.baseline.mean + cfg.sdThreshold * m.baseline.sd : m.baseline.mean - cfg.sdThreshold * m.baseline.sd, label: `${cfg.sdThreshold} SD threshold`, color: "amber" },
      ] : [],
      axes: { left: { format: f } },
      title: `${meta.label} (${meta.unit}) · baseline, rolling average and sustained deviations`,
    };
  }, [dataset, from, effectiveView, analysis, availableMetrics, episode, cfg]);

  // ----- signal count chart -----
  const countRows: ChartRow[] = analysis.signalCounts.slice(from).map((c) => ({ date: c.date, count: c.count }));
  const epBands: ChartBand[] = analysis.episodes.filter((e) => e.endIndex >= from).map((e) => ({ x1: dataset.days[Math.max(e.startIndex, from)].date, x2: dataset.days[e.endIndex].date, color: "amber", opacity: 0.18 }));

  const allRuns = analysis.metrics.flatMap((m) => m.adverseRuns.map((r) => ({ m, r }))).sort((a, b) => (a.r.startIndex < b.r.startIndex ? 1 : -1));

  return (
    <Stagger>
      <StaggerItem>
        <PageHeader icon={Activity} accent="amber" eyebrow="Module 01" title="Health Drift Detection" subtitle="Identify meaningful changes in your physiological patterns before they become difficult to notice."
          actions={<>
            <div className="min-w-[190px]"><Select aria-label="Baseline window" value={baselineId} onChange={(e) => setBaselineId(e.target.value)} className="text-xs">{BASELINES.map((b) => <option key={b.id} value={b.id}>Baseline: {b.label}</option>)}</Select></div>
            <Button variant="secondary" onClick={() => setShowCfg((s) => !s)} aria-expanded={showCfg}><SlidersHorizontal className="h-4 w-4" />Detection settings</Button>
          </>} />
        <Collapsible open={showCfg}>
          <Card className="mb-6"><CardBody className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="thr">Deviation threshold</Label><Select id="thr" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>{[1, 1.5, 2, 2.5].map((v) => <option key={v} value={v}>{v} standard deviations</option>)}</Select></div>
            <div><Label htmlFor="per">Persistence required</Label><Select id="per" value={persistence} onChange={(e) => setPersistence(Number(e.target.value))}>{[2, 3, 4, 5, 7].map((v) => <option key={v} value={v}>{v} consecutive days</option>)}</Select></div>
            <div><Label htmlFor="roll">Rolling window</Label><Select id="roll" value={rolling} onChange={(e) => setRolling(Number(e.target.value))}>{[3, 5, 7].map((v) => <option key={v} value={v}>{v} days</option>)}</Select></div>
          </CardBody></Card>
        </Collapsible>
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {analysis.metrics.map((m) => <DriftMetricCard key={m.key} m={m} rangeDays={range} selected={effectiveView === m.key} onSelect={() => setView((v) => (v === m.key ? "all" : m.key))} />)}
        </div>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title={title} subtitle={`${fmtDate(dataset.days[from].date)} – ${fmtDate(dataset.endDate)} · baseline ${fmtDate(dataset.days[bl.start].date)} – ${fmtDate(dataset.days[bl.end].date)}`}
            action={<Segmented<View> id="drift-view" size="sm" ariaLabel="Chart metric" value={effectiveView} onChange={setView}
              options={[{ value: "all", label: "All" }, ...DRIFT_METRICS.map((d) => ({ value: d.key as View, label: METRICS[d.key].short, disabled: !availableMetrics.some((m) => m.key === d.key) }))]} />} />
          <CardBody>
            {rows.length ? <TimeSeriesChart data={rows} xKey="date" series={series} bands={bands} refs={refs} axes={axes} height={300} ariaLabel={title} /> : <EmptyState title="No data" text="No measurements in this range." />}
            <p className="mt-2 text-[11px] text-muted">Amber shading marks periods where the rolling average stayed beyond the threshold for the required number of days.</p>
          </CardBody>
        </Card>
      </StaggerItem>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <StaggerItem className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader title={episode?.ongoing ? "Your physiological pattern has shifted" : episode ? "Most recent physiological shift" : "Insight"} subtitle="Automatically generated from your data · not a diagnosis"
              action={episode ? <Badge tone={episode.ongoing ? "amber" : "muted"}>{episode.ongoing ? "Ongoing" : "Resolved"}</Badge> : undefined} />
            <CardBody>
              {episode ? (
                <>
                  <p className="text-sm text-muted">Over {episode.ongoing ? "the last" : "a"} <span className="font-medium text-fg">{episode.durationDays} days</span> ({fmtDate(episode.startDate)} – {fmtDate(episode.endDate)}):</p>
                  <ul className="mt-2 space-y-1.5">
                    {episode.metrics.map((m) => (
                      <li key={m.key} className="flex items-center gap-2 text-sm"><AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber" />
                        <span>{METRICS[m.key].label} {m.pctChange >= 0 ? "increased" : "decreased"} by <span className="font-semibold tabular-nums">{Math.abs(m.pctChange).toFixed(1)}%</span></span>
                        <span className="ml-auto text-xs tabular-nums text-muted">{fmt(m.key, m.baselineMean, false)} → {fmt(m.key, m.episodeMean)}</span></li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-muted">These changes occurred together and differ from your historical baseline.</p>
                  <p className="mt-3 text-xs font-medium">Potential factors to review</p>
                  <ul className="mt-1 grid list-disc gap-x-6 pl-4 text-xs text-muted sm:grid-cols-2"><li>Recent training intensity</li><li>Sleep consistency</li><li>Lifestyle changes</li><li>Recovery time</li></ul>
                  <p className="mt-3 rounded-xl bg-surface-2 p-2.5 text-[11px] text-muted">This is a statistical comparison with your own history. It does not diagnose illness or predict disease. Speak with a clinician about health concerns.</p>
                  <DriftExplainer analysis={analysis} episode={episode} />
                </>
              ) : (
                <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 text-lime" /><p className="text-sm text-muted">No sustained multi-signal drift with the current settings. Individual readings may still vary day to day without forming a pattern.</p></div>
              )}
            </CardBody>
          </Card>
        </StaggerItem>
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full"><CardHeader title="Metric comparison" subtitle="Latest rolling average vs baseline" /><CardBody><DeviationBars metrics={analysis.metrics} threshold={cfg.sdThreshold} /></CardBody></Card>
        </StaggerItem>
      </div>

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title="Multi-signal timeline" subtitle="Number of metrics in sustained unfavourable deviation each day" />
          <CardBody>
            <TimeSeriesChart data={countRows} xKey="date" height={140} ariaLabel="Number of metrics deviating per day" pinnable={false}
              series={[{ key: "count", label: "Metrics deviating", color: "amber", type: "step", width: 2, format: (v) => String(Math.round(v)) }]} bands={epBands}
              axes={{ left: { domain: [0, 4], format: (v) => String(Math.round(v)) } }} />
          </CardBody>
        </Card>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title="Historical drift events" subtitle="All sustained single-metric deviations and multi-signal patterns for this baseline" />
          <CardBody>
            {allRuns.length === 0 ? <EmptyState title="No drift events" text="No metric stayed beyond the threshold for the required number of days." /> : (
              <ul className="divide-y divide-border">
                {analysis.episodes.slice().reverse().map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><div className="flex items-center gap-2"><Badge tone="amber">Multi-signal</Badge><span className="text-sm font-medium">{fmtDate(e.startDate)} – {fmtDate(e.endDate)}</span><span className="text-xs text-muted">{e.durationDays} days{e.ongoing ? " · ongoing" : ""}</span></div>
                      <p className="mt-1 text-xs text-muted">{e.metrics.map((m) => `${METRICS[m.key].short} ${formatPct(m.pctChange)}`).join(" · ")}</p></div>
                    <Badge tone={e.severity === "strong" ? "amber" : "muted"}>{e.severity === "strong" ? "Strong pattern" : "Moderate pattern"}</Badge>
                  </li>
                ))}
                {allRuns.map(({ m, r }) => (
                  <li key={m.key + r.startIndex} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2"><Badge>{METRICS[m.key].short}</Badge><span className="text-sm">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span><span className="text-xs text-muted">{r.length} days · peak {Math.abs(r.peakZ).toFixed(1)} SD</span></div>
                    <span className="text-xs text-muted">Single-metric · {analysis.episodes.some((e) => r.endIndex >= e.startIndex && r.startIndex <= e.endIndex) ? "part of a multi-signal pattern" : "not corroborated by other signals"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

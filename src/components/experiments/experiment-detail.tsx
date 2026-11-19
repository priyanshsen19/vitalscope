"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Download, Pause, Pencil, Play, Square, Trash2, TriangleAlert } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Collapsible, Progress, Segmented } from "@/components/ui/misc";
import { TimeSeriesChart, type ChartRow } from "@/components/charts/time-series-chart";
import { AdherenceCalendar } from "./adherence-calendar";
import { EmptyState } from "@/components/shared/states";
import { useApp } from "@/lib/store/app-context";
import { buildExperimentReport, calculateExperimentResults } from "@/lib/analytics/experiments";
import { METRICS, formatPct } from "@/lib/metrics";
import { downloadFile, slugify, cn } from "@/lib/utils";
import type { Experiment, ExperimentMetricResult, Verdict } from "@/types/experiment";
import type { MetricKey } from "@/types/health";
import { PLAIN } from "@/lib/plain";

const simpleStatus: Record<Experiment["status"], string> = { draft: "not started", active: "in progress", paused: "on hold", completed: "finished" };
const simpleVerdict: Record<Verdict, string> = { improved: "better", worsened: "less good", changed: "changed", unchanged: "about the same", unavailable: "no data" };
const verdictLine: Record<Verdict, string> = {
  improved: "That’s a move in a good direction.",
  worsened: "That moved in a less helpful direction.",
  changed: "It changed, though this measurement has no clear “better” direction.",
  unchanged: "That’s about the same as before.",
  unavailable: "We don’t have enough readings to compare.",
};
const confLine = { High: "We’re fairly confident this difference is real.", Moderate: "This looks promising, but a few more days would make it clearer.", Low: "It’s too early to be sure — more days or more check-ins will help." } as const;
const pname = (k: MetricKey) => (PLAIN[k]?.name ?? METRICS[k].label);

const verdictTone: Record<Verdict, Tone> = { improved: "lime", worsened: "amber", changed: "cyan", unchanged: "muted", unavailable: "muted" };
const statusTone: Record<Experiment["status"], Tone> = { draft: "muted", active: "lime", paused: "amber", completed: "cyan" };

export function ExperimentDetail({ exp, onEdit, onDelete }: { exp: Experiment; onEdit: () => void; onDelete: () => void }) {
  const { dataset, settings, setExperimentStatus, fmt, fmtDate, conv, unitOf } = useApp();
  const simple = settings.viewMode === "simple";
  const res = useMemo(() => calculateExperimentResults(dataset, exp, settings.source, settings.units), [dataset, exp, settings.source, settings.units]);
  const [metricKey, setMetricKey] = useState<MetricKey>(exp.primaryMetric);
  const [showFindings, setShowFindings] = useState(true);
  const [showConf, setShowConf] = useState(false);

  const keys = res.metrics.filter((m) => m.verdict !== "unavailable").map((m) => m.key);
  const activeKey = keys.includes(metricKey) ? metricKey : keys[0] ?? exp.primaryMetric;
  const mr: ExperimentMetricResult | undefined = res.metrics.find((m) => m.key === activeKey);
  const progress = res.period.planned ? Math.min(100, (res.period.elapsed / res.period.planned) * 100) : 0;

  const chartRows: ChartRow[] = useMemo(() => {
    if (!mr) return [];
    const len = Math.max(mr.baselineSeries.length, mr.experimentSeries.length);
    return Array.from({ length: len }, (_, i) => ({
      day: i + 1,
      baseline: mr.baselineSeries[i]?.value != null ? conv(mr.key, mr.baselineSeries[i].value as number) : null,
      experiment: mr.experimentSeries[i]?.value != null ? conv(mr.key, mr.experimentSeries[i].value as number) : null,
    }));
  }, [mr, conv]);

  const doExport = () => downloadFile(`${slugify(exp.name)}-report.md`, buildExperimentReport(exp, res, dataset, settings.units), "text/markdown");
  const isStatus = (s: Experiment["status"][]) => s.includes(exp.status);

  return (
    <div className="space-y-4">
      <Card>
        <div className="px-4 pt-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone[exp.status]}>{simple ? simpleStatus[exp.status] : exp.status}</Badge><Badge>{exp.category}</Badge><Badge>{exp.durationDays} days</Badge>{exp.isSample ? <Badge tone="violet">Sample</Badge> : null}</div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{exp.name}</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{simple ? "What you hope will happen" : "Hypothesis"}</dt><dd className="mt-0.5 text-fg/90">{exp.hypothesis}</dd></div>
            <div><dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{simple ? "What you’re doing" : "Behaviour tested"}</dt><dd className="mt-0.5 text-fg/90">{exp.behaviour}</dd></div>
            <div><dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{simple ? "Main thing we’re watching" : "Primary metric"}</dt><dd className="mt-0.5">{simple ? pname(exp.primaryMetric) : METRICS[exp.primaryMetric].label}</dd></div>
            <div><dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{simple ? "Also watching" : "Secondary metrics"}</dt><dd className="mt-0.5">{exp.secondaryMetrics.map((k) => (simple ? pname(k) : METRICS[k].label)).join(", ") || "None"}</dd></div>
          </dl>
        </div>
        <div className="px-4 pb-4 pt-4 sm:px-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>{exp.startDate ? `Day ${Math.min(res.period.elapsed, exp.durationDays)} of ${exp.durationDays} · ${fmtDate(exp.startDate)}` : "Not started"}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} tone={exp.status === "paused" ? "amber" : "lime"} label="Experiment progress" />
          <div className="mt-4 flex flex-wrap gap-2">
            {exp.status === "draft" ? <Button variant="primary" size="sm" onClick={() => setExperimentStatus(exp.id, "active", exp.startDate ?? undefined)}><Play className="h-3.5 w-3.5" />{simple ? "Start habit" : "Start experiment"}</Button> : null}
            {exp.status === "active" ? <Button size="sm" onClick={() => setExperimentStatus(exp.id, "paused")}><Pause className="h-3.5 w-3.5" />Pause</Button> : null}
            {exp.status === "paused" ? <Button variant="primary" size="sm" onClick={() => setExperimentStatus(exp.id, "active")}><Play className="h-3.5 w-3.5" />Resume</Button> : null}
            {isStatus(["active", "paused"]) ? <Button size="sm" onClick={() => setExperimentStatus(exp.id, "completed")}><Square className="h-3.5 w-3.5" />{simple ? "Finish" : "Complete"}</Button> : null}
            {exp.status === "completed" ? <Button size="sm" onClick={() => setExperimentStatus(exp.id, "active")}><Play className="h-3.5 w-3.5" />Reopen</Button> : null}
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Edit</Button>
            <Button size="sm" variant="outline" onClick={doExport}><Download className="h-3.5 w-3.5" />{simple ? "Save report" : "Export report"}</Button>
            <Button size="sm" variant="danger" className="ml-auto" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          </div>
        </div>
      </Card>

      {!res.ready ? (
        <EmptyState title={exp.status === "draft" ? "Ready when you are" : "Results are on their way"} text={res.reason ?? "No results yet."} />
      ) : simple && mr ? (
        <>
          <Card>
            <CardHeader title="What happened" subtitle={`${res.period.elapsed} days so far · done on ${res.adherence.adherent} of ${res.adherence.elapsed} days`} />
            <CardBody className="space-y-4">
              {(() => { const p = res.metrics.find((m) => m.isPrimary) ?? mr; return (
                <div className="rounded-2xl bg-fg/[0.04] p-4">
                  <p className="text-[15px] leading-relaxed">Before you started, your <b>{pname(p.key).toLowerCase()}</b> was usually <b>{fmt(p.key, p.baselineMean)}</b>. While doing this habit it averaged <b>{fmt(p.key, p.experimentMean)}</b>.</p>
                  <p className={cn("mt-2 text-sm font-semibold", p.verdict === "improved" ? "text-lime" : p.verdict === "worsened" ? "text-amber" : "text-fg/80")}>{verdictLine[p.verdict]}</p>
                  <p className="mt-1 text-sm text-muted">{confLine[res.confidence.level as keyof typeof confLine] ?? ""}</p>
                </div>
              ); })()}
              {res.metrics.filter((m) => !m.isPrimary).length ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">The other things we watched</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {res.metrics.filter((m) => !m.isPrimary).map((m) => (
                      <li key={m.key} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm">
                        <span className="truncate">{pname(m.key)}</span>
                        <Badge tone={verdictTone[m.verdict]}>{simpleVerdict[m.verdict]}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="flex gap-2 text-[11px] leading-relaxed text-muted"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />This shows what changed while you did the habit. Other things in your life may also have played a part, so it isn’t proof the habit caused it.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Before vs during" subtitle="Dashed line: before you started · green line: while doing the habit" action={<Segmented<MetricKey> id="exp-metric-s" size="sm" ariaLabel="Measurement" value={activeKey} onChange={setMetricKey} options={keys.map((k) => ({ value: k, label: METRICS[k].short }))} />} />
            <CardBody>
              <TimeSeriesChart data={chartRows} xKey="day" xType="number" xFormatter={(v) => `Day ${v}`} height={240} ariaLabel={`${pname(activeKey)} before vs during`}
                series={[
                  { key: "baseline", label: "Before", color: "muted", dashed: true, width: 1.75, format: (v) => v.toFixed(METRICS[activeKey].decimals) },
                  { key: "experiment", label: "During habit", color: "lime", width: 2.25, format: (v) => v.toFixed(METRICS[activeKey].decimals) },
                ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Days you did it" subtitle="Tap a day to mark it done, missed, or clear it" />
            <CardBody><AdherenceCalendar exp={exp} res={res} /></CardBody>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader title="Findings" subtitle="Deterministic summary of measured changes" action={<button onClick={() => setShowFindings((s) => !s)} aria-expanded={showFindings} className="text-xs text-muted hover:text-fg"><ChevronDown className={cn("h-4 w-4 transition-transform", showFindings && "rotate-180")} /></button>} />
            <CardBody>
              <motion.p key={res.summary} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium leading-relaxed">{res.summary}</motion.p>
              <Collapsible open={showFindings}>
                <ul className="mt-3 space-y-1.5 text-sm text-muted">{res.observations.map((o, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />{o}</li>)}</ul>
              </Collapsible>
              <div className="mt-4 flex gap-2 rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-muted"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />This is an observational personal experiment. It shows how measurements differed between two periods and does not establish that the behaviour caused the change.</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Before / after" subtitle={`Baseline ${fmtDate(res.baseline.start)} – ${fmtDate(res.baseline.end)} (${res.baseline.days} d) vs experiment ${fmtDate(res.period.start)} – ${fmtDate(res.period.end)} (${res.period.elapsed} d)`} />
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead><tr className="border-b border-border text-xs text-muted"><th className="pb-2 font-medium">Metric</th><th className="pb-2 font-medium">Baseline</th><th className="pb-2 font-medium">Experiment</th><th className="pb-2 font-medium">Change</th><th className="pb-2 font-medium">Effect</th><th className="pb-2 text-right font-medium">Result</th></tr></thead>
                <tbody>
                  {res.metrics.map((m) => (
                    <tr key={m.key} className="border-b border-border/60 tabular-nums">
                      <td className="py-2.5 pr-3"><button onClick={() => m.verdict !== "unavailable" && setMetricKey(m.key)} className={cn("text-left font-medium hover:text-cyan", activeKey === m.key && "text-cyan")}>{METRICS[m.key].label}</button>{m.isPrimary ? <span className="ml-1.5 text-[10px] uppercase text-muted">primary</span> : null}</td>
                      <td className="pr-3">{fmt(m.key, m.baselineMean)}</td><td className="pr-3">{fmt(m.key, m.experimentMean)}</td>
                      <td className={cn("pr-3 font-medium", m.verdict === "improved" ? "text-lime" : m.verdict === "worsened" ? "text-amber" : "")}>{formatPct(m.pctChange)}</td>
                      <td className="pr-3 text-muted">{m.effectSize === null ? "—" : `${m.effectSize.toFixed(2)} SD`}</td>
                      <td className="text-right"><Badge tone={verdictTone[m.verdict]}>{m.verdict}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted">Effect = difference in means ÷ baseline standard deviation. Differences under 0.5 SD are reported as “unchanged”.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Trend comparison" subtitle="Both periods aligned by day number" action={<Segmented<MetricKey> id="exp-metric" size="sm" ariaLabel="Metric" value={activeKey} onChange={setMetricKey} options={keys.map((k) => ({ value: k, label: METRICS[k].short }))} />} />
            <CardBody>
              <TimeSeriesChart data={chartRows} xKey="day" xType="number" xFormatter={(v) => `Day ${v}`} height={260} ariaLabel={`${METRICS[activeKey].label} baseline vs experiment`}
                series={[
                  { key: "baseline", label: "Baseline period", color: "muted", dashed: true, width: 1.75, format: (v) => v.toFixed(METRICS[activeKey].decimals) },
                  { key: "experiment", label: "Experiment period", color: "lime", width: 2.25, format: (v) => v.toFixed(METRICS[activeKey].decimals) },
                ]}
                refs={mr && mr.baselineMean !== null ? [{ y: conv(activeKey, mr.baselineMean), label: `baseline mean ${conv(activeKey, mr.baselineMean).toFixed(METRICS[activeKey].decimals)} ${unitOf(activeKey)}`, color: "muted" }] : []} />
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Behaviour adherence" subtitle={res.adherence.rate === null ? "No check-ins yet" : `${res.adherence.adherent} of ${res.adherence.elapsed} days · ${Math.round(res.adherence.rate * 100)}%`} />
              <CardBody><AdherenceCalendar exp={exp} res={res} /></CardBody>
            </Card>
            <Card>
              <CardHeader title={`Confidence: ${res.confidence.level}`} subtitle={`${res.confidence.score}/100 · observational evidence`} action={<button onClick={() => setShowConf((s) => !s)} className="text-xs text-cyan hover:underline" aria-expanded={showConf}>{showConf ? "Hide" : "Explain"}</button>} />
              <CardBody className="space-y-3">
                <Progress value={res.confidence.score} tone={res.confidence.level === "High" ? "lime" : res.confidence.level === "Moderate" ? "cyan" : "amber"} label="Confidence" />
                {res.confidence.factors.map((f) => (
                  <div key={f.label}>
                    <div className="mb-1 flex justify-between text-xs"><span>{f.label}</span><span className="tabular-nums text-muted">{Math.round(f.score * 100)}%</span></div>
                    <Progress value={f.score * 100} tone="cyan" className="h-1" label={f.label} />
                    <Collapsible open={showConf}><p className="mt-1 text-[11px] text-muted">{f.detail}</p></Collapsible>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {!res.ready && exp.startDate && exp.status !== "draft" ? (
        <Card><CardHeader title="Behaviour adherence" subtitle="Log your check-ins as you go" /><CardBody><AdherenceCalendar exp={exp} res={res} /></CardBody></Card>
      ) : null}
    </div>
  );
}

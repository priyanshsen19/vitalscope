"use client";

import { useMemo, useState } from "react";
import { Bike, Footprints, Info, PersonStanding, Brain } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SimulatedTag } from "@/components/ui/badge";
import { Segmented, Progress } from "@/components/ui/misc";
import { Switch } from "@/components/ui/form";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { UnavailableNotice } from "@/components/shared/states";
import { TimeSeriesChart, type ChartBand, type ChartRow, type ChartSeries } from "@/components/charts/time-series-chart";
import { useApp } from "@/lib/store/app-context";
import { isMetricAvailable, getSeries } from "@/lib/data/selectors";
import { BB_SIGNALS, compareWorkoutResponses, relativeToPre, windowSamples, type BBSignal } from "@/lib/analytics/brain-body";
import { calculateCorrelations } from "@/lib/analytics/insights";
import type { Workout, WorkoutKind } from "@/types/health";
import { cn } from "@/lib/utils";

const kindIcon: Record<WorkoutKind, typeof Bike> = { running: PersonStanding, cycling: Bike, walking: Footprints };
const WCOLORS: Record<string, string> = { "w-run": "danger", "w-cycle": "cyan", "w-walk": "lime" };
type Win = "full" | "before-during" | "during" | "recovery";
type DailyKey = "brainFlow" | "entropy" | "hrv" | "sleepEfficiency" | "workoutIntensity";
const DAILY: { key: DailyKey; label: string; color: string; simulated: boolean }[] = [
  { key: "brainFlow", label: "BrainFlow", color: "violet", simulated: true },
  { key: "entropy", label: "Entropy", color: "amber", simulated: true },
  { key: "hrv", label: "HRV", color: "lime", simulated: false },
  { key: "sleepEfficiency", label: "Sleep quality", color: "cyan", simulated: false },
  { key: "workoutIntensity", label: "Exercise intensity", color: "danger", simulated: false },
];

const fmtSigned = (v: number, d: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;

export default function BrainBodyPage() {
  const { dataset, setDataMode } = useApp();
  if (dataset.workouts.length > 0) return <BrainBodyDemo />;
  return (
    <Stagger>
      <StaggerItem>
        <PageHeader icon={Brain} accent="violet" eyebrow="Module 04 · Exploratory" title="Brain-Body Intelligence" subtitle="Explore how physiological signals interact across activity and recovery." actions={<Badge tone="violet">Demo data only</Badge>} />
      </StaggerItem>
      <StaggerItem>
        <div className="vs-card rounded-2xl border border-border/70 p-5 text-sm">
          <p className="font-semibold">Not available with real data</p>
          <p className="mt-1 text-muted">This module needs BrainFlow and Entropy from a Temple device plus minute-by-minute workout recordings. No public Temple data exists, and the real {dataset.provenance?.dataset} file only has daily summaries — so rather than invent anything, this page is shown on demo data only.</p>
          <button onClick={() => setDataMode("demo")} className="mt-3 rounded-full bg-violet/15 px-3 py-1.5 text-xs font-semibold text-violet hover:bg-violet/25">Switch to demo data to explore it</button>
        </div>
      </StaggerItem>
    </Stagger>
  );
}

function BrainBodyDemo() {
  const { dataset, settings, fmtDate } = useApp();
  const src = settings.source;
  const workouts = dataset.workouts;
  const [wid, setWid] = useState(workouts[0]?.id ?? "");
  const [sel, setSel] = useState<BBSignal[]>(["brainFlow", "hr", "entropy"]);
  const [win, setWin] = useState<Win>("full");
  const [norm, setNorm] = useState(false);
  const [cmpKey, setCmpKey] = useState<BBSignal>("brainFlow");
  const [daily, setDaily] = useState<DailyKey[]>(["brainFlow", "entropy"]);

  const available = isMetricAvailable("brainFlow", src, dataset);
  const workout: Workout = workouts.find((w) => w.id === wid) ?? workouts[0];
  const { summaries, observations } = useMemo(() => compareWorkoutResponses(workouts, workout.id), [workouts, workout.id]);
  const s = summaries.find((x) => x.id === workout.id)!;

  const samples = useMemo(() => windowSamples(workout, win), [workout, win]);
  const D = workout.durationMin;
  const xDomain: [number, number] = [samples[0].t, samples[samples.length - 1].t];

  const { rows, series, axes } = useMemo(() => {
    const keys = BB_SIGNALS.filter((b) => sel.includes(b.key));
    const ranges: Record<string, [number, number]> = {};
    keys.forEach((k) => {
      const v = samples.map((x) => (k.key === "brainFlow" ? x.brainFlow : k.key === "entropy" ? x.entropy : k.key === "hr" ? x.hr : k.key === "hrv" ? x.hrv : x.rr));
      ranges[k.key] = [Math.min(...v), Math.max(...v)];
    });
    const rowsOut: ChartRow[] = samples.map((x) => {
      const row: ChartRow = { t: x.t };
      keys.forEach((k) => {
        const raw = k.key === "brainFlow" ? x.brainFlow : k.key === "entropy" ? x.entropy : k.key === "hr" ? x.hr : k.key === "hrv" ? x.hrv : x.rr;
        const [lo, hi] = ranges[k.key];
        row[k.key] = norm ? Math.round(((raw - lo) / (hi - lo || 1)) * 1000) / 10 : raw;
        row[`${k.key}_raw`] = raw;
      });
      return row;
    });
    const ser: ChartSeries[] = keys.map((k) => ({
      key: k.key, label: k.label, color: k.colorVar, axis: norm ? "left" : k.key, simulated: k.simulatedTemple, width: 2,
      format: norm ? (v: number) => `${v.toFixed(0)}%` : (v: number) => `${v.toFixed(k.decimals)} ${k.unit}`,
    }));
    const ax: Record<string, { format?: (v: number) => string; domain?: [number, number] }> = {};
    keys.forEach((k) => { ax[k.key] = { format: (v: number) => v.toFixed(k.decimals > 1 ? 2 : k.decimals) }; });
    if (norm) ax.left = { format: (v: number) => `${v.toFixed(0)}%`, domain: [-5, 105] };
    return { rows: rowsOut, series: ser, axes: ax };
  }, [samples, sel, norm]);

  const bands: ChartBand[] = [
    { x1: -workout.preMin, x2: 0, color: "muted", opacity: 0.08, label: "Before" },
    { x1: 0, x2: D, color: "violet", opacity: 0.09, label: "Exercise" },
    { x1: D, x2: D + workout.recoveryMin, color: "cyan", opacity: 0.08, label: "Recovery" },
  ];

  // comparison chart
  const cmpMeta = BB_SIGNALS.find((b) => b.key === cmpKey)!;
  const cmpRows = useMemo(() => {
    const mode = cmpKey === "hrv" ? "percent" : "delta";
    const rel = Object.fromEntries(workouts.map((w) => [w.id, relativeToPre(w, cmpKey, mode)]));
    const maxT = Math.max(...workouts.map((w) => w.durationMin + w.recoveryMin));
    return Array.from({ length: maxT + 11 }, (_, i) => {
      const t = i - 10;
      const row: ChartRow = { t };
      workouts.forEach((w) => { row[w.id] = rel[w.id].find((p) => p.t === t)?.value ?? null; });
      return row;
    });
  }, [workouts, cmpKey]);
  const cmpUnit = cmpKey === "hrv" ? "%" : cmpMeta.unit;
  const cmpDec = cmpKey === "entropy" ? 3 : 1;

  const dailyRows: ChartRow[] = useMemo(() => {
    const series = Object.fromEntries(DAILY.map((d) => [d.key, getSeries(dataset, d.key, src)]));
    return dataset.days.slice(-settings.dateRange).map((d) => {
      const row: ChartRow = { date: d.date };
      DAILY.forEach((k) => { row[k.key] = series[k.key]?.[d.index]?.value ?? null; });
      return row;
    });
  }, [dataset, src, settings.dateRange]);
  const dailySeries: ChartSeries[] = DAILY.filter((d) => daily.includes(d.key) && isMetricAvailable(d.key, src, dataset)).map((d) => ({
    key: d.key, label: d.label, color: d.color, axis: d.key, simulated: d.simulated, type: d.key === "workoutIntensity" ? "bar" : "line", width: 2, opacity: d.key === "workoutIntensity" ? 0.35 : 1,
    format: (v: number) => v.toFixed(d.key === "entropy" ? 3 : 1),
  }));

  const corrs = useMemo(() => calculateCorrelations(dataset, src, [
    { a: "brainFlow", b: "hrv" }, { a: "brainFlow", b: "sleepEfficiency" }, { a: "entropy", b: "hrv" }, { a: "brainFlow", b: "mentalFatigue" }, { a: "entropy", b: "reactionTime" }, { a: "trainingLoad", b: "brainFlow", lag: 1 },
  ]), [dataset, src]);
  const labelOf = (k: string) => (k === "trainingLoad" ? "Training load" : k === "brainFlow" ? "BrainFlow" : k === "entropy" ? "Entropy" : k === "hrv" ? "HRV" : k === "sleepEfficiency" ? "Sleep efficiency" : k === "mentalFatigue" ? "Mental fatigue" : "Reaction time");

  return (
    <Stagger>
      <StaggerItem>
        <PageHeader icon={Brain} accent="violet" eyebrow="Module 04 · Exploratory" title="Brain-Body Intelligence" subtitle="Explore how physiological signals interact across activity and recovery." actions={<Badge tone="violet">Temple-compatible · Simulated</Badge>} />
        <div className="mb-6 flex gap-2.5 rounded-2xl border border-violet/25 bg-violet/5 p-3 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" />
          <p>BrainFlow Index and Entropy are <span className="text-fg">simulated Temple-compatible measurements</span> generated for this demo. No Temple device is connected. They are not clinical measurements and are not claimed to measure cognition or cerebral blood flow. This page is an exploratory physiological analysis, not a diagnostic tool.</p>
        </div>
      </StaggerItem>

      {!available ? (
        <StaggerItem><UnavailableNotice metrics="BrainFlow, Entropy and workout-session signals" /></StaggerItem>
      ) : (
        <>
          <StaggerItem>
            <div className="grid gap-3 md:grid-cols-3" role="tablist" aria-label="Workout sessions">
              {workouts.map((w) => {
                const Icon = kindIcon[w.kind];
                const on = w.id === workout.id;
                return (
                  <button key={w.id} role="tab" aria-selected={on} onClick={() => setWid(w.id)} className={cn("flex items-start gap-3 rounded-2xl vs-card border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20", on ? "border-violet/60 ring-1 ring-violet/30" : "border-border")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: `rgb(var(--${WCOLORS[w.id]}) / 0.15)`, color: `rgb(var(--${WCOLORS[w.id]}))` }}><Icon className="h-4 w-4" /></span>
                    <span><span className="block text-sm font-medium">{w.name}</span><span className="mt-0.5 block text-xs text-muted">{fmtDate(w.date)} · {w.durationMin} min · RPE {w.rpe}</span><span className="mt-1 block"><Badge tone={w.intensityLabel === "High" ? "amber" : w.intensityLabel === "Moderate" ? "cyan" : "lime"}>{w.intensityLabel} intensity</Badge></span></span>
                  </button>
                );
              })}
            </div>
          </StaggerItem>

          <StaggerItem className="mt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {[
                { l: "Duration", v: `${s.durationMin} min`, n: `${workout.preMin} min before · ${workout.recoveryMin} min recovery` },
                { l: "Avg heart rate", v: `${s.avgHr.toFixed(0)} bpm`, n: `peak ${s.peakHr.toFixed(0)} · resting ${s.preHr.toFixed(0)}` },
                { l: "HR response", v: `−${s.hrRecovery1.toFixed(0)} bpm`, n: `1 min after · −${s.hrRecovery5.toFixed(0)} at 5 min` },
                { l: "HRV trend", v: `${fmtSigned(s.hrvDuringPct, 0)}%`, n: `recovery ${fmtSigned(s.hrvRecoveryPct, 0)}% vs pre`, sim: true },
                { l: "BrainFlow trend", v: fmtSigned(s.bfPeakDelta, 1), n: `peak at min ${s.bfPeakAt} · end ${fmtSigned(s.bfEndDelta, 1)}`, sim: true },
                { l: "Entropy trend", v: fmtSigned(s.entropyMinDelta, 3), n: `lowest · recovery ${fmtSigned(s.entropyRecoveryDelta, 3)}`, sim: true },
              ].map((c) => (
                <Card key={c.l} className="p-3.5"><p className="flex items-center gap-1.5 text-[11px] text-muted">{c.l}{c.sim ? <SimulatedTag /> : null}</p><p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{c.v}</p><p className="mt-0.5 text-[10px] leading-snug text-muted">{c.n}</p></Card>
              ))}
            </div>
          </StaggerItem>

          <StaggerItem className="mt-6">
            <Card>
              <CardHeader title="Multi-signal timeline" subtitle={`${workout.name} · ${fmtDate(workout.date)} · synchronised, minutes relative to exercise start`}
                action={<div className="flex items-center gap-2 text-xs text-muted"><span>Normalise</span><Switch checked={norm} onChange={setNorm} label="Normalise signals to 0–100%" /></div>} />
              <CardBody>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {BB_SIGNALS.map((b) => {
                    const on = sel.includes(b.key);
                    return (
                      <button key={b.key} aria-pressed={on} onClick={() => setSel((cur) => (on ? (cur.length > 1 ? cur.filter((k) => k !== b.key) : cur) : [...cur, b.key]))}
                        className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "text-fg" : "border-border text-muted hover:text-fg")}
                        style={on ? { borderColor: `rgb(var(--${b.colorVar}) / 0.6)`, background: `rgb(var(--${b.colorVar}) / 0.12)` } : undefined}>
                        <span className="h-2 w-2 rounded-full" style={{ background: `rgb(var(--${b.colorVar}))` }} />{b.label}{b.simulatedTemple ? <SimulatedTag /> : null}
                      </button>
                    );
                  })}
                  <div className="ml-auto"><Segmented<Win> id="bb-win" size="sm" ariaLabel="Timeline window" value={win} onChange={setWin} options={[{ value: "full", label: "Full session" }, { value: "before-during", label: "Pre + exercise" }, { value: "during", label: "Exercise" }, { value: "recovery", label: "Recovery" }]} /></div>
                </div>
                <TimeSeriesChart data={rows} xKey="t" xType="number" xDomain={xDomain} xFormatter={(v) => `${Number(v) > 0 ? "+" : ""}${v} min`} series={series} bands={bands} axes={axes} height={320} ariaLabel={`Multi-signal timeline for ${workout.name}`} />
                <p className="mt-2 text-[11px] text-muted">{norm ? "Each signal is scaled to its own range (0–100%) so trajectories can be compared directly. Tooltips show scaled values." : "The first two selected units use the left and right axes; additional signals use their own hidden scales — use Normalise for a shared view."}</p>
              </CardBody>
            </Card>
          </StaggerItem>

          <StaggerItem className="mt-6">
            <Card>
              <CardHeader title="Compare exercise sessions" subtitle="Change from each session’s pre-exercise level, aligned at exercise start"
                action={<Segmented<BBSignal> id="bb-cmp" size="sm" ariaLabel="Comparison metric" value={cmpKey} onChange={setCmpKey} options={BB_SIGNALS.map((b) => ({ value: b.key, label: b.label.replace(" Index", "").replace("Respiratory rate", "Resp.") }))} />} />
              <CardBody>
                <TimeSeriesChart data={cmpRows} xKey="t" xType="number" xFormatter={(v) => `${Number(v) > 0 ? "+" : ""}${v} min`} height={280} ariaLabel={`${cmpMeta.label} change by session`}
                  series={workouts.map((w) => ({ key: w.id, label: w.name, color: WCOLORS[w.id], width: w.id === workout.id ? 2.75 : 1.5, opacity: w.id === workout.id ? 1 : 0.7, simulated: true, format: (v: number) => `${fmtSigned(v, cmpDec)} ${cmpUnit}` }))}
                  refs={[{ y: 0, label: "pre-exercise level", color: "muted" }]} axes={{ left: { format: (v: number) => v.toFixed(cmpKey === "entropy" ? 2 : 0) } }} />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead><tr className="border-b border-border text-xs text-muted"><th className="pb-2 font-medium">Session</th><th className="pb-2 font-medium">Avg HR</th><th className="pb-2 font-medium">HR drop (1 min)</th><th className="pb-2 font-medium">HRV (during)</th><th className="pb-2 font-medium">BrainFlow (peak → end)</th><th className="pb-2 font-medium">Entropy (lowest)</th></tr></thead>
                    <tbody>{summaries.map((x) => (
                      <tr key={x.id} className={cn("border-b border-border/60 tabular-nums", x.id === workout.id && "bg-surface-2/60")}>
                        <td className="py-2.5 pr-3 font-medium"><button onClick={() => setWid(x.id)} className="hover:text-violet">{x.name}</button></td><td>{x.avgHr.toFixed(0)} bpm</td><td>{x.hrRecovery1.toFixed(0)} bpm</td><td>{fmtSigned(x.hrvDuringPct, 0)}%</td><td>{fmtSigned(x.bfPeakDelta, 1)} → {fmtSigned(x.bfEndDelta, 1)}</td><td>{fmtSigned(x.entropyMinDelta, 3)}</td></tr>))}</tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </StaggerItem>

          <StaggerItem className="mt-6">
            <Card>
              <CardHeader title="Cross-signal observations" subtitle={`Generated from the selected session (${workout.name}) and the other sessions`} />
              <CardBody className="grid gap-4 md:grid-cols-2">
                {observations.map((o) => (
                  <div key={o.id} className="rounded-xl border border-border p-3.5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">{o.title}<SimulatedTag /></h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.text}</p>
                    <ul className="mt-2.5 space-y-1 border-t border-border pt-2.5 text-[11px] text-muted">{o.evidence.map((e) => <li key={e.label} className="flex justify-between gap-3"><span>{e.label}</span><span className="font-medium tabular-nums text-fg">{e.value}</span></li>)}</ul>
                  </div>))}
              </CardBody>
            </Card>
          </StaggerItem>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <StaggerItem className="lg:col-span-3">
              <Card className="h-full">
                <CardHeader title="Daily context" subtitle={`Last ${settings.dateRange} days · combine signals with exercise intensity and sleep`} />
                <CardBody>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {DAILY.filter((d) => isMetricAvailable(d.key, src, dataset)).map((d) => {
                      const on = daily.includes(d.key);
                      return <button key={d.key} aria-pressed={on} onClick={() => setDaily((cur) => (on ? (cur.length > 1 ? cur.filter((k) => k !== d.key) : cur) : [...cur, d.key]))} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", on ? "text-fg" : "border-border text-muted hover:text-fg")} style={on ? { borderColor: `rgb(var(--${d.color}) / 0.6)`, background: `rgb(var(--${d.color}) / 0.12)` } : undefined}>{d.label}{d.simulated ? <SimulatedTag /> : null}</button>;
                    })}
                  </div>
                  <TimeSeriesChart data={dailyRows} xKey="date" series={dailySeries} height={260} ariaLabel="Daily BrainFlow, Entropy and context" />
                </CardBody>
              </Card>
            </StaggerItem>
            <StaggerItem className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader title="Daily associations" subtitle="Pearson r across the 90-day history" />
                <CardBody className="space-y-3">
                  {corrs.map((c) => (
                    <div key={`${c.a}-${c.b}`}>
                      <div className="mb-1 flex justify-between text-xs"><span>{labelOf(c.a)} ↔ {labelOf(c.b)}{c.lag ? " (next day)" : ""}</span><span className="font-medium tabular-nums">{c.r.toFixed(2)}</span></div>
                      <Progress value={Math.abs(c.r) * 100} tone={c.r >= 0 ? "violet" : "amber"} className="h-1" label={`${labelOf(c.a)} and ${labelOf(c.b)} correlation`} />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted">Associations are exploratory; shared trends can create correlation without a direct relationship.</p>
                </CardBody>
              </Card>
            </StaggerItem>
          </div>
        </>
      )}
    </Stagger>
  );
}

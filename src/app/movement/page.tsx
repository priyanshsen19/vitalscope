"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/misc";
import { Select } from "@/components/ui/form";
import { Footprints } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { EmptyState, UnavailableNotice } from "@/components/shared/states";
import { MovementStatusBadge, TrendIcon } from "@/components/shared/status";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { TimeSeriesChart, type ChartBand } from "@/components/charts/time-series-chart";
import { GaitFigure } from "@/components/movement/gait-figure";
import { ProfileRadar } from "@/components/movement/profile-radar";
import { useApp } from "@/lib/store/app-context";
import { calculateMovementProfile, calculateMovementTrends, comparePeriods, generateMovementObservations, MOVEMENT_METRICS } from "@/lib/analytics/movement";
import { calculateRollingAverage } from "@/lib/analytics/baseline";
import { METRICS, formatPct } from "@/lib/metrics";
import type { MetricKey } from "@/types/health";
import { cn } from "@/lib/utils";

type CompareMode = "previous" | "baseline";

export default function MovementPage() {
  const { dataset, settings, conv, unitOf, fmt, fmtDate, updateSettings } = useApp();
  const range = settings.dateRange;
  const n = dataset.days.length;
  const from = n - range;
  const [selected, setSelected] = useState<MetricKey>("walkingSpeed");
  const [mode, setMode] = useState<CompareMode>("baseline");

  const trends = useMemo(() => calculateMovementTrends(dataset, settings.source, range), [dataset, settings.source, range]);
  const available = trends.filter((t) => t.available);
  const observations = useMemo(() => generateMovementObservations(trends, settings.units), [trends, settings.units]);
  const profileNow = useMemo(() => calculateMovementProfile(dataset, settings.source, from, n - 1), [dataset, settings.source, from, n]);
  const profileBase = useMemo(() => calculateMovementProfile(dataset, settings.source, 0, 29), [dataset, settings.source]);

  const prevStart = n - 2 * range;
  const prevOk = prevStart >= 0;
  const effectiveMode: CompareMode = mode === "previous" && !prevOk ? "baseline" : mode;
  const comparison = useMemo(() => comparePeriods(dataset, settings.source, { start: from, end: n - 1 }, effectiveMode === "previous" ? { start: prevStart, end: n - range - 1 } : { start: 0, end: 29 }), [dataset, settings.source, from, n, effectiveMode, prevStart, range]);

  if (available.length === 0) {
    return (
      <Stagger>
        <StaggerItem><PageHeader icon={Footprints} accent="cyan" eyebrow="Module 03" title="Movement Intelligence" subtitle="Understand how your movement patterns evolve over time." /></StaggerItem>
        <UnavailableNotice metrics="Walking speed, step length, asymmetry, double support and stair speeds" />
      </Stagger>
    );
  }

  const sel = trends.find((t) => t.key === selected) ?? available[0];
  const meta = METRICS[sel.key];
  const dec = sel.key === "stepLength" || sel.key === "walkingAsymmetry" || sel.key === "doubleSupport" ? 1 : 2;
  const toRows = (t: typeof sel) => {
    const roll = calculateRollingAverage(t.series, 7);
    return t.series.slice(from).map((p, i) => ({ date: p.date, raw: p.value === null ? null : conv(t.key, p.value), rolling: roll.slice(from)[i]?.value == null ? null : conv(t.key, roll.slice(from)[i].value as number) }));
  };
  const bandsFor = (t: typeof sel): ChartBand[] =>
    t.runs.filter((r) => r.endIndex >= from).map((r) => ({ x1: t.series[Math.max(r.startIndex, from)].date, x2: t.series[r.endIndex].date, color: r.direction === (METRICS[t.key].better === "higher" ? "down" : "up") ? "amber" : "lime", opacity: 0.14 }));

  const groups = {
    improving: available.filter((t) => t.status === "improving"),
    stable: available.filter((t) => t.status === "stable"),
    monitor: available.filter((t) => t.status === "monitor"),
  };
  const speed = trends.find((t) => t.key === "walkingSpeed");
  const step = trends.find((t) => t.key === "stepLength");
  const asym = trends.find((t) => t.key === "walkingAsymmetry");
  const allRuns = available.flatMap((t) => t.runs.map((r) => ({ t, r }))).sort((a, b) => b.r.startIndex - a.r.startIndex);

  return (
    <Stagger>
      <StaggerItem><PageHeader icon={Footprints} accent="cyan" eyebrow="Module 03" title="Movement Intelligence" subtitle="Understand how your movement patterns evolve over time." actions={<Badge tone="muted">Apple Watch · Simulated</Badge>} /></StaggerItem>

      <StaggerItem>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {trends.map((t) => {
            const m = METRICS[t.key];
            const on = selected === t.key;
            if (!t.available) return <Card key={t.key} className="border-dashed p-4"><p className="text-xs text-muted">{m.label}</p><p className="mt-2 text-sm">Not available in this source</p></Card>;
            const d = t.pctVsBaseline === null ? "flat" : t.pctVsBaseline > 0.5 ? "up" : t.pctVsBaseline < -0.5 ? "down" : "flat";
            return (
              <button key={t.key} onClick={() => setSelected(t.key)} aria-pressed={on} className={cn("rounded-2xl vs-card border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20", on ? "border-cyan/60 ring-1 ring-cyan/30" : "border-border")}>
                <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-muted">{m.label}</span><MovementStatusBadge status={t.status} /></div>
                <p className="mt-2 flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums tracking-tight"><AnimatedNumber value={t.current === null ? null : conv(t.key, t.current)} decimals={dec} /><span className="text-xs font-normal text-muted">{unitOf(t.key)}</span>
                  <span className="ml-auto flex items-center gap-0.5 text-xs font-medium text-muted"><TrendIcon dir={d} />{formatPct(t.pctVsBaseline)}</span></p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div><dt className="text-muted">Baseline</dt><dd className="font-medium tabular-nums">{fmt(t.key, t.baseline?.mean, false)}</dd></div>
                  <div><dt className="text-muted">Hist. avg</dt><dd className="font-medium tabular-nums">{fmt(t.key, t.historicalAvg, false)}</dd></div>
                  <div><dt className="text-muted">30-day Δ</dt><dd className="font-medium tabular-nums">{formatPct(t.thirty.pct)}</dd></div>
                </dl>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted">Current = 7-day average. Baseline = first 30 days. 30-day Δ compares the last 30 days with the 30 days before. Status = last 14 days vs baseline in standard deviations — not a medical threshold.</p>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title={`${meta.label} (${unitOf(sel.key)})`} subtitle={`${fmtDate(dataset.days[from].date)} – ${fmtDate(dataset.endDate)} · shaded = sustained deviation from baseline`}
            action={<Segmented<MetricKey> id="mv-metric" size="sm" ariaLabel="Mobility metric" value={sel.key} onChange={setSelected} options={MOVEMENT_METRICS.map((k) => ({ value: k, label: METRICS[k].short, disabled: !trends.find((t) => t.key === k)?.available }))} />} />
          <CardBody>
            <TimeSeriesChart data={toRows(sel)} xKey="date" height={280} ariaLabel={`${meta.label} over time`}
              series={[{ key: "raw", label: "Daily", color: "muted", opacity: 0.6, width: 1.25, dots: true, format: (v) => v.toFixed(dec + (settings.units === "imperial" ? 1 : 0)) }, { key: "rolling", label: "7-day average", color: "cyan", width: 2.25, format: (v) => v.toFixed(dec + (settings.units === "imperial" ? 1 : 0)) }]}
              refs={sel.baseline ? [{ y: conv(sel.key, sel.baseline.mean), label: "baseline", color: "lime" }] : []} bands={bandsFor(sel)} axes={{ left: { format: (v) => v.toFixed(dec) } }} />
          </CardBody>
        </Card>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">All mobility measurements</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {available.map((t) => (
            <Card key={t.key}><CardHeader title={METRICS[t.key].label} subtitle={unitOf(t.key)} /><CardBody className="pt-1">
              <TimeSeriesChart data={toRows(t)} xKey="date" height={150} pinnable={false} ariaLabel={`${METRICS[t.key].label} chart`} hideXAxis={false}
                series={[{ key: "raw", label: "Daily", color: "muted", opacity: 0.45, width: 1 }, { key: "rolling", label: "7-day avg", color: "cyan", width: 2 }]}
                refs={t.baseline ? [{ y: conv(t.key, t.baseline.mean), label: "", color: "lime" }] : []} bands={bandsFor(t)} axes={{ left: { format: (v) => v.toFixed(2) } }} />
            </CardBody></Card>
          ))}
        </div>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {([["improving", "Improving indicators", "lime"], ["stable", "Stable indicators", "cyan"], ["monitor", "Indicators worth monitoring", "amber"]] as const).map(([k, title, tone]) => (
            <Card key={k}><CardHeader title={title} subtitle={k === "monitor" ? "Beyond 1.5 SD of your own baseline" : "vs your personal baseline"} />
              <CardBody>{groups[k].length === 0 ? <p className="text-xs text-muted">None right now.</p> : (
                <ul className="space-y-2">{groups[k].map((t) => <li key={t.key} className="flex items-center justify-between gap-2 text-sm"><span>{METRICS[t.key].label}</span><Badge tone={tone}>{formatPct(t.pctVsBaseline)}</Badge></li>)}</ul>)}</CardBody></Card>
          ))}
        </div>
      </StaggerItem>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <StaggerItem className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader title="Compare periods" subtitle={effectiveMode === "previous" ? `Last ${range} days vs the ${range} days before` : `Last ${range} days vs your baseline (first 30 days)`}
              action={<Select aria-label="Comparison mode" className="h-8 w-auto text-xs" value={effectiveMode} onChange={(e) => setMode(e.target.value as CompareMode)}><option value="baseline">vs personal baseline</option><option value="previous" disabled={!prevOk}>vs previous period{prevOk ? "" : " (needs shorter range)"}</option></Select>} />
            <CardBody className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead><tr className="border-b border-border text-xs text-muted"><th className="pb-2 font-medium">Metric</th><th className="pb-2 font-medium">Selected period</th><th className="pb-2 font-medium">Reference</th><th className="pb-2 text-right font-medium">Change</th></tr></thead>
                <tbody>{comparison.filter((r) => r.a !== null).map((r) => (
                  <tr key={r.key} className="border-b border-border/60 tabular-nums"><td className="py-2.5 font-medium">{METRICS[r.key].label}</td><td>{fmt(r.key, r.a)}</td><td className="text-muted">{fmt(r.key, r.b)}</td>
                    <td className={cn("text-right font-medium", r.favourable === true ? "text-lime" : r.favourable === false ? "text-amber" : "text-muted")}>{formatPct(r.pct)}</td></tr>))}</tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted">Green = moved in the generally favourable direction; amber = the opposite. Based on your own history, not clinical norms.</p>
            </CardBody>
          </Card>
        </StaggerItem>
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader title="Gait" subtitle="Schematic, cadence from your measurements" />
            <CardBody className="flex flex-col items-center">
              {speed?.current && step?.current ? <GaitFigure speed={speed.current} stepLength={step.current} asymmetry={asym?.current ?? 3} /> : <EmptyState title="No gait data" text="Walking speed and step length are needed." />}
              {speed?.current && step?.current ? <p className="mt-1 text-center text-[11px] text-muted">{(speed.current / (step.current / 100)).toFixed(2)} steps/s · {fmt("walkingSpeed", speed.current)} · {fmt("stepLength", step.current)} · asymmetry {asym?.current?.toFixed(1)}%</p> : null}
            </CardBody>
          </Card>
        </StaggerItem>
      </div>

      {profileNow && profileBase ? (
        <StaggerItem className="mt-6">
          <Card>
            <CardHeader title="Mobility profile" subtitle={`Last ${range} days vs baseline · descriptive 0–100 indices`} />
            <CardBody className="grid items-center gap-4 md:grid-cols-2">
              <ProfileRadar current={profileNow} baseline={profileBase} label={`Last ${range} days`} />
              <dl className="space-y-3 text-sm">
                {([["consistency", "Walking consistency", "variation in daily walking speed"], ["regularity", "Step regularity", "variation in step length"], ["symmetry", "Symmetry", "left/right timing difference"], ["stairs", "Stair movement", "stair speeds relative to your baseline"], ["stability", "Stability", "double support time"]] as const).map(([k, label, note]) => (
                  <div key={k} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                    <div><dt className="font-medium">{label}</dt><dd className="text-[11px] text-muted">{note}</dd></div>
                    <span className="tabular-nums"><span className="font-semibold">{profileNow[k]}</span><span className="ml-1.5 text-xs text-muted">baseline {profileBase[k]}</span></span>
                  </div>))}
                <p className="text-[11px] text-muted">Indices are simple transformations of your own measurements for visual comparison. They are not clinical scores and do not identify any condition.</p>
              </dl>
            </CardBody>
          </Card>
        </StaggerItem>
      ) : null}

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title="Movement observations" subtitle="Generated from your measurements" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            {observations.map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-3.5">
                <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", { lime: "bg-lime", cyan: "bg-cyan", amber: "bg-amber", muted: "bg-muted" }[o.tone])} /><h4 className="text-sm font-semibold">{o.title}</h4></div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{o.text}</p>
                {o.evidence.length ? <ul className="mt-2.5 space-y-1 border-t border-border pt-2.5 text-[11px] text-muted">{o.evidence.map((e) => <li key={e.label}><span className="text-fg">{e.label}:</span> {e.value}</li>)}</ul> : null}
              </div>))}
            <p className="text-[11px] text-muted md:col-span-2">Observations describe changes relative to your own history. They do not identify neurological or musculoskeletal conditions.</p>
          </CardBody>
        </Card>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title="Historical movement changes" subtitle="Periods when a 5-day average stayed beyond 1.5 SD of baseline for ≥ 3 days" />
          <CardBody>
            {allRuns.length === 0 ? <EmptyState title="No sustained changes" text="No mobility metric moved beyond baseline for several days in a row." /> : (
              <ul className="divide-y divide-border">{allRuns.map(({ t, r }) => (
                <li key={t.key + r.startIndex} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm"><span className="font-medium">{METRICS[t.key].label}</span> {r.direction === "down" ? "below" : "above"} baseline</span>
                  <span className="text-xs text-muted">{fmtDate(r.startDate)} – {fmtDate(r.endDate)} · {r.length} days · peak {Math.abs(r.peakZ).toFixed(1)} SD {r.endIndex === n - 1 ? "· ongoing" : ""}</span>
                </li>))}</ul>)}
          </CardBody>
        </Card>
      </StaggerItem>
      <p className="mt-4 text-[11px] text-muted">Unit system: {settings.units}. <button className="text-cyan hover:underline" onClick={() => updateSettings({ units: settings.units === "metric" ? "imperial" : "metric" })}>Switch units</button></p>
    </Stagger>
  );
}

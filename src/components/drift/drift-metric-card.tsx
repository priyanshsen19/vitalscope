"use client";

import { Card } from "@/components/ui/card";
import { DriftStatusBadge, TrendIcon } from "@/components/shared/status";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { TimeSeriesChart, type ChartBand } from "@/components/charts/time-series-chart";
import type { MetricDrift } from "@/lib/analytics/drift-detection";
import { METRICS, formatPct } from "@/lib/metrics";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export function DriftMetricCard({ m, rangeDays, selected, onSelect }: { m: MetricDrift; rangeDays: number; selected: boolean; onSelect: () => void }) {
  const { fmt, fmtDate } = useApp();
  const meta = METRICS[m.key];
  if (!m.available) {
    return (
      <Card className="flex flex-col justify-between border-dashed p-4">
        <div>
          <p className="text-xs font-medium text-muted">{meta.label}</p>
          <p className="mt-3 text-sm font-medium">Not available</p>
          <p className="mt-1 text-xs text-muted">The selected data source does not record this measurement. Switch to Apple Watch or Combined.</p>
        </div>
      </Card>
    );
  }
  const slice = m.rolling.slice(-rangeDays);
  const data = m.series.slice(-rangeDays).map((p, i) => ({ date: p.date, raw: p.value, rolling: slice[i]?.value ?? null }));
  const bands: ChartBand[] = m.adverseRuns
    .filter((r) => r.endIndex >= m.series.length - rangeDays)
    .map((r) => ({ x1: m.series[Math.max(r.startIndex, m.series.length - rangeDays)].date, x2: m.series[r.endIndex].date, color: "amber", opacity: 0.16 }));
  const dir = m.trend;
  const adverseTrend = (dir === "up" && m.adverse === "up") || (dir === "down" && m.adverse === "down");
  return (
    <Card className={cn("cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20", selected && "border-cyan/60 ring-1 ring-cyan/30")}>
      <button onClick={onSelect} aria-pressed={selected} className="block w-full text-left" aria-label={`Select ${meta.label}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted">{meta.label}</p>
          <DriftStatusBadge status={m.status} />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums tracking-tight"><AnimatedNumber value={m.currentRolling} decimals={meta.decimals} /></span>
          <span className="text-xs text-muted">{meta.unit}</span>
          <span className={cn("ml-auto flex items-center gap-0.5 text-xs font-medium", m.status === "drifting" || m.status === "building" ? "text-amber" : m.status === "favourable" ? "text-lime" : "text-muted")}>
            <TrendIcon dir={dir} />{formatPct(m.pctDeviation)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div><dt className="text-muted">Baseline</dt><dd className="font-medium tabular-nums">{fmt(m.key, m.baseline?.mean, false)}</dd></div>
          <div><dt className="text-muted">z-score</dt><dd className="font-medium tabular-nums">{m.zScore === null ? "—" : m.zScore.toFixed(1)}</dd></div>
          <div><dt className="text-muted">{rangeDays}d avg</dt><dd className="font-medium tabular-nums">{fmt(m.key, m.rangeAvg, false)}</dd></div>
        </dl>
        <p className="sr-only">Trend {adverseTrend ? "moving in the adverse direction" : "stable or improving"}</p>
      </button>
      <div className="mt-2 -mb-2">
        <TimeSeriesChart data={data} xKey="date" height={96} pinnable={false} hideXAxis ariaLabel={`${meta.label} over the last ${rangeDays} days`}
          series={[{ key: "raw", label: "Daily", color: "muted", opacity: 0.45, width: 1 }, { key: "rolling", label: "Rolling avg", color: "cyan", format: (v) => v.toFixed(meta.decimals) }]}
          bands={bands} refs={m.baseline ? [{ y: m.baseline.mean, label: "", color: "lime" }] : []} axes={{ left: { hidden: true } }} />
      </div>
      <p className="mt-1 text-[10px] text-muted">{fmtDate(data[0]?.date ?? "")} – {fmtDate(data[data.length - 1]?.date ?? "")} · shaded = sustained deviation</p>
    </Card>
  );
}

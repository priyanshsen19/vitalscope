"use client";

import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Pin, X } from "lucide-react";
import { SimulatedTag } from "@/components/ui/badge";
import { useApp } from "@/lib/store/app-context";

export const cssColor = (c: string): string => (/^(cyan|lime|violet|amber|danger|muted|fg|border)$/.test(c) ? `rgb(var(--${c}))` : c);

export type ChartRow = Record<string, number | string | null | undefined>;

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  axis?: string;
  type?: "line" | "area" | "bar" | "step";
  dashed?: boolean;
  width?: number;
  dots?: boolean;
  format?: (v: number) => string;
  simulated?: boolean;
  opacity?: number;
  hideInTooltip?: boolean;
  /** Area only: vertical gradient fill. */
  gradient?: boolean;
}
export interface ChartBand { x1: string | number; x2: string | number; color: string; label?: string; opacity?: number }
export interface ChartRef { y: number; label: string; color?: string; axis?: string; dashed?: boolean }
export interface AxisConfig { unit?: string; format?: (v: number) => string; domain?: [number, number]; hidden?: boolean }

interface Props {
  data: ChartRow[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
  bands?: ChartBand[];
  refs?: ChartRef[];
  xType?: "category" | "number";
  xFormatter?: (v: string | number) => string;
  xDomain?: [number, number];
  axes?: Record<string, AxisConfig>;
  ariaLabel: string;
  pinnable?: boolean;
  hideXAxis?: boolean;
}

interface TooltipPayloadItem { dataKey?: string | number; value?: number | string | null; color?: string; payload?: ChartRow }
interface TooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: string | number }

const defaultFmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));

export function TimeSeriesChart({
  data, xKey, series, height = 260, bands = [], refs = [], xType = "category", xFormatter, xDomain, axes = {}, ariaLabel, pinnable = true, hideXAxis,
}: Props) {
  const { motionEnabled, fmtDate } = useApp();
  const [pinned, setPinned] = useState<string | number | null>(null);
  const uid = useId().replace(/:/g, "");
  const fmtX = xFormatter ?? ((v: string | number) => (typeof v === "string" ? fmtDate(v) : String(v)));

  const axisIds = useMemo(() => {
    const ids: string[] = [];
    series.forEach((s) => { const a = s.axis ?? "left"; if (!ids.includes(a)) ids.push(a); });
    if (ids.length === 0) ids.push("left");
    return ids;
  }, [series]);

  const domains = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    axisIds.forEach((id) => {
      if (axes[id]?.domain) { out[id] = axes[id].domain as [number, number]; return; }
      let lo = Infinity, hi = -Infinity;
      series.filter((s) => (s.axis ?? "left") === id).forEach((s) => {
        data.forEach((r) => { const v = r[s.key]; if (typeof v === "number") { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
      });
      refs.filter((r) => (r.axis ?? "left") === id).forEach((r) => { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y); });
      if (!isFinite(lo)) { out[id] = [0, 1]; return; }
      const isBar = series.some((s) => (s.axis ?? "left") === id && s.type === "bar");
      const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.15;
      out[id] = [isBar ? 0 : lo - pad, hi + pad];
    });
    return out;
  }, [axisIds, axes, series, data, refs]);

  const pinnedRow = pinned === null ? null : data.find((r) => r[xKey] === pinned) ?? null;

  const Tip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p) => typeof p.value === "number" && !series.find((s) => s.key === p.dataKey)?.hideInTooltip);
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="min-w-[150px] rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
        <div className="mb-1.5 font-medium text-fg">{fmtX(label as string | number)}</div>
        <div className="space-y-1">
          {rows.map((p) => {
            const s = series.find((x) => x.key === p.dataKey);
            if (!s) return null;
            return (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: cssColor(s.color) }} />{s.label}{s.simulated ? <SimulatedTag /> : null}</span>
                <span className="font-medium tabular-nums text-fg">{(s.format ?? defaultFmt)(p.value as number)}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div>
      <div style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            onClick={pinnable ? (st) => { const l = (st as { activeLabel?: string | number } | null)?.activeLabel; if (l !== undefined) setPinned((p) => (p === l ? null : l)); } : undefined}
          >
            <defs>
              {series.filter((s) => s.gradient).map((s) => (
                <linearGradient key={s.key} id={`g-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cssColor(s.color)} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={cssColor(s.color)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgb(var(--border))" strokeOpacity={0.45} strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey={xKey} type={xType} domain={xDomain} hide={hideXAxis}
              tickFormatter={(v: string | number) => fmtX(v)} tickLine={false} axisLine={{ stroke: "rgb(var(--border))" }} minTickGap={28}
              {...(xType === "number" ? { allowDataOverflow: true } : {})}
            />
            {axisIds.map((id, i) => {
              const cfg = axes[id] ?? {};
              const first = series.find((s) => (s.axis ?? "left") === id);
              return (
                <YAxis
                  key={id} yAxisId={id} orientation={i === 0 ? "left" : "right"} hide={cfg.hidden || i > 1}
                  domain={domains[id]} tickLine={false} axisLine={false} width={46} allowDataOverflow
                  tickFormatter={(v: number) => (cfg.format ?? first?.format ?? defaultFmt)(v)}
                  tick={{ fill: i === 1 ? cssColor(first?.color ?? "muted") : undefined }}
                />
              );
            })}
            {bands.map((b, i) => (
              <ReferenceArea key={`band-${i}`} yAxisId={axisIds[0]} x1={b.x1} x2={b.x2} fill={cssColor(b.color)} fillOpacity={b.opacity ?? 0.1} stroke="none" ifOverflow="hidden"
                label={b.label ? { value: b.label, position: "insideTop", fill: "rgb(var(--muted))", fontSize: 10 } : undefined} />
            ))}
            {refs.map((r, i) => (
              <ReferenceLine key={`ref-${i}`} yAxisId={r.axis ?? axisIds[0]} y={r.y} stroke={cssColor(r.color ?? "muted")} strokeDasharray={r.dashed === false ? undefined : "4 4"} strokeOpacity={0.8}
                label={{ value: r.label, position: "insideTopRight", fill: "rgb(var(--muted))", fontSize: 10 }} ifOverflow="extendDomain" />
            ))}
            <Tooltip content={<Tip />} cursor={{ stroke: "rgb(var(--muted))", strokeOpacity: 0.4 }} isAnimationActive={false} />
            {pinned !== null ? <ReferenceLine yAxisId={axisIds[0]} x={pinned} stroke="rgb(var(--cyan))" strokeOpacity={0.7} /> : null}
            {series.map((s) => {
              const yAxisId = s.axis ?? "left";
              const color = cssColor(s.color);
              const common = { dataKey: s.key, yAxisId, isAnimationActive: motionEnabled, animationDuration: 900, name: s.label, connectNulls: true };
              if (s.type === "bar") return <Bar key={s.key} {...common} fill={color} fillOpacity={s.opacity ?? 0.5} radius={[2, 2, 0, 0]} />;
              if (s.type === "area") return <Area key={s.key} {...common} stroke={color} strokeWidth={s.width ?? 1.75} fill={s.gradient ? `url(#g-${uid}-${s.key})` : color} fillOpacity={s.gradient ? 1 : s.opacity ?? 0.12} dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: "rgb(var(--bg))", fill: color }} />;
              return (
                <Line key={s.key} {...common} type={s.type === "step" ? "stepAfter" : "monotone"} stroke={color} strokeWidth={s.width ?? 1.75} strokeDasharray={s.dashed ? "5 4" : undefined}
                  strokeOpacity={s.opacity ?? 1} dot={s.dots ? { r: 2.5, fill: color, strokeWidth: 0 } : false} activeDot={{ r: 4, strokeWidth: 0, fill: color }} />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {pinnable && pinnedRow ? (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-cyan/25 bg-cyan/5 px-3 py-2 text-xs">
          <span className="flex items-center gap-1 font-medium text-cyan"><Pin className="h-3 w-3" />{fmtX(pinned as string | number)}</span>
          {series.filter((s) => typeof pinnedRow[s.key] === "number").map((s) => (
            <span key={s.key} className="text-muted">{s.label}: <span className="font-medium tabular-nums text-fg">{(s.format ?? defaultFmt)(pinnedRow[s.key] as number)}</span></span>
          ))}
          <button onClick={() => setPinned(null)} className="ml-auto text-muted hover:text-fg" aria-label="Unpin point"><X className="h-3.5 w-3.5" /></button>
        </motion.div>
      ) : pinnable ? (
        <p className="mt-1.5 text-[10px] text-muted/80">Hover to inspect · click a point to pin it</p>
      ) : null}
    </div>
  );
}

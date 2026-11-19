"use client";

import Link from "next/link";
import { BookOpen, HeartHandshake, Lightbulb, ArrowRight } from "lucide-react";
import { Dialog } from "@/components/ui/misc";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { RangeBar, TonePill, toneColor } from "./range-bar";
import { useApp } from "@/lib/store/app-context";
import { getSeries } from "@/lib/data/selectors";
import { METRICS } from "@/lib/metrics";
import type { PlainReading } from "@/lib/plain";

const detailHref = (cat: string) => (cat === "mobility" ? "/movement" : cat === "temple" ? "/brain-body" : "/health-drift");

export function MetricExplainer({ reading, onClose }: { reading: PlainReading | null; onClose: () => void }) {
  const { dataset, settings, fmt, conv, unitOf, isReal } = useApp();
  const r = reading;
  const series = r ? getSeries(dataset, r.key, settings.source) ?? [] : [];
  const rows = r ? series.slice(-30).map((p) => ({ date: p.date, v: p.value === null ? null : conv(r.key, p.value) })) : [];
  const meta = r ? METRICS[r.key] : null;
  return (
    <Dialog open={r !== null} onClose={onClose} title={r?.info.name ?? ""} description={r ? r.status.sentence : undefined} wide>
      {r && meta ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><TonePill tone={r.status.tone}>{r.status.word}</TonePill>{meta.templeSimulated ? <span className="text-[11px] text-violet">Simulated demo signal</span> : null}</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-fg/[0.04] p-3.5">
              <p className="text-xs text-muted">This week</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: `rgb(var(--${toneColor[r.status.tone]}))` }}>{fmt(r.key, r.recent)}</p>
            </div>
            <div className="rounded-2xl bg-fg/[0.04] p-3.5">
              <p className="text-xs text-muted">Your usual</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(r.key, r.usual)}</p>
              <p className="text-[11px] text-muted">usually {fmt(r.key, r.usualLow, false)} – {fmt(r.key, r.usualHigh)}</p>
            </div>
          </div>
          <RangeBar low={r.usualLow} high={r.usualHigh} now={r.recent} tone={r.status.tone} />

          <div>
            <p className="mb-1 text-xs font-medium text-muted">Last 30 days · the dashed lines show your usual range</p>
            <TimeSeriesChart data={rows} xKey="date" height={180} ariaLabel={`${r.info.name}, last 30 days`} pinnable={false}
              series={[{ key: "v", label: r.info.name, color: toneColor[r.status.tone], type: "area", gradient: true, width: 2.25, format: (n) => `${n.toFixed(meta.decimals)} ${unitOf(r.key)}` }]}
              refs={r.usualLow !== null && r.usualHigh !== null ? [
                { y: conv(r.key, r.usualLow), label: "usual low", color: "muted", dashed: true },
                { y: conv(r.key, r.usualHigh), label: "usual high", color: "muted", dashed: true },
              ] : []} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: BookOpen, title: "What is it?", text: r.info.what },
              { icon: HeartHandshake, title: "Why it matters", text: r.info.why },
              { icon: Lightbulb, title: "What may help", text: r.info.tip },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-border/70 p-3.5">
                <b.icon className="h-4 w-4 text-cyan" />
                <p className="mt-2 text-sm font-semibold">{b.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{b.text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-muted">{isReal ? "Real recordings from a research volunteer" : "Demo data"}, not medical advice. If you feel unwell or worried, talk to a healthcare professional.</p>
            <Link href={detailHref(meta.category)} onClick={onClose} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-cyan hover:underline">Detailed analysis <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

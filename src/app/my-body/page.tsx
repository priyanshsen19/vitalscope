"use client";

import { useEffect, useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { MetricExplainer } from "@/components/simple/metric-explainer";
import { RangeBar, TonePill } from "@/components/simple/range-bar";
import { useApp } from "@/lib/store/app-context";
import { AREAS, NORMAL, plainReadings, type BodyArea, type PlainReading } from "@/lib/plain";
import { cn } from "@/lib/utils";

type Filter = "all" | "watch" | BodyArea;

export default function MyBodyPage() {
  const { dataset, settings, fmt, isReal } = useApp();
  const readings = useMemo(() => plainReadings(dataset, settings.source), [dataset, settings.source]);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<PlainReading | null>(null);

  // Deep link: /my-body?m=restingHr opens that explanation.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (m) setOpen(readings.find((r) => r.key === m) ?? null);
  }, [readings]);

  const counts = {
    normal: readings.filter((r) => Math.abs(r.z ?? 99) < NORMAL).length,
    better: readings.filter((r) => r.status.tone === "good" && Math.abs(r.z ?? 0) >= NORMAL).length,
    watch: readings.filter((r) => r.status.tone === "watch").length,
  };
  const areas = AREAS.filter((a) => readings.some((r) => r.info.area === a.id));
  const shown = (a: BodyArea) => readings.filter((r) => r.info.area === a && (filter === "all" || filter === a || (filter === "watch" && r.status.tone === "watch")));

  return (
    <Stagger>
      <StaggerItem>
        <PageHeader icon={HeartPulse} accent="cyan" eyebrow="Everything we track" title="My Body" subtitle="Every measurement, compared with what’s normal for you — explained in plain words. Tap any card to learn more." />
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: counts.normal, label: "normal for you", c: "cyan" },
            { n: counts.better, label: "better than usual", c: "lime" },
            { n: counts.watch, label: "worth a look", c: "amber" },
          ].map((s) => (
            <div key={s.label} className="vs-card rounded-2xl border border-border/70 p-4">
              <p className="text-3xl font-semibold tabular-nums" style={{ color: `rgb(var(--${s.c}))` }}>{s.n}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Filter by body area">
          {([{ id: "all", label: "Everything" }, { id: "watch", label: `Worth a look (${counts.watch})` }, ...areas.map((a) => ({ id: a.id, label: a.label }))] as { id: Filter; label: string }[]).map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors", filter === f.id ? "border-transparent bg-fg text-bg" : "border-border text-muted hover:text-fg")}>
              {f.label}
            </button>
          ))}
        </div>
      </StaggerItem>

      <div className="mt-6 space-y-8">
        {areas.map((a) => {
          const list = shown(a.id);
          if (!list.length) return null;
          return (
            <StaggerItem key={a.id}>
              <section aria-labelledby={`area-${a.id}`}>
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 id={`area-${a.id}`} className="flex items-center gap-2 text-base font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: `rgb(var(--${a.color}))` }} />{a.label}</h2>
                  <p className="hidden text-xs text-muted sm:block">{a.blurb}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((r) => (
                    <button key={r.key} onClick={() => setOpen(r)} className="vs-card group flex flex-col rounded-2xl border border-border/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-black/20">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold">{r.info.name}</span>
                        <TonePill tone={r.status.tone}>{r.status.word}</TonePill>
                      </div>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">{fmt(r.key, r.recent)}</p>
                      <p className="text-[11px] text-muted">this week · usually around {fmt(r.key, r.usual)}</p>
                      <div className="mt-2"><RangeBar low={r.usualLow} high={r.usualHigh} now={r.recent} tone={r.status.tone} compact /></div>
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{r.info.what}</p>
                      <span className="mt-2 text-xs font-medium text-cyan opacity-80 group-hover:opacity-100">What does this mean? →</span>
                    </button>
                  ))}
                </div>
              </section>
            </StaggerItem>
          );
        })}
      </div>

      <p className="mt-8 text-center text-[11px] text-muted">“Normal for you” is based on your own first month of data, not population averages. {isReal ? `Real ${dataset.provenance?.dataset} data` : "Demo data"} · not medical advice.</p>
      <MetricExplainer reading={open} onClose={() => setOpen(null)} />
    </Stagger>
  );
}

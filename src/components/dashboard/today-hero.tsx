"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FlaskConical, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ScoreDial } from "./score-dial";
import { Sparkline } from "@/components/charts/sparkline";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { Badge, SimulatedTag } from "@/components/ui/badge";
import { useApp } from "@/lib/store/app-context";
import { getSeries, isMetricAvailable, sliceLast } from "@/lib/data/selectors";
import { calculateBaseline, calculateMean, calculatePercentageChange } from "@/lib/analytics/baseline";
import { calculateReadiness, type RingScore } from "@/lib/analytics/readiness";
import { METRICS } from "@/lib/metrics";
import type { MetricKey } from "@/types/health";
import { cn } from "@/lib/utils";

const VITALS: { key: MetricKey; color: string }[] = [
  { key: "hrv", color: "cyan" }, { key: "restingHr", color: "danger" }, { key: "sleepDuration", color: "violet" }, { key: "steps", color: "lime" },
  { key: "walkingSpeed", color: "cyan" }, { key: "respRate", color: "amber" }, { key: "vo2Max", color: "lime" }, { key: "brainFlow", color: "violet" }, { key: "entropy", color: "violet" },
];

export function TodayHero({ focus }: { focus: { title: string; text: string; href: string } }) {
  const { dataset, settings, conv, unitOf, fmt, today, isReal } = useApp();
  const src = settings.source;
  const readiness = useMemo(() => calculateReadiness(dataset, src), [dataset, src]);
  const [ring, setRing] = useState<RingScore["key"] | null>(null);
  const vitals = useMemo(() => VITALS.filter((v) => isMetricAvailable(v.key, src, dataset)).map((v) => {
    const s = getSeries(dataset, v.key, src)!;
    const b = calculateBaseline(s, 0, 29);
    const cur = calculateMean(s.slice(-7).map((p) => p.value));
    return { ...v, s, cur, pct: calculatePercentageChange(b?.mean, cur), mean: b?.mean ?? null };
  }), [dataset, src]);
  const [sel, setSel] = useState<MetricKey | null>(null);
  const active = vitals.find((v) => v.key === sel) ?? vitals[0];
  const selRing = readiness.rings.find((r) => r.key === ring);
  const hour = 8;
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = settings.profileName.split(" ")[0] || "there";

  const rows = active ? sliceLast(active.s, settings.dateRange).map((p) => ({ date: p.date, v: p.value === null ? null : conv(active.key, p.value) })) : [];

  return (
    <section aria-label="Today" className="mb-6">
      <div className="mb-6 flex flex-col gap-1">
        {isReal ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">Real data · last reading {format(parseISO(dataset.endDate), "d MMMM yyyy")}</p>
            <h1 className="text-gradient text-3xl font-semibold tracking-tight sm:text-4xl">{dataset.provenance?.dataset} participant {dataset.provenance?.participant}</h1>
            <p className="text-sm text-muted">Real {dataset.provenance?.device} recordings, analysed against this person’s own baseline.</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">{format(parseISO(today), "EEEE, d MMMM")}</p>
            <h1 className="text-gradient text-3xl font-semibold tracking-tight sm:text-4xl">{greet}, {first}.</h1>
            <p className="text-sm text-muted">Here’s how your body is trending against your own baseline.</p>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Readiness rings */}
        <div className="vs-card relative overflow-hidden rounded-3xl border border-border/70 p-5 sm:p-6 xl:col-span-3">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ScoreDial score={readiness.score} caption="Readiness" />
            <div className="w-full min-w-0 flex-1">
              <div className="flex items-center gap-2"><Badge tone={readiness.score === null ? "muted" : readiness.score >= 65 ? "lime" : "amber"}>{readiness.label}</Badge><span className="text-[11px] text-muted">Readiness · {isReal ? "real data" : "demo data"}</span></div>
              <p className="mt-2 text-sm leading-relaxed text-fg/90">{readiness.message}</p>
              <ul className="mt-4 space-y-2">
                {readiness.rings.map((r) => (
                  <li key={r.key}>
                    <button onClick={() => setRing((x) => (x === r.key ? null : r.key))} aria-pressed={ring === r.key}
                      className={cn("flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors", ring === r.key ? "border-border bg-fg/[0.06]" : "border-transparent hover:bg-fg/[0.04]")}>
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `rgb(var(--${r.color}))`, boxShadow: `0 0 10px rgb(var(--${r.color}) / .7)` }} />
                      <span className="text-sm font-medium">{r.label}</span>
                      <span className="ml-auto text-sm tabular-nums">{r.available ? <>{r.value} <span className="text-xs text-muted">{r.target}</span></> : <span className="text-xs text-muted">Not in this source</span>}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <AnimatePresence initial={false}>
                {selRing ? (
                  <motion.p key={selRing.key} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-2 text-xs text-muted">
                    {selRing.detail}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Focus card */}
        <div className="relative overflow-hidden rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.16] via-cyan/[0.06] to-transparent p-5 sm:p-6 xl:col-span-2">
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-lime/15 blur-3xl" />
          <div className="relative flex h-full flex-col">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-semibold text-lime"><Sparkles className="h-3 w-3" /> Today’s focus</span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">{focus.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg/80">{focus.text}</p>
            <p className="mt-2 text-[11px] text-muted">Pattern-based guidance from {isReal ? "real recordings" : "simulated data"}, not medical advice.</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <Link href={focus.href} className="inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-xs font-semibold text-[rgb(9_11_16)] shadow-[0_8px_24px_-8px_rgb(var(--lime)/0.8)] transition-transform active:scale-95">See why <ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link href="/experiments" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-4 py-2 text-xs font-medium transition-colors hover:bg-surface-2"><FlaskConical className="h-3.5 w-3.5" /> Try an experiment</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Vitals strip */}
      {vitals.length ? (
        <>
          <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Choose a vital to explore">
            {vitals.map((v) => {
              const on = v.key === active?.key;
              const m = METRICS[v.key];
              const good = v.pct === null || m.better === "neutral" ? null : (m.better === "higher") === v.pct > 0;
              return (
                <button key={v.key} role="tab" aria-selected={on} onClick={() => setSel(v.key)}
                  className={cn("vs-card relative w-[156px] shrink-0 snap-start rounded-2xl border p-3 text-left transition-all", on ? "border-transparent ring-2" : "border-border/70 hover:-translate-y-0.5")}
                  style={on ? { ["--tw-ring-color" as string]: `rgb(var(--${v.color}) / .7)` } : undefined}>
                  <div className="flex items-center justify-between gap-1"><span className="truncate text-[11px] font-medium text-muted">{m.short}</span>{m.templeSimulated ? <SimulatedTag /> : null}</div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{v.cur === null ? "—" : fmt(v.key, v.cur, false)}{v.key === "sleepDuration" ? null : <span className="ml-1 text-[10px] font-normal text-muted">{unitOf(v.key)}</span>}</p>
                  <div className="mt-1 h-7"><Sparkline values={v.s.slice(-21).map((p) => p.value)} color={v.color} height={28} /></div>
                  {v.pct !== null ? (
                    <p className={cn("mt-1 inline-flex items-center gap-1 text-[10px] font-medium", good === null ? "text-muted" : good ? "text-lime" : "text-amber")}>
                      {v.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{v.pct >= 0 ? "+" : ""}{v.pct.toFixed(1)}% vs baseline
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {active ? (
            <div className="vs-card mt-4 rounded-3xl border border-border/70 p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">Trend explorer · last {settings.dateRange} days</p>
                  <h3 className="text-base font-semibold">{METRICS[active.key].label} {METRICS[active.key].templeSimulated ? <SimulatedTag /> : null}</h3>
                </div>
                <Link href={METRICS[active.key].category === "mobility" ? "/movement" : METRICS[active.key].category === "temple" ? "/brain-body" : "/health-drift"} className="inline-flex items-center gap-1 text-xs text-cyan hover:underline">Open module <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <TimeSeriesChart
                key={active.key}
                data={rows}
                xKey="date"
                height={220}
                ariaLabel={`${METRICS[active.key].label} over the last ${settings.dateRange} days`}
                series={[{ key: "v", label: METRICS[active.key].short, color: active.color, type: "area", gradient: true, width: 2.5, format: (n) => `${n.toFixed(METRICS[active.key].decimals)} ${unitOf(active.key)}` }]}
                refs={active.mean !== null ? [{ y: conv(active.key, active.mean), label: "Baseline", color: "muted", dashed: true }] : []}
                axes={{ left: { unit: unitOf(active.key) } }}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

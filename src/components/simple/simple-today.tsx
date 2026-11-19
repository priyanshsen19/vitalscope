"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, Check, ChevronDown, Footprints, HeartPulse, Info, MoonStar, Sparkles, ThumbsUp, X } from "lucide-react";
import { ScoreDial } from "@/components/dashboard/score-dial";
import { Collapsible } from "@/components/ui/misc";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { MetricExplainer } from "./metric-explainer";
import { useApp } from "@/lib/store/app-context";
import { calculateReadiness } from "@/lib/analytics/readiness";
import { experimentPeriod } from "@/lib/analytics/experiments";
import { NORMAL, plainReadings, type PlainReading } from "@/lib/plain";
import { cn } from "@/lib/utils";

function headline(score: number | null) {
  if (score === null) return "We need a little more data to read your day.";
  if (score >= 80) return "You look well rested and ready to go.";
  if (score >= 65) return "You’re doing about as usual today.";
  if (score >= 50) return "You’re a little run down today.";
  return "Your body is asking for an easier day.";
}

/** Ten small blocks: an easy-to-read level meter. */
function Level({ value, color }: { value: number; color: string }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i < on ? `rgb(var(--${color}))` : "rgb(var(--fg) / .08)" }} />
      ))}
    </div>
  );
}

export function SimpleToday() {
  const { dataset, settings, experiments, updateExperiment, today, isReal } = useApp();
  const src = settings.source;
  const readiness = useMemo(() => calculateReadiness(dataset, src), [dataset, src]);
  const readings = useMemo(() => plainReadings(dataset, src), [dataset, src]);
  const [open, setOpen] = useState<PlainReading | null>(null);
  const [how, setHow] = useState(false);

  const watch = readings.filter((r) => r.status.tone === "watch").sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0)).slice(0, 4);
  const good = readings.filter((r) => r.status.tone === "good" && Math.abs(r.z ?? 0) >= NORMAL).sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0)).slice(0, 3);
  const normal = readings.filter((r) => Math.abs(r.z ?? 99) < NORMAL).length;
  const first = settings.profileName.split(" ")[0] || "there";

  const [rec, sleep, move] = readiness.rings;
  const word = (p: number) => (p >= 0.8 ? "Good" : p >= 0.6 ? "Okay" : "Low");
  const pillars = [
    { icon: HeartPulse, title: "Recovery", color: "cyan", ok: rec.available, value: rec.progress, big: word(rec.progress), sub: rec.available ? "How rested your heart looks" : "Not in this data source", reading: readings.find((r) => r.key === "hrv") },
    { icon: MoonStar, title: "Sleep", color: "violet", ok: sleep.available, value: sleep.progress, big: sleep.value, sub: sleep.available ? `last night · goal 8h` : "Not in this data source", reading: readings.find((r) => r.key === "sleepDuration") },
    { icon: Footprints, title: "Movement", color: "lime", ok: move.available, value: move.progress, big: move.value, sub: move.available ? "steps yesterday · goal 10,000" : "Not in this data source", reading: readings.find((r) => r.key === "steps") },
  ];

  const habit = experiments.find((e) => e.status === "active");
  const per = habit ? experimentPeriod(dataset, habit) : null;
  const todayLog = habit ? habit.adherence[today] : undefined;
  const logToday = (v: boolean) => habit && updateExperiment(habit.id, { adherence: { ...habit.adherence, [today]: v } });

  return (
    <Stagger>
      <StaggerItem>
        <div className="mb-6">
          {isReal ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">Real data · last reading {format(parseISO(dataset.endDate), "d MMMM yyyy")}</p>
              <h1 className="text-gradient mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">A real person’s last 90 days.</h1>
              <p className="mt-1 text-sm text-muted">Anonymised {dataset.provenance?.dataset} participant {dataset.provenance?.participant}, wearing a {dataset.provenance?.device}. Everything below is worked out from their actual recordings.</p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">{format(parseISO(today), "EEEE, d MMMM")}</p>
              <h1 className="text-gradient mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Good morning, {first}.</h1>
              <p className="mt-1 text-sm text-muted">Here’s your body today, in plain words.</p>
            </>
          )}
        </div>
      </StaggerItem>

      {/* Big picture */}
      <StaggerItem>
        <div className="vs-card relative overflow-hidden rounded-3xl border border-border/70 p-5 sm:p-7">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
          <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
            <ScoreDial score={readiness.score} caption="out of 100" />
            <div className="w-full min-w-0 flex-1 text-center md:text-left">
              <p className="text-xs font-medium text-muted">How ready you are today</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px] sm:leading-tight">{headline(readiness.score)}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-fg/80">{readiness.message}</p>
              <button onClick={() => setHow((h) => !h)} aria-expanded={how} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan hover:underline">
                <Info className="h-3.5 w-3.5" /> How is this worked out? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", how && "rotate-180")} />
              </button>
              <Collapsible open={how}>
                <p className="mt-2 rounded-2xl bg-fg/[0.04] p-3 text-left text-[13px] leading-relaxed text-muted">
                  We compare your heart recovery, resting heart rate and sleep over the last 3 days with what’s normal for you (your first month of data). <b className="text-fg">75 means a typical day for you.</b> Higher means better rested than usual; lower means your body may be under more strain. It’s a guide, not a diagnosis.
                </p>
              </Collapsible>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            {pillars.map((p) => (
              <button key={p.title} disabled={!p.reading} onClick={() => p.reading && setOpen(p.reading)}
                className="group rounded-2xl border border-border/70 bg-bg/40 p-4 text-left transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-border disabled:opacity-70">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-medium"><span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `rgb(var(--${p.color}) / .14)`, color: `rgb(var(--${p.color}))` }}><p.icon className="h-4 w-4" /></span>{p.title}</span>
                  {p.reading ? <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" /> : null}
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums">{p.ok ? p.big : "—"}</p>
                <p className="mb-3 text-xs text-muted">{p.sub}</p>
                {p.ok ? <Level value={p.value} color={p.color} /> : null}
              </button>
            ))}
          </div>
        </div>
      </StaggerItem>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Worth a look */}
        <StaggerItem>
          <section className="vs-card h-full rounded-3xl border border-border/70 p-5">
            <h2 className="text-base font-semibold">Worth a look</h2>
            <p className="text-xs text-muted">Things that have been different from your usual this week</p>
            {watch.length === 0 ? (
              <p className="mt-6 flex items-center gap-2 text-sm text-fg/80"><ThumbsUp className="h-4 w-4 text-lime" />Nothing unusual. Everything we track is in your normal range.</p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {watch.map((r) => (
                  <li key={r.key}>
                    <button onClick={() => setOpen(r)} className="flex w-full items-start gap-3 rounded-2xl border border-amber/20 bg-amber/[0.05] p-3.5 text-left transition-colors hover:bg-amber/[0.09]">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{r.info.name}</span>
                        <span className="block text-[13px] leading-snug text-muted">{r.status.sentence}</span>
                      </span>
                      <span className="mt-0.5 shrink-0 text-xs font-medium text-cyan">Explain</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </StaggerItem>

        {/* Going well */}
        <StaggerItem>
          <section className="vs-card h-full rounded-3xl border border-border/70 p-5">
            <h2 className="text-base font-semibold">Going well</h2>
            <p className="text-xs text-muted">{normal} of {readings.length} things we track are normal for you</p>
            <ul className="mt-4 space-y-2.5">
              {good.length === 0 ? <li className="text-sm text-muted">No big improvements this week — steady is good too.</li> : null}
              {good.map((r) => (
                <li key={r.key}>
                  <button onClick={() => setOpen(r)} className="flex w-full items-start gap-3 rounded-2xl border border-lime/20 bg-lime/[0.05] p-3.5 text-left transition-colors hover:bg-lime/[0.09]">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{r.info.name}</span>
                      <span className="block text-[13px] leading-snug text-muted">{r.status.sentence}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Link href="/my-body" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan hover:underline">See everything about my body <ArrowRight className="h-3 w-3" /></Link>
          </section>
        </StaggerItem>
      </div>

      {/* Habit check-in */}
      <StaggerItem>
        <section className="mt-6 overflow-hidden rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.12] via-cyan/[0.05] to-transparent p-5 sm:p-6">
          {habit && per ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium text-lime">Your habit · day {Math.min(per.elapsed, habit.durationDays)} of {habit.durationDays}</p>
                <h2 className="mt-1 text-lg font-semibold">{habit.name}</h2>
                <p className="mt-0.5 text-sm text-fg/75">{habit.behaviour}</p>
              </div>
              <div className="shrink-0">
                <p className="mb-2 text-sm font-medium">Did you do it today?</p>
                <div className="flex gap-2">
                  <button onClick={() => logToday(true)} aria-pressed={todayLog === true} className={cn("inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95", todayLog === true ? "bg-lime text-[rgb(9_11_16)]" : "border border-border bg-surface/70 hover:bg-surface-2")}><Check className="h-4 w-4" />Yes</button>
                  <button onClick={() => logToday(false)} aria-pressed={todayLog === false} className={cn("inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95", todayLog === false ? "bg-amber text-[rgb(9_11_16)]" : "border border-border bg-surface/70 hover:bg-surface-2")}><X className="h-4 w-4" />Not today</button>
                </div>
                {todayLog !== undefined ? <p className="mt-2 text-xs text-muted">{todayLog ? "Nice work — saved." : "That’s okay — saved. Tomorrow’s a new day."}</p> : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-semibold">Try a small habit</h2><p className="text-sm text-fg/75">Pick one change for a couple of weeks and see how your body responds.</p></div>
              <Link href="/experiments" className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-[rgb(9_11_16)]">Start a habit <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
        </section>
      </StaggerItem>

      <StaggerItem>
        <p className="mt-6 text-center text-[11px] text-muted">{isReal ? `Real recordings from the public ${dataset.provenance?.dataset} research dataset (${dataset.provenance?.licence}). It is not medical advice.` : "This is a demo with simulated data. It is not medical advice."}</p>
      </StaggerItem>

      <MetricExplainer reading={open} onClose={() => setOpen(null)} />
    </Stagger>
  );
}


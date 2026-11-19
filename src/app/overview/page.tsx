"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, Brain, FlaskConical, Footprints, Moon } from "lucide-react";
import { TodayHero } from "@/components/dashboard/today-hero";
import { SimpleToday } from "@/components/simple/simple-today";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { InsightCard } from "@/components/insights/insight-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SimulatedTag } from "@/components/ui/badge";
import { Progress } from "@/components/ui/misc";
import { EmptyState } from "@/components/shared/states";
import { useApp } from "@/lib/store/app-context";
import { useAnalysis } from "@/lib/store/use-analysis";
import { getSeries, isMetricAvailable, sliceLast } from "@/lib/data/selectors";
import { calculateBaseline, calculateMean, calculatePercentageChange } from "@/lib/analytics/baseline";
import { calculateExperimentResults, experimentPeriod } from "@/lib/analytics/experiments";
import { formatHours, formatPct, METRICS } from "@/lib/metrics";
import type { MetricKey } from "@/types/health";
import { cn } from "@/lib/utils";

const toneDot = { lime: "bg-lime", cyan: "bg-cyan", violet: "bg-violet", amber: "bg-amber", muted: "bg-muted" } as const;

export default function OverviewPage() {
  const { dataset, settings, experiments, fmtDate, unitOf, conv, motionEnabled } = useApp();
  const { insights, drift, trends, timeline } = useAnalysis();
  if (settings.viewMode === "simple") return <SimpleToday />;
  const src = settings.source;
  const last = dataset.days.length - 1;

  const pick = (keys: MetricKey[]) => keys.find((k) => isMetricAvailable(k, src, dataset)) ?? null;
  const stat = (key: MetricKey | null) => {
    if (!key) return null;
    const s = getSeries(dataset, key, src);
    if (!s) return null;
    const b = calculateBaseline(s, 0, 29);
    const cur = calculateMean(s.slice(-7).map((p) => p.value));
    return { key, s, b, cur, pct: calculatePercentageChange(b?.mean, cur), spark: s.slice(-30).map((p) => p.value) };
  };

  // 1. Cardiovascular
  const cardioKey = pick(["restingHr", "hrv", "avgHr"]);
  const cardio = stat(cardioKey);
  const cardioDrift = drift.metrics.find((m) => m.key === cardioKey);
  // 2. Sleep
  const sleepKey = pick(["sleepDuration", "sleepEfficiency"]);
  const sleep = stat(sleepKey);
  const sleepEff = stat(pick(["sleepEfficiency"]));
  const sleepDrift = drift.metrics.find((m) => m.key === "sleepEfficiency");
  // 3. Movement
  const moveAvail = trends.filter((t) => t.available);
  const speed = trends.find((t) => t.key === "walkingSpeed" && t.available);
  const monitor = moveAvail.filter((t) => t.status === "monitor");
  // 4. Brain-body
  const bf = stat(pick(["brainFlow"]));

  const active = experiments.filter((e) => e.status === "active" || e.status === "paused");
  const importantInsights = insights.filter((i) => i.category === "drift" || (i.category === "movement" && i.severity === "attention")).slice(0, 3);
  const patterns = insights.filter((i) => i.category === "pattern").slice(0, 3);

  const driftTone = (d?: { status: string }) => (d?.status === "drifting" ? { label: "Drift detected", tone: "amber" as const } : d?.status === "building" ? { label: "Watching", tone: "amber" as const } : d?.status === "favourable" ? { label: "Favourable shift", tone: "lime" as const } : { label: "Within baseline", tone: "cyan" as const });

  const drifting = drift.metrics.filter((m) => m.status === "drifting");
  const focus = drifting.length >= 2
    ? { title: "Ease the load today", text: `${drifting.map((m) => METRICS[m.key].short).join(", ")} have moved away from your usual range together for several days. A lighter session and a consistent bedtime may help them settle.`, href: "/health-drift" }
    : drifting.length === 1
      ? { title: `Keep an eye on ${METRICS[drifting[0].key].short}`, text: `${METRICS[drifting[0].key].label} has stayed outside your usual range for a few days. Other signals look steady.`, href: "/health-drift" }
      : active.length
        ? { title: `Stay on track with “${active[0].name}”`, text: "Your signals are close to baseline. Logging adherence today keeps your experiment result reliable.", href: "/experiments" }
        : { title: "Steady day", text: "Your tracked signals are close to your personal baseline. A good day to start a small habit experiment.", href: "/experiments" };

  const cardioBetter = cardioKey && cardio?.pct !== null && cardio?.pct !== undefined ? (METRICS[cardioKey].better === "higher" ? cardio.pct > 0 : METRICS[cardioKey].better === "lower" ? cardio.pct < 0 : null) : null;

  return (
    <Stagger>
      <StaggerItem>
        <TodayHero focus={focus} />
      </StaggerItem>

      <StaggerItem>
        <h2 className="mb-3 text-sm font-semibold">Your modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cardio && cardioKey ? (
            <SummaryCard href="/health-drift" title="Cardiovascular Trends" icon={<Activity className="h-3.5 w-3.5" />} accent="cyan"
              statusLabel={driftTone(cardioDrift).label} statusTone={driftTone(cardioDrift).tone}
              metricLabel={`${METRICS[cardioKey].label} · 7-day avg`} value={cardio.cur} decimals={1} unit={METRICS[cardioKey].unit}
              trend={cardio.pct === null ? "flat" : cardio.pct > 0.5 ? "up" : cardio.pct < -0.5 ? "down" : "flat"} trendLabel={`${formatPct(cardio.pct)} vs personal baseline`} trendGood={cardioBetter}
              spark={cardio.spark} insight={cardioDrift?.status === "drifting" ? `${METRICS[cardioKey].short} has stayed beyond ${drift.config.sdThreshold} SD of your baseline for ${cardioDrift.adverseRuns[cardioDrift.adverseRuns.length - 1]?.length ?? 0} days.` : "Cardiovascular signals are close to your personal baseline."} />
          ) : null}
          {sleep && sleepKey ? (
            <SummaryCard href="/health-drift" title="Recovery & Sleep" icon={<Moon className="h-3.5 w-3.5" />} accent="lime"
              statusLabel={driftTone(sleepDrift).label} statusTone={driftTone(sleepDrift).tone}
              metricLabel={`${METRICS[sleepKey].label} · 7-day avg`} value={sleep.cur} decimals={sleepKey === "sleepDuration" ? 2 : 1} unit={sleepKey === "sleepDuration" ? "" : "%"} valueFormatter={sleepKey === "sleepDuration" ? (v) => formatHours(v) : undefined}
              trend={sleep.pct === null ? "flat" : sleep.pct > 0.5 ? "up" : sleep.pct < -0.5 ? "down" : "flat"} trendLabel={`${formatPct(sleep.pct)} vs personal baseline`} trendGood={sleep.pct === null ? null : sleep.pct > 0.5 ? true : sleep.pct < -0.5 ? false : null}
              spark={sleep.spark} insight={sleepEff ? `Sleep efficiency is ${sleepEff.cur?.toFixed(1)}% against a ${sleepEff.b?.mean.toFixed(1)}% baseline.` : "Sleep staging is only available from the Apple Watch dataset."} />
          ) : (
            <SummaryCard href="/health-drift" title="Recovery & Sleep" icon={<Moon className="h-3.5 w-3.5" />} accent="lime" statusLabel="Unavailable" statusTone="muted" metricLabel="Sleep" value={null} decimals={0} unit="" trend="flat" trendLabel="No sleep data in this source" spark={[0, 0]} insight="Switch to Apple Watch or Combined to see sleep and recovery." />
          )}
          {speed ? (
            <SummaryCard href="/movement" title="Movement Intelligence" icon={<Footprints className="h-3.5 w-3.5" />} accent="cyan"
              statusLabel={monitor.length ? `${monitor.length} worth monitoring` : "Stable"} statusTone={monitor.length ? "amber" : "cyan"}
              metricLabel="Walking speed · 7-day avg" value={speed.current === null ? null : conv("walkingSpeed", speed.current)} decimals={2} unit={unitOf("walkingSpeed")}
              trend={speed.pctVsBaseline === null ? "flat" : speed.pctVsBaseline > 1 ? "up" : speed.pctVsBaseline < -1 ? "down" : "flat"} trendLabel={`${formatPct(speed.pctVsBaseline)} vs personal baseline`} trendGood={speed.pctVsBaseline === null ? null : Math.abs(speed.pctVsBaseline) < 1 ? null : speed.pctVsBaseline > 0}
              spark={speed.series.slice(-30).map((p) => p.value)}
              insight={monitor.length ? `${monitor.map((m) => METRICS[m.key].short).join(", ")} differ${monitor.length === 1 ? "s" : ""} from your baseline; other indicators are stable.` : "All mobility indicators are within your normal range."} />
          ) : (
            <SummaryCard href="/movement" title="Movement Intelligence" icon={<Footprints className="h-3.5 w-3.5" />} accent="cyan" statusLabel="Unavailable" statusTone="muted" metricLabel="Walking speed" value={null} decimals={0} unit="" trend="flat" trendLabel="Not in this source" spark={[0, 0]} insight="Mobility measurements come from the Apple Watch dataset." />
          )}
          {bf ? (
            <SummaryCard href="/brain-body" title="Brain-Body Response" icon={<Brain className="h-3.5 w-3.5" />} accent="violet" simulated
              statusLabel="Exploratory" statusTone="violet" metricLabel="BrainFlow Index · 7-day avg" value={bf.cur} decimals={1} unit="index"
              trend={bf.pct === null ? "flat" : bf.pct > 1 ? "up" : bf.pct < -1 ? "down" : "flat"} trendLabel={`${formatPct(bf.pct)} vs personal baseline`} trendGood={null}
              spark={bf.spark} insight="BrainFlow responded differently across running, cycling and walking sessions." />
          ) : (
            <SummaryCard href="/brain-body" title="Brain-Body Response" icon={<Brain className="h-3.5 w-3.5" />} accent="violet" statusLabel="Unavailable" statusTone="muted" metricLabel="BrainFlow Index" value={null} decimals={0} unit="" trend="flat" trendLabel="Needs Temple-compatible data" spark={[0, 0]} insight={dataset.kind === "real" ? "Not in the real dataset — Temple signals exist only in demo data." : "Switch to Temple or Combined to explore simulated BrainFlow and Entropy."} />
          )}
        </div>
      </StaggerItem>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <StaggerItem>
            <section aria-labelledby="important">
              <div className="mb-3 flex items-center justify-between"><h2 id="important" className="text-sm font-semibold">Important changes</h2><Link href="/health-drift" className="inline-flex items-center gap-1 text-xs text-cyan hover:underline">Health Drift <ArrowUpRight className="h-3 w-3" /></Link></div>
              {importantInsights.length ? <div className="space-y-3">{importantInsights.map((i, n) => <InsightCard key={i.id} insight={i} defaultOpen={n === 0} />)}</div>
                : <EmptyState title="No sustained changes detected" text="None of your tracked signals have moved beyond your personal baseline for several days in a row." />}
            </section>
          </StaggerItem>

          <StaggerItem>
            <section aria-labelledby="patterns">
              <div className="mb-3 flex items-center justify-between"><h2 id="patterns" className="text-sm font-semibold">Recently discovered patterns</h2><Link href="/insights" className="inline-flex items-center gap-1 text-xs text-cyan hover:underline">All insights <ArrowUpRight className="h-3 w-3" /></Link></div>
              {patterns.length ? <div className="space-y-3">{patterns.map((i) => <InsightCard key={i.id} insight={i} compact />)}</div>
                : <EmptyState title="No patterns yet" text="Cross-signal patterns appear when two measurements in the selected source move together across at least 30 days." />}
            </section>
          </StaggerItem>
        </div>

        <div className="space-y-6">
          <StaggerItem>
            <Card>
              <CardHeader title="Active experiments" subtitle="Progress against planned duration" action={<Link href="/experiments" className="text-xs text-cyan hover:underline">Manage</Link>} />
              <CardBody className="space-y-4">
                {active.length === 0 ? <EmptyState icon={<FlaskConical className="h-5 w-5" />} title="No active experiments" text="Start an experiment to compare a habit change with your baseline." action={<Link href="/experiments" className="text-xs font-medium text-cyan hover:underline">Open Experiments</Link>} /> : null}
                {active.map((e) => {
                  const per = experimentPeriod(dataset, e);
                  const elapsed = per?.elapsed ?? 0;
                  const res = calculateExperimentResults(dataset, e, src);
                  return (
                    <Link key={e.id} href="/experiments" className="block rounded-xl border border-border p-3 transition-colors hover:bg-surface-2">
                      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{e.name}</span><Badge tone={e.status === "paused" ? "amber" : "lime"}>{e.status}</Badge></div>
                      <p className="mt-0.5 text-xs text-muted">Day {Math.min(elapsed, e.durationDays)} of {e.durationDays} · adherence {res.adherence.rate === null ? "—" : Math.round(res.adherence.rate * 100) + "%"}</p>
                      <Progress className="mt-2" value={(elapsed / e.durationDays) * 100} label={`${e.name} progress`} />
                    </Link>
                  );
                })}
              </CardBody>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader title="Health timeline" subtitle={`Last 30 days · to ${fmtDate(dataset.endDate)}`} />
              <CardBody>
                {timeline.length === 0 ? <EmptyState title="No events" text="Detected changes, workouts and experiments from the last 30 days appear here." /> : (
                  <ol className="relative space-y-4 border-l border-dashed border-border pl-5">
                    {timeline.slice(0, 9).map((ev, i) => (
                      <li key={ev.id} className="relative">
                        <span className={cn("absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface", toneDot[ev.tone])} />
                        {i === 0 && motionEnabled ? <span className={cn("absolute -left-[26px] top-1.5 h-2.5 w-2.5 animate-ping rounded-full opacity-60", toneDot[ev.tone])} /> : null}
                        <Link href={ev.href} className="group block">
                          <p className="text-[11px] text-muted">{fmtDate(ev.date)}</p>
                          <p className="text-sm font-medium group-hover:text-cyan">{ev.title}</p>
                          <p className="text-xs text-muted">{ev.detail}{ev.type === "workout" ? " · " : ""}{ev.type === "workout" ? <SimulatedTag /> : null}</p>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </StaggerItem>
        </div>
      </div>
    </Stagger>
  );
}

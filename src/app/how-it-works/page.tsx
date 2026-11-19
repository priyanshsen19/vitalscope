"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, ChevronDown, CircleAlert, Database, FlaskConical, Footprints, Gauge, HeartPulse, LineChart, Network, Brain, ShieldCheck, Sigma } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Collapsible } from "@/components/ui/misc";
import { useApp } from "@/lib/store/app-context";
import { generateDataset, dateAtIndex } from "@/lib/data/generator";
import { defaultExperiments } from "@/lib/data/persistence";
import { EVENTS } from "@/lib/data/seed";
import { getSeries } from "@/lib/data/selectors";
import { loadRealDataset } from "@/lib/data/real";
import { pearson } from "@/lib/analytics/baseline";
import { calculateReadiness } from "@/lib/analytics/readiness";
import type { MetricKey } from "@/types/health";
import Link from "next/link";
import { calculateBaseline, calculateZScore, meanOver } from "@/lib/analytics/baseline";
import { analyseDrift, DEFAULT_DRIFT_CONFIG } from "@/lib/analytics/drift-detection";
import { calculateExperimentResults } from "@/lib/analytics/experiments";
import { calculateMovementTrends } from "@/lib/analytics/movement";
import { METRICS } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface Check { planted: string; expect: string; found: string; pass: boolean }

/** Ground-truth validation: the generator plants known events; the detectors must find them (and nothing in the quiet period). */
function useSelfChecks(): Check[] {
  const { dataset, seed, fmtDate } = useApp();
  return useMemo(() => {
    // Ground-truth checks only make sense on the synthetic data, where we planted the answers.
    const ds = dataset.kind === "demo" ? dataset : generateDataset(seed);
    const d = (i: number) => fmtDate(dateAtIndex(i));
    const drift = analyseDrift(ds, "combined", DEFAULT_DRIFT_CONFIG, 30);
    const checks: Check[] = [];

    // 1. Multi-signal drift
    const late = drift.episodes.find((e) => e.endIndex >= EVENTS.driftRampStart);
    checks.push({
      planted: `Strain period: resting HR ↑, HRV ↓, breathing ↑, sleep quality ↓ — ramping in from ${d(EVENTS.driftRampStart)}`,
      expect: "A multi-signal drift episode starting shortly after the ramp begins",
      found: late ? `Episode from ${fmtDate(late.startDate)} (${late.durationDays} days, ${late.metrics.length} signals: ${late.metrics.map((m) => METRICS[m.key].short).join(", ")})` : "No episode found",
      pass: !!late && late.startIndex >= EVENTS.driftRampStart && late.startIndex <= EVENTS.driftFull + 4,
    });

    // 2. Short travel blip must NOT become an episode, but should be visible as one-off outliers
    const [b1, b2] = EVENTS.travelBlip;
    const blipEpisode = drift.episodes.some((e) => e.startIndex <= b2 && e.endIndex >= b1);
    const blipDates = [dateAtIndex(b1), dateAtIndex(b2)];
    const outlierHits = drift.metrics.filter((m) => m.isolatedOutliers.some((x) => blipDates.includes(x))).map((m) => METRICS[m.key].short);
    checks.push({
      planted: `2-night travel disruption on ${d(b1)}–${d(b2)}`,
      expect: "Flagged as one-off outliers, NOT as a sustained drift (persistence rule filters it)",
      found: `${blipEpisode ? "Wrongly raised as an episode" : "No episode raised"}; one-off outliers in ${outlierHits.join(", ") || "no metric"}`,
      pass: !blipEpisode && outlierHits.length > 0,
    });

    // 3. No false alarms in the baseline month
    const quietEpisodes = drift.episodes.filter((e) => e.startIndex <= DEFAULT_DRIFT_CONFIG.baselineEnd);
    checks.push({
      planted: `Nothing unusual in the first 30 days (${d(0)}–${d(29)})`,
      expect: "Zero drift episodes (false-alarm check)",
      found: `${quietEpisodes.length} episode(s)`,
      pass: quietEpisodes.length === 0,
    });

    // 4. Morning-walk habit
    const walk = defaultExperiments().find((e) => e.id === "exp-morning-walk");
    const wr = walk ? calculateExperimentResults(ds, walk, "combined") : null;
    const prim = wr?.metrics.find((m) => m.isPrimary);
    checks.push({
      planted: `Morning walks ${d(EVENTS.walk.start)}–${d(EVENTS.walk.start + EVENTS.walk.days - 1)} (12 of 14 days) gently improve sleep and recovery`,
      expect: "Experiment shows sleep duration ‘improved’ vs the 14 days before",
      found: prim ? `Sleep ${prim.verdict} · effect ${prim.effectSize?.toFixed(2)} SD · confidence ${wr?.confidence.level}` : "Not computed",
      pass: prim?.verdict === "improved",
    });

    // 5. Mobility dip
    const speed = getSeries(ds, "walkingSpeed", "combined")!;
    const base = calculateBaseline(speed, 0, 29);
    const dipZ = calculateZScore(meanOver(speed, EVENTS.mobilityDip.start, EVENTS.mobilityDip.end).mean, base?.mean, base?.sd);
    checks.push({
      planted: `Temporary mobility dip ${d(EVENTS.mobilityDip.start)}–${d(EVENTS.mobilityDip.end)} (slower, shorter, less even steps)`,
      expect: "Walking speed clearly below baseline during the dip (z ≤ −1.5)",
      found: `Walking speed z = ${dipZ?.toFixed(1)} during the dip`,
      pass: dipZ !== null && dipZ <= -1.5,
    });

    // 6. Gradual stair decline
    const stairs = calculateMovementTrends(ds, "combined", 30).find((t) => t.key === "stairDescent");
    checks.push({
      planted: `Slow decline in stair-descent speed from ${d(EVENTS.stairDeclineStart)}`,
      expect: "Movement module marks stair descent ‘worth monitoring’",
      found: `Status: ${stairs?.status} (${stairs?.effectSize?.toFixed(1)} SD vs baseline)`,
      pass: stairs?.status === "monitor",
    });

    // 7. Determinism
    const again = generateDataset(ds.seed);
    const same = JSON.stringify(again.days[45]) === JSON.stringify(ds.days[45]) && JSON.stringify(again.days[89]) === JSON.stringify(ds.days[89]);
    checks.push({
      planted: `Seed ${ds.seed}`,
      expect: "Regenerating with the same seed gives identical data (reproducible demo)",
      found: same ? "Identical" : "Different",
      pass: same,
    });
    return checks;
  }, [dataset, seed, fmtDate]);
}

/** Plausible human ranges. Anything outside would point to a conversion or parsing bug. */
const RANGES: Partial<Record<MetricKey, [number, number]>> = {
  restingHr: [30, 120], hrv: [3, 250], avgHr: [35, 160], vo2Max: [15, 90], respRate: [6, 35],
  sleepDuration: [0.5, 16], sleepEfficiency: [40, 100], steps: [0, 80000], walkingDistance: [0, 80], exerciseMinutes: [0, 600],
};

/** Data-quality checks and live findings on the real public dataset (no answer key exists for it). */
function useRealChecks() {
  const { fmtDate } = useApp();
  return useMemo(() => {
    const ds = loadRealDataset();
    const keys = ds.available ?? [];
    const checks: Check[] = [];

    let out = 0, total = 0;
    const bad: string[] = [];
    for (const k of keys) {
      const r = RANGES[k]; if (!r) continue;
      for (const d of ds.days) {
        const v = d.apple[k]; if (v === undefined) continue;
        total++;
        if (v < r[0] || v > r[1]) { out++; bad.push(`${METRICS[k].short} ${fmtDate(d.date)}`); }
      }
    }
    checks.push({ planted: `${total.toLocaleString()} readings across ${keys.length} measurements`, expect: "Every value inside a plausible human range (catches unit or parsing mistakes)", found: out ? `${out} out of range: ${bad.slice(0, 3).join(", ")}` : "All within range", pass: out === 0 });

    const dates = ds.days.map((d) => d.date);
    const unique = new Set(dates).size === dates.length;
    const consecutive = dates.every((d, i) => i === 0 || (Date.parse(d) - Date.parse(dates[i - 1])) === 86400000);
    checks.push({ planted: `${ds.days.length} calendar days`, expect: "One row per day, no duplicates, no skipped dates", found: unique && consecutive ? "One row per day, in order" : "Duplicates or gaps in the calendar", pass: unique && consecutive });

    const core: MetricKey[] = ["restingHr", "hrv", "sleepDuration", "steps"];
    const minCov = Math.min(...core.map((k) => ds.provenance?.coverage[k] ?? 0));
    checks.push({ planted: "Missing days left as gaps (not filled in)", expect: "At least 85% of days present for the core measurements", found: `Lowest coverage ${minCov}/${ds.days.length} (${Math.round((minCov / ds.days.length) * 100)}%)`, pass: minCov / ds.days.length >= 0.85 });

    const base = (k: MetricKey) => calculateBaseline(getSeries(ds, k, "apple")!, 0, 29);
    const sd = keys.filter((k) => (base(k)?.sd ?? 0) > 0).length;
    checks.push({ planted: "Baseline month (first 30 days)", expect: "Every measurement varies day to day, so personal ranges can be computed", found: `${sd} of ${keys.length} have a usable spread`, pass: sd === keys.length });

    const hr = getSeries(ds, "restingHr", "apple")!.map((p) => p.value);
    const hrv = getSeries(ds, "hrv", "apple")!.map((p) => p.value);
    const c = pearson(hr, hrv);
    checks.push({ planted: "Well-known physiology: higher resting HR tends to come with lower HRV", expect: "A negative relationship in this person’s data (external sense-check, not guaranteed for every individual)", found: c ? `r = ${c.r.toFixed(2)} over ${c.n} days` : "Not enough data", pass: !!c && c.r < 0 });

    const drift = analyseDrift(ds, "apple", DEFAULT_DRIFT_CONFIG, 30);
    const readiness = calculateReadiness(ds, "apple");
    const findings = [
      `${drift.episodes.length === 0 ? "No multi-signal drift episodes" : `${drift.episodes.length} drift episode${drift.episodes.length > 1 ? "s" : ""}`}${drift.episodes.length ? ` (${drift.episodes.map((e) => `${fmtDate(e.startDate)}, ${e.durationDays} days, ${e.metrics.map((m) => METRICS[m.key].short).join(" + ")}`).join("; ")})` : ""}.`,
      `Readiness on the last day of data: ${readiness.score ?? "—"} (${readiness.label}).`,
      `${drift.metrics.reduce((a, m) => a + m.isolatedOutliers.length, 0)} one-off unusual days were seen but not raised as alerts (persistence rule).`,
    ];
    return { checks, findings, ds };
  }, [fmtDate]);
}

const ENGINES: { icon: typeof Sigma; color: string; title: string; plain: string; how: string[]; why: string; limits: string; file: string }[] = [
  {
    icon: Sigma, color: "cyan", title: "1 · Personal baseline — “what’s normal for you”",
    plain: "Everything is compared with your own history, not with population averages.",
    how: [
      "Baseline = the first 30 days of data (configurable on Health Drift).",
      "For each measurement we store the mean and the sample standard deviation (SD) — the typical day-to-day spread.",
      "“Your usual range” in Simple view = mean ± 1 SD.",
    ],
    why: "People differ hugely (a resting HR of 52 can be normal for one person and unusual for another). Personal baselines are how consumer wearables make readings meaningful.",
    limits: "If the baseline month itself was unusual, comparisons inherit that. A rolling baseline would be the production choice.",
    file: "lib/analytics/baseline.ts",
  },
  {
    icon: LineChart, color: "amber", title: "2 · Health Drift — sustained change detection",
    plain: "Finds changes that last several days and involve several signals at once, ignoring one-off bad nights.",
    how: [
      "Smooth each daily series with a 5-day rolling average (removes single-day noise).",
      "z-score = (rolling value − baseline mean) ÷ baseline SD.",
      "A metric is flagged when |z| ≥ 1.5 in its unhealthy direction for ≥ 3 consecutive days (resting HR ↑, HRV ↓, breathing rate ↑, sleep efficiency ↓).",
      "An episode is raised only when ≥ 2 metrics are flagged together for ≥ 3 days. Severity is ‘strong’ if ≥ 3 metrics or any |z| ≥ 3.",
      "Single days ≥ 2 SD away that are not part of a run are listed separately as one-off outliers.",
    ],
    why: "Each rule removes a source of false alarms: smoothing (noise), persistence (one bad night), multiple signals (a single sensor glitch). This is a classic statistical process-control approach.",
    limits: "Thresholds are sensible defaults, not clinically validated cut-offs. They are exposed as sliders so their effect can be seen.",
    file: "lib/analytics/drift-detection.ts",
  },
  {
    icon: Gauge, color: "lime", title: "3 · Readiness score (0–100)",
    plain: "One number for “how rested do I look today?”, built from the same baseline idea.",
    how: [
      "Take the average of the last 3 days for HRV, resting HR (inverted, lower is better), sleep efficiency and sleep duration.",
      "Convert each to a z-score against your baseline; average heart (HRV + RHR) and sleep separately.",
      "Each part = 75 + 12 × z (clamped 0–100). Score = average of the parts. 75 = a typical day for you.",
      "Words: ≥ 80 ‘Primed’, ≥ 65 ‘Steady’, ≥ 50 ‘Take it a little easier’, below that ‘Prioritise recovery’.",
    ],
    why: "Transparent and explainable — every point can be traced back to a measurement. No hidden model.",
    limits: "The 75/12 scaling is a design choice for readability, not a validated readiness model.",
    file: "lib/analytics/readiness.ts",
  },
  {
    icon: HeartPulse, color: "violet", title: "4 · Plain-language status (Simple view)",
    plain: "Turns the numbers into ‘Normal for you’, ‘A bit lower than usual’ or ‘Much higher than usual’.",
    how: [
      "Compare this week’s average (last 7 days) with the baseline: z = (week − mean) ÷ SD.",
      "|z| < 1.5 → ‘Normal for you’; 1.5–2.5 → ‘A bit higher/lower’; > 2.5 → ‘Much higher/lower’.",
      "Each measurement knows which direction is healthier (e.g. HRV higher = better), so a change is labelled ‘good sign’ or ‘worth a look’.",
    ],
    why: "Users understand comparisons with themselves far more easily than SDs or percentiles.",
    limits: "Direction rules are general (e.g. lower resting HR is usually better) and don’t cover every personal situation.",
    file: "lib/plain.ts",
  },
  {
    icon: FlaskConical, color: "lime", title: "5 · Experiments / Habits — before vs during",
    plain: "Compares your numbers while doing a habit with the same number of days just before you started.",
    how: [
      "Baseline period = the equally long window immediately before the start date (needs ≥ 5 days).",
      "Effect size d = (habit-period mean − baseline mean) ÷ baseline SD. |d| ≥ 0.5 counts as a real change (Cohen’s ‘medium effect’ convention); smaller = ‘unchanged’.",
      "Confidence (0–100) = 22% sample size + 20% data completeness + 28% day-to-day consistency of the change + 20% absence of confounders + 10% planned duration completed.",
      "Confounders checked automatically: training load changing by ≥ 25%, or a drift episode overlapping ≥ 3 days. Any confounder blocks a ‘High’ rating.",
    ],
    why: "A personal ‘n-of-1’ trial: the most honest thing one person’s data can show is a before/after difference with its caveats.",
    limits: "Observational — it cannot prove the habit caused the change. The app says this every time.",
    file: "lib/analytics/experiments.ts",
  },
  {
    icon: Footprints, color: "cyan", title: "6 · Movement",
    plain: "Watches walking speed, step length, balance and stair speed for slow changes.",
    how: [
      "Recent level = last 14 days’ mean, compared with the baseline: d = (recent − mean) ÷ SD.",
      "|d| ≥ 1.5 → ‘improving’ or ‘worth monitoring’ depending on the healthy direction; otherwise ‘stable’.",
      "Consistency & regularity scores use the coefficient of variation (SD ÷ mean) of speed and step length.",
    ],
    why: "Walking speed is widely studied as an everyday indicator of overall function, and slow gait changes are easy to miss by eye.",
    limits: "Footwear, terrain and carrying things change gait; the app names these as possible causes.",
    file: "lib/analytics/movement.ts",
  },
  {
    icon: Network, color: "violet", title: "7 · Patterns between signals",
    plain: "Spots measurements that tend to move together, e.g. harder training → higher resting HR the next day.",
    how: [
      "Pearson correlation r on daily values over the full history, for a predefined list of plausible pairs (some lagged by 1 day).",
      "Shown only if |r| ≥ 0.3 and ≥ 30 paired days. 0.4–0.6 = ‘moderate’, ≥ 0.6 = ‘strong’.",
    ],
    why: "Pre-selecting plausible pairs avoids ‘fishing’ through hundreds of combinations and reporting chance findings.",
    limits: "Correlation is not causation — shared events can create associations. Every pattern card says so.",
    file: "lib/analytics/insights.ts",
  },
  {
    icon: Brain, color: "violet", title: "8 · Brain-Body (simulated signals)",
    plain: "Describes how simulated Temple-style signals moved before, during and after three workouts.",
    how: [
      "Each workout has minute-by-minute samples split into pre (10 min), exercise and recovery (15 min).",
      "We report descriptive changes: peak and end vs pre-exercise, heart-rate drop at 1 and 5 minutes, HRV and BrainFlow at the end of recovery.",
    ],
    why: "Shows how a future brain-body sensor could be presented responsibly.",
    limits: "BrainFlow and Entropy are invented demo signals. They are not measures of cognition or blood flow and no conclusions are drawn from them.",
    file: "lib/analytics/brain-body.ts",
  },
];

function Engine({ e }: { e: (typeof ENGINES)[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="vs-card rounded-2xl border border-border/70 p-4 sm:p-5">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `rgb(var(--${e.color}) / .14)`, color: `rgb(var(--${e.color}))` }}><e.icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{e.title}</span>
          <span className="mt-0.5 block text-[13px] text-muted">{e.plain}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <Collapsible open={open}>
        <div className="mt-4 space-y-3 pl-12 text-[13px] leading-relaxed">
          <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">How it’s calculated</p>
            <ol className="list-decimal space-y-1 pl-4 text-fg/85">{e.how.map((h) => <li key={h}>{h}</li>)}</ol></div>
          <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Why this approach</p><p className="text-fg/85">{e.why}</p></div>
          <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Limits</p><p className="text-fg/85">{e.limits}</p></div>
          <p className="font-mono text-[11px] text-muted">src/{e.file}</p>
        </div>
      </Collapsible>
    </div>
  );
}

export default function HowItWorksPage() {
  const checks = useSelfChecks();
  const passed = checks.filter((c) => c.pass).length;
  const { dataset, seed, isReal, setDataMode } = useApp();
  const real = useRealChecks();
  const realPassed = real.checks.filter((c) => c.pass).length;

  return (
    <Stagger>
      <StaggerItem>
        <PageHeader icon={BookOpenCheck} accent="cyan" eyebrow="Methodology" title="How Vitalscope works" subtitle="Where the data comes from, how every number is calculated, and how we know the calculations are right." />
      </StaggerItem>

      {/* Short answers */}
      <StaggerItem>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Database, c: "amber", q: "Is the data real?", a: "Both options exist. Demo data is synthetic, made by a seeded generator. Real data is 90 days from one anonymised volunteer in the public LifeSnaps study (Fitbit Sense). Switch with Demo / Real data at the top. Temple signals are always simulated." },
            { icon: Sigma, c: "cyan", q: "Does it predict the future?", a: "No. There is no AI model or forecasting. Every result is a transparent comparison of your recent data with your own past — descriptive statistics you can trace by hand." },
            { icon: ShieldCheck, c: "lime", q: "How do we know it’s right?", a: "The maths is tested on demo data, where we planted known events and know the right answers. Real data has no answer key, so there we check the data itself — ranges, gaps, calendar — and run the same, already-tested code." },
          ].map((x) => (
            <div key={x.q} className="vs-card rounded-2xl border border-border/70 p-4">
              <x.icon className="h-5 w-5" style={{ color: `rgb(var(--${x.c}))` }} />
              <p className="mt-2 text-sm font-semibold">{x.q}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{x.a}</p>
            </div>
          ))}
        </div>
      </StaggerItem>

      {/* Pipeline */}
      <StaggerItem>
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">The pipeline</h2>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Load", "Demo: seeded generator. Real: LifeSnaps Fitbit file, unit-converted only"],
              ["Select", "Pick the data source (Apple-style, Temple-style or combined)"],
              ["Baseline", "Mean and SD of your first 30 days per measurement"],
              ["Compare", "z-scores, rolling averages, effect sizes, correlations"],
              ["Explain", "Rules turn numbers into insights, plain words and caveats"],
            ].map(([t, x], i) => (
              <li key={t} className="relative rounded-2xl border border-border/70 bg-fg/[0.02] p-3.5">
                <span className="text-[11px] font-semibold text-lime">Step {i + 1}</span>
                <p className="text-sm font-semibold">{t}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{x}</p>
              </li>
            ))}
          </ol>
        </section>
      </StaggerItem>

      {/* Self checks */}
      <StaggerItem>
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Live accuracy checks</h2>
              <p className="text-xs text-muted">Always run on the demo data (seed {dataset.kind === "demo" ? dataset.seed : seed}){isReal ? ", even while you’re viewing real data," : ""} because that’s where the right answers are known. Try Settings → new seed: the noise changes, the planted events don’t, and the checks should still pass.</p>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", passed === checks.length ? "bg-lime/15 text-lime" : "bg-amber/15 text-amber")}>{passed} / {checks.length} passed</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-fg/[0.03] text-xs text-muted"><tr><th className="px-4 py-2.5 font-medium">Planted in the data</th><th className="px-4 py-2.5 font-medium">Expected result</th><th className="px-4 py-2.5 font-medium">What Vitalscope found</th><th className="px-4 py-2.5 text-right font-medium">Check</th></tr></thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.planted} className="border-t border-border/60 align-top">
                    <td className="px-4 py-3">{c.planted}</td>
                    <td className="px-4 py-3 text-muted">{c.expect}</td>
                    <td className="px-4 py-3">{c.found}</td>
                    <td className="px-4 py-3 text-right">{c.pass ? <CheckCircle2 className="ml-auto h-5 w-5 text-lime" aria-label="Pass" /> : <CircleAlert className="ml-auto h-5 w-5 text-amber" aria-label="Fail" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">Example of how a value is generated: resting HR = 62 + random noise (SD 1.2) + 5 × strain + 3 × travel − 3.8 × walking effect. Because we know the formula, we know the right answer — that’s what makes these checks possible.</p>
        </section>
      </StaggerItem>

      {/* Real data */}
      <StaggerItem>
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Real data checks</h2>
              <p className="text-xs text-muted">{real.ds.provenance?.dataset} participant {real.ds.provenance?.participant} · {real.ds.provenance?.device} · nobody planted anything here, so these check the <i>data</i>, not the answers. <Link href="/data-sources#real" className="text-cyan hover:underline">Full source details</Link></p>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", realPassed === real.checks.length ? "bg-lime/15 text-lime" : "bg-amber/15 text-amber")}>{realPassed} / {real.checks.length} passed</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-fg/[0.03] text-xs text-muted"><tr><th className="px-4 py-2.5 font-medium">What we checked</th><th className="px-4 py-2.5 font-medium">Expected</th><th className="px-4 py-2.5 font-medium">Result</th><th className="px-4 py-2.5 text-right font-medium">Check</th></tr></thead>
              <tbody>
                {real.checks.map((c) => (
                  <tr key={c.planted} className="border-t border-border/60 align-top">
                    <td className="px-4 py-3">{c.planted}</td>
                    <td className="px-4 py-3 text-muted">{c.expect}</td>
                    <td className="px-4 py-3">{c.found}</td>
                    <td className="px-4 py-3 text-right">{c.pass ? <CheckCircle2 className="ml-auto h-5 w-5 text-lime" aria-label="Pass" /> : <CircleAlert className="ml-auto h-5 w-5 text-amber" aria-label="Fail" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-2xl border border-border/70 p-4">
            <p className="text-sm font-semibold">What the analysis finds in this real person’s data</p>
            <ul className="mt-2 space-y-1 text-[13px] text-fg/85">{real.findings.map((f) => <li key={f}>• {f}</li>)}</ul>
            <p className="mt-2 text-[11px] text-muted">We can’t say whether these findings are “right” — we don’t know what happened in this person’s life. That’s exactly why the method is first proven on demo data with a known answer key.</p>
            {!isReal ? <button onClick={() => setDataMode("real")} className="mt-3 rounded-full bg-cyan/15 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/25">Explore the real data in the app</button> : null}
          </div>
        </section>
      </StaggerItem>

      {/* Engines */}
      <StaggerItem>
        <section className="mt-8">
          <h2 className="mb-1 text-base font-semibold">The eight engines</h2>
          <p className="mb-3 text-xs text-muted">Tap any engine to see the exact formula, why it was chosen and its limits.</p>
          <div className="space-y-3">{ENGINES.map((e) => <Engine key={e.title} e={e} />)}</div>
        </section>
      </StaggerItem>

      {/* Real world */}
      <StaggerItem>
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="vs-card rounded-2xl border border-border/70 p-5">
            <h2 className="text-base font-semibold">With real devices, how would we validate it?</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-fg/85">
              <li><b>Measurement accuracy</b> comes from the device maker (e.g. HealthKit values) — Vitalscope analyses data, it doesn’t measure.</li>
              <li><b>Data quality checks:</b> missing days, impossible values, wear-time, device changes.</li>
              <li><b>Back-testing:</b> run drift detection on historical data where users logged illness, travel or heavy training and measure hit rate vs false alarms.</li>
              <li><b>Threshold tuning</b> on that labelled data (1.5 SD, 3 days and 2 signals are starting points).</li>
              <li><b>User testing</b> that plain-language labels are understood correctly.</li>
              <li><b>Clinical review</b> before any wording that could be read as medical guidance.</li>
            </ol>
          </div>
          <div className="vs-card rounded-2xl border border-border/70 p-5">
            <h2 className="text-base font-semibold">Design principles</h2>
            <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-fg/85">
              <li>• <b>Explainable over clever</b> — no black-box model; every insight lists its evidence.</li>
              <li>• <b>You vs you</b> — personal baselines, never population norms.</li>
              <li>• <b>Several signals, several days</b> before raising anything.</li>
              <li>• <b>Honest language</b> — “associated with”, “may”, never a diagnosis.</li>
              <li>• <b>Clearly labelled data</b> — demo vs real shown on every screen; Temple signals always marked Simulated.</li>
              <li>• <b>Deterministic</b> — same seed (or same real file), same results.</li>
            </ul>
          </div>
        </section>
      </StaggerItem>
    </Stagger>
  );
}

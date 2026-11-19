"use client";

import { ExternalLink, Database, Check, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store/app-context";
import { REAL_PROVENANCE as P, loadRealDataset } from "@/lib/data/real";
import { METRICS } from "@/lib/metrics";
import { PLAIN } from "@/lib/plain";
import type { MetricKey } from "@/types/health";

const NOT_RECORDED: { label: string; why: string }[] = [
  { label: "Walking speed, step length, walking balance, stairs", why: "Fitbit does not measure gait — Movement shows “not in this source”." },
  { label: "Sleep stages, sleep routine score", why: "The daily file gives stage ratios against Fitbit’s own benchmark, not durations, so they are not copied." },
  { label: "Daylight, noise, active calories", why: "Not recorded in a comparable form." },
  { label: "BrainFlow, Entropy, workout curves", why: "No public Temple data exists. Brain-Body stays demo-only." },
  { label: "Energy / tiredness check-ins", why: "The study’s mood check-ins are tick-box choices (e.g. “tired”, “happy”), not 1–10 scores, so they aren’t mapped onto Vitalscope’s energy scale." },
];

export function RealDataCard() {
  const { isReal, setDataMode, settings, fmtDate } = useApp();
  const ds = loadRealDataset();
  const keys = Object.keys(P.mapping) as MetricKey[];
  const simple = settings.viewMode === "simple";

  return (
    <Card id="real" className="scroll-mt-24 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan/15 text-cyan"><Database className="h-4 w-4" /></span>
          <div>
            <h3 className="text-sm font-semibold">Real public data · {P.dataset} <span className="font-normal text-muted">· {P.device}</span></h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              Real recordings from one anonymised volunteer in a published research study. Not you, and not live — but genuine measurements, so you can see how the analysis behaves on messy, real-world data.
            </p>
          </div>
        </div>
        {isReal ? <Badge tone="cyan">Showing now</Badge> : <Button size="sm" variant="primary" onClick={() => setDataMode("real")}>Switch to real data</Button>}
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Participant</dt><dd className="mt-0.5 font-medium">{P.participant} (anonymised ID)</dd></div>
        <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Period</dt><dd className="mt-0.5 font-medium">{fmtDate(ds.startDate, "d MMM yyyy")} – {fmtDate(ds.endDate, "d MMM yyyy")}</dd></div>
        <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Complete days</dt><dd className="mt-0.5 font-medium">{P.completeDays} of {ds.days.length} (heart, HRV, sleep and steps all present)</dd></div>
        <div className="rounded-xl bg-surface-2 p-3"><dt className="text-muted">Licence</dt><dd className="mt-0.5 font-medium">{P.licence} · free to reuse with credit</dd></div>
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-muted"><span className="font-medium text-fg">How this person and period were picked: </span>{P.selection} The rule only looks at how complete the data is — never at what the results show — so nothing was cherry-picked.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">What’s used ({keys.length} measurements)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-left text-muted"><th className="py-1.5 pr-3 font-medium">In Vitalscope</th>{!simple ? <th className="py-1.5 pr-3 font-medium">Fitbit column</th> : null}<th className="py-1.5 font-medium">Days</th></tr></thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-3"><Check className="mr-1 inline h-3 w-3 text-lime" />{simple ? PLAIN[k]?.name ?? METRICS[k].label : METRICS[k].label}<span className="block pl-4 text-[11px] text-muted">{P.mapping[k]?.note}</span></td>
                    {!simple ? <td className="py-1.5 pr-3 font-mono text-[11px] text-muted">{P.mapping[k]?.column}</td> : null}
                    <td className="py-1.5 tabular-nums">{P.coverage[k]}/{ds.days.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Not in this data</h4>
          <ul className="space-y-2 text-xs">
            {NOT_RECORDED.map((n) => (
              <li key={n.label} className="flex gap-2"><Minus className="mt-0.5 h-3 w-3 shrink-0 text-muted" /><span><span className="font-medium">{n.label}</span><span className="block text-muted">{n.why}</span></span></li>
            ))}
          </ul>
          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">What changed from the original file</h4>
          <p className="text-xs leading-relaxed text-muted">Only unit conversions (minutes → hours, metres → km). No smoothing, no filling of missing days, no edits. Age, gender and BMI columns were left out on purpose.</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border p-3 text-[11px] leading-relaxed text-muted">
        <span className="font-medium text-fg">Source: </span>{P.authors} ({P.year}). <i>{P.title}</i>. Zenodo. DOI{" "}
        <a href={P.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-cyan hover:underline">{P.doi}<ExternalLink className="h-3 w-3" /></a>.
        {!simple ? <> Reproduce with <code className="rounded bg-surface-2 px-1 font-mono">node scripts/import-lifesnaps.mjs &lt;daily CSV&gt;</code> using <code className="rounded bg-surface-2 px-1 font-mono">{P.file}</code>.</> : null}
      </div>
    </Card>
  );
}

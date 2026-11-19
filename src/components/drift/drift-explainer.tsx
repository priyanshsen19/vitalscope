"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "@/components/ui/misc";
import type { DriftAnalysis, DriftEpisode } from "@/lib/analytics/drift-detection";
import { METRICS, formatPct } from "@/lib/metrics";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export function DriftExplainer({ analysis, episode }: { analysis: DriftAnalysis; episode: DriftEpisode }) {
  const [open, setOpen] = useState(false);
  const { fmt, fmtDate, dataset } = useApp();
  const cfg = analysis.config;
  return (
    <div className="mt-4 rounded-xl border border-border">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2">
        How was this detected? <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <Collapsible open={open}>
        <div className="space-y-4 border-t border-border p-3 text-xs">
          <ol className="list-decimal space-y-1.5 pl-4 text-muted">
            <li>Baseline: mean and sample standard deviation of days {cfg.baselineStart + 1}–{cfg.baselineEnd + 1} ({fmtDate(dataset.days[cfg.baselineStart].date)} – {fmtDate(dataset.days[cfg.baselineEnd].date)}).</li>
            <li>Each day’s value is smoothed with a {cfg.rollingWindow}-day trailing rolling average.</li>
            <li>A metric is <span className="text-fg">deviating</span> when its rolling average is more than <span className="text-fg">{cfg.sdThreshold} SD</span> beyond baseline in the unfavourable direction: z = (rolling − mean) ÷ SD.</li>
            <li>The deviation must <span className="text-fg">persist for ≥ {cfg.persistence} consecutive days</span>. Single unusual readings are never treated as events.</li>
            <li>A multi-signal pattern needs <span className="text-fg">≥ {cfg.minSignals} metrics</span> deviating on the same days.</li>
          </ol>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="text-muted"><tr className="border-b border-border"><th className="py-1.5 pr-3 font-medium">Metric</th><th className="pr-3 font-medium">Baseline mean ± SD</th><th className="pr-3 font-medium">Threshold</th><th className="pr-3 font-medium">Episode mean</th><th className="pr-3 font-medium">Change</th><th className="pr-3 font-medium">z</th><th className="font-medium">Days beyond</th></tr></thead>
              <tbody>
                {episode.metrics.map((m) => {
                  const md = analysis.metrics.find((x) => x.key === m.key);
                  const thr = md?.baseline ? md.baseline.mean + (md.adverse === "up" ? 1 : -1) * cfg.sdThreshold * md.baseline.sd : null;
                  return (
                    <tr key={m.key} className="border-b border-border/60 tabular-nums">
                      <td className="py-1.5 pr-3 font-medium">{METRICS[m.key].label}</td>
                      <td className="pr-3">{fmt(m.key, m.baselineMean, false)} ± {md?.baseline ? fmt(m.key, md.baseline.sd, false) : "—"}</td>
                      <td className="pr-3">{md?.adverse === "up" ? ">" : "<"} {thr === null ? "—" : fmt(m.key, thr, false)}</td>
                      <td className="pr-3">{fmt(m.key, m.episodeMean, false)}</td>
                      <td className="pr-3">{formatPct(m.pctChange)}</td>
                      <td className="pr-3">{m.zScore.toFixed(1)}</td>
                      <td>{m.flaggedDays} of {episode.durationDays}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted">Single-day outliers (≥ 2 SD) that did not persist are excluded:{" "}
            {analysis.metrics.filter((m) => m.available).map((m) => `${METRICS[m.key].short}: ${m.isolatedOutliers.length}`).join(" · ")}.
          </p>
        </div>
      </Collapsible>
    </div>
  );
}

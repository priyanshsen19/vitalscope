"use client";

import { motion } from "framer-motion";
import type { MetricDrift } from "@/lib/analytics/drift-detection";
import { METRICS } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Diverging bars of the latest rolling-average z-score for each metric. */
export function DeviationBars({ metrics, threshold }: { metrics: MetricDrift[]; threshold: number }) {
  const MAX = Math.max(4, threshold + 1);
  return (
    <div className="space-y-3" role="list" aria-label="Deviation from baseline in standard deviations">
      {metrics.map((m) => {
        const z = m.zScore ?? 0;
        const adverse = m.available && (m.adverse === "up" ? z >= threshold : z <= -threshold);
        const w = Math.min(50, (Math.abs(z) / MAX) * 50);
        return (
          <div key={m.key} role="listitem" className="text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted">{METRICS[m.key].label}</span>
              <span className={cn("font-medium tabular-nums", adverse ? "text-amber" : "text-fg")}>{m.available ? `${z > 0 ? "+" : ""}${z.toFixed(1)} SD` : "n/a"}</span>
            </div>
            <div className="relative h-4 rounded bg-surface-2">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <span className="absolute inset-y-0 w-px bg-amber/50" style={{ left: `${50 + (threshold / MAX) * 50}%` }} />
              <span className="absolute inset-y-0 w-px bg-amber/50" style={{ left: `${50 - (threshold / MAX) * 50}%` }} />
              {m.available ? (
                <motion.span
                  className={cn("absolute inset-y-1 rounded-sm", adverse ? "bg-amber" : "bg-cyan/70")}
                  style={{ left: z >= 0 ? "50%" : undefined, right: z < 0 ? "50%" : undefined }}
                  initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted">Amber guides mark ±{threshold} SD. Values are the latest rolling average relative to the baseline mean and standard deviation.</p>
    </div>
  );
}

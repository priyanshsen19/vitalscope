"use client";

import { motion } from "framer-motion";
import type { PlainTone } from "@/lib/plain";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export const toneColor: Record<PlainTone, string> = { good: "lime", watch: "amber", neutral: "cyan" };

/** A track with your usual range shaded and a dot for where you are now. */
export function RangeBar({ low, high, now, tone, compact }: { low: number | null; high: number | null; now: number | null; tone: PlainTone; compact?: boolean }) {
  const { motionEnabled } = useApp();
  if (low === null || high === null || now === null) return null;
  const spread = Math.max(high - low, 1e-6);
  const min = Math.min(low - spread * 0.9, now - spread * 0.15);
  const max = Math.max(high + spread * 0.9, now + spread * 0.15);
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  const c = toneColor[tone];
  return (
    <div className={cn("w-full", compact ? "pt-1" : "pt-5")}>
      <div className="relative h-2 rounded-full bg-fg/[0.07]">
        <div className="absolute inset-y-0 rounded-full bg-fg/[0.16]" style={{ left: `${pos(low)}%`, width: `${pos(high) - pos(low)}%` }}>
          {!compact ? <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted">your usual</span> : null}
        </div>
        <motion.span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg"
          style={{ background: `rgb(var(--${c}))`, boxShadow: `0 0 12px rgb(var(--${c}) / .7)` }}
          initial={motionEnabled ? { left: "50%", opacity: 0 } : false}
          animate={{ left: `${pos(now)}%`, opacity: 1 }}
          transition={{ duration: motionEnabled ? 0.8 : 0, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {!compact ? <div className="mt-1.5 flex justify-between text-[10px] text-muted"><span>Lower</span><span>Higher</span></div> : null}
    </div>
  );
}

export function TonePill({ tone, children }: { tone: PlainTone; children: React.ReactNode }) {
  const c = toneColor[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `rgb(var(--${c}) / .13)`, color: `rgb(var(--${c}))` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(var(--${c}))` }} />{children}
    </span>
  );
}

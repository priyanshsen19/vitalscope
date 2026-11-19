"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { useApp } from "@/lib/store/app-context";

/**
 * Vitalscope "pulse dial": a 240° arc made of separate ticks, filled up to the
 * score with a warm-to-fresh colour sweep. Designed for this product.
 */
const TICKS = 32;
const START = 150; // degrees
const SWEEP = 240;

function tickColor(i: number) {
  const t = i / (TICKS - 1);
  return t < 0.4 ? "var(--amber)" : t < 0.7 ? "var(--cyan)" : "var(--lime)";
}

export function ScoreDial({ score, caption, size = 220 }: { score: number | null; caption: string; size?: number }) {
  const { motionEnabled } = useApp();
  const filled = score === null ? 0 : Math.round((score / 100) * TICKS);
  const c = size / 2;
  const r1 = size / 2 - 8;
  const r2 = r1 - 18;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size * 0.86 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-x-0 top-0" aria-hidden>
        {Array.from({ length: TICKS }, (_, i) => {
          const a = ((START + (SWEEP * i) / (TICKS - 1)) * Math.PI) / 180;
          const on = i < filled;
          return (
            <motion.line key={i}
              x1={c + r2 * Math.cos(a)} y1={c + r2 * Math.sin(a)} x2={c + r1 * Math.cos(a)} y2={c + r1 * Math.sin(a)}
              strokeWidth={6} strokeLinecap="round"
              stroke={on ? `rgb(${tickColor(i)})` : "rgb(var(--fg) / 0.08)"}
              initial={motionEnabled ? { opacity: 0.15 } : false}
              animate={{ opacity: 1 }}
              transition={{ delay: motionEnabled ? i * 0.025 : 0, duration: 0.25 }}
              style={on ? { filter: `drop-shadow(0 0 4px rgb(${tickColor(i)} / 0.55))` } : undefined}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: size * 0.3 }}>
        <span className="text-5xl font-semibold leading-none tracking-tight tabular-nums"><AnimatedNumber value={score} /></span>
        <span className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{caption}</span>
      </div>
    </div>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "lime" | "cyan" | "violet" | "amber" | "danger" | "muted";

const toneClasses: Record<Tone, string> = {
  lime: "bg-lime/12 text-lime border-lime/25",
  cyan: "bg-cyan/12 text-cyan border-cyan/25",
  violet: "bg-violet/12 text-violet border-violet/25",
  amber: "bg-amber/12 text-amber border-amber/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  muted: "bg-surface-2 text-muted border-border",
};

export function Badge({ tone = "muted", className, children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}

export function SimulatedTag({ className }: { className?: string }) {
  return (
    <span title="Simulated Temple-compatible measurement — not from a real device" className={cn("inline-flex items-center rounded border border-violet/30 bg-violet/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-violet", className)}>
      Simulated
    </span>
  );
}

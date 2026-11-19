"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, SimulatedTag, type Tone } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts/sparkline";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { HoverLift } from "@/components/shared/motion";
import { TrendIcon } from "@/components/shared/status";
import { cn } from "@/lib/utils";

export interface SummaryCardProps {
  href: string;
  title: string;
  icon: React.ReactNode;
  accent: "cyan" | "lime" | "violet" | "amber";
  statusLabel: string;
  statusTone: Tone;
  metricLabel: string;
  value: number | null;
  decimals: number;
  unit: string;
  valueFormatter?: (v: number) => string;
  trend: "up" | "down" | "flat";
  trendLabel: string;
  trendGood?: boolean | null;
  spark: (number | null)[];
  insight: string;
  simulated?: boolean;
}

const accentText = { cyan: "text-cyan", lime: "text-lime", violet: "text-violet", amber: "text-amber" };

export function SummaryCard(p: SummaryCardProps) {
  return (
    <HoverLift>
      <Link href={p.href} className="group relative flex h-full flex-col rounded-2xl vs-card border border-border/70 p-4 transition-shadow hover:shadow-xl hover:shadow-black/25 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={cn("flex items-center gap-2 text-xs font-medium", accentText[p.accent])}>{p.icon}{p.title}{p.simulated ? <SimulatedTag /> : null}</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <Badge tone={p.statusTone} className="self-start">{p.statusLabel}</Badge>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted">{p.metricLabel}</p>
            <p className="mt-0.5 flex items-baseline gap-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums">
              <AnimatedNumber value={p.value} decimals={p.decimals} format={p.valueFormatter} />
              <span className="text-xs font-normal text-muted">{p.unit}</span>
            </p>
          </div>
          <div className="w-20 shrink-0 sm:w-24"><Sparkline values={p.spark} color={p.accent} /></div>
        </div>
        <p className={cn("mt-2 flex items-center gap-1 text-xs", p.trendGood === true ? "text-lime" : p.trendGood === false ? "text-amber" : "text-muted")}>
          <TrendIcon dir={p.trend} />{p.trendLabel}
        </p>
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted">{p.insight}</p>
      </Link>
    </HoverLift>
  );
}

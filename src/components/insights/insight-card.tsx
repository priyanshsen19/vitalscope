"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import type { Insight } from "@/types/insights";
import { Badge, SimulatedTag, type Tone } from "@/components/ui/badge";
import { Collapsible } from "@/components/ui/misc";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

const sevTone: Record<Insight["severity"], { tone: Tone; label: string; bar: string }> = {
  positive: { tone: "lime", label: "Positive", bar: "bg-lime" },
  info: { tone: "cyan", label: "Pattern", bar: "bg-cyan" },
  attention: { tone: "amber", label: "Worth reviewing", bar: "bg-amber" },
  notable: { tone: "amber", label: "Notable change", bar: "bg-amber" },
};

const catLabel: Record<Insight["category"], string> = {
  drift: "Health Drift", experiment: "Experiment", movement: "Movement", "brain-body": "Brain-Body", pattern: "Cross-signal",
};

export function InsightCard({ insight, defaultOpen = false, compact = false }: { insight: Insight; defaultOpen?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { fmtDate } = useApp();
  const s = sevTone[insight.severity];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lg hover:shadow-black/20">
      <span className={cn("absolute inset-y-0 left-0 w-0.5", s.bar)} />
      <div className="px-4 py-3.5 sm:px-5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={s.tone}>{s.label}</Badge>
          <Badge>{catLabel[insight.category]}</Badge>
          {insight.simulatedTemple ? <SimulatedTag /> : null}
          <span className="ml-auto text-[11px] text-muted">{fmtDate(insight.dateRange.start)} – {fmtDate(insight.dateRange.end)}</span>
        </div>
        <h4 className="text-sm font-semibold tracking-tight">{insight.title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-muted">{insight.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs font-medium text-fg hover:text-cyan">
            Evidence <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
          <span className="text-[11px] text-muted">Confidence: <span className="font-medium text-fg">{insight.confidence.level}</span> ({insight.confidence.score})</span>
          {!compact ? (
            <Link href={insight.href} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-cyan hover:underline">Open module <ArrowUpRight className="h-3 w-3" /></Link>
          ) : null}
        </div>
        <Collapsible open={open}>
          <div className="mt-3 space-y-3 rounded-xl border border-border bg-surface-2/50 p-3">
            <dl className="space-y-2">
              {insight.evidence.map((e) => (
                <div key={e.label} className="flex flex-col gap-0.5 text-xs sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-muted">{e.label}</dt>
                  <dd className="text-right font-medium tabular-nums sm:max-w-[65%]">{e.value}{e.detail ? <span className="block text-[11px] font-normal text-muted">{e.detail}</span> : null}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted">{insight.explanation}</p>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}

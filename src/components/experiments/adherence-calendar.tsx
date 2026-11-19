"use client";

import { Check, Minus, X } from "lucide-react";
import type { Experiment, ExperimentResults } from "@/types/experiment";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export function AdherenceCalendar({ exp, res }: { exp: Experiment; res: ExperimentResults }) {
  const { toggleAdherence, fmtDate, today } = useApp();
  const editable = exp.status === "active" || exp.status === "completed";
  if (!exp.startDate) return null;
  const days = Array.from({ length: exp.durationDays }, (_, off) => {
    const d = res.daily[off];
    return d;
  });
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid" aria-label="Daily adherence">
        {days.map((d) => {
          const logged = exp.adherence[d.date];
          const future = d.date > today;
          const disabled = !editable || future;
          return (
            <button
              key={d.date} disabled={disabled} onClick={() => toggleAdherence(exp.id, d.date)}
              aria-label={`${fmtDate(d.date)}: ${logged === true ? "completed" : logged === false ? "missed" : future ? "upcoming" : "not logged"}. ${disabled ? "" : "Click to change."}`}
              title={`${fmtDate(d.date)} · ${logged === true ? "Done" : logged === false ? "Missed" : "Not logged"}`}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl border text-[10px] transition-all",
                logged === true && "border-lime/50 bg-lime/15 text-lime",
                logged === false && "border-amber/50 bg-amber/10 text-amber",
                logged === undefined && !future && "border-border text-muted hover:border-muted",
                future && "border-dashed border-border/60 text-muted/40",
                !disabled && "hover:-translate-y-0.5",
              )}
            >
              <span className="absolute left-1 top-0.5 tabular-nums opacity-70">{d.offset + 1}</span>
              {logged === true ? <Check className="h-3.5 w-3.5" /> : logged === false ? <X className="h-3.5 w-3.5" /> : <Minus className="h-3 w-3 opacity-40" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted">{editable ? "Click a day to cycle: done → missed → not logged." : "Start the experiment to log adherence."} Day 1 = {fmtDate(exp.startDate)}.</p>
    </div>
  );
}

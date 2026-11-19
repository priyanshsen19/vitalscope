"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/form";
import { METRIC_KEYS, METRICS } from "@/lib/metrics";
import { useApp } from "@/lib/store/app-context";
import type { Experiment } from "@/types/experiment";
import type { MetricKey } from "@/types/health";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Sleep", "Exercise", "Nutrition", "Recovery", "Lifestyle", "Environment"] as const;
const DURATIONS = [7, 14, 21, 30] as const;

const schema = z.object({
  name: z.string().trim().min(3, "Give the experiment a name (min 3 characters)").max(60),
  category: z.enum(CATEGORIES),
  hypothesis: z.string().trim().min(10, "Describe what you expect to happen (min 10 characters)").max(280),
  behaviour: z.string().trim().min(5, "Describe the behaviour you will test").max(280),
  durationDays: z.coerce.number().refine((v) => (DURATIONS as readonly number[]).includes(v), "Choose a duration"),
  primaryMetric: z.string().min(1, "Choose a primary metric"),
  secondaryMetrics: z.array(z.string()).max(4, "Choose up to 4 secondary metrics"),
  startDate: z.string().min(1, "Choose a start date"),
});
type FormValues = z.infer<typeof schema>;

const GROUPS: { label: string; keys: MetricKey[] }[] = [
  { label: "Cardiovascular", keys: ["restingHr", "hrv", "avgHr", "hrRecovery", "vo2Max"] },
  { label: "Sleep", keys: ["sleepDuration", "sleepEfficiency", "sleepConsistency", "deepDuration", "remDuration"] },
  { label: "Activity & environment", keys: ["steps", "exerciseMinutes", "daylight", "noise", "respRate"] },
  { label: "Mobility", keys: ["walkingSpeed", "stepLength", "stairDescent"] },
  { label: "Temple-compatible & self-report", keys: ["brainFlow", "entropy", "reactionTime", "energy", "mentalFatigue"] },
];

export function ExperimentFormDialog({ open, onClose, experiment }: { open: boolean; onClose: () => void; experiment?: Experiment | null }) {
  const { createExperiment, updateExperiment, dataset, settings, today } = useApp();
  const simple = settings.viewMode === "simple";
  const editing = Boolean(experiment);
  const locked = experiment ? experiment.status !== "draft" : false; // schedule/date locked once started
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", category: "Lifestyle", hypothesis: "", behaviour: "", durationDays: 14, primaryMetric: "sleepDuration", secondaryMetrics: [], startDate: today },
  });

  useEffect(() => {
    if (!open) return;
    if (experiment) {
      reset({
        name: experiment.name, category: experiment.category, hypothesis: experiment.hypothesis, behaviour: experiment.behaviour,
        durationDays: experiment.durationDays, primaryMetric: experiment.primaryMetric, secondaryMetrics: experiment.secondaryMetrics, startDate: experiment.startDate ?? today,
      });
    } else {
      reset({ name: "", category: "Lifestyle", hypothesis: "", behaviour: "", durationDays: 14, primaryMetric: "sleepDuration", secondaryMetrics: [], startDate: today });
    }
  }, [open, experiment, reset]);

  const secondary = watch("secondaryMetrics");
  const primary = watch("primaryMetric");

  const onSubmit = (v: FormValues) => {
    const sec = v.secondaryMetrics.filter((k) => k !== v.primaryMetric) as MetricKey[];
    if (experiment) {
      updateExperiment(experiment.id, {
        name: v.name, category: v.category, hypothesis: v.hypothesis, behaviour: v.behaviour, primaryMetric: v.primaryMetric as MetricKey, secondaryMetrics: sec,
        ...(locked ? {} : { durationDays: v.durationDays as Experiment["durationDays"], startDate: v.startDate }),
      });
    } else {
      createExperiment({ name: v.name, category: v.category, hypothesis: v.hypothesis, behaviour: v.behaviour, durationDays: v.durationDays as Experiment["durationDays"], primaryMetric: v.primaryMetric as MetricKey, secondaryMetrics: sec, startDate: v.startDate });
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} wide title={simple ? (editing ? "Edit habit" : "New habit") : editing ? "Edit experiment" : "New experiment"} description={simple ? "Choose one small change, what you hope it does, and what we should keep an eye on." : "Define a hypothesis, the behaviour you will test, and which measurements to compare."}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2"><Label htmlFor="name">{simple ? "Give it a name" : "Experiment name"}</Label><Input id="name" placeholder="e.g. Morning Walk Experiment" {...register("name")} /><FieldError message={errors.name?.message} /></div>
          <div><Label htmlFor="category">Category</Label><Select id="category" {...register("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></div>
        </div>
        <div><Label htmlFor="hyp">{simple ? "What do you hope will happen?" : "Hypothesis"}</Label><Textarea id="hyp" placeholder="A 20-minute morning outdoor walk may improve sleep consistency and recovery indicators." {...register("hypothesis")} /><FieldError message={errors.hypothesis?.message} /></div>
        <div><Label htmlFor="beh">{simple ? "What will you do each day?" : "Behaviour being tested"}</Label><Textarea id="beh" placeholder="Walk outdoors for 20 minutes within one hour of waking." {...register("behaviour")} /><FieldError message={errors.behaviour?.message} /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="dur">Duration</Label><Select id="dur" disabled={locked} {...register("durationDays")}>{DURATIONS.map((d) => <option key={d} value={d}>{d} days</option>)}</Select></div>
          <div><Label htmlFor="pm">{simple ? "Main thing to watch" : "Primary metric"}</Label>
            <Select id="pm" {...register("primaryMetric")}>
              {GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.keys.map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}</optgroup>)}
            </Select><FieldError message={errors.primaryMetric?.message} /></div>
          {!locked ? (
            <div><Label htmlFor="sd">Planned start date</Label><Input id="sd" type="date" min={dataset.startDate} max={today} {...register("startDate")} /></div>
          ) : null}
        </div>
        {!locked ? <p className="-mt-2 text-[11px] text-muted">Default is today (no measurements yet). Choose a past date to analyse the experiment against the existing demo data.</p> : null}
        <div>
          <Label>{simple ? "Other things to watch" : "Secondary metrics"} <span className="font-normal text-muted/70">(up to 4)</span></Label>
          <div className="space-y-3 rounded-xl border border-border p-3">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{g.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.keys.filter((k) => k !== primary).map((k) => {
                    const on = secondary.includes(k);
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => setValue("secondaryMetrics", on ? secondary.filter((x) => x !== k) : [...secondary, k], { shouldValidate: true })}
                        className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-lime/50 bg-lime/15 text-lime" : "border-border text-muted hover:text-fg")}>{METRICS[k].short}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <FieldError message={errors.secondaryMetrics?.message as string | undefined} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">{editing ? "Save changes" : simple ? "Create habit" : "Create experiment"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export { METRIC_KEYS };

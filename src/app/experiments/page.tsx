"use client";

import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Plus, Sprout } from "lucide-react";
import { PLAIN } from "@/lib/plain";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Dialog, Progress, Segmented } from "@/components/ui/misc";
import { EmptyState } from "@/components/shared/states";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { ExperimentFormDialog } from "@/components/experiments/experiment-form";
import { ExperimentDetail } from "@/components/experiments/experiment-detail";
import { useApp } from "@/lib/store/app-context";
import { calculateExperimentResults, calculateExperimentStats, experimentPeriod } from "@/lib/analytics/experiments";
import { METRICS } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { Experiment } from "@/types/experiment";

type Tab = "active" | "completed" | "all";
const statusTone: Record<Experiment["status"], Tone> = { draft: "muted", active: "lime", paused: "amber", completed: "cyan" };
const simpleStatus: Record<Experiment["status"], string> = { draft: "not started", active: "in progress", paused: "on hold", completed: "finished" };

export default function ExperimentsPage() {
  const { experiments, dataset, settings, deleteExperiment, fmtDate } = useApp();
  const simple = settings.viewMode === "simple";
  const [tab, setTab] = useState<Tab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Experiment | null>(null);
  const [deleting, setDeleting] = useState<Experiment | null>(null);

  const stats = useMemo(() => calculateExperimentStats(dataset, experiments, settings.source), [dataset, experiments, settings.source]);
  const list = experiments.filter((e) => (tab === "active" ? e.status === "active" || e.status === "paused" || e.status === "draft" : tab === "completed" ? e.status === "completed" : true));
  const selected = experiments.find((e) => e.id === selectedId) ?? list[0] ?? experiments[0] ?? null;

  useEffect(() => {
    if (selectedId === null && experiments.length) {
      setSelectedId((experiments.find((e) => e.status === "completed") ?? experiments[0]).id);
    }
  }, [experiments, selectedId]);

  const openNew = () => { setEditing(null); setFormOpen(true); };

  return (
    <Stagger>
      <StaggerItem>
        {simple
          ? <PageHeader icon={Sprout} accent="lime" eyebrow="Try a change" title="Habits" subtitle="Pick one small change, do it for a couple of weeks, and see how your body responds." actions={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" />New habit</Button>} />
          : <PageHeader icon={FlaskConical} accent="lime" eyebrow="Module 02" title="Personal Health Experiments" subtitle="Discover how your daily habits relate to your body’s response." actions={<Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" />New experiment</Button>} />}
      </StaggerItem>

      {!simple ? <StaggerItem>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Experiments", value: stats.total, dec: 0, suffix: "" },
            { label: "Active", value: stats.active, dec: 0, suffix: "" },
            { label: "Completed", value: stats.completed, dec: 0, suffix: "" },
            { label: "Avg. adherence", value: stats.avgAdherence === null ? null : stats.avgAdherence * 100, dec: 0, suffix: "%" },
            { label: "With improved primary metric", value: stats.withPositiveFinding, dec: 0, suffix: ` / ${stats.analysed}` },
          ].map((s) => (
            <Card key={s.label} className="p-4"><p className="text-xs text-muted">{s.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight"><AnimatedNumber value={s.value} decimals={s.dec} /><span className="text-sm font-normal text-muted">{s.suffix}</span></p></Card>
          ))}
        </div>
      </StaggerItem> : null}

      <div className={cn("grid gap-6 xl:grid-cols-[340px_1fr]", !simple && "mt-6")}>
        <StaggerItem>
          <div className="mb-3"><Segmented<Tab> id="exp-tab" ariaLabel="Experiment list" value={tab} onChange={setTab} options={[{ value: "active", label: `${simple ? "Current" : "Active"} (${stats.active + stats.paused + stats.draft})` }, { value: "completed", label: `${simple ? "Finished" : "Completed"} (${stats.completed})` }, { value: "all", label: simple ? "All" : "History" }]} /></div>
          <div className="space-y-2.5">
            {list.length === 0 ? <EmptyState icon={<FlaskConical className="h-5 w-5" />} title={tab === "completed" ? "No completed experiments" : "No experiments"} text="Create an experiment to test how a habit relates to your measurements." action={<Button size="sm" variant="primary" onClick={openNew}>New experiment</Button>} /> : null}
            {list.map((e) => {
              const per = experimentPeriod(dataset, e);
              const res = calculateExperimentResults(dataset, e, settings.source);
              const prog = per ? Math.min(100, (per.elapsed / e.durationDays) * 100) : 0;
              const sel = selected?.id === e.id;
              return (
                <button key={e.id} onClick={() => setSelectedId(e.id)} aria-pressed={sel}
                  className={cn("block w-full rounded-2xl vs-card border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20", sel ? "border-lime/50 ring-1 ring-lime/20" : "border-border")}>
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium leading-snug">{e.name}</span><Badge tone={statusTone[e.status]}>{simple ? simpleStatus[e.status] : e.status}</Badge></div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{simple ? e.behaviour : e.hypothesis}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted"><span>{simple ? `${e.durationDays} days · watching ${(PLAIN[e.primaryMetric]?.name ?? METRICS[e.primaryMetric].short).toLowerCase()}` : `${e.category} · ${e.durationDays} d · ${METRICS[e.primaryMetric].short}`}</span><span>{e.startDate ? fmtDate(e.startDate) : "Draft"}</span></div>
                  {e.status !== "draft" ? <Progress className="mt-2" value={prog} tone={e.status === "completed" ? "cyan" : e.status === "paused" ? "amber" : "lime"} label={`${e.name} progress`} /> : null}
                  {e.status !== "draft" && res.adherence.rate !== null ? <p className="mt-1.5 text-[11px] text-muted">{simple ? `Done on ${Math.round(res.adherence.rate * 100)}% of days` : `Adherence ${Math.round(res.adherence.rate * 100)}%`}</p> : null}
                </button>
              );
            })}
          </div>
        </StaggerItem>

        <StaggerItem>
          {selected ? (
            <ExperimentDetail key={selected.id} exp={selected} onEdit={() => { setEditing(selected); setFormOpen(true); }} onDelete={() => setDeleting(selected)} />
          ) : (
            <EmptyState icon={<FlaskConical className="h-5 w-5" />} title="Select or create an experiment" text="Your experiment analysis, adherence log and findings appear here." />
          )}
        </StaggerItem>
      </div>

      <ExperimentFormDialog open={formOpen} onClose={() => setFormOpen(false)} experiment={editing} />
      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title="Delete experiment?" description="This removes the experiment and its adherence log from this browser.">
        <p className="text-sm text-muted">“{deleting?.name}” will be permanently deleted. Use Settings → Restore initial experiments to bring back the samples.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { if (deleting) { deleteExperiment(deleting.id); setSelectedId(null); } setDeleting(null); }}>Delete experiment</Button>
        </div>
      </Dialog>
    </Stagger>
  );
}

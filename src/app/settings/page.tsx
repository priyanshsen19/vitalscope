"use client";

import { useState } from "react";
import { Settings2, Download, RefreshCw, RotateCcw, Shuffle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/misc";
import { Input, Label, Select, Switch } from "@/components/ui/form";
import { useApp } from "@/lib/store/app-context";
import { buildExperimentReport, calculateExperimentResults } from "@/lib/analytics/experiments";
import { DEFAULT_SEED } from "@/lib/data/seed";
import { downloadFile, slugify } from "@/lib/utils";
import type { DateFormatPref, DateRangeDays, MotionPref, SourceId, ThemePref, UnitPref } from "@/types/health";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0"><p className="text-sm font-medium">{label}</p>{hint ? <p className="text-xs text-muted">{hint}</p> : null}</div>
      <div className="w-full sm:w-60">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, seed, dataset, experiments, resetAll, restoreSampleExperiments, regenerate, fmtDate } = useApp();
  const [seedInput, setSeedInput] = useState(String(seed));
  const [confirmReset, setConfirmReset] = useState(false);
  const [expId, setExpId] = useState(experiments[0]?.id ?? "");
  const [note, setNote] = useState<string | null>(null);
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(null), 3500); };

  const exportJson = () => {
    const payload = dataset.kind === "real"
      ? {
          notice: `REAL PUBLIC DATA · ${dataset.provenance?.dataset} (${dataset.provenance?.licence}). Cite: ${dataset.provenance?.authors} (${dataset.provenance?.year}), DOI ${dataset.provenance?.doi}.`,
          generatedBy: "Vitalscope", provenance: dataset.provenance, startDate: dataset.startDate, endDate: dataset.endDate,
          days: dataset.days.map((d) => ({ date: d.date, values: d.apple })), experiments,
        }
      : {
          notice: "DEMO DATA · SIMULATED WEARABLE MEASUREMENTS. Not from a real Apple Watch or Temple device.",
          generatedBy: "Vitalscope", seed: dataset.seed, startDate: dataset.startDate, endDate: dataset.endDate,
          profile: { name: settings.profileName, age: settings.profileAge },
          days: dataset.days, workouts: dataset.workouts, experiments,
        };
    downloadFile(dataset.kind === "real" ? `vitalscope-real-${dataset.provenance?.dataset?.toLowerCase()}-${dataset.provenance?.participant}.json` : `vitalscope-sample-data-seed-${dataset.seed}.json`, JSON.stringify(payload, null, 2));
    flash("Sample data exported as JSON.");
  };
  const exp = experiments.find((e) => e.id === expId) ?? experiments[0];
  const exportReport = () => {
    if (!exp) return;
    const res = calculateExperimentResults(dataset, exp, settings.source, settings.units);
    downloadFile(`${slugify(exp.name)}-report.md`, buildExperimentReport(exp, res, dataset, settings.units), "text/markdown");
    flash("Experiment report exported.");
  };
  const applySeed = () => {
    const n = Number(seedInput);
    if (!Number.isInteger(n) || n <= 0) { flash("Enter a positive whole number as the seed."); return; }
    regenerate(n);
    flash(`Sample dataset regenerated with seed ${n}.`);
  };

  return (
    <Stagger>
      <StaggerItem><PageHeader icon={Settings2} accent="cyan" eyebrow="Preferences" title="Settings" subtitle="Preferences are saved in this browser. Nothing leaves your device." /></StaggerItem>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <StaggerItem>
            <Card id="profile"><CardHeader title="Profile" subtitle="Sample profile used for the demo" />
              <CardBody className="divide-y divide-border">
                <Row label="Name"><Input aria-label="Name" value={settings.profileName} onChange={(e) => updateSettings({ profileName: e.target.value })} maxLength={40} /></Row>
                <Row label="Age"><Input aria-label="Age" type="number" min={13} max={110} value={settings.profileAge} onChange={(e) => updateSettings({ profileAge: Number(e.target.value) || 0 })} /></Row>
              </CardBody></Card>
          </StaggerItem>

          <StaggerItem>
            <Card><CardHeader title="Display" />
              <CardBody className="divide-y divide-border">
                <Row label="Units" hint="Distance, step length and speeds"><Select aria-label="Units" value={settings.units} onChange={(e) => updateSettings({ units: e.target.value as UnitPref })}><option value="metric">Metric (km, cm, m/s)</option><option value="imperial">Imperial (mi, in, mph)</option></Select></Row>
                <Row label="Date format" hint={`Example: ${fmtDate(dataset.endDate)}`}><Select aria-label="Date format" value={settings.dateFormat} onChange={(e) => updateSettings({ dateFormat: e.target.value as DateFormatPref })}><option value="MMM d">Nov 18</option><option value="d MMM">18 Nov</option><option value="yyyy-MM-dd">2026-11-18</option></Select></Row>
                <Row label="Theme"><Select aria-label="Theme" value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as ThemePref })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">Match system</option></Select></Row>
                <Row label="Reduced motion" hint="Disables chart drawing, counters and transitions"><Select aria-label="Reduced motion" value={settings.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.value as MotionPref })}><option value="system">Follow system setting</option><option value="on">Always reduce</option><option value="off">Never reduce</option></Select></Row>
              </CardBody></Card>
          </StaggerItem>

          <StaggerItem>
            <Card><CardHeader title="Data" />
              <CardBody className="divide-y divide-border">
                <Row label="Preferred data source" hint="Also switchable from the top bar"><Select aria-label="Preferred data source" value={settings.source} onChange={(e) => updateSettings({ source: e.target.value as SourceId })}><option value="combined">Combined dataset</option><option value="apple">Apple Watch · Simulated</option><option value="temple">Temple · Simulated</option></Select></Row>
                <Row label="Default date range"><Select aria-label="Default date range" value={settings.dateRange} onChange={(e) => updateSettings({ dateRange: Number(e.target.value) as DateRangeDays })}>{[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</Select></Row>
                <Row label="Collapse sidebar by default"><div className="flex sm:justify-end"><Switch checked={settings.sidebarCollapsed} onChange={(v) => updateSettings({ sidebarCollapsed: v })} label="Collapse sidebar" /></div></Row>
              </CardBody></Card>
          </StaggerItem>
        </div>

        <StaggerItem>
          <Card><CardHeader title="Demo controls" subtitle="Reset, regenerate and export" />
            <CardBody className="space-y-5">
              <div className="rounded-xl border border-border p-3.5">
                <p className="text-sm font-medium">Regenerate sample dataset</p>
                <p className="mt-0.5 text-xs text-muted">{dataset.kind === "real" ? "Applies to demo data only (you’re viewing real data now). " : ""}The 90-day dataset is generated from a fixed seed, so the same seed always gives the same data. Scripted events stay in the same places; day-to-day noise changes. Current seed: <span className="tabular-nums text-fg">{seed}</span>.</p>
                <div className="mt-3 flex gap-2"><Input aria-label="Seed" inputMode="numeric" value={seedInput} onChange={(e) => setSeedInput(e.target.value)} className="max-w-[160px]" /><Button onClick={applySeed}><Shuffle className="h-4 w-4" />Regenerate</Button><Button variant="ghost" onClick={() => { setSeedInput(String(DEFAULT_SEED)); regenerate(DEFAULT_SEED); flash("Restored the original seed."); }}>Original seed</Button></div>
              </div>
              <div className="rounded-xl border border-border p-3.5">
                <p className="text-sm font-medium">Restore initial experiments</p>
                <p className="mt-0.5 text-xs text-muted">Brings back the three sample experiments (morning walk, consistent bedtime, caffeine cut-off) in their original state. Your own experiments are kept.</p>
                <Button className="mt-3" onClick={() => { restoreSampleExperiments(); flash("Sample experiments restored."); }}><RefreshCw className="h-4 w-4" />Restore experiments</Button>
              </div>
              <div className="rounded-xl border border-border p-3.5">
                <p className="text-sm font-medium">Export</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={exportJson}><Download className="h-4 w-4" />Sample data (JSON)</Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select aria-label="Experiment to export" value={exp?.id ?? ""} onChange={(e) => setExpId(e.target.value)} className="max-w-[240px]">{experiments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
                  <Button onClick={exportReport} disabled={!exp}><Download className="h-4 w-4" />Experiment report (.md)</Button>
                </div>
              </div>
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3.5">
                <p className="text-sm font-medium">Reset all demo data</p>
                <p className="mt-0.5 text-xs text-muted">Clears everything saved in this browser — experiments, adherence logs, settings and the dataset seed — and restores the initial demo state.</p>
                <Button variant="danger" className="mt-3" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" />Reset demo data</Button>
              </div>
              <p role="status" aria-live="polite" className="min-h-[1rem] text-xs text-lime">{note}</p>
            </CardBody></Card>
        </StaggerItem>
      </div>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset all demo data?" description="This cannot be undone.">
        <p className="text-sm text-muted">Experiments you created, adherence logs, settings and the dataset seed will return to their initial values.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button><Button variant="danger" onClick={() => { resetAll(); setSeedInput(String(DEFAULT_SEED)); setConfirmReset(false); flash("Demo data reset."); }}>Reset everything</Button></div>
      </Dialog>
    </Stagger>
  );
}

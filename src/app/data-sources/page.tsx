"use client";

import { Fragment } from "react";
import { Check, Circle, Minus, Watch, Brain, PenLine, Database } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SimulatedTag } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Stagger, StaggerItem } from "@/components/shared/motion";
import { useApp } from "@/lib/store/app-context";
import { METRIC_KEYS, METRICS } from "@/lib/metrics";
import type { MetricCategory } from "@/types/health";
import { sourcesFor } from "@/lib/data/selectors";
import { cn } from "@/lib/utils";
import { RealDataCard } from "@/components/data/real-data-card";

const CAT: Record<MetricCategory, string> = { cardio: "Cardiovascular", respiratory: "Respiratory", sleep: "Sleep", activity: "Activity", mobility: "Mobility", environment: "Environmental", temple: "Temple-compatible", cognitive: "Cognitive (self-reported)" };

const ROADMAP = [
  { name: "Apple HealthKit", text: "Read workouts, sleep, heart rate and mobility records directly from the Health app.", status: "Planned" },
  { name: "Google Health Connect", text: "Bring Android and Wear OS data into the same baselines.", status: "Planned" },
  { name: "Temple device data", text: "Analyse real BrainFlow and Entropy streams once access to Temple’s data is available.", status: "Exploring" },
  { name: "Other wearable platforms", text: "Wearable-agnostic ingestion so any device with compatible measurements can be analysed.", status: "Exploring" },
];

export default function DataSourcesPage() {
  const { settings, dataset, fmtDate, isReal, setDataMode } = useApp();
  const active = sourcesFor(settings.source);
  const cards = [
    { id: "apple", name: "Apple Watch", sub: "Simulated data", icon: Watch, tone: "cyan" as const, count: METRIC_KEYS.filter((k) => METRICS[k].sources.includes("apple")).length, text: "Heart rate, HRV, respiratory rate, sleep stages, activity, mobility and environmental measurements." },
    { id: "temple", name: "Temple", sub: "Simulated compatible data", icon: Brain, tone: "violet" as const, count: METRIC_KEYS.filter((k) => METRICS[k].sources.includes("temple")).length, text: "BrainFlow Index, Entropy, heart rate, HRV and respiratory rate — simulated to resemble the kind of data a Temple-compatible source could provide." },
    { id: "manual", name: "Self-report", sub: "Simulated entries", icon: PenLine, tone: "lime" as const, count: METRIC_KEYS.filter((k) => METRICS[k].sources.includes("manual")).length, text: "Reaction-time test, energy and mental-fatigue ratings." },
  ];
  const cats = Array.from(new Set(METRIC_KEYS.map((k) => METRICS[k].category)));

  return (
    <Stagger>
      <StaggerItem><PageHeader icon={Database} accent="cyan" eyebrow="Provenance" title="Data Sources" subtitle="Where every measurement in this demonstration comes from." /></StaggerItem>

      <StaggerItem>
        {isReal ? (
          <div className="mb-6 rounded-2xl border border-cyan/30 bg-cyan/5 p-4 text-sm">
            <p className="font-medium">Showing: <span className="text-cyan">Real public data</span></p>
            <p className="mt-1 text-muted">Every number in the app now comes from one volunteer’s real Fitbit recordings (details below). No device is connected live. <button className="text-cyan hover:underline" onClick={() => setDataMode("demo")}>Switch back to demo data</button></p>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl border border-amber/30 bg-amber/5 p-4 text-sm">
            <p className="font-medium">Connection status: <span className="text-amber">Demo mode</span></p>
            <p className="mt-1 text-muted">This demonstration uses synthetic physiological measurements. Live Apple HealthKit and Temple integrations are not connected. A real public dataset is also available — see below.</p>
          </div>
        )}
      </StaggerItem>

      {isReal ? <StaggerItem><div className="mb-6"><RealDataCard /></div></StaggerItem> : null}

      <StaggerItem>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            const on = !isReal && active.includes(c.id as "apple" | "temple" | "manual");
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between"><span className={cn("flex h-9 w-9 items-center justify-center rounded-md", { cyan: "bg-cyan/15 text-cyan", violet: "bg-violet/15 text-violet", lime: "bg-lime/15 text-lime" }[c.tone])}><Icon className="h-4 w-4" /></span><Badge tone={on ? "lime" : "muted"}>{isReal ? "Demo only" : on ? "In current view" : "Not in current view"}</Badge></div>
                <h3 className="mt-3 text-sm font-semibold">{c.name} <span className="font-normal text-muted">· {c.sub}</span></h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{c.text}</p>
                <p className="mt-3 text-[11px] text-muted">{c.count} measurements · {dataset.days.length} days ({fmtDate(dataset.startDate)} – {fmtDate(dataset.endDate)})</p>
                <p className="mt-0.5 text-[11px] text-muted">Status: <span className="text-fg">Demo mode — not connected</span></p>
              </Card>
            );
          })}
        </div>
      </StaggerItem>

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title="Data coverage" subtitle="Which source provides each measurement. Metrics a selected source cannot provide show as unavailable throughout the app." />
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted"><th className="pb-2 font-medium">Measurement</th><th className="pb-2 text-center font-medium">Apple Watch</th><th className="pb-2 text-center font-medium">Temple</th><th className="pb-2 text-center font-medium">Self-report</th></tr></thead>
              <tbody>
                {cats.map((cat) => (
                  <Fragment key={cat}>
                    <tr><td colSpan={4} className="pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted">{CAT[cat]}</td></tr>
                    {METRIC_KEYS.filter((k) => METRICS[k].category === cat).map((k) => (
                      <tr key={k} className="border-b border-border/50">
                        <td className="py-2 pr-3">{METRICS[k].label}{METRICS[k].templeSimulated ? <SimulatedTag className="ml-1.5" /> : null}<span className="ml-1.5 text-[11px] text-muted">{METRICS[k].unit}</span></td>
                        {(["apple", "temple", "manual"] as const).map((s) => (
                          <td key={s} className="text-center">{METRICS[k].sources.includes(s) ? <Check className="mx-auto h-4 w-4 text-lime" aria-label="Provided" /> : <Minus className="mx-auto h-4 w-4 text-border" aria-label="Not provided" />}</td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </StaggerItem>

      {!isReal ? <StaggerItem className="mt-6"><RealDataCard /></StaggerItem> : null}

      <StaggerItem className="mt-6">
        <Card>
          <CardHeader title="Integration roadmap" subtitle="Directional ideas — none of these integrations exist in this demo" />
          <CardBody>
            <ul className="divide-y divide-border">
              {ROADMAP.map((r) => (
                <li key={r.name} className="flex items-start gap-3 py-3"><Circle className="mt-1 h-3 w-3 shrink-0 text-muted" /><div className="flex-1"><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted">{r.text}</p></div><Badge>{r.status}</Badge></li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Dialog } from "@/components/ui/misc";

const STEPS = [
  { href: "/my-body", title: "Open My Body", text: "Every measurement in plain words, compared with what’s normal for you. Tap a card for the explanation." },
  { href: "/health-drift", title: "Open Health Drift", text: "Inspect the multi-signal deviation. Try changing the baseline window and expanding “How was this detected?”." },
  { href: "/experiments", title: "Open Experiments", text: "Inspect the completed morning-walk experiment, toggle adherence on the active one, or create your own." },
  { href: "/movement", title: "Open Movement", text: "Explore mobility trends, switch metrics and compare periods against your baseline." },
  { href: "/how-it-works", title: "Open How it works", text: "The data source, every formula, and live checks proving the analytics find the events planted in the demo data." },
  { href: "/brain-body", title: "Open Brain-Body", text: "Compare exercise responses across running, cycling and walking using the simulated Temple-compatible signals." },
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="How to explore Vitalscope" description="A suggested path — explore in any order.">
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} onClick={onClose} className="group flex gap-3 rounded-2xl border border-border p-3 transition-colors hover:border-cyan/40 hover:bg-surface-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime/15 text-xs font-semibold text-lime">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium">{s.title}<ArrowUpRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                <span className="mt-0.5 block text-xs text-muted">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">Demo data is synthetic; switch to <span className="text-fg">Real data</span> at the top to see one volunteer’s real Fitbit recordings from the public LifeSnaps study. Your changes (experiments, settings) are saved in this browser; use <span className="text-fg">Settings → Reset demo data</span> to start over.</p>
    </Dialog>
  );
}

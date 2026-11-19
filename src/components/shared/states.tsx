"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Info, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useApp } from "@/lib/store/app-context";
import { cn } from "@/lib/utils";

export function EmptyState({ title, text, action, icon }: { title: string; text: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <div className="text-muted">{icon ?? <Info className="h-5 w-5" />}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted">{text}</p>
      {action}
    </div>
  );
}

export function UnavailableNotice({ metrics, className }: { metrics: string; className?: string }) {
  const { setSource, settings, isReal, dataset, setDataMode } = useApp();
  if (isReal) {
    return (
      <div className={cn("flex flex-col items-start gap-3 rounded-2xl border border-dashed border-cyan/40 bg-cyan/5 p-4 sm:flex-row sm:items-center sm:justify-between", className)}>
        <div className="flex gap-3">
          <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
          <div>
            <p className="text-sm font-medium">Not recorded in the real data</p>
            <p className="mt-0.5 text-xs text-muted">{metrics}: the {dataset.provenance?.device} in the {dataset.provenance?.dataset} study doesn’t provide these, so nothing is shown rather than anything made up.</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setDataMode("demo")}>Switch to demo data</Button>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-2xl border border-dashed border-amber/40 bg-amber/5 p-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex gap-3">
        <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
        <div>
          <p className="text-sm font-medium">Not available from the selected data source</p>
          <p className="mt-0.5 text-xs text-muted">{metrics} {settings.source === "apple" ? "come from Temple-compatible data, which is not part of the Apple Watch dataset." : "come from the Apple Watch dataset, which is not part of the Temple-compatible dataset."}</p>
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setSource("combined")}>Switch to Combined</Button>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-muted">{children}</p>;
}

export function ModuleLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-cyan hover:underline">{children}</Link>;
}

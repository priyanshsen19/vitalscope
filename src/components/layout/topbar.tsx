"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CircleHelp, Menu } from "lucide-react";
import { titleFor } from "./nav";
import { HelpDialog } from "./help-dialog";
import { Segmented } from "@/components/ui/misc";
import { Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store/app-context";
import { useAnalysis } from "@/lib/store/use-analysis";
import type { DataMode, DateRangeDays, SourceId, ViewMode } from "@/types/health";
import { cn } from "@/lib/utils";

function Notifications() {
  const { settings, markNotificationsRead } = useApp();
  const { notifications } = useAnalysis();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !settings.readNotifications.includes(n.id));

  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`} aria-expanded={open} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:text-fg">
        <Bell className="h-4 w-4" />
        {unread.length > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber ring-2 ring-bg" /> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="absolute right-0 top-11 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              {unread.length ? <button className="text-xs text-cyan hover:underline" onClick={() => markNotificationsRead(notifications.map((n) => n.id))}>Mark all read</button> : null}
            </div>
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.length === 0 ? <li className="px-4 py-6 text-center text-xs text-muted">Nothing needs your attention.</li> : null}
              {notifications.map((n) => {
                const isUnread = !settings.readNotifications.includes(n.id);
                return (
                  <li key={n.id}>
                    <Link href={n.href} onClick={() => { markNotificationsRead([n.id]); setOpen(false); }} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", isUnread ? { amber: "bg-amber", cyan: "bg-cyan", lime: "bg-lime" }[n.tone] : "bg-border")} />
                      <span><span className="block text-sm font-medium">{n.title}</span><span className="block text-xs text-muted">{n.detail}</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { settings, setDateRange, setSource, updateSettings, setDataMode, isReal, dataset, fmtDate } = useApp();
  const simple = settings.viewMode === "simple";
  const [help, setHelp] = useState(false);
  const initials = settings.profileName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/70 backdrop-blur-xl">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <button onClick={onMenu} aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-fg lg:hidden"><Menu className="h-4 w-4" /></button>
        <h2 className="mr-auto min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base">{titleFor(pathname, settings.viewMode)}</h2>
        <Segmented<ViewMode> id="view-mode" size="sm" ariaLabel="View" value={settings.viewMode} onChange={(v) => updateSettings(v === "simple" ? { viewMode: v, source: "combined" } : { viewMode: v })}
          options={[{ value: "simple", label: "Simple" }, { value: "detailed", label: "Detailed" }]} />
        <Segmented<DataMode> id="data-mode" size="sm" ariaLabel="Data" value={settings.dataMode} onChange={setDataMode}
          options={[{ value: "demo", label: "Demo data" }, { value: "real", label: "Real data" }]} />
        {!simple ? (
          <>
            <Segmented<DateRangeDays> id="range" size="sm" ariaLabel="Date range" value={settings.dateRange} onChange={setDateRange}
              options={[{ value: 7, label: "7d" }, { value: 14, label: "14d" }, { value: 30, label: "30d" }, { value: 90, label: "90d" }]} />
            {!isReal ? <Select aria-label="Data source" className="h-9 w-auto min-w-[150px] rounded-full text-xs" value={settings.source} onChange={(e) => setSource(e.target.value as SourceId)}>
              <option value="combined">Combined dataset</option>
              <option value="apple">Apple Watch · Simulated</option>
              <option value="temple">Temple · Simulated</option>
            </Select> : null}
          </>
        ) : null}
        <Notifications />
        <button onClick={() => setHelp(true)} aria-label="How to explore Vitalscope" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:text-fg"><CircleHelp className="h-4 w-4" /></button>
        <Link href="/settings#profile" aria-label="Profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-violet/20 text-xs font-semibold text-violet">{initials}</Link>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border/40 px-4 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted/90">
        {isReal ? (
          <><span className="h-1.5 w-1.5 rounded-full bg-cyan" /><Link href="/data-sources#real" className="hover:text-fg">Real data · {dataset.provenance?.dataset} public dataset · {dataset.provenance?.device} · {fmtDate(dataset.startDate, "MMM yyyy")}–{fmtDate(dataset.endDate, "MMM yyyy")}{simple ? " · not medical advice" : ""}</Link></>
        ) : (
          <><span className="h-1.5 w-1.5 rounded-full bg-amber" />{simple ? "Demo · simulated data, not medical advice" : "Demo data · simulated wearable measurements"}</>
        )}
      </div>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </header>
  );
}

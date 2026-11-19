"use client";

import { createPortal } from "react-dom";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useApp } from "@/lib/store/app-context";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-md bg-surface-2 after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-fg/5 after:to-transparent", className)} />;
}

export function Progress({ value, tone = "lime", className, label }: { value: number; tone?: "lime" | "cyan" | "violet" | "amber"; className?: string; label?: string }) {
  const { motionEnabled } = useApp();
  const pct = Math.max(0, Math.min(100, value));
  const bg = { lime: "bg-lime", cyan: "bg-cyan", violet: "bg-violet", amber: "bg-amber" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className={cn("h-full rounded-full", bg)} initial={motionEnabled ? { width: 0 } : false} animate={{ width: `${pct}%` }} transition={{ duration: motionEnabled ? 0.7 : 0, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export function Segmented<T extends string | number>({
  value, onChange, options, id, size = "md", ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  id: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-surface-2/80 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn("relative whitespace-nowrap rounded-full font-medium transition-colors disabled:opacity-40", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs sm:text-sm", active ? "text-fg" : "text-muted hover:text-fg")}
          >
            {active ? <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-fg/[0.09] shadow-sm ring-1 ring-fg/10" transition={{ type: "spring", stiffness: 500, damping: 38 }} /> : null}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Dialog({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  const { motionEnabled } = useApp();
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Render at <body> level so a parent with backdrop-filter/transform (e.g. the sticky
  // top bar) can't become the containing block and clip or offset the dialog.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn("relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: motionEnabled ? 0.2 : 0, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close dialog"><X className="h-4 w-4" /></Button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  const { motionEnabled } = useApp();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: motionEnabled ? 0.25 : 0, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

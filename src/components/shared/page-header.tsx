import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Accent = "lime" | "cyan" | "violet" | "amber";

export function PageHeader({
  title, subtitle, actions, icon: Icon, accent = "lime", eyebrow,
}: { title: string; subtitle: string; actions?: ReactNode; icon?: LucideIcon; accent?: Accent; eyebrow?: string }) {
  return (
    <div className="relative mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 h-40 w-72 rounded-full blur-3xl" style={{ background: `rgb(var(--${accent}) / 0.10)` }} />
      <div className="relative flex max-w-2xl items-start gap-4">
        {Icon ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1" style={{ background: `linear-gradient(135deg, rgb(var(--${accent}) / 0.28), rgb(var(--${accent}) / 0.06))`, color: `rgb(var(--${accent}))`, boxShadow: `0 10px 30px -12px rgb(var(--${accent}) / 0.6)`, borderColor: "transparent", ["--tw-ring-color" as string]: `rgb(var(--${accent}) / 0.25)` }}>
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
        ) : null}
        <div>
          {eyebrow ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: `rgb(var(--${accent}))` }}>{eyebrow}</p> : null}
          <h1 className="text-gradient text-2xl font-semibold tracking-tight sm:text-[28px] sm:leading-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="relative flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
